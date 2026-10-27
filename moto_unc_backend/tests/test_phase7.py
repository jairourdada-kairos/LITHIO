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


# --- 3 y 5. Comprobante y detalle del viaje ----------------------------------------

from tests.test_phase4a import ADMIN, PNG  # noqa: E402


def make_ride(client, payment="pago_movil"):
    return client.post(
        "/api/rides?passenger_id=4",
        json={"driver_id": 1, "origin": "UNC", "destination": "IVIC", "payment_method": payment,
              "payment_reference": "123456", "fare_amount": 2},
        headers=auth_headers(4),
    ).json()


def test_receipt_is_private_and_linked_to_the_ride(client):
    ride = make_ride(client)
    photo = {"photo": ("pago.png", PNG, "image/png")}
    assert client.post(f"/api/rides/{ride['id']}/receipt", files=photo, headers=auth_headers(1)).status_code == 403
    assert client.post(f"/api/rides/{ride['id']}/receipt", files={"photo": ("x.png", b"nope", "image/png")},
                       headers=auth_headers(4)).status_code == 400
    assert client.post(f"/api/rides/{ride['id']}/receipt", files=photo, headers=auth_headers(4)).json()["has_receipt"]

    # Pasajero, conductor y administrador lo ven; nadie más, y no está en /media.
    for headers in (auth_headers(4), auth_headers(1), ADMIN):
        assert client.get(f"/api/rides/{ride['id']}/receipt", headers=headers).content == PNG
    assert client.get(f"/api/rides/{ride['id']}/receipt", headers=auth_headers(2)).status_code == 404


def test_ride_detail_shows_timeline_receipt_and_review(client):
    ride = make_ride(client)
    for status in ("aceptado", "en_camino", "en_curso", "completado"):
        client.put(f"/api/rides/{ride['id']}/status", json={"status": status}, headers=auth_headers(1))
    client.post(f"/api/rides/{ride['id']}/receipt", files={"photo": ("p.png", PNG, "image/png")}, headers=auth_headers(4))

    detail = client.get(f"/api/rides/{ride['id']}/detail", headers=auth_headers(4)).json()
    assert [t["status"] for t in detail["timeline"]] == ["solicitado", "aceptado", "en_camino", "en_curso", "completado"]
    assert detail["has_receipt"] and detail["payment_reference"] == "123456"
    assert detail["viewer_role"] == "pasajero" and detail["can_upload_receipt"]
    assert detail["driver"]["plate"]

    as_driver = client.get(f"/api/rides/{ride['id']}/detail", headers=auth_headers(1)).json()
    assert as_driver["viewer_role"] == "conductor" and not as_driver["can_upload_receipt"]
    assert client.get(f"/api/rides/{ride['id']}/detail", headers=auth_headers(2)).status_code == 404

    history = client.get("/api/rides/mine?scope=history&role=pasajero", headers=auth_headers(4)).json()
    assert history[0]["id"] == ride["id"] and history[0]["has_receipt"]


# --- 2. Edición de perfil cada 7 días ------------------------------------------------

def test_profile_edit_once_every_seven_days_photo_unlimited(client, monkeypatch):
    from datetime import datetime, timedelta

    from app import auth as auth_module
    from app.database import get_db
    from app.main import app
    from app.models import User

    firebase_calls = []
    monkeypatch.setattr(auth_module, "update_firebase_email", lambda uid, email: firebase_calls.append((uid, email)))
    db = next(app.dependency_overrides[get_db]())
    db.get(User, 2).email = "carlos@lithio-demo.com"
    db.commit()

    assert client.put("/api/users/me/profile", json={"cedula": "V1"}, headers=auth_headers(4)).status_code == 422
    assert client.put("/api/users/me/profile", json={"phone": "0212-1234567"}, headers=auth_headers(4)).status_code == 422
    assert client.put("/api/users/me/profile", json={"email": "Carlos@lithio-demo.com"}, headers=auth_headers(4)).status_code == 409

    updated = client.put(
        "/api/users/me/profile",
        json={"name": "Sofía", "phone": "0414-7654321", "email": "Sofia.Nueva@lithio-demo.com"},
        headers=auth_headers(4),
    ).json()
    assert updated["phone"] == "+58 414 7654321" and updated["email"] == "sofia.nueva@lithio-demo.com"
    assert updated["next_edit_at"] and firebase_calls == [("uid-user-4", "sofia.nueva@lithio-demo.com")]

    blocked = client.put("/api/users/me/profile", json={"name": "Sofi"}, headers=auth_headers(4))
    assert blocked.status_code == 429 and "7 días" in blocked.json()["detail"]

    # La foto se puede cambiar en cualquier momento.
    photo = client.post("/api/users/me/avatar", files={"photo": ("a.png", PNG, "image/png")}, headers=auth_headers(4))
    assert photo.status_code == 200

    db.expire_all()
    db.get(User, 4).profile_updated_at = datetime.utcnow() - timedelta(days=8)
    db.commit()
    assert client.put("/api/users/me/profile", json={"name": "Sofi"}, headers=auth_headers(4)).status_code == 200
