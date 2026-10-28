"""Foto de perfil y tabla de niveles."""
import secrets
from ..rate_limit import rate_limit
from datetime import timedelta, timezone
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel, ConfigDict, EmailStr
from sqlalchemy import func
from sqlalchemy.orm import Session

from .. import auth as auth_module
from ..auth import get_current_user, get_current_user_any_session
from ..config import MEDIA_DIR, VENEZUELA_TZ
from ..database import get_db
from ..links_service import ELEMENTS, LEVEL_PERKS, level_for, threshold_for
from ..models import DriverProfile, Link, Ride, User, WalletTransaction
from ..wallet_service import as_diamonds
from ..realtime import manager
from ..validation import email_domain_allowed, format_cedula, normalize_person_name, normalize_phone
from .. import push_service
from ..timeutil import utcnow

router = APIRouter(prefix="/api", tags=["perfil"])

AVATAR_DIR = MEDIA_DIR / "avatars"
MAX_AVATAR_BYTES = 2 * 1024 * 1024

# Se valida por la firma del archivo, no por la extensión ni por el tipo que declare el cliente.
_SIGNATURES = {
    "jpg": lambda data: data[:3] == b"\xff\xd8\xff",
    "png": lambda data: data[:8] == b"\x89PNG\r\n\x1a\n",
    "webp": lambda data: data[:4] == b"RIFF" and data[8:12] == b"WEBP",
}


def _detect_format(data: bytes) -> str | None:
    for extension, matches in _SIGNATURES.items():
        if matches(data):
            return extension
    return None


def commit_or_discard(db: Session, written: Path) -> None:
    """Guarda en la base de datos; si falla, borra el archivo recién escrito para no dejar huérfanos."""
    try:
        db.commit()
    except Exception:
        db.rollback()
        written.unlink(missing_ok=True)
        raise


def _delete_local_avatar(url: str | None) -> None:
    """Borra la foto anterior si la guardó LITHIO (no toca enlaces externos)."""
    if not url or not url.startswith("/media/avatars/"):
        return
    path = (AVATAR_DIR / Path(url).name).resolve()
    if path.parent == AVATAR_DIR.resolve() and path.exists():
        path.unlink()


@router.post("/users/me/avatar", dependencies=[Depends(rate_limit("fotos", 10, 600))])
async def upload_avatar(
    photo: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    data = await photo.read(MAX_AVATAR_BYTES + 1)
    if len(data) > MAX_AVATAR_BYTES:
        raise HTTPException(status_code=413, detail="La foto pesa más de 2 MB. Elige otra o recórtala.")
    extension = _detect_format(data)
    if not extension:
        raise HTTPException(status_code=400, detail="Solo se aceptan fotos JPG, PNG o WEBP.")

    AVATAR_DIR.mkdir(parents=True, exist_ok=True)
    filename = f"{user.id}-{secrets.token_hex(8)}.{extension}"
    (AVATAR_DIR / filename).write_bytes(data)
    previous = user.avatar_url
    user.avatar_url = f"/media/avatars/{filename}"
    commit_or_discard(db, AVATAR_DIR / filename)
    # La foto anterior se borra solo cuando la nueva quedó guardada.
    _delete_local_avatar(previous)
    return {"avatar_url": user.avatar_url}


@router.delete("/users/me/avatar")
def delete_avatar(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _delete_local_avatar(user.avatar_url)
    user.avatar_url = None
    db.commit()
    return {"avatar_url": None}


@router.get("/levels")
def levels(user: User = Depends(get_current_user)):
    """Los 36 elementos con su Fe necesario, beneficio y si ya los alcanzaste."""
    fe = user.fe_lifetime or 0
    current = level_for(fe)
    return {
        "current": current,
        "elements": [
            {
                "z": z,
                "symbol": symbol,
                "name": name,
                "threshold": threshold_for(z),
                "perk": LEVEL_PERKS.get(z),
                "unlocked": fe >= threshold_for(z),
                "current": z == current["z"],
            }
            for z, (symbol, name) in enumerate(ELEMENTS, start=1)
        ],
    }


@router.post("/sessions", status_code=201, dependencies=[Depends(rate_limit("sesiones", 10, 300))])
async def start_session(user: User = Depends(get_current_user_any_session), db: Session = Depends(get_db)):
    """Inicia sesión en este dispositivo y cierra la de cualquier otro.

    Política de sesión única: el último dispositivo que entra se queda con la
    cuenta. Los demás reciben SESSION_REPLACED por WebSocket y, en adelante,
    sus peticiones con el identificador viejo responden 401.
    """
    user.active_session_id = secrets.token_urlsafe(24)
    # El teléfono anterior deja de recibir notificaciones; el nuevo registra su token.
    user.push_token = None
    db.commit()
    await manager.close_other_sessions(user.id, user.active_session_id)
    return {"session_id": user.active_session_id}


# ---------------- Datos personales (una edición cada 7 días) ----------------

PROFILE_EDIT_COOLDOWN = timedelta(days=7)


class ProfileUpdateIn(BaseModel):
    model_config = ConfigDict(extra="forbid")  # La cédula y el rol no se editan aquí.
    name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None


def profile_payload(user: User) -> dict:
    next_edit = user.profile_updated_at + PROFILE_EDIT_COOLDOWN if user.profile_updated_at else None
    return {
        "name": user.name,
        "last_name": user.last_name,
        "email": user.email,
        "phone": user.phone,
        # Solo el dueño ve su cédula completa (la app la muestra tras tocar "Mostrar").
        "cedula": format_cedula(user.cedula) if user.cedula else None,
        "career": user.career,
        "semester": user.semester,
        "profile_updated_at": user.profile_updated_at.isoformat() if user.profile_updated_at else None,
        "next_edit_at": next_edit.isoformat() if next_edit and next_edit > utcnow() else None,
    }


@router.get("/users/me/profile")
def my_profile(user: User = Depends(get_current_user)):
    return profile_payload(user)


@router.put("/users/me/profile")
def update_profile(data: ProfileUpdateIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.profile_updated_at and utcnow() < user.profile_updated_at + PROFILE_EDIT_COOLDOWN:
        available = (user.profile_updated_at + PROFILE_EDIT_COOLDOWN).replace(tzinfo=timezone.utc).astimezone(VENEZUELA_TZ)
        raise HTTPException(
            status_code=429,
            detail=f"Solo puedes cambiar tus datos una vez cada 7 días. Podrás hacerlo de nuevo el {available:%d/%m/%Y a las %I:%M %p}.",
        )

    changes = {}
    try:
        if data.name is not None:
            changes["name"] = normalize_person_name(data.name, "El nombre")
        if data.last_name is not None:
            changes["last_name"] = normalize_person_name(data.last_name, "El apellido")
        if data.phone is not None:
            changes["phone"] = normalize_phone(data.phone)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from None
    if data.email is not None:
        changes["email"] = str(data.email).strip().lower()
        if not email_domain_allowed(changes["email"]):
            raise HTTPException(status_code=400, detail="LITHIO solo acepta cuentas reales de Gmail. Usa un correo @gmail.com.")
    changes = {field: value for field, value in changes.items() if value != getattr(user, field)}
    if not changes:
        raise HTTPException(status_code=400, detail="No cambiaste ningún dato.")

    if "email" in changes:
        taken = db.query(User).filter(func.lower(User.email) == changes["email"], User.id != user.id).first()
        if taken:
            raise HTTPException(status_code=409, detail="Ese correo ya lo usa otra cuenta.")
        if user.firebase_uid:
            auth_module.update_firebase_email(user.firebase_uid, changes["email"])

    for field, value in changes.items():
        setattr(user, field, value)
    user.profile_updated_at = utcnow()
    db.commit()
    return profile_payload(user)


# ---------------- Eliminar la cuenta ----------------

OPEN_RIDE_STATUSES = ("solicitado", "aceptado", "en_camino", "en_curso")


@router.delete("/users/me")
def delete_my_account(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Elimina la cuenta: borra los datos personales y el acceso.

    Los viajes, reseñas y movimientos de la billetera quedan, pero sin nada que
    identifique a la persona (el otro participante y la contabilidad los necesitan).
    """
    if auth_module.is_admin(user):
        raise HTTPException(status_code=400, detail="La cuenta del administrador no se puede eliminar desde la app.")
    open_ride = db.query(Ride.id).filter(
        (Ride.passenger_id == user.id) | (Ride.driver_id == user.id),
        Ride.status.in_(OPEN_RIDE_STATUSES),
    ).first()
    if open_ride:
        raise HTTPException(status_code=409, detail="Termina o cancela tu viaje antes de eliminar la cuenta.")
    if (user.diamonds_cents or 0) > 0:
        raise HTTPException(
            status_code=409,
            detail=f"Tienes ◆ {as_diamonds(user.diamonds_cents):.2f} en tu billetera. Retíralos o dónalos antes de eliminar la cuenta.",
        )
    if db.query(WalletTransaction.id).filter(WalletTransaction.user_id == user.id, WalletTransaction.status == "pendiente").first():
        raise HTTPException(status_code=409, detail="Tienes un movimiento de la billetera en revisión. Espera a que se resuelva.")

    if user.firebase_uid:
        auth_module.delete_firebase_user(user.firebase_uid)
    _delete_local_avatar(user.avatar_url)

    db.query(Link).filter((Link.requester_id == user.id) | (Link.addressee_id == user.id)).delete(synchronize_session=False)
    profile = db.query(DriverProfile).filter(DriverProfile.user_id == user.id).first()
    if profile:
        profile.is_available = False
        profile.verification_status = "eliminado"  # Sale del directorio de conductores
        for field in ("license_number", "binance_address", "mobile_payment_number", "mobile_payment_bank",
                      "mobile_payment_id", "bank_account_number", "verification_notes"):
            setattr(profile, field, None)

    user.name = "Usuario eliminado"
    user.last_name = None
    user.age = None
    user.email = f"eliminado-{user.id}@lithio.invalid"
    user.phone = ""
    user.cedula = None
    user.cedula_hash = None
    user.career = None
    user.semester = None
    user.avatar_url = None
    user.firebase_uid = None
    user.push_token = None
    user.active_session_id = None
    db.commit()
    return {"deleted": True}


# ---------------- Notificaciones push ----------------

class PushTokenIn(BaseModel):
    token: Optional[str] = None


@router.put("/users/me/push-token")
def set_push_token(data: PushTokenIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Registra (o borra, con token vacío) el dispositivo que recibe las notificaciones."""
    token = (data.token or "").strip() or None
    if token and not push_service.is_valid_token(token):
        raise HTTPException(status_code=422, detail="Token de notificaciones no válido.")
    if token:
        # Un mismo teléfono con otra cuenta: solo la última cuenta recibe sus avisos.
        db.query(User).filter(User.push_token == token, User.id != user.id).update({"push_token": None})
    user.push_token = token
    db.commit()
    return {"registered": bool(token)}
