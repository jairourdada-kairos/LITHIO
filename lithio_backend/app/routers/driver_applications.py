"""Postulación de conductores: el conductor sigue su estado y el
administrador revisa datos, cita la inspección de la moto y da la luz verde."""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..auth import get_current_user, require_admin
from ..database import get_db
from ..drivers import VERIFICATION_STATUSES, application_payload, driver_profile
from ..models import DriverProfile, User
from ..realtime import manager
from .. import push_service
from ..timeutil import utcnow

router = APIRouter(prefix="/api", tags=["postulación de conductores"])


class ApplicationReviewIn(BaseModel):
    status: str
    notes: Optional[str] = Field(default=None, max_length=500)
    inspection_date: Optional[str] = Field(default=None, max_length=60)


@router.get("/drivers/me/application")
def my_application(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    profile = driver_profile(db, user)
    if not profile:
        raise HTTPException(status_code=404, detail="No tienes una postulación de conductor.")
    return application_payload(user, profile)


@router.get("/admin/driver-applications", dependencies=[Depends(require_admin)])
def list_applications(status: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(DriverProfile).join(User)
    if status:
        query = query.filter(DriverProfile.verification_status == status)
    else:
        query = query.filter(DriverProfile.verification_status != "aprobado")
    result = []
    for profile in query.order_by(DriverProfile.submitted_at).all():
        item = application_payload(profile.user, profile)
        # Datos que el administrador necesita para verificar la identidad.
        item.update({
            "phone": profile.user.phone,
            "cedula": profile.user.cedula,
            "career": profile.user.career,
            "semester": profile.user.semester,
            "license_number": profile.license_number,
        })
        result.append(item)
    return result


@router.put("/admin/driver-applications/{user_id}", dependencies=[Depends(require_admin)])
async def review_application(user_id: int, data: ApplicationReviewIn, db: Session = Depends(get_db)):
    if data.status not in VERIFICATION_STATUSES:
        raise HTTPException(status_code=400, detail="Estado de postulación no válido.")
    profile = db.query(DriverProfile).filter(DriverProfile.user_id == user_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Postulación no encontrada.")
    profile.verification_status = data.status
    if data.notes is not None:
        profile.verification_notes = data.notes
    if data.inspection_date is not None:
        profile.inspection_date = data.inspection_date
    profile.reviewed_at = utcnow()
    if data.status != "aprobado":
        profile.is_available = False
    db.commit()
    payload = application_payload(profile.user, profile)
    # El conductor ve el cambio al instante si tiene la app abierta.
    await manager.send_personal_message({"type": "DRIVER_APPLICATION_UPDATED", "application": payload}, user_id=user_id)
    messages = {
        "en_revision": ("Revisamos tu postulación", "Estamos verificando tus datos de conductor."),
        "inspeccion": ("Cita de inspección", f"Revisaremos tu moto: {profile.inspection_date or 'te contactaremos'}."),
        "aprobado": ("¡Luz verde, conductor!", "Tu cuenta está activa. Ya puedes recibir viajes en LITHIO."),
        "rechazado": ("Tu postulación necesita cambios", profile.verification_notes or "Revisa la nota en la app."),
    }
    if data.status in messages:
        title, body = messages[data.status]
        push_service.notify(db, user_id, title, body, {"type": "DRIVER_APPLICATION_UPDATED"})
    return payload


@router.get("/admin/drivers", dependencies=[Depends(require_admin)])
def list_all_drivers(db: Session = Depends(get_db)):
    """Todos los conductores, en cualquier estado de verificación (panel web)."""
    profiles = db.query(DriverProfile).join(User).order_by(User.name).all()
    return [
        {
            **application_payload(profile.user, profile),
            "phone": profile.user.phone,
            "is_available": bool(profile.is_available),
            "rating_avg": profile.rating_avg,
            "trips_count": profile.trips_count,
        }
        for profile in profiles
    ]
