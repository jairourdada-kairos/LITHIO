"""Avisos al administrador de solicitudes que esperan su revisión.

Cada solicitud nueva (recarga o donación por Pago Móvil, retiro, canje del
taller, vale de nota o conductor por verificar) llega a las cuentas de
administrador de dos formas: un aviso flotante dentro de la app (WebSocket,
tipo ADMIN_ALERT) y una notificación push del sistema si la app está cerrada.
"""
from sqlalchemy.orm import Session

from . import push_service
from .auth import admin_users
from .realtime import manager

# kind -> sección del panel de administración que abre el aviso.
KINDS = {"recarga", "donacion_pm", "retiro", "taller", "vale", "conductor", "comprobante"}


async def alert_admins(db: Session, kind: str, title: str, body: str, **data) -> None:
    assert kind in KINDS, kind
    payload = {"type": "ADMIN_ALERT", "kind": kind, "title": title, "body": body, **data}
    for admin in admin_users(db):
        await manager.send_personal_message(payload, user_id=admin.id)
        push_service.notify(db, admin.id, title, body, {"type": "ADMIN_ALERT", "kind": kind, **data})
