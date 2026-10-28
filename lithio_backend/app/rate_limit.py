"""Límite de peticiones por usuario en las acciones sensibles.

Se cuenta por cuenta de Firebase (uid), no por IP: detrás del túnel de
Cloudflare todas las peticiones llegan desde la misma dirección local, y
limitar por IP bloquearía a todos los usuarios a la vez.

En memoria del proceso (el servidor corre con una sola instancia; con varias
haría falta Redis, como para el WebSocket).
"""
import threading
import time
from collections import defaultdict, deque

from fastapi import Depends, HTTPException, Request

from .auth import FirebaseIdentity, get_firebase_identity

_lock = threading.Lock()
_hits: dict[tuple[str, str], deque] = defaultdict(deque)


def reset() -> None:
    """Vacía los contadores (pruebas)."""
    with _lock:
        _hits.clear()


def _hit(action: str, who: str, max_calls: int, per_seconds: int) -> None:
    now = time.monotonic()
    with _lock:
        calls = _hits[(action, who)]
        while calls and now - calls[0] > per_seconds:
            calls.popleft()
        if len(calls) >= max_calls:
            retry = int(per_seconds - (now - calls[0])) + 1
            raise HTTPException(
                status_code=429,
                detail=f"Demasiados intentos seguidos. Espera {max(retry // 60, 1)} min e intenta de nuevo.",
                headers={"Retry-After": str(retry)},
            )
        calls.append(now)


def rate_limit(action: str, max_calls: int, per_seconds: int):
    """Dependencia de FastAPI: máximo `max_calls` de `action` por usuario cada `per_seconds`."""

    def dependency(identity: FirebaseIdentity = Depends(get_firebase_identity)) -> None:
        _hit(action, identity.uid, max_calls, per_seconds)

    return dependency


def client_ip(request: Request) -> str:
    """IP real del cliente. Detrás del túnel de Cloudflare (que se conecta desde
    esta misma máquina) se usa CF-Connecting-IP; si no, la IP de la conexión."""
    host = request.client.host if request.client else "desconocido"
    if host in {"127.0.0.1", "::1"}:
        return request.headers.get("CF-Connecting-IP", host)
    return host


def rate_limit_by_ip(action: str, max_calls: int, per_seconds: int):
    """Para endpoints públicos (sin sesión), donde no hay usuario con quien contar."""

    def dependency(request: Request) -> None:
        _hit(action, client_ip(request), max_calls, per_seconds)

    return dependency
