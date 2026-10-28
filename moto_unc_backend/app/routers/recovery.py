"""Recuperar la cuenta sin haber iniciado sesión.

"Olvidé mi correo": con la cédula o con el número de teléfono se encuentra la
cuenta (índices ciegos, sin descifrar nada) y Firebase envía a ese correo el
enlace para crear una contraseña nueva. La respuesta solo muestra el correo
parcialmente oculto, así que saber una cédula o un teléfono ajeno no revela el
correo completo de nadie.

("Olvidé mi contraseña" con el correo conocido lo hace la app directo con
Firebase.)
"""
import json
import logging
import os
import urllib.error
import urllib.request

from fastapi import APIRouter, Depends, HTTPException
from typing import Optional

from pydantic import BaseModel, Field, field_validator, model_validator
from sqlalchemy.orm import Session

from .. import crypto, validation
from ..database import get_db
from ..models import User, phone_fingerprint
from ..rate_limit import rate_limit_by_ip

router = APIRouter(prefix="/api/auth", tags=["recuperacion"])
logger = logging.getLogger(__name__)


def mask_email(email: str) -> str:
    """jairourdada@gmail.com -> j*********a@gmail.com"""
    local, _, domain = email.partition("@")
    if len(local) <= 2:
        hidden = local[0] + "*" * (len(local) - 1)
    else:
        hidden = local[0] + "*" * (len(local) - 2) + local[-1]
    return f"{hidden}@{domain}"


def send_password_reset(email: str) -> None:
    """Pide a Firebase que envíe el correo de "restablecer contraseña" (en español)."""
    api_key = os.getenv("FIREBASE_WEB_API_KEY", "")
    if not api_key:
        raise HTTPException(status_code=503, detail="La recuperación de cuenta no está configurada en el servidor.")
    request = urllib.request.Request(
        f"https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key={api_key}",
        data=json.dumps({"requestType": "PASSWORD_RESET", "email": email}).encode(),
        headers={"Content-Type": "application/json", "X-Firebase-Locale": "es"},
    )
    try:
        with urllib.request.urlopen(request, timeout=10):
            pass
    except (urllib.error.URLError, OSError) as error:
        logger.warning("Firebase no envió el correo de recuperación: %s", error)
        raise HTTPException(status_code=503, detail="No se pudo enviar el correo ahora. Intenta en unos minutos.") from None


class RecoverIn(BaseModel):
    """Una de las dos: cédula o teléfono."""
    cedula: Optional[str] = Field(default=None, min_length=6, max_length=14)
    phone: Optional[str] = Field(default=None, min_length=7, max_length=20)

    @field_validator("cedula")
    @classmethod
    def _cedula(cls, value: Optional[str]) -> Optional[str]:
        return validation.normalize_cedula(value) if value else None

    @field_validator("phone")
    @classmethod
    def _phone(cls, value: Optional[str]) -> Optional[str]:
        return validation.normalize_phone(value) if value else None

    @model_validator(mode="after")
    def _one_of(self):
        if bool(self.cedula) == bool(self.phone):
            raise ValueError("Escribe tu cédula o tu número de teléfono.")
        return self


@router.post("/recover", dependencies=[Depends(rate_limit_by_ip("recuperacion", 5, 600))])
def recover_account(data: RecoverIn, db: Session = Depends(get_db)):
    if data.cedula:
        user = db.query(User).filter(User.cedula_hash == crypto.blind_index(data.cedula)).first()
        not_found = "No encontramos una cuenta con esa cédula. Revisa el número o regístrate."
    else:
        matches = db.query(User).filter(User.phone_hash == phone_fingerprint(data.phone)).limit(2).all()
        if len(matches) > 1:
            raise HTTPException(
                status_code=409,
                detail="Ese teléfono está en más de una cuenta. Recupera la tuya con tu cédula.",
            )
        user = matches[0] if matches else None
        not_found = "No encontramos una cuenta con ese teléfono. Revisa el número o usa tu cédula."
    if not user or not user.email:
        raise HTTPException(status_code=404, detail=not_found)
    send_password_reset(user.email)
    return {"masked_email": mask_email(user.email)}
