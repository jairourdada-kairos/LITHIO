"""Recuperar la cuenta sin haber iniciado sesión.

"Olvidé mi correo": con la cédula se encuentra la cuenta (índice ciego, sin
descifrar nada) y Firebase envía a ese correo el enlace para crear una
contraseña nueva. La respuesta solo muestra el correo parcialmente oculto, así
que saber una cédula ajena no revela el correo completo de nadie.

("Olvidé mi contraseña" con el correo conocido lo hace la app directo con
Firebase.)
"""
import json
import logging
import os
import urllib.error
import urllib.request

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from .. import crypto, validation
from ..database import get_db
from ..models import User
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
    cedula: str = Field(min_length=6, max_length=14)

    @field_validator("cedula")
    @classmethod
    def _cedula(cls, value: str) -> str:
        return validation.normalize_cedula(value)


@router.post("/recover", dependencies=[Depends(rate_limit_by_ip("recuperacion", 5, 600))])
def recover_account(data: RecoverIn, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.cedula_hash == crypto.blind_index(data.cedula)).first()
    if not user or not user.email:
        raise HTTPException(status_code=404, detail="No encontramos una cuenta con esa cédula. Revisa el número o regístrate.")
    send_password_reset(user.email)
    return {"masked_email": mask_email(user.email)}
