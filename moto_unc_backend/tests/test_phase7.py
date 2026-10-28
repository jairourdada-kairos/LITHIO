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
    from datetime import timedelta

    from app.timeutil import utcnow

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
    db.get(User, 4).profile_updated_at = utcnow() - timedelta(days=8)
    db.commit()
    assert client.put("/api/users/me/profile", json={"name": "Sofi"}, headers=auth_headers(4)).status_code == 200


# --- Notificaciones push -------------------------------------------------------------

TOKEN_DRIVER = "ExponentPushToken[conductor-1]"
TOKEN_PASSENGER = "ExponentPushToken[pasajera-4]"


def test_push_notifications_reach_the_other_side_of_the_ride(client, push_outbox):
    assert client.put("/api/users/me/push-token", json={"token": "hola"}, headers=auth_headers(1)).status_code == 422
    client.put("/api/users/me/push-token", json={"token": TOKEN_DRIVER}, headers=auth_headers(1))
    client.put("/api/users/me/push-token", json={"token": TOKEN_PASSENGER}, headers=auth_headers(4))

    ride = make_ride(client)
    assert push_outbox[-1]["to"] == TOKEN_DRIVER and push_outbox[-1]["title"] == "Nueva solicitud de viaje"
    assert push_outbox[-1]["data"]["ride_id"] == ride["id"]

    client.put(f"/api/rides/{ride['id']}/status", json={"status": "aceptado"}, headers=auth_headers(1))
    assert push_outbox[-1]["to"] == TOKEN_PASSENGER and push_outbox[-1]["title"] == "Tu viaje fue aceptado"

    client.put(f"/api/rides/{ride['id']}/status", json={"status": "cancelado"}, headers=auth_headers(4))
    assert push_outbox[-1]["to"] == TOKEN_DRIVER and push_outbox[-1]["title"] == "Viaje cancelado"


def test_new_device_takes_over_notifications(client, push_outbox):
    client.put("/api/users/me/push-token", json={"token": TOKEN_DRIVER}, headers=auth_headers(1))
    client.post("/api/sessions", headers=auth_headers(1))  # Entró en otro teléfono
    make_ride(client)
    assert push_outbox == []  # El teléfono anterior ya no recibe avisos

    # El mismo teléfono con otra cuenta: solo la última recibe.
    client.put("/api/users/me/push-token", json={"token": TOKEN_DRIVER}, headers=auth_headers(4))
    client.put("/api/users/me/push-token", json={"token": TOKEN_DRIVER}, headers=auth_headers(1))
    from app.database import get_db
    from app.main import app
    from app.models import User
    db = next(app.dependency_overrides[get_db]())
    assert db.get(User, 4).push_token is None and db.get(User, 1).push_token == TOKEN_DRIVER


def test_fcm_tokens_go_straight_to_firebase_and_expo_tokens_to_expo(client, monkeypatch):
    from app import push_service

    fcm_token = "dQw4w9WgXcQ:APA91b" + "x" * 140
    assert push_service.is_valid_token(fcm_token) and push_service.is_valid_token(TOKEN_DRIVER)
    assert not push_service.is_valid_token("hola")
    assert client.put("/api/users/me/push-token", json={"token": fcm_token}, headers=auth_headers(1)).json()["registered"]

    to_expo, to_fcm = [], []
    monkeypatch.setattr(push_service, "_post_to_expo", to_expo.extend)
    monkeypatch.setattr(push_service, "_send_fcm", to_fcm.append)
    push_service._deliver([
        {"to": fcm_token, "title": "a", "body": "b"},
        {"to": TOKEN_PASSENGER, "title": "c", "body": "d"},
    ])
    assert [m["to"] for m in to_fcm] == [fcm_token]
    assert [m["to"] for m in to_expo] == [TOKEN_PASSENGER]


# --- Auditoría: prioridad 1 --------------------------------------------------------

def test_whatsapp_webhook_requires_meta_signature(client, monkeypatch):
    import hashlib
    import hmac

    body = b'{"object": "whatsapp_business_account"}'
    assert client.post("/webhooks/whatsapp", content=body).status_code == 403  # Sin secreto configurado

    monkeypatch.setenv("WHATSAPP_APP_SECRET", "secreto-de-prueba")
    good = "sha256=" + hmac.new(b"secreto-de-prueba", body, hashlib.sha256).hexdigest()
    assert client.post("/webhooks/whatsapp", content=body).status_code == 403
    assert client.post("/webhooks/whatsapp", content=body, headers={"X-Hub-Signature-256": "sha256=falsa"}).status_code == 403
    assert client.post("/webhooks/whatsapp", content=body + b" ", headers={"X-Hub-Signature-256": good}).status_code == 403
    assert client.post("/webhooks/whatsapp", content=body, headers={"X-Hub-Signature-256": good}).json() == {"received": True}


def test_switch_to_driver_requires_approved_application(client):
    from app.database import get_db
    from app.main import app
    from app.models import DriverProfile

    db = next(app.dependency_overrides[get_db]())
    profile = db.query(DriverProfile).filter(DriverProfile.user_id == 1).first()
    profile.verification_status = "rechazado"
    db.commit()
    assert client.post("/api/users/1/switch-role", json={"new_role": "conductor"}, headers=auth_headers(1)).status_code == 403

    profile.verification_status = "aprobado"
    db.commit()
    assert client.post("/api/users/1/switch-role", json={"new_role": "conductor"}, headers=auth_headers(1)).status_code == 200


# --- Auditoría: prioridad 2 --------------------------------------------------------

def test_admin_endpoints_reject_invalid_data_with_422(client):
    bad_route = client.post("/api/admin/routes", json={"origin": "UNC", "destination": "IVIC", "fare_usd": "gratis"}, headers=ADMIN)
    assert bad_route.status_code == 422
    assert client.post("/api/admin/routes", json={"origin": "UNC", "destination": "IVIC", "fare_usd": -1}, headers=ADMIN).status_code == 422
    route = client.post("/api/admin/routes", json={"origin": "UNC", "destination": "IVIC", "fare_usd": 3}, headers=ADMIN)
    assert route.status_code == 201
    assert client.put(f"/api/admin/routes/{route.json()['id']}", json={"estimated_minutes": "mucho"}, headers=ADMIN).status_code == 422
    assert client.put("/api/admin/drivers/1", json={"rating_avg": 9}, headers=ADMIN).status_code == 422
    assert client.post("/api/admin/drivers", json={"email": "no-es-correo"}, headers=ADMIN).status_code == 422
    assert client.post("/api/admin/rewards", json={"discount_percent": 150}, headers=ADMIN).status_code == 422


def test_sensitive_actions_are_rate_limited_per_user(client):
    for _ in range(10):
        assert client.post("/api/sessions", headers=auth_headers(4)).status_code == 201
    blocked = client.post("/api/sessions", headers=auth_headers(4))
    assert blocked.status_code == 429 and int(blocked.headers["Retry-After"]) > 0
    # El límite es por usuario: otra cuenta no queda bloqueada.
    assert client.post("/api/sessions", headers=auth_headers(1)).status_code == 201


def test_failed_save_keeps_old_photo_and_leaves_no_orphan(client, monkeypatch):
    from app.routers import profile as profile_module
    from sqlalchemy.orm import Session

    first = client.post("/api/users/me/avatar", files={"photo": ("a.png", PNG, "image/png")}, headers=auth_headers(4)).json()
    before = set(profile_module.AVATAR_DIR.iterdir())

    def broken_commit(self):
        raise RuntimeError("base de datos caída")

    monkeypatch.setattr(Session, "commit", broken_commit)
    with pytest.raises(RuntimeError):
        client.post("/api/users/me/avatar", files={"photo": ("b.png", PNG, "image/png")}, headers=auth_headers(4))
    monkeypatch.undo()

    assert set(profile_module.AVATAR_DIR.iterdir()) == before  # Sin archivo huérfano
    assert client.get(first["avatar_url"]).content == PNG       # La foto anterior sigue ahí


# --- Datos personales completos ---------------------------------------------------

def test_owner_sees_full_cedula_others_only_masked(client):
    from app.database import get_db
    from app.main import app
    from app.models import User

    db = next(app.dependency_overrides[get_db]())
    user = db.get(User, 4)
    user.cedula, user.career, user.semester = "V12345678", "Ingeniería en Informática", "5"
    db.commit()

    mine = client.get("/api/users/me/profile", headers=auth_headers(4)).json()
    assert mine["cedula"] == "V-12345678"
    assert mine["career"] == "Ingeniería en Informática" and mine["semester"] == "5"
    # En las demás respuestas sigue enmascarada.
    assert "****" in client.get("/api/users/me", headers=auth_headers(4)).json()["cedula"]


# --- Recuperar cuenta --------------------------------------------------------------

def test_recover_account_by_cedula_sends_reset_and_masks_email(client, monkeypatch):
    from app import crypto
    from app.database import get_db
    from app.main import app
    from app.models import User
    from app.routers import recovery

    sent = []
    monkeypatch.setattr(recovery, "send_password_reset", sent.append)
    db = next(app.dependency_overrides[get_db]())
    user = db.get(User, 4)
    user.cedula, user.cedula_hash = "V12345678", crypto.blind_index("V12345678")
    db.commit()

    found = client.post("/api/auth/recover", json={"cedula": "v-12.345.678"})
    assert found.status_code == 200
    assert found.json() == {"masked_email": "s***a@example.test"}  # sofia@example.test
    assert sent == ["sofia@example.test"]  # El correo completo nunca sale en la respuesta

    assert client.post("/api/auth/recover", json={"cedula": "V-99999999"}).status_code == 404
    assert client.post("/api/auth/recover", json={"cedula": "hola123"}).status_code == 422
    for _ in range(3):
        client.post("/api/auth/recover", json={"cedula": "V-99999999"})
    assert client.post("/api/auth/recover", json={"cedula": "V-12345678"}).status_code == 429


def test_mask_email():
    from app.routers.recovery import mask_email

    assert mask_email("jairourdada@gmail.com") == "j*********a@gmail.com"
    assert mask_email("ab@x.com") == "a*@x.com"


def test_app_version_comes_from_server_settings(client, monkeypatch):
    # Independiente del .env local, que puede tener ya una versión publicada.
    for name in ("APP_MIN_BUILD", "APP_LATEST_BUILD", "APP_DOWNLOAD_URL"):
        monkeypatch.delenv(name, raising=False)
    assert client.get("/api/app/version").json() == {"min_build": 0, "latest_build": 0, "download_url": None}
    monkeypatch.setenv("APP_MIN_BUILD", "3")
    monkeypatch.setenv("APP_LATEST_BUILD", "4")
    monkeypatch.setenv("APP_DOWNLOAD_URL", "https://expo.dev/artifacts/eas/lithio.apk")
    assert client.get("/api/app/version").json() == {
        "min_build": 3, "latest_build": 4, "download_url": "https://expo.dev/artifacts/eas/lithio.apk"}


def test_whatsapp_message_uses_template_when_configured(monkeypatch):
    from app.main import whatsapp_ride_message
    from app.models import Ride

    ride = Ride(origin="UNC", destination="IVIC", fare_amount=2.5, scheduled_time=None)
    text = whatsapp_ride_message("584141234567", ride, "Sofía")
    assert text["type"] == "text" and "\n" in text["text"]["body"] and chr(92) + "n" not in text["text"]["body"]

    monkeypatch.setenv("WHATSAPP_TEMPLATE_NAME", "nueva_solicitud")
    template = whatsapp_ride_message("584141234567", ride, "Sofía")
    values = [p["text"] for p in template["template"]["components"][0]["parameters"]]
    assert template["type"] == "template" and values == ["Sofía", "UNC", "IVIC", "$2.50", "inmediato"]
