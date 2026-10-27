"""Fase 7: sesión única por cuenta, edición de perfil, comprobantes e historial."""
import pytest
from starlette.websockets import WebSocketDisconnect

from tests.test_api import auth_headers, client  # noqa: F401  (fixture compartido)


def with_session(user_id, session_id):
    return {**auth_headers(user_id), "X-Session-Id": session_id}


# --- 1. Sesión única -------------------------------------------------------------

def test_new_login_replaces_the_previous_device(client):
    first = client.post("/api/sessions", headers=auth_headers(4)).json()["session_id"]
    assert client.get("/api/users/me", headers=with_session(4, first)).status_code == 200

    second = client.post("/api/sessions", headers=with_session(4, first)).json()["session_id"]
    assert second != first
    old = client.get("/api/users/me", headers=with_session(4, first))
    assert old.status_code == 401 and old.headers["X-Session-Replaced"] == "1"
    assert client.get("/api/users/me", headers=with_session(4, second)).status_code == 200
    # El panel web de administración no envía sesión y no compite por ella.
    assert client.get("/api/users/me", headers=auth_headers(4)).status_code == 200


def test_websocket_rejects_and_kicks_old_sessions(client):
    first = client.post("/api/sessions", headers=auth_headers(1)).json()["session_id"]
    with client.websocket_connect("/ws") as old_device:
        old_device.send_json({"type": "AUTH", "token": "test-user-1", "session_id": first})
        assert old_device.receive_json()["type"] == "AUTHENTICATED"
        old_device.receive_json()  # ACTIVE_RIDE_SYNC

        second = client.post("/api/sessions", headers=auth_headers(1)).json()["session_id"]
        assert old_device.receive_json() == {"type": "SESSION_REPLACED"}
        with pytest.raises(WebSocketDisconnect):
            old_device.receive_json()

    with client.websocket_connect("/ws") as stale:
        stale.send_json({"type": "AUTH", "token": "test-user-1", "session_id": first})
        assert stale.receive_json() == {"type": "SESSION_REPLACED"}

    with client.websocket_connect("/ws") as current:
        current.send_json({"type": "AUTH", "token": "test-user-1", "session_id": second})
        assert current.receive_json()["type"] == "AUTHENTICATED"
