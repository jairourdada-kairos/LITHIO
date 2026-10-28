"""Reglas de verificación de conductores.

Un conductor se registra como postulante y solo puede recibir viajes,
aparecer en el directorio o usar su billetera de conductor cuando el
administrador aprueba su postulación (datos, inspección de la moto y luz verde).
"""
from fastapi import HTTPException
from sqlalchemy.orm import Session

from .models import DriverProfile, User

VERIFICATION_STEPS = ["pendiente", "en_revision", "inspeccion", "aprobado"]
VERIFICATION_STATUSES = set(VERIFICATION_STEPS) | {"rechazado"}

STATUS_MESSAGES = {
    "pendiente": "Recibimos tu postulación. Pronto empezaremos a revisar tus datos.",
    "en_revision": "Estamos verificando tus datos y documentos.",
    "inspeccion": "Tus datos están en orden. Te contactaremos para inspeccionar tu moto.",
    "aprobado": "¡Tu cuenta de conductor está activa!",
    "rechazado": "Tu postulación no fue aprobada. Revisa la nota del administrador.",
}


def driver_profile(db: Session, user: User) -> DriverProfile | None:
    return db.query(DriverProfile).filter(DriverProfile.user_id == user.id).first()


def is_approved(profile: DriverProfile | None) -> bool:
    return profile is not None and profile.verification_status == "aprobado"


def require_approved_driver(db: Session, user: User) -> DriverProfile:
    profile = driver_profile(db, user)
    if profile is None:
        raise HTTPException(status_code=403, detail="Esta cuenta no tiene perfil de conductor.")
    if not is_approved(profile):
        raise HTTPException(
            status_code=403,
            detail="Tu postulación de conductor aún está en revisión. Te avisaremos cuando sea aprobada.",
        )
    return profile


def application_payload(user: User, profile: DriverProfile) -> dict:
    status = profile.verification_status
    reached = VERIFICATION_STEPS.index(status) if status in VERIFICATION_STEPS else -1
    return {
        "user_id": user.id,
        "name": user.name,
        "last_name": user.last_name,
        "email": user.email,
        "status": status,
        "message": STATUS_MESSAGES.get(status, ""),
        "notes": profile.verification_notes,
        "inspection_date": profile.inspection_date,
        "submitted_at": profile.submitted_at.isoformat() if profile.submitted_at else None,
        "reviewed_at": profile.reviewed_at.isoformat() if profile.reviewed_at else None,
        "steps": [
            {"key": key, "done": reached >= index}
            for index, key in enumerate(VERIFICATION_STEPS)
        ],
        "moto": {
            "brand_model": profile.moto_brand_model,
            "color": profile.moto_color,
            "plate": profile.plate,
            "year": profile.moto_year,
            "helmet_provided": profile.helmet_provided,
        },
    }
