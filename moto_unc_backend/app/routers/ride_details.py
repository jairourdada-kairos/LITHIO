"""Detalle de un viaje del historial y comprobante de pago.

El comprobante (captura del Pago Móvil) es privado: se guarda fuera de /media
y solo lo ven el pasajero, el conductor de ese viaje y el administrador.
"""
import json
import secrets
from ..rate_limit import rate_limit
from datetime import datetime

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from ..auth import get_current_user, is_admin
from ..config import EVIDENCE_DIR
from ..database import get_db
from ..models import Coupon, Ride, User
from ..realtime import manager
from .. import push_service
from .profile import _detect_format

router = APIRouter(prefix="/api/rides", tags=["historial"])

RECEIPT_DIR = EVIDENCE_DIR / "receipts"
MAX_RECEIPT_BYTES = 4 * 1024 * 1024


def ride_for(ride_id: int, user: User, db: Session) -> Ride:
    """El viaje, si quien pregunta participa en él (o es administrador)."""
    ride = db.get(Ride, ride_id)
    if not ride or (user.id not in {ride.passenger_id, ride.driver_id} and not is_admin(user)):
        raise HTTPException(status_code=404, detail="Viaje no encontrado.")
    return ride


def person(user: User) -> dict:
    return {"id": user.id, "name": user.name, "last_name": user.last_name, "avatar_url": user.avatar_url}


@router.get("/{ride_id}/detail")
def ride_detail(ride_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ride = ride_for(ride_id, user, db)
    profile = ride.driver.driver_profile
    coupon = db.query(Coupon).filter(Coupon.ride_id == ride.id).first()
    timeline = json.loads(ride.status_log) if ride.status_log else []
    if not timeline:
        # Viajes anteriores a la línea de tiempo: solo se conoce el inicio y el estado final.
        timeline = [{"status": "solicitado", "at": ride.created_at.isoformat()}]
        if ride.status != "solicitado":
            timeline.append({"status": ride.status, "at": None})
    review = ride.review
    return {
        "id": ride.id,
        "origin": ride.origin,
        "destination": ride.destination,
        "status": ride.status,
        "created_at": ride.created_at.isoformat() if ride.created_at else None,
        "is_scheduled": bool(ride.is_scheduled),
        "scheduled_time": ride.scheduled_time,
        "fare_amount": ride.fare_amount,
        "coupon_percent": coupon.percent if coupon else None,
        "payment_method": ride.payment_method,
        "payment_reference": ride.payment_reference,
        "has_receipt": bool(ride.receipt_file),
        "receipt_uploaded_at": ride.receipt_uploaded_at.isoformat() if ride.receipt_uploaded_at else None,
        "can_upload_receipt": user.id == ride.passenger_id and ride.payment_method == "pago_movil"
        and ride.status not in {"rechazado", "cancelado"},
        "fe_rewarded": ride.points_rewarded if ride.status == "completado" else 0,
        "timeline": timeline,
        "passenger": person(ride.passenger),
        "driver": {
            **person(ride.driver),
            "moto": profile.moto_brand_model if profile else None,
            "moto_color": profile.moto_color if profile else None,
            "plate": profile.plate if profile else None,
        },
        "review": {"rating": review.rating, "comment": review.comment, "badges": review.badges} if review else None,
        "viewer_role": "pasajero" if user.id == ride.passenger_id else "conductor" if user.id == ride.driver_id else "admin",
    }


@router.post("/{ride_id}/receipt", dependencies=[Depends(rate_limit("comprobantes", 10, 600))])
async def upload_receipt(
    ride_id: int,
    photo: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ride = ride_for(ride_id, user, db)
    if user.id != ride.passenger_id:
        raise HTTPException(status_code=403, detail="Solo el pasajero puede adjuntar el comprobante.")
    if ride.payment_method != "pago_movil":
        raise HTTPException(status_code=400, detail="Este viaje no se pagó por Pago Móvil.")
    if ride.status in {"rechazado", "cancelado"}:
        raise HTTPException(status_code=400, detail="El viaje no se realizó; no hace falta comprobante.")
    data = await photo.read(MAX_RECEIPT_BYTES + 1)
    if len(data) > MAX_RECEIPT_BYTES:
        raise HTTPException(status_code=413, detail="La foto pesa más de 4 MB.")
    extension = _detect_format(data)
    if not extension:
        raise HTTPException(status_code=400, detail="Solo se aceptan fotos JPG, PNG o WEBP.")

    RECEIPT_DIR.mkdir(parents=True, exist_ok=True)
    filename = f"{ride.id}-{secrets.token_hex(8)}.{extension}"
    (RECEIPT_DIR / filename).write_bytes(data)
    old = ride.receipt_file
    ride.receipt_file = filename
    ride.receipt_uploaded_at = datetime.utcnow()
    db.commit()
    if old:
        old_path = (RECEIPT_DIR / old).resolve()
        if old_path.parent == RECEIPT_DIR.resolve() and old_path.exists():
            old_path.unlink()
    await manager.send_personal_message(
        {"type": "RIDE_RECEIPT_UPLOADED", "ride_id": ride.id}, user_id=ride.driver_id
    )
    push_service.notify(
        db, ride.driver_id, "Comprobante de pago recibido",
        f"{ride.passenger.name} adjuntó la captura del Pago Móvil del viaje #{ride.id}.",
        {"type": "RIDE_RECEIPT_UPLOADED", "ride_id": ride.id},
    )
    return {"has_receipt": True, "receipt_uploaded_at": ride.receipt_uploaded_at.isoformat()}


@router.get("/{ride_id}/receipt")
def get_receipt(ride_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ride = ride_for(ride_id, user, db)
    path = (RECEIPT_DIR / ride.receipt_file).resolve() if ride.receipt_file else None
    if not path or path.parent != RECEIPT_DIR.resolve() or not path.exists():
        raise HTTPException(status_code=404, detail="Este viaje no tiene comprobante.")
    return FileResponse(path)
