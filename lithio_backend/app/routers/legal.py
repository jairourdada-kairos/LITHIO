"""Marco legal de LITHIO: Términos y Condiciones, Política de privacidad y
eliminación de la cuenta (las dos últimas también las pide Google Play).

Cada usuario acepta una versión (config.LEGAL_VERSION): al registrarse o,
si el texto cambió, en la pantalla que la app muestra al entrar. El servidor
guarda la versión y la fecha, y no deja pedir viajes ni mover diamantes sin
aceptar la vigente.

El correo de contacto sale de CONTACT_EMAIL (en el .env); sin él, las páginas
indican cómo hacerlo desde la app.
"""
import html
import os
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from .. import config
from ..auth import get_current_user
from ..database import get_db
from ..models import User
from ..timeutil import utcnow

router = APIRouter(tags=["legal"])

TERMS_REQUIRED_HEADERS = {"X-Terms-Required": "1"}


def record_acceptance(user: User, version: str) -> None:
    user.terms_version = version
    user.terms_accepted_at = utcnow()


def require_current_terms(user: User = Depends(get_current_user)) -> User:
    """Para pedir viajes, atenderlos o mover diamantes hay que aceptar los Términos vigentes."""
    if user.terms_version != config.LEGAL_VERSION:
        raise HTTPException(
            status_code=403,
            detail="Acepta los Términos y Condiciones y la Política de privacidad vigentes para continuar.",
            headers=TERMS_REQUIRED_HEADERS,
        )
    return user


class AcceptTermsIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    version: str = Field(max_length=20)


@router.get("/api/legal")
def legal_info():
    return {"version": config.LEGAL_VERSION, "terms_url": "/terminos", "privacy_url": "/privacidad"}


@router.post("/api/legal/accept")
def accept_terms(data: AcceptTermsIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if data.version != config.LEGAL_VERSION:
        raise HTTPException(status_code=409, detail="Los Términos cambiaron mientras los leías. Ábrelos de nuevo.")
    record_acceptance(user, data.version)
    db.commit()
    return {"version": user.terms_version, "accepted_at": user.terms_accepted_at.isoformat()}

PAGES_DIR = Path(__file__).resolve().parent.parent / "legal"


def _contact() -> str:
    email = os.getenv("CONTACT_EMAIL", "").strip()
    if email:
        safe = html.escape(email)
        return f'escríbenos a <a href="mailto:{safe}">{safe}</a> desde el correo de tu cuenta.'
    return "escríbele al administrador de LITHIO desde el correo de tu cuenta, o elimínala desde la app."


def _page(name: str) -> HTMLResponse:
    text = (PAGES_DIR / name).read_text(encoding="utf-8")
    return HTMLResponse(text.replace("{contacto}", _contact()))


@router.get("/terminos", response_class=HTMLResponse, include_in_schema=False)
def terms_and_conditions():
    return _page("terminos.html")


@router.get("/privacidad", response_class=HTMLResponse, include_in_schema=False)
def privacy_policy():
    return _page("privacidad.html")


@router.get("/eliminar-cuenta", response_class=HTMLResponse, include_in_schema=False)
def delete_account_info():
    return _page("eliminar-cuenta.html")
