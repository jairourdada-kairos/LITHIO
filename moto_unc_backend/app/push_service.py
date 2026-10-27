"""Notificaciones push (fuera de la app) con el servicio de Expo.

Expo entrega el aviso por Firebase Cloud Messaging aunque la app esté cerrada.
Cada usuario guarda el token del dispositivo con su sesión activa (sesión
única: al entrar en otro teléfono se borra y el nuevo registra el suyo).

El envío no bloquea la respuesta de la API: se hace en un hilo aparte y un
fallo de red solo se registra en el log.
"""
import json
import logging
import re
import threading
import urllib.request
from typing import Callable, Optional

from sqlalchemy.orm import Session

from .models import User

logger = logging.getLogger(__name__)

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
TOKEN_PATTERN = re.compile(r"^Expo(nent)?PushToken\[[A-Za-z0-9_\-]+\]$")


def is_valid_token(token: str) -> bool:
    return bool(TOKEN_PATTERN.match(token or ""))


def _post_to_expo(messages: list[dict]) -> None:
    request = urllib.request.Request(
        EXPO_PUSH_URL,
        data=json.dumps(messages).encode(),
        headers={"Content-Type": "application/json", "Accept": "application/json"},
    )
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            result = json.load(response)
        for ticket in result.get("data", []):
            if ticket.get("status") == "error":
                logger.warning("Expo rechazó una notificación: %s", ticket.get("message"))
    except Exception as error:  # Sin internet o Expo caído: el aviso en la app sigue llegando por WebSocket.
        logger.warning("No se pudo enviar la notificación push: %s", error)


def _send_in_background(messages: list[dict]) -> None:
    threading.Thread(target=_post_to_expo, args=(messages,), daemon=True).start()


# Las pruebas lo reemplazan para revisar los mensajes sin salir a internet.
dispatch: Callable[[list[dict]], None] = _send_in_background


def notify(db: Session, user_id: int, title: str, body: str, data: Optional[dict] = None) -> None:
    """Envía una notificación push al dispositivo activo del usuario, si tiene uno."""
    user = db.get(User, user_id)
    if not user or not user.push_token:
        return
    dispatch([{
        "to": user.push_token,
        "title": title,
        "body": body,
        "data": data or {},
        "sound": "default",
        "priority": "high",
        "channelId": "default",
    }])
