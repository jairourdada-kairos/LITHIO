"""Foto de perfil y tabla de niveles."""
import secrets
from ..rate_limit import rate_limit
from datetime import datetime, timedelta, timezone
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
from ..models import User
from ..realtime import manager
from ..validation import normalize_person_name, normalize_phone
from .. import push_service

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
        "profile_updated_at": user.profile_updated_at.isoformat() if user.profile_updated_at else None,
        "next_edit_at": next_edit.isoformat() if next_edit and next_edit > datetime.utcnow() else None,
    }


@router.get("/users/me/profile")
def my_profile(user: User = Depends(get_current_user)):
    return profile_payload(user)


@router.put("/users/me/profile")
def update_profile(data: ProfileUpdateIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.profile_updated_at and datetime.utcnow() < user.profile_updated_at + PROFILE_EDIT_COOLDOWN:
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
    user.profile_updated_at = datetime.utcnow()
    db.commit()
    return profile_payload(user)


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
