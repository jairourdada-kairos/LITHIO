"""Páginas públicas que piden Google Play y Facebook: privacidad y eliminación de la cuenta.

El correo de contacto sale de CONTACT_EMAIL (en el .env); sin él, las páginas
indican cómo hacerlo desde la app.
"""
import html
import os
from pathlib import Path

from fastapi import APIRouter
from fastapi.responses import HTMLResponse

router = APIRouter(tags=["legal"])

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


@router.get("/privacidad", response_class=HTMLResponse, include_in_schema=False)
def privacy_policy():
    return _page("privacidad.html")


@router.get("/eliminar-cuenta", response_class=HTMLResponse, include_in_schema=False)
def delete_account_info():
    return _page("eliminar-cuenta.html")
