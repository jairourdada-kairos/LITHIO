"""Billetera de diamantes: saldo, recargas, envíos a enlaces, donaciones al
Fondo Solidario, retiros y canjes del taller aliado para conductores.

Las recargas y las donaciones por Pago Móvil se pagan al Pago Móvil del
administrador (los datos de su perfil de conductor), llevan la captura del
pago y quedan en revisión hasta que el administrador las aprueba."""
import secrets
from ..rate_limit import rate_limit
from typing import Literal, Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from .. import wallet_service as wallet
from ..admin_alerts import alert_admins
from ..auth import admin_users, get_current_user, is_admin, require_admin
from ..config import EVIDENCE_DIR
from ..database import get_db
from ..drivers import require_approved_driver
from ..links_service import are_linked
from ..models import DriverProfile, User, WalletTransaction, WorkshopReward
from ..realtime import manager
from .. import push_service
from .profile import _detect_format, commit_or_discard

RECEIPT_DIR = EVIDENCE_DIR / "wallet"
MAX_RECEIPT_BYTES = 4 * 1024 * 1024
# Movimientos que el administrador revisa a mano.
REVIEWED_KINDS = {"recarga", "donacion_pm", "retiro", "taller"}
# Movimientos que se pagan por Pago Móvil y llevan captura.
RECEIPT_KINDS = {"recarga", "donacion_pm"}

router = APIRouter(prefix="/api", tags=["billetera"])

KIND_LABELS = {
    "recarga": "Recarga",
    "retiro": "Retiro",
    "envio": "Envío",
    "recepcion": "Recibido",
    "donacion": "Donación al Fondo Solidario",
    "donacion_pm": "Donación por Pago Móvil",
    "pago_viaje": "Pago de viaje",
    "cobro_viaje": "Cobro de viaje",
    "taller": "Canje en el taller",
}


class TransactionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    kind: str
    label: str = ""
    amount: float = 0
    status: str
    counterpart_name: Optional[str] = None
    note: Optional[str] = None
    has_receipt: bool = False
    created_at: str = ""


class AmountIn(BaseModel):
    amount: float = Field(gt=0, le=500)


class TopupIn(AmountIn):
    reference: str = Field(min_length=4, max_length=30)


class DonationIn(AmountIn):
    method: Literal["diamantes", "pago_movil"] = "diamantes"
    reference: Optional[str] = Field(default=None, min_length=4, max_length=30)


class CreditIn(AmountIn):
    friend_code: str = Field(min_length=4, max_length=12)
    note: Optional[str] = Field(default=None, max_length=120)


class TransferIn(AmountIn):
    to_code: str = Field(min_length=4, max_length=12)
    note: Optional[str] = Field(default=None, max_length=80)


class WithdrawalIn(AmountIn):
    destination: str = Field(min_length=6, max_length=120, description="Pago Móvil o cuenta donde recibir")


class ReviewIn(BaseModel):
    action: Literal["aprobar", "rechazar"]
    note: Optional[str] = Field(default=None, max_length=200)


def serialize(db: Session, tx: WalletTransaction) -> TransactionOut:
    counterpart = db.get(User, tx.counterpart_id) if tx.counterpart_id else None
    return TransactionOut(
        id=tx.id,
        kind=tx.kind,
        label=KIND_LABELS.get(tx.kind, tx.kind),
        amount=wallet.as_diamonds(tx.amount_cents),
        status=tx.status,
        counterpart_name=counterpart.name if counterpart else None,
        note=tx.note,
        has_receipt=bool(tx.receipt_file),
        created_at=tx.created_at.isoformat() if tx.created_at else "",
    )


def pago_movil_destination(db: Session) -> Optional[dict]:
    """Pago Móvil donde se pagan recargas y donaciones: el del administrador."""
    for admin in admin_users(db):
        profile = db.query(DriverProfile).filter(DriverProfile.user_id == admin.id).first()
        if profile and profile.mobile_payment_number:
            return {
                "holder": " ".join(filter(None, [admin.name, admin.last_name])),
                "phone": profile.mobile_payment_number,
                "bank": profile.mobile_payment_bank,
                "id_number": profile.mobile_payment_id,
            }
    return None


def fund_stats(db: Session) -> dict:
    # Las donaciones con diamantes se guardan en negativo; las de Pago Móvil, en positivo.
    donated = db.query(func.coalesce(func.sum(func.abs(WalletTransaction.amount_cents)), 0)).filter(
        WalletTransaction.kind.in_(["donacion", "donacion_pm"]), WalletTransaction.status == "aprobado"
    ).scalar()
    donors = db.query(func.count(func.distinct(WalletTransaction.user_id))).filter(
        WalletTransaction.kind.in_(["donacion", "donacion_pm"]), WalletTransaction.status == "aprobado"
    ).scalar()
    return {"donated": wallet.as_diamonds(donated), "donors": donors}


@router.get("/wallet")
def get_wallet(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    transactions = (
        db.query(WalletTransaction)
        .filter(WalletTransaction.user_id == user.id)
        .order_by(WalletTransaction.id.desc())
        .limit(40)
        .all()
    )
    return {
        "balance": wallet.as_diamonds(user.diamonds_cents or 0),
        "points": user.points,
        "friend_code": user.friend_code,
        "transactions": [serialize(db, tx) for tx in transactions],
        "fund": fund_stats(db),
        "pago_movil": pago_movil_destination(db),
    }


@router.post("/wallet/topups", status_code=201, response_model=TransactionOut, dependencies=[Depends(rate_limit("billetera", 20, 600))])
async def request_topup(data: TopupIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    cents = wallet.to_cents(data.amount)
    if cents > wallet.MAX_TOPUP_CENTS:
        raise HTTPException(status_code=400, detail="La recarga máxima es de ◆ 500.")
    tx = wallet.record(
        db, user, "recarga", cents, status="pendiente",
        reference=data.reference.strip(), note="Pago Móvil en revisión",
    )
    db.commit()
    await alert_admins(
        db, "recarga", "Recarga por aprobar",
        f"{user.name} pidió una recarga de ◆ {data.amount:.2f} (ref. {data.reference.strip()}).", tx_id=tx.id,
    )
    return serialize(db, tx)


@router.post("/wallet/transfers", status_code=201, response_model=TransactionOut, dependencies=[Depends(rate_limit("billetera", 20, 600))])
async def transfer(data: TransferIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    cents = wallet.to_cents(data.amount)
    if cents > wallet.MAX_TRANSFER_CENTS:
        raise HTTPException(status_code=400, detail="El envío máximo es de ◆ 50.")
    recipient = db.query(User).filter(func.upper(User.friend_code) == data.to_code.strip().upper()).first()
    if not recipient or recipient.id == user.id:
        raise HTTPException(status_code=404, detail="No encontramos un enlace con ese código.")
    if not are_linked(db, user.id, recipient.id):
        raise HTTPException(status_code=403, detail="Solo puedes enviar diamantes a tus enlaces.")
    if wallet.outgoing_today_cents(db, user.id) + cents > wallet.MAX_DAILY_OUTGOING_CENTS:
        raise HTTPException(status_code=400, detail="Superas el límite diario de ◆ 100 en envíos y donaciones.")

    sender = wallet.lock_user(db, user.id)
    receiver = wallet.lock_user(db, recipient.id)
    sent = wallet.record(db, sender, "envio", -cents, counterpart_id=receiver.id, note=data.note)
    wallet.record(db, receiver, "recepcion", cents, counterpart_id=sender.id, note=data.note)
    db.commit()
    await manager.send_personal_message(
        {"type": "WALLET_UPDATED", "reason": "recepcion", "amount": wallet.as_diamonds(cents), "from": sender.name},
        user_id=receiver.id,
    )
    push_service.notify(
        db, receiver.id, f"Recibiste ◆ {wallet.as_diamonds(cents):.2f}",
        f"{sender.name} te envió diamantes." + (f" «{data.note}»" if data.note else ""),
        {"type": "WALLET_UPDATED"},
    )
    return serialize(db, sent)


@router.post("/wallet/donations", status_code=201, response_model=TransactionOut, dependencies=[Depends(rate_limit("billetera", 20, 600))])
async def donate(data: DonationIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    cents = wallet.to_cents(data.amount)
    if data.method == "pago_movil":
        if not data.reference:
            raise HTTPException(status_code=400, detail="Escribe la referencia del Pago Móvil.")
        if cents > wallet.MAX_TOPUP_CENTS:
            raise HTTPException(status_code=400, detail="La donación máxima por Pago Móvil es de ◆ 500.")
        # No suma al saldo de quien dona: va al Fondo Solidario cuando el administrador la confirma.
        tx = WalletTransaction(
            user_id=user.id, kind="donacion_pm", amount_cents=cents, status="pendiente",
            reference=data.reference.strip(), note="Fondo Solidario LITHIO · Pago Móvil en revisión",
        )
        db.add(tx)
        db.commit()
        await alert_admins(
            db, "donacion_pm", "Donación por confirmar",
            f"{user.name} donó ◆ {data.amount:.2f} por Pago Móvil (ref. {data.reference.strip()}).", tx_id=tx.id,
        )
        return serialize(db, tx)
    if wallet.outgoing_today_cents(db, user.id) + cents > wallet.MAX_DAILY_OUTGOING_CENTS:
        raise HTTPException(status_code=400, detail="Superas el límite diario de ◆ 100 en envíos y donaciones.")
    donor = wallet.lock_user(db, user.id)
    tx = wallet.record(db, donor, "donacion", -cents, note="Fondo Solidario LITHIO")
    db.commit()
    return serialize(db, tx)


@router.post("/wallet/withdrawals", status_code=201, response_model=TransactionOut, dependencies=[Depends(rate_limit("billetera", 20, 600))])
async def request_withdrawal(data: WithdrawalIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_approved_driver(db, user)
    driver = wallet.lock_user(db, user.id)
    tx = wallet.record(
        db, driver, "retiro", -wallet.to_cents(data.amount), status="pendiente",
        reference=data.destination.strip(), note="Retiro en revisión",
    )
    db.commit()
    await alert_admins(db, "retiro", "Retiro por pagar", f"{user.name} pidió retirar ◆ {data.amount:.2f}.", tx_id=tx.id)
    return serialize(db, tx)


@router.get("/wallet/workshop")
def workshop_catalog(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    items = db.query(WorkshopReward).filter(WorkshopReward.is_active.is_(True)).order_by(WorkshopReward.cost_cents).all()
    return [
        {"id": r.id, "title": r.title, "description": r.description, "cost": wallet.as_diamonds(r.cost_cents), "icon": r.icon}
        for r in items
    ]


@router.post("/wallet/workshop/{reward_id}/redeem", status_code=201, response_model=TransactionOut)
async def redeem_workshop(reward_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_approved_driver(db, user)
    reward = db.get(WorkshopReward, reward_id)
    if not reward or not reward.is_active:
        raise HTTPException(status_code=404, detail="Servicio no disponible.")
    driver = wallet.lock_user(db, user.id)
    tx = wallet.record(
        db, driver, "taller", -reward.cost_cents, status="pendiente",
        reward_id=reward.id, note=reward.title,
    )
    db.commit()
    await alert_admins(db, "taller", "Pedido del taller", f"{user.name} canjeó «{reward.title}» en el taller.", tx_id=tx.id)
    return serialize(db, tx)


def _own_receipt_tx(tx_id: int, user: User, db: Session) -> WalletTransaction:
    tx = db.get(WalletTransaction, tx_id)
    if not tx or (tx.user_id != user.id and not is_admin(user)):
        raise HTTPException(status_code=404, detail="Movimiento no encontrado.")
    return tx


@router.post("/wallet/transactions/{tx_id}/receipt", dependencies=[Depends(rate_limit("comprobantes", 10, 600))])
async def upload_wallet_receipt(
    tx_id: int,
    photo: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Captura del Pago Móvil de una recarga o donación en revisión."""
    tx = _own_receipt_tx(tx_id, user, db)
    if tx.user_id != user.id or tx.kind not in RECEIPT_KINDS:
        raise HTTPException(status_code=400, detail="Este movimiento no lleva comprobante.")
    if tx.status != "pendiente":
        raise HTTPException(status_code=409, detail="Este movimiento ya fue revisado.")
    data = await photo.read(MAX_RECEIPT_BYTES + 1)
    if len(data) > MAX_RECEIPT_BYTES:
        raise HTTPException(status_code=413, detail="La foto pesa más de 4 MB.")
    extension = _detect_format(data)
    if not extension:
        raise HTTPException(status_code=400, detail="Solo se aceptan fotos JPG, PNG o WEBP.")

    RECEIPT_DIR.mkdir(parents=True, exist_ok=True)
    filename = f"{tx.id}-{secrets.token_hex(8)}.{extension}"
    (RECEIPT_DIR / filename).write_bytes(data)
    old = tx.receipt_file
    tx.receipt_file = filename
    commit_or_discard(db, RECEIPT_DIR / filename)
    if old:
        old_path = (RECEIPT_DIR / old).resolve()
        if old_path.parent == RECEIPT_DIR.resolve() and old_path.exists():
            old_path.unlink()
    await alert_admins(
        db, "comprobante", "Comprobante recibido",
        f"{user.name} adjuntó la captura de su {KIND_LABELS[tx.kind].lower()}.", tx_id=tx.id,
    )
    return serialize(db, tx)


@router.get("/wallet/transactions/{tx_id}/receipt")
def get_wallet_receipt(tx_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    tx = _own_receipt_tx(tx_id, user, db)
    path = (RECEIPT_DIR / tx.receipt_file).resolve() if tx.receipt_file else None
    if not path or path.parent != RECEIPT_DIR.resolve() or not path.exists():
        raise HTTPException(status_code=404, detail="Este movimiento no tiene comprobante.")
    return FileResponse(path)


# --- Administración -----------------------------------------------------------

@router.get("/admin/wallet/pending", dependencies=[Depends(require_admin)])
def pending_transactions(db: Session = Depends(get_db)):
    """Recargas, donaciones por Pago Móvil, retiros y canjes del taller esperando revisión."""
    rows = (
        db.query(WalletTransaction)
        .filter(WalletTransaction.status == "pendiente", WalletTransaction.kind.in_(REVIEWED_KINDS))
        .order_by(WalletTransaction.id)
        .all()
    )
    result = []
    for tx in rows:
        owner = db.get(User, tx.user_id)
        item = serialize(db, tx).model_dump()
        item.update({
            "user_id": owner.id, "user_name": owner.name, "user_email": owner.email,
            "friend_code": owner.friend_code, "reference": tx.reference,
        })
        result.append(item)
    return result


@router.put("/admin/wallet/transactions/{tx_id}", dependencies=[Depends(require_admin)], response_model=TransactionOut)
async def review_transaction(tx_id: int, data: ReviewIn, db: Session = Depends(get_db)):
    tx = db.get(WalletTransaction, tx_id)
    if not tx or tx.kind not in REVIEWED_KINDS:
        raise HTTPException(status_code=404, detail="Movimiento no encontrado.")
    if data.action == "aprobar":
        wallet.approve(db, tx)
    else:
        wallet.reject(db, tx)
    if data.note:
        tx.note = data.note
    db.commit()
    await manager.send_personal_message(
        {"type": "WALLET_UPDATED", "reason": tx.kind, "status": tx.status, "amount": wallet.as_diamonds(tx.amount_cents)},
        user_id=tx.user_id,
    )
    label = {"recarga": "Recarga", "donacion_pm": "Donación", "retiro": "Retiro", "taller": "Canje del taller"}[tx.kind]
    amount = f"◆ {abs(wallet.as_diamonds(tx.amount_cents)):.2f}"
    if tx.status == "aprobado":
        push_service.notify(db, tx.user_id, f"{label} aprobado", f"Tu {label.lower()} de {amount} fue aprobado.", {"type": "WALLET_UPDATED"})
    else:
        push_service.notify(
            db, tx.user_id, f"{label} rechazado",
            data.note or f"Tu {label.lower()} de {amount} no fue aprobado.", {"type": "WALLET_UPDATED"},
        )
    return serialize(db, tx)


@router.post("/admin/wallet/credit", status_code=201, dependencies=[Depends(require_admin)], response_model=TransactionOut)
async def credit_diamonds(data: CreditIn, db: Session = Depends(get_db)):
    """Acredita diamantes a mano (p. ej. un Pago Móvil recibido sin solicitud en la app)."""
    target = db.query(User).filter(func.upper(User.friend_code) == data.friend_code.strip().upper()).first()
    if not target:
        raise HTTPException(status_code=404, detail="No hay ningún usuario con ese código.")
    cents = wallet.to_cents(data.amount)
    if cents > wallet.MAX_TOPUP_CENTS:
        raise HTTPException(status_code=400, detail="El máximo por acreditación es de ◆ 500.")
    tx = wallet.record(
        db, wallet.lock_user(db, target.id), "recarga", cents,
        note=(data.note or "").strip() or "Acreditado por el administrador",
    )
    db.commit()
    await manager.send_personal_message(
        {"type": "WALLET_UPDATED", "reason": "recarga", "status": "aprobado", "amount": data.amount}, user_id=target.id
    )
    push_service.notify(
        db, target.id, f"Recibiste ◆ {data.amount:.2f}", "El administrador acreditó diamantes en tu billetera.",
        {"type": "WALLET_UPDATED"},
    )
    return serialize(db, tx)


# ---------------- Catálogo del taller (administración) ----------------

class WorkshopIn(BaseModel):
    title: str = Field(min_length=3, max_length=80)
    description: Optional[str] = Field(default=None, max_length=200)
    cost: float = Field(gt=0, le=500)
    is_active: bool = True


def workshop_admin_payload(item: WorkshopReward) -> dict:
    return {
        "id": item.id,
        "title": item.title,
        "description": item.description,
        "cost": wallet.as_diamonds(item.cost_cents),
        "is_active": bool(item.is_active),
    }


@router.get("/admin/workshop", dependencies=[Depends(require_admin)])
def admin_workshop(db: Session = Depends(get_db)):
    return [workshop_admin_payload(r) for r in db.query(WorkshopReward).order_by(WorkshopReward.cost_cents).all()]


@router.post("/admin/workshop", status_code=201, dependencies=[Depends(require_admin)])
def create_workshop_item(data: WorkshopIn, db: Session = Depends(get_db)):
    item = WorkshopReward(title=data.title, description=data.description, cost_cents=wallet.to_cents(data.cost), is_active=data.is_active)
    db.add(item)
    db.commit()
    return workshop_admin_payload(item)


@router.put("/admin/workshop/{item_id}", dependencies=[Depends(require_admin)])
def update_workshop_item(item_id: int, data: WorkshopIn, db: Session = Depends(get_db)):
    item = db.get(WorkshopReward, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Servicio no encontrado.")
    item.title, item.description = data.title, data.description
    item.cost_cents, item.is_active = wallet.to_cents(data.cost), data.is_active
    db.commit()
    return workshop_admin_payload(item)


@router.delete("/admin/workshop/{item_id}", dependencies=[Depends(require_admin)])
def delete_workshop_item(item_id: int, db: Session = Depends(get_db)):
    item = db.get(WorkshopReward, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Servicio no encontrado.")
    # Si ya hay canjes que lo citan, solo se desactiva para no romper el historial.
    if db.query(WalletTransaction).filter(WalletTransaction.reward_id == item_id).first():
        item.is_active = False
    else:
        db.delete(item)
    db.commit()
    return {"ok": True}
