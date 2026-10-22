"""Foto de perfil y tabla de niveles."""
import secrets
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..config import MEDIA_DIR
from ..database import get_db
from ..links_service import ELEMENTS, LEVEL_PERKS, level_for, threshold_for
from ..models import User

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


def _delete_local_avatar(url: str | None) -> None:
    """Borra la foto anterior si la guardó LITHIO (no toca enlaces externos)."""
    if not url or not url.startswith("/media/avatars/"):
        return
    path = (AVATAR_DIR / Path(url).name).resolve()
    if path.parent == AVATAR_DIR.resolve() and path.exists():
        path.unlink()


@router.post("/users/me/avatar")
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
    _delete_local_avatar(user.avatar_url)
    user.avatar_url = f"/media/avatars/{filename}"
    db.commit()
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
