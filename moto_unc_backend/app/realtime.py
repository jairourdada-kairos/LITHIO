"""Gestor de conexiones WebSocket compartido por todos los módulos de la API."""
import json
from typing import Dict, Set

from fastapi import WebSocket, WebSocketDisconnect


class ConnectionManager:
    """Conexiones en memoria de este proceso.

    Un usuario puede tener varias conexiones a la vez (teléfono y web, o una
    reconexión que llega antes de que se cierre la anterior), así que se
    guarda un conjunto por usuario. Para correr varias instancias del backend
    habría que repartir los mensajes con Redis pub/sub.
    """

    def __init__(self):
        # Mapea user_id -> conexiones abiertas
        self.active_connections: Dict[int, Set[WebSocket]] = {}
        # Sesión con la que se autenticó cada conexión (política de sesión única).
        self.sessions: Dict[WebSocket, str | None] = {}

    def connect(self, user_id: int, websocket: WebSocket, session_id: str | None = None):
        self.active_connections.setdefault(user_id, set()).add(websocket)
        self.sessions[websocket] = session_id

    def disconnect(self, user_id: int, websocket: WebSocket):
        connections = self.active_connections.get(user_id)
        if connections is None:
            return
        connections.discard(websocket)
        self.sessions.pop(websocket, None)
        if not connections:
            del self.active_connections[user_id]

    def is_connected(self, user_id: int) -> bool:
        return bool(self.active_connections.get(user_id))

    async def _send(self, user_id: int, websocket: WebSocket, payload: str):
        try:
            await websocket.send_text(payload)
        except (WebSocketDisconnect, RuntimeError, OSError):
            self.disconnect(user_id, websocket)

    async def send_personal_message(self, message: dict, user_id: int):
        payload = json.dumps(message, default=str)
        for connection in list(self.active_connections.get(user_id, ())):
            await self._send(user_id, connection, payload)

    async def close_other_sessions(self, user_id: int, session_id: str):
        """Avisa y desconecta los dispositivos de esta cuenta con otra sesión."""
        payload = json.dumps({"type": "SESSION_REPLACED"})
        for connection in list(self.active_connections.get(user_id, ())):
            if self.sessions.get(connection) == session_id:
                continue
            await self._send(user_id, connection, payload)
            try:
                await connection.close(code=4001, reason="Sesión iniciada en otro dispositivo")
            except (RuntimeError, OSError):
                pass
            self.disconnect(user_id, connection)

    async def broadcast(self, message: dict):
        payload = json.dumps(message, default=str)
        for user_id, connections in list(self.active_connections.items()):
            for connection in list(connections):
                await self._send(user_id, connection, payload)

manager = ConnectionManager()
