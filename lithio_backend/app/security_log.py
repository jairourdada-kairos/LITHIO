"""Blindaje del panel de administración.

- assert_admin_routes_protected: el servidor no arranca si alguna ruta con
  "/admin" en su dirección no exige require_admin. Así un endpoint nuevo
  olvidado nunca queda abierto.
- audit_admin_requests: escribe en logs/seguridad.log cada intento rechazado
  (sin sesión o sin permiso) y cada cambio que hace el administrador.
- add_security_headers: el panel no se puede incrustar en otra página
  (clickjacking) y el navegador no adivina tipos de archivo.
"""
import logging
from logging.handlers import RotatingFileHandler

from fastapi import FastAPI, Request
from fastapi.routing import APIRoute

from . import config
from .auth import require_admin
from .rate_limit import client_ip

security_logger = logging.getLogger("lithio.seguridad")

SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Content-Security-Policy": "frame-ancestors 'none'",
    "Referrer-Policy": "strict-origin-when-cross-origin",
}


def configure_security_log() -> None:
    if security_logger.handlers:
        return
    security_logger.setLevel(logging.INFO)
    security_logger.propagate = False
    formatter = logging.Formatter("%(asctime)s %(levelname)s %(message)s")
    console = logging.StreamHandler()
    console.setFormatter(formatter)
    security_logger.addHandler(console)
    try:
        config.LOG_DIR.mkdir(parents=True, exist_ok=True)
        file_handler = RotatingFileHandler(
            config.LOG_DIR / "seguridad.log", maxBytes=2_000_000, backupCount=5, encoding="utf-8"
        )
    except OSError:
        security_logger.warning("No se pudo abrir %s; el registro de seguridad solo va a la consola.", config.LOG_DIR)
        return
    file_handler.setFormatter(formatter)
    security_logger.addHandler(file_handler)


def is_admin_path(path: str) -> bool:
    return path.startswith("/api/") and "/admin" in path


def _api_routes(routes):
    """Rutas de la app, también las de cada APIRouter incluido."""
    for route in routes:
        included = getattr(route, "original_router", None)
        if included is not None:
            yield from _api_routes(included.routes)
        elif isinstance(route, APIRoute):
            yield route


def _depends_on(dependant, target) -> bool:
    return any(dep.call is target or _depends_on(dep, target) for dep in dependant.dependencies)


def unprotected_admin_routes(app: FastAPI) -> list[str]:
    return sorted(
        f"{','.join(sorted(route.methods))} {route.path}"
        for route in _api_routes(app.routes)
        if is_admin_path(route.path) and not _depends_on(route.dependant, require_admin)
    )


def assert_admin_routes_protected(app: FastAPI) -> None:
    missing = unprotected_admin_routes(app)
    if missing:
        raise RuntimeError("Rutas de administrador sin require_admin: " + "; ".join(missing))


async def audit_admin_requests(request: Request, call_next):
    response = await call_next(request)
    path = request.url.path
    if not is_admin_path(path):
        return response
    user_id = getattr(request.state, "security_user_id", None)
    who = f"usuario={user_id}" if user_id is not None else "sin sesión válida"
    where = f"{request.method} {path} ip={client_ip(request)}"
    if response.status_code in {401, 403}:
        security_logger.warning("ACCESO DENEGADO al panel (%s): %s %s", response.status_code, who, where)
    elif request.method != "GET" and response.status_code < 400:
        security_logger.info("Acción de administrador: %s %s -> %s", who, where, response.status_code)
    return response


async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    for header, value in SECURITY_HEADERS.items():
        response.headers.setdefault(header, value)
    return response
