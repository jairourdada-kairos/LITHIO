"""Billetera de diamantes: saldo, recargas, envíos a enlaces, donaciones al
Fondo Solidario, retiros y canjes del taller aliado para conductores."""
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from .. import wallet_service as wallet
from ..auth import get_current_user, require_admin
from ..database import get_db
from ..drivers import require_approved_driver
from ..links_service import are_linked
from ..models import DriverProfile, User, WalletTransaction, WorkshopReward
from ..realtime import manager

router = APIRouter(prefix="/api", tags=["billetera"])

KIND_LABELS = {
    "recarga": "Recarga",
    "retiro": "Retiro",
    "envio": "Envío",
    "recepcion": "Recibido",
    "donacion": "Donación al Fondo Solidario",
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
    created_at: str = ""


class AmountIn(BaseModel):
    amount: float = Field(gt=0, le=500)


class TopupIn(AmountIn):
    reference: str = Field(min_length=4, max_length=30)


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
        created_at=tx.created_at.isoformat() if tx.created_at else "",
    )


def fund_stats(db: Session) -> dict:
    donated = db.query(func.coalesce(func.sum(WalletTransaction.amount_cents), 0)).filter(
        WalletTransaction.kind == "donacion", WalletTransaction.status == "aprobado"
    ).scalar()
    donors = db.query(func.count(func.distinct(WalletTransaction.user_id))).filter(
        WalletTransaction.kind == "donacion"
    ).scalar()
    return {"donated": wallet.as_diamonds(-donated), "donors": donors}


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
    }


@router.post("/wallet/topups", status_code=201, response_model=TransactionOut)
def request_topup(data: TopupIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    cents = wallet.to_cents(data.amount)
    if cents > wallet.MAX_TOPUP_CENTS:
        raise HTTPException(status_code=400, detail="La recarga máxima es de ◆ 500.")
    tx = wallet.record(
        db, user, "recarga", cents, status="pendiente",
        reference=data.reference.strip(), note="Pago Móvil en revisión",
    )
    db.commit()
    return serialize(db, tx)


@router.post("/wallet/transfers", status_code=201, response_model=TransactionOut)
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
    return serialize(db, sent)


@router.post("/wallet/donations", status_code=201, response_model=TransactionOut)
def donate(data: AmountIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    cents = wallet.to_cents(data.amount)
    if wallet.outgoing_today_cents(db, user.id) + cents > wallet.MAX_DAILY_OUTGOING_CENTS:
        raise HTTPException(status_code=400, detail="Superas el límite diario de ◆ 100 en envíos y donaciones.")
    donor = wallet.lock_user(db, user.id)
    tx = wallet.record(db, donor, "donacion", -cents, note="Fondo Solidario LITHIO")
    db.commit()
    return serialize(db, tx)


@router.post("/wallet/withdrawals", status_code=201, response_model=TransactionOut)
def request_withdrawal(data: WithdrawalIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_approved_driver(db, user)
    driver = wallet.lock_user(db, user.id)
    tx = wallet.record(
        db, driver, "retiro", -wallet.to_cents(data.amount), status="pendiente",
        reference=data.destination.strip(), note="Retiro en revisión",
    )
    db.commit()
    return serialize(db, tx)


@router.get("/wallet/workshop")
def workshop_catalog(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    items = db.query(WorkshopReward).filter(WorkshopReward.is_active.is_(True)).order_by(WorkshopReward.cost_cents).all()
    return [
        {"id": r.id, "title": r.title, "description": r.description, "cost": wallet.as_diamonds(r.cost_cents), "icon": r.icon}
        for r in items
    ]


@router.post("/wallet/workshop/{reward_id}/redeem", status_code=201, response_model=TransactionOut)
def redeem_workshop(reward_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
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
    return serialize(db, tx)


# --- Administración -----------------------------------------------------------

@router.get("/admin/wallet/pending", dependencies=[Depends(require_admin)])
def pending_transactions(db: Session = Depends(get_db)):
    """Recargas, retiros y canjes del taller esperando revisión."""
    rows = (
        db.query(WalletTransaction)
        .filter(WalletTransaction.status == "pendiente", WalletTransaction.kind.in_(["recarga", "retiro", "taller"]))
        .order_by(WalletTransaction.id)
        .all()
    )
    result = []
    for tx in rows:
        owner = db.get(User, tx.user_id)
        item = serialize(db, tx).model_dump()
        item.update({"user_id": owner.id, "user_name": owner.name, "user_email": owner.email, "reference": tx.reference})
        result.append(item)
    return result


@router.put("/admin/wallet/transactions/{tx_id}", dependencies=[Depends(require_admin)], response_model=TransactionOut)
async def review_transaction(tx_id: int, data: ReviewIn, db: Session = Depends(get_db)):
    tx = db.get(WalletTransaction, tx_id)
    if not tx or tx.kind not in {"recarga", "retiro", "taller"}:
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
