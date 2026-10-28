"""Notificaciones push (fuera de la app).

En Android el APK registra su token nativo de Firebase Cloud Messaging y el
servidor envía directo con la cuenta de servicio de Firebase que ya usa para
la autenticación: no hace falta subir ninguna clave a Expo. Los tokens de Expo
(ExponentPushToken[...], p. ej. de iOS) se siguen enviando por el servicio de
Expo.

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
EXPO_TOKEN = re.compile(r"^Expo(nent)?PushToken\[[A-Za-z0-9_\-]+\]$")
FCM_TOKEN = re.compile(r"^[A-Za-z0-9_:\-]{100,4096}$")
BRAND_COLOR = "#45D6C5"


def is_expo_token(token: str) -> bool:
    return bool(EXPO_TOKEN.match(token or ""))


def is_valid_token(token: str) -> bool:
    return is_expo_token(token) or bool(FCM_TOKEN.match(token or ""))


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
        logger.warning("No se pudo enviar la notificación push por Expo: %s", error)


def _forget_token(token: str) -> None:
    """El teléfono desinstaló la app o renovó su token: deja de usarse."""
    from .database import SessionLocal

    db = SessionLocal()
    try:
        db.query(User).filter(User.push_token == token).update({"push_token": None})
        db.commit()
    finally:
        db.close()


def _send_fcm(message: dict) -> None:
    from firebase_admin import messaging

    from .auth import _get_firebase_app

    fcm_message = messaging.Message(
        token=message["to"],
        notification=messaging.Notification(title=message["title"], body=message["body"]),
        data={key: str(value) for key, value in (message.get("data") or {}).items()},
        android=messaging.AndroidConfig(
            priority="high",
            notification=messaging.AndroidNotification(channel_id="default", sound="default", color=BRAND_COLOR),
        ),
    )
    try:
        messaging.send(fcm_message, app=_get_firebase_app())
    except (messaging.UnregisteredError, messaging.SenderIdMismatchError):
        _forget_token(message["to"])
    except Exception as error:
        logger.warning("No se pudo enviar la notificación push por Firebase: %s", error)


def _deliver(messages: list[dict]) -> None:
    expo = [m for m in messages if is_expo_token(m["to"])]
    if expo:
        _post_to_expo(expo)
    for message in messages:
        if not is_expo_token(message["to"]):
            _send_fcm(message)


def _send_in_background(messages: list[dict]) -> None:
    threading.Thread(target=_deliver, args=(messages,), daemon=True).start()


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
