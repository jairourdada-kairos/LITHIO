"""Tienda de Fe: cupones de descuento y vale «Pasar con 20».

El Fe gastado sale de `points` (saldo canjeable); `fe_lifetime` no baja,
así que canjear nunca hace perder nivel.
"""
import secrets
from datetime import datetime
from typing import Literal, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..auth import get_current_user, require_admin
from ..config import EVIDENCE_DIR
from ..database import get_db
from ..links_service import GIFT_COUPONS, STORE_DISCOUNT_LEVEL, user_z
from ..models import Coupon, GradeVoucher, PerkGrant, User
from ..realtime import manager
from .profile import _detect_format

router = APIRouter(prefix="/api", tags=["tienda-fe"])

COUPON_PRICES = {25: 150, 50: 300}
VOUCHER_COST = 500
MAX_EVIDENCE_BYTES = 4 * 1024 * 1024


def price(user: User, base: int) -> int:
    """Precio en Fe con el 10 % de descuento del nivel Hierro (Fe, Z=26) o superior."""
    return round(base * 0.9) if user_z(user) >= STORE_DISCOUNT_LEVEL else base


def grant_level_perks(db: Session, user: User) -> None:
    """Entrega una sola vez los cupones de regalo de los niveles alcanzados."""
    z = user_z(user)
    granted = {g.z for g in db.query(PerkGrant).filter(PerkGrant.user_id == user.id)}
    for level, percent in GIFT_COUPONS.items():
        if level <= z and level not in granted:
            db.add(PerkGrant(user_id=user.id, z=level))
            db.add(Coupon(user_id=user.id, percent=percent, fe_cost=0))
    db.commit()


def _spend_fe(user: User, cost: int) -> None:
    if (user.points or 0) < cost:
        raise HTTPException(
            status_code=400, detail=f"Fe insuficiente. Tienes {user.points or 0} Fe y necesitas {cost} Fe."
        )
    user.points -= cost


def coupon_payload(coupon: Coupon) -> dict:
    return {
        "id": coupon.id,
        "percent": coupon.percent,
        "status": coupon.status,
        "ride_id": coupon.ride_id,
        "created_at": coupon.created_at.isoformat() if coupon.created_at else None,
    }


def voucher_payload(voucher: GradeVoucher) -> dict:
    return {
        "id": voucher.id,
        "subject": voucher.subject,
        "note": voucher.note,
        "status": voucher.status,
        "review_note": voucher.review_note,
        "code": f"P20-{voucher.id:04d}" if voucher.status == "aprobado" else None,
        "created_at": voucher.created_at.isoformat() if voucher.created_at else None,
    }


@router.get("/fe-store")
def store(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    grant_level_perks(db, user)
    coupons = db.query(Coupon).filter(Coupon.user_id == user.id).order_by(Coupon.id.desc()).limit(20).all()
    vouchers = db.query(GradeVoucher).filter(GradeVoucher.user_id == user.id).order_by(GradeVoucher.id.desc()).all()
    return {
        "points": user.points or 0,
        "coupon_prices": [{"percent": p, "cost": price(user, c)} for p, c in COUPON_PRICES.items()],
        "voucher_cost": price(user, VOUCHER_COST),
        "store_discount": user_z(user) >= STORE_DISCOUNT_LEVEL,
        "coupons": [coupon_payload(c) for c in coupons],
        "vouchers": [voucher_payload(v) for v in vouchers],
    }


class CouponIn(BaseModel):
    percent: Literal[25, 50]


@router.post("/fe-store/coupons")
def buy_coupon(data: CouponIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    cost = price(user, COUPON_PRICES[data.percent])
    _spend_fe(user, cost)
    coupon = Coupon(user_id=user.id, percent=data.percent, fe_cost=cost)
    db.add(coupon)
    db.commit()
    return {"coupon": coupon_payload(coupon), "points": user.points}


@router.post("/fe-store/vouchers")
async def request_voucher(
    subject: str = Form(..., min_length=3, max_length=80),
    note: Optional[str] = Form(None, max_length=200),
    photo: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if db.query(GradeVoucher).filter(GradeVoucher.user_id == user.id, GradeVoucher.status == "pendiente").first():
        raise HTTPException(status_code=409, detail="Ya tienes un vale en revisión. Espera la respuesta del administrador.")
    data = await photo.read(MAX_EVIDENCE_BYTES + 1)
    if len(data) > MAX_EVIDENCE_BYTES:
        raise HTTPException(status_code=413, detail="La foto pesa más de 4 MB.")
    extension = _detect_format(data)
    if not extension:
        raise HTTPException(status_code=400, detail="Solo se aceptan fotos JPG, PNG o WEBP.")
    cost = price(user, VOUCHER_COST)
    _spend_fe(user, cost)

    EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
    filename = f"{user.id}-{secrets.token_hex(8)}.{extension}"
    (EVIDENCE_DIR / filename).write_bytes(data)
    voucher = GradeVoucher(
        user_id=user.id,
        subject=subject.strip(),
        note=(note or "").strip() or None,
        evidence_file=filename,
        fe_cost=cost,
    )
    db.add(voucher)
    db.commit()
    return {"voucher": voucher_payload(voucher), "points": user.points}


# ---------------- Administración ----------------

@router.get("/admin/vouchers", dependencies=[Depends(require_admin)])
def pending_vouchers(db: Session = Depends(get_db)):
    vouchers = db.query(GradeVoucher).filter(GradeVoucher.status == "pendiente").order_by(GradeVoucher.id).all()
    users = {u.id: u for u in db.query(User).filter(User.id.in_([v.user_id for v in vouchers])).all()}
    return [
        {**voucher_payload(v), "user_name": users[v.user_id].name if v.user_id in users else "—"}
        for v in vouchers
    ]


@router.get("/admin/vouchers/{voucher_id}/evidence", dependencies=[Depends(require_admin)])
def voucher_evidence(voucher_id: int, db: Session = Depends(get_db)):
    voucher = db.get(GradeVoucher, voucher_id)
    path = (EVIDENCE_DIR / voucher.evidence_file).resolve() if voucher else None
    if not path or path.parent != EVIDENCE_DIR.resolve() or not path.exists():
        raise HTTPException(status_code=404, detail="Evidencia no encontrada.")
    return FileResponse(path)


class VoucherReviewIn(BaseModel):
    action: Literal["aprobar", "rechazar"]
    note: Optional[str] = None


@router.put("/admin/vouchers/{voucher_id}", dependencies=[Depends(require_admin)])
async def review_voucher(voucher_id: int, data: VoucherReviewIn, db: Session = Depends(get_db)):
    voucher = db.get(GradeVoucher, voucher_id)
    if not voucher:
        raise HTTPException(status_code=404, detail="Vale no encontrado.")
    if voucher.status != "pendiente":
        raise HTTPException(status_code=409, detail="Este vale ya fue revisado.")
    voucher.status = "aprobado" if data.action == "aprobar" else "rechazado"
    voucher.review_note = (data.note or "").strip() or None
    voucher.reviewed_at = datetime.utcnow()
    if voucher.status == "rechazado":
        owner = db.get(User, voucher.user_id)
        owner.points = (owner.points or 0) + voucher.fe_cost  # Se devuelve el Fe retenido
    db.commit()
    payload = voucher_payload(voucher)
    await manager.send_personal_message({"type": "VOUCHER_UPDATED", "voucher": payload}, user_id=voucher.user_id)
    return payload
