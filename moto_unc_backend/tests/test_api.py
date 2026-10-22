import os

import pytest
from cryptography.fernet import Fernet
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from starlette.websockets import WebSocketDisconnect

import app.auth as auth
import app.models as models
from app import crypto, main
from app.auth import FirebaseIdentity
from app.seed import migrate_plaintext_columns
from app.database import Base, get_db

User = getattr(models, "User")
Route = getattr(models, "Route")
DriverProfile = getattr(models, "DriverProfile")
Reward = getattr(models, "Reward")


def auth_headers(user_id: int) -> dict[str, str]:
    return {"Authorization": f"Bearer test-user-{user_id}"}


def test_firebase_auth_returns_503_without_server_credentials(monkeypatch):
    monkeypatch.delenv("FIREBASE_PROJECT_ID", raising=False)
    monkeypatch.delenv("FIREBASE_SERVICE_ACCOUNT_PATH", raising=False)
    auth._get_firebase_app.cache_clear()
    try:
        with pytest.raises(HTTPException) as error:
            auth.verify_firebase_token("test-token")
    finally:
        auth._get_firebase_app.cache_clear()

    assert error.value.status_code == 503


def test_dashboard_firebase_config_is_public_but_requires_configuration(client, monkeypatch):
    monkeypatch.delenv("FIREBASE_WEB_API_KEY", raising=False)
    monkeypatch.delenv("FIREBASE_AUTH_DOMAIN", raising=False)
    monkeypatch.setenv("FIREBASE_PROJECT_ID", "lithio-test")
    missing_key = client.get("/api/auth/config")
    assert missing_key.status_code == 503
    assert "FIREBASE_WEB_API_KEY" in missing_key.json()["detail"]

    monkeypatch.setenv("FIREBASE_WEB_API_KEY", "test-web-key")
    configured = client.get("/api/auth/config")
    assert configured.status_code == 200
    assert configured.json() == {
        "apiKey": "test-web-key",
        "authDomain": "lithio-test.firebaseapp.com",
        "projectId": "lithio-test",
    }


@pytest.fixture
def client(monkeypatch):
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    users = [
        User(id=1, name="Jairo", email="jairo@example.test", phone="driver-phone", role="conductor"),
        User(id=2, name="Carlos", email="carlos@example.test", phone="private-phone", role="conductor"),
        User(id=3, name="Alejandro", email="alejandro@example.test", phone="private-phone", role="conductor"),
        User(id=4, name="Sofia", email="sofia@example.test", phone="passenger-phone", role="pasajero"),
        User(id=5, name="Admin", email="admin@example.test", phone="admin-phone", role="admin", firebase_uid="uid-admin"),
    ]
    db.add_all(users)
    db.flush()
    db.add_all([
        DriverProfile(
            user_id=1,
            moto_brand_model="Bera SBR 150",
            moto_color="Azul",
            plate="PRIVATE-PLATE",
            is_available=True,
            mobile_payment_number="PRIVATE-PAYMENT",
            mobile_payment_bank="PRIVATE-BANK",
            mobile_payment_id="PRIVATE-ID",
            bank_account_number="PRIVATE-ACCOUNT",
        ),
        DriverProfile(
            user_id=2,
            moto_brand_model="Keeway 150",
            moto_color="Rojo",
            plate="PRIVATE-PLATE-2",
            is_available=True,
        ),
        DriverProfile(
            user_id=3,
            moto_brand_model="Haojue 150",
            moto_color="Gris",
            plate="PRIVATE-PLATE-3",
            is_available=False,
        ),
    ])
    db.add_all([
        Route(origin="UNC", destination="BIBLIOTECA", fare_usd=1.5, estimated_minutes=8),
        Route(origin="UNC", destination="IVIC", fare_usd=2.0, estimated_minutes=10),
        Route(origin="UNC", destination="CARACAS", fare_usd=6.0, estimated_minutes=35),
        Reward(title="Descuento", description="Prueba", points_cost=100, discount_percent=20),
    ])
    db.commit()
    db.close()

    def override_get_db():
        session = TestingSessionLocal()
        try:
            yield session
        finally:
            session.close()

    def verify_test_token(token: str) -> FirebaseIdentity:
        if token == "test-new-user":
            return FirebaseIdentity("uid-new-user", "new@example.test", False)
        if token == "test-wrong-email":
            return FirebaseIdentity("uid-wrong-email", "other@example.test", False)
        if token == "test-admin":
            return FirebaseIdentity("uid-admin", "admin@example.test", True)
        if token.startswith("test-user-"):
            user_id = int(token.removeprefix("test-user-"))
            email = {
                1: "jairo@example.test",
                2: "carlos@example.test",
                3: "alejandro@example.test",
                4: "sofia@example.test",
            }.get(user_id)
            if email:
                return FirebaseIdentity(f"uid-user-{user_id}", email, True)
        raise HTTPException(status_code=401, detail="Invalid test token")

    monkeypatch.setattr(auth, "verify_firebase_token", verify_test_token)
    monkeypatch.setattr(main, "verify_firebase_token", verify_test_token)
    monkeypatch.setattr(main, "SessionLocal", TestingSessionLocal)
    app_overrides = main.app.dependency_overrides
    app_overrides[get_db] = override_get_db

    try:
        with TestClient(main.app) as test_client:
            test_client.session_factory = TestingSessionLocal
            yield test_client
    finally:
        app_overrides.clear()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


def test_get_routes(client):
    response = client.get("/api/routes")
    assert response.status_code == 200
    routes = response.json()
    assert len(routes) >= 3
    assert any("UNC" in route["origin"] for route in routes)


def test_cors_allows_configured_dashboard_origins(client):
    if not main.cors_origins:
        pytest.skip("No CORS origins are configured.")
    allowed_origin = main.cors_origins[0]
    preflight = client.options(
        "/api/users/me",
        headers={
            "Origin": allowed_origin,
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "authorization",
        },
    )
    assert preflight.status_code == 200
    assert preflight.headers["access-control-allow-origin"] == allowed_origin

    blocked = client.get(
        "/api/routes",
        headers={"Origin": "https://untrusted.example"},
    )
    assert "access-control-allow-origin" not in blocked.headers


def test_public_driver_cards_exclude_private_data(client):
    response = client.get("/api/drivers")
    assert response.status_code == 200
    drivers = response.json()
    assert len(drivers) >= 1
    assert any(driver["name"] == "Jairo" for driver in drivers)
    for driver in drivers:
        assert not {
            "phone",
            "plate",
            "current_location_tag",
            "mobile_payment_number",
            "mobile_payment_bank",
            "mobile_payment_id",
            "bank_account_number",
            "firebase_uid",
        } & driver.keys()


def test_profile_and_financial_data_are_owner_only(client):
    anonymous = client.get("/api/users/4")
    assert anonymous.status_code == 401

    own_profile = client.get("/api/users/4", headers=auth_headers(4))
    assert own_profile.status_code == 200
    assert own_profile.json()["phone"] == "passenger-phone"
    assert "firebase_uid" not in own_profile.json()
    assert "driver_profile" not in own_profile.json()

    other_profile = client.get("/api/users/1", headers=auth_headers(4))
    assert other_profile.status_code == 403

    own_finances = client.get("/api/users/me/financial", headers=auth_headers(1))
    assert own_finances.status_code == 200
    assert own_finances.json()["bank_account_number"] == "PRIVATE-ACCOUNT"
    passenger_finances = client.get("/api/users/me/financial", headers=auth_headers(4))
    assert passenger_finances.status_code == 404


def test_registration_requires_firebase_identity_and_uses_claimed_uid(client):
    payload = {
        "name": "New",
        "last_name": "Passenger",
        "age": 22,
        "phone": "new-phone",
        "email": "new@example.test",
        "firebase_uid": "attacker-controlled-uid",
    }
    no_auth = client.post("/api/passengers/register", json=payload)
    assert no_auth.status_code == 401

    mismatch = client.post(
        "/api/passengers/register",
        json={**payload, "email": "new@example.test"},
        headers={"Authorization": "Bearer test-wrong-email"},
    )
    assert mismatch.status_code == 403

    created = client.post(
        "/api/passengers/register",
        json=payload,
        headers={"Authorization": "Bearer test-new-user"},
    )
    assert created.status_code == 201
    assert created.json()["email"] == "new@example.test"
    assert "firebase_uid" not in created.json()


def test_driver_availability_requires_owner(client):
    denied = client.put(
        "/api/drivers/1/availability",
        json={"is_available": False},
        headers=auth_headers(4),
    )
    assert denied.status_code == 403

    updated = client.put(
        "/api/drivers/1/availability",
        json={"is_available": False},
        headers=auth_headers(1),
    )
    assert updated.status_code == 200
    assert updated.json()["is_available"] is False


def test_ride_privacy_and_participant_authorization(client):
    ride_payload = {
        "driver_id": 1,
        "origin": "Campus",
        "destination": "San Antonio",
        "payment_method": "pago_movil",
        "payment_reference": "PRIVATE-REFERENCE",
        "fare_amount": 2.5,
    }
    impersonation = client.post(
        "/api/rides?passenger_id=1",
        json=ride_payload,
        headers=auth_headers(4),
    )
    assert impersonation.status_code == 403

    created = client.post(
        "/api/rides?passenger_id=4",
        json=ride_payload,
        headers=auth_headers(4),
    )
    assert created.status_code == 200
    ride = created.json()
    ride_id = ride["id"]
    assert ride["driver_mobile_payment_number"] == "PRIVATE-PAYMENT"
    assert ride["driver_bank_account_number"] == "PRIVATE-ACCOUNT"

    unrelated_active_ride = client.get("/api/rides/active/4", headers=auth_headers(2))
    assert unrelated_active_ride.status_code == 403
    unrelated_pending_rides = client.get("/api/rides/driver/1/pending", headers=auth_headers(2))
    assert unrelated_pending_rides.status_code == 403

    passenger_status = client.put(
        f"/api/rides/{ride_id}/status",
        json={"status": "aceptado"},
        headers=auth_headers(4),
    )
    assert passenger_status.status_code == 403

    accepted = client.put(
        f"/api/rides/{ride_id}/status",
        json={"status": "aceptado"},
        headers=auth_headers(1),
    )
    assert accepted.status_code == 200


def test_ride_flow_and_gamification(client):
    ride_payload = {
        "driver_id": 1,
        "origin": "Campus UNC",
        "destination": "San Antonio",
        "payment_method": "efectivo",
        "fare_amount": 2.5,
    }
    ride_response = client.post(
        "/api/rides?passenger_id=4",
        json=ride_payload,
        headers=auth_headers(4),
    )
    assert ride_response.status_code == 200
    ride_id = ride_response.json()["id"]

    before = client.get("/api/users/me", headers=auth_headers(4)).json()["points"]
    for status in ("aceptado", "en_camino", "en_curso", "completado"):
        response = client.put(
            f"/api/rides/{ride_id}/status",
            json={"status": status},
            headers=auth_headers(1),
        )
        assert response.status_code == 200

    after = client.get("/api/users/me", headers=auth_headers(4)).json()["points"]
    assert after == before + 35

    review = client.post(
        "/api/reviews?passenger_id=4",
        json={
            "ride_id": ride_id,
            "rating": 5,
            "badges": "Manejo seguro,Casco impecable",
            "comment": "El conductor hizo un viaje seguro y puntual.",
        },
        headers=auth_headers(4),
    )
    assert review.status_code == 200
    assert review.json()["points_earned"] == 20


def test_review_and_payment_validation(client):
    created_ride = client.post(
        "/api/rides?passenger_id=4",
        json={
            "driver_id": 1,
            "origin": "Campus",
            "destination": "San Antonio",
            "payment_method": "efectivo",
            "fare_amount": 2.5,
        },
        headers=auth_headers(4),
    )
    assert created_ride.status_code == 200
    review_payload = {
        "ride_id": created_ride.json()["id"],
        "rating": 5,
        "comment": "Buen viaje",
    }
    unauthorized_review = client.post(
        "/api/reviews?passenger_id=4",
        json=review_payload,
        headers=auth_headers(2),
    )
    assert unauthorized_review.status_code == 403

    unsupported_payment = client.post(
        "/api/rides?passenger_id=4",
        json={
            "driver_id": 1,
            "origin": "Campus",
            "destination": "San Antonio",
            "payment_method": "diamantes",
            "fare_amount": 2.5,
        },
        headers=auth_headers(4),
    )
    assert unsupported_payment.status_code == 400


def test_rewards_are_public_but_redemption_is_owner_only(client):
    rewards = client.get("/api/gamification/rewards")
    assert rewards.status_code == 200
    reward_id = rewards.json()[0]["id"]

    denied = client.post(
        "/api/gamification/redeem?user_id=4",
        json={"reward_id": reward_id},
        headers=auth_headers(2),
    )
    assert denied.status_code == 403

    redeemed = client.post(
        "/api/gamification/redeem?user_id=4",
        json={"reward_id": reward_id},
        headers=auth_headers(4),
    )
    assert redeemed.status_code == 200


def test_admin_routes_require_admin_role(client):
    payload = {
        "origin": "Admin route test",
        "destination": "UNC",
        "fare_usd": 3.5,
        "estimated_minutes": 18,
    }
    unauthorized = client.post("/api/admin/routes", json=payload, headers=auth_headers(4))
    assert unauthorized.status_code == 403

    created = client.post("/api/admin/routes", json=payload, headers={"Authorization": "Bearer test-admin"})
    assert created.status_code == 201
    route_id = created.json()["id"]
    updated = client.put(
        f"/api/admin/routes/{route_id}",
        json={"origin": "Updated route"},
        headers={"Authorization": "Bearer test-admin"},
    )
    assert updated.status_code == 200
    deleted = client.delete(
        f"/api/admin/routes/{route_id}",
        headers={"Authorization": "Bearer test-admin"},
    )
    assert deleted.status_code == 200


def test_admin_profile_endpoint_requires_admin_role(client, monkeypatch):
    denied = client.get("/api/admin/me", headers=auth_headers(4))
    assert denied.status_code == 403

    admin = client.get("/api/admin/me", headers={"Authorization": "Bearer test-admin"})
    assert admin.status_code == 200
    assert admin.json()["email"] == "admin@example.test"

    monkeypatch.setenv("ADMIN_FIREBASE_UIDS", "uid-user-1")
    configured_admin_profile = client.get("/api/admin/me", headers=auth_headers(1))
    assert configured_admin_profile.status_code == 200
    configured_admin = client.get("/api/users/4", headers=auth_headers(1))
    assert configured_admin.status_code == 200


def test_role_switch_cannot_target_other_users_or_elevate_to_admin(client):
    other_user = client.post(
        "/api/users/1/switch-role",
        json={"new_role": "admin"},
        headers=auth_headers(4),
    )
    assert other_user.status_code == 403

    invalid_role = client.post(
        "/api/users/4/switch-role",
        json={"new_role": "admin"},
        headers=auth_headers(4),
    )
    assert invalid_role.status_code == 400


def test_websocket_authenticates_firebase_token(client):
    with client.websocket_connect("/ws") as websocket:
        websocket.send_json({"type": "AUTH", "token": "test-user-1"})
        assert websocket.receive_json() == {"type": "AUTHENTICATED", "user_id": 1}
        assert websocket.receive_json() == {"type": "ACTIVE_RIDE_SYNC", "ride": None}
        websocket.send_json({"type": "PING"})
        assert websocket.receive_json() == {"type": "PONG"}

    with client.websocket_connect("/ws") as websocket:
        websocket.send_json({"type": "AUTH", "token": "invalid-token"})
        with pytest.raises(WebSocketDisconnect):
            websocket.receive_json()

    with client.websocket_connect("/ws") as websocket:
        websocket.send_text("not-json")
        with pytest.raises(WebSocketDisconnect):
            websocket.receive_json()


# -------------------------------------------------------------
# FASE 1: CIFRADO, DISPONIBILIDAD, RESEÑAS Y TIEMPO REAL
# -------------------------------------------------------------
def request_ride(client, driver_id=1):
    return client.post(
        "/api/rides?passenger_id=4",
        json={
            "driver_id": driver_id,
            "origin": "UNC",
            "destination": "BIBLIOTECA",
            "payment_method": "pago_movil",
            "payment_reference": "REF-123456",
            "fare_amount": 1.5,
        },
        headers=auth_headers(4),
    )


def set_ride_status(client, ride_id, status, user_id=1):
    return client.put(
        f"/api/rides/{ride_id}/status",
        json={"status": status},
        headers=auth_headers(user_id),
    )


def public_driver(client, driver_id):
    return next(d for d in client.get("/api/drivers").json() if d["user_id"] == driver_id)


def test_sensitive_columns_are_encrypted_at_rest(client):
    ride_id = request_ride(client).json()["id"]
    with client.session_factory() as db:
        phone = db.execute(text("SELECT phone FROM users WHERE id = 4")).scalar_one()
        account, payment = db.execute(text(
            "SELECT bank_account_number, mobile_payment_number FROM driver_profiles WHERE user_id = 1"
        )).one()
        reference = db.execute(
            text("SELECT payment_reference FROM rides WHERE id = :id"), {"id": ride_id}
        ).scalar_one()

    for raw, plain in (
        (phone, "passenger-phone"),
        (account, "PRIVATE-ACCOUNT"),
        (payment, "PRIVATE-PAYMENT"),
        (reference, "REF-123456"),
    ):
        assert plain not in raw
        assert raw.startswith(crypto.FERNET_PREFIX)
        assert crypto.decrypt(raw) == plain

    # La API sigue entregando el dato en claro a su dueño.
    assert client.get("/api/users/me", headers=auth_headers(4)).json()["phone"] == "passenger-phone"


def test_legacy_plaintext_values_are_migrated(client):
    with client.session_factory() as db:
        db.execute(text("UPDATE users SET phone = 'legacy-plain-phone' WHERE id = 2"))
        db.commit()
        migrate_plaintext_columns(db)
        migrate_plaintext_columns(db)  # Idempotente: no cifra dos veces
        raw = db.execute(text("SELECT phone FROM users WHERE id = 2")).scalar_one()
    assert crypto.decrypt(raw) == "legacy-plain-phone"


def test_cedula_blind_index_is_deterministic_and_not_reversible():
    assert crypto.blind_index("V12345678") == crypto.blind_index("V12345678")
    assert crypto.blind_index("V12345678") != crypto.blind_index("V12345679")
    assert "12345678" not in crypto.blind_index("V12345678")
    assert crypto.mask("04121234567") == "*******4567"


def test_encryption_key_rotation_keeps_old_data_readable(monkeypatch):
    old_token = crypto.encrypt("dato-antiguo")
    new_key = Fernet.generate_key().decode()
    monkeypatch.setenv("LITHIO_ENCRYPTION_KEYS", f"{new_key},{os.environ['LITHIO_ENCRYPTION_KEYS']}")
    crypto.reset_key_cache()
    try:
        assert crypto.decrypt(old_token) == "dato-antiguo"
        assert Fernet(new_key.encode()).decrypt(crypto.encrypt("nuevo").encode()) == b"nuevo"
    finally:
        monkeypatch.undo()
        crypto.reset_key_cache()


def test_missing_encryption_key_fails_fast(monkeypatch):
    monkeypatch.delenv("LITHIO_ENCRYPTION_KEYS")
    crypto.reset_key_cache()
    try:
        with pytest.raises(crypto.EncryptionNotConfigured):
            crypto.validate_configuration()
    finally:
        monkeypatch.undo()
        crypto.reset_key_cache()


def test_accepted_driver_is_hidden_from_available_directory(client):
    assert public_driver(client, 1)["is_available"] is True
    ride_id = request_ride(client).json()["id"]
    assert set_ride_status(client, ride_id, "aceptado").status_code == 200

    assert public_driver(client, 1)["is_available"] is False

    # No puede volver a marcarse disponible mientras atiende el viaje.
    toggle = client.put(
        "/api/drivers/1/availability", json={"is_available": True}, headers=auth_headers(1)
    )
    assert toggle.status_code == 409

    for status in ("en_camino", "en_curso", "completado"):
        assert set_ride_status(client, ride_id, status).status_code == 200
    assert public_driver(client, 1)["is_available"] is True


def test_driver_with_flag_but_busy_ride_is_still_hidden(client):
    ride_id = request_ride(client).json()["id"]
    set_ride_status(client, ride_id, "aceptado")
    # Aunque el indicador quede en True (p. ej. editado desde el panel), el viaje manda.
    with client.session_factory() as db:
        db.execute(text("UPDATE driver_profiles SET is_available = 1 WHERE user_id = 1"))
        db.commit()
    assert public_driver(client, 1)["is_available"] is False


def test_cancelling_accepted_ride_restores_availability(client):
    ride_id = request_ride(client).json()["id"]
    set_ride_status(client, ride_id, "aceptado")
    assert public_driver(client, 1)["is_available"] is False
    cancelled = set_ride_status(client, ride_id, "cancelado", user_id=4)
    assert cancelled.status_code == 200
    assert public_driver(client, 1)["is_available"] is True


def test_unavailable_driver_and_double_booking_are_rejected(client):
    unavailable = request_ride(client, driver_id=3)
    assert unavailable.status_code == 409

    assert request_ride(client).status_code == 200
    second = request_ride(client, driver_id=2)
    assert second.status_code == 409
    assert "viaje activo" in second.json()["detail"]


@pytest.mark.parametrize("rating", [0, 6, -1, 4.5, "5", True])
def test_review_rating_must_be_integer_between_1_and_5(client, rating):
    ride_id = request_ride(client).json()["id"]
    for status in ("aceptado", "en_curso", "completado"):
        set_ride_status(client, ride_id, status)
    review = client.post(
        "/api/reviews?passenger_id=4",
        json={
            "ride_id": ride_id,
            "rating": rating,
            "comment": "El conductor hizo un viaje seguro y puntual.",
        },
        headers=auth_headers(4),
    )
    assert review.status_code == 422


def test_websocket_notifies_both_participants_and_syncs_on_reconnect(client):
    with client.websocket_connect("/ws") as driver_ws:
        driver_ws.send_json({"type": "AUTH", "token": "test-user-1"})
        driver_ws.receive_json()
        driver_ws.receive_json()

        ride_id = request_ride(client).json()["id"]
        new_request = driver_ws.receive_json()
        assert new_request["type"] == "NEW_RIDE_REQUEST"
        assert new_request["ride"]["id"] == ride_id
        assert "payment_reference" not in new_request["ride"]

        with client.websocket_connect("/ws") as passenger_ws:
            passenger_ws.send_json({"type": "AUTH", "token": "test-user-4"})
            passenger_ws.receive_json()
            sync = passenger_ws.receive_json()
            assert sync["type"] == "ACTIVE_RIDE_SYNC"
            assert sync["ride"]["status"] == "solicitado"

            set_ride_status(client, ride_id, "aceptado")
            for ws in (driver_ws, passenger_ws):
                update = ws.receive_json()
                assert update["type"] == "RIDE_STATUS_UPDATED"
                assert update["new_status"] == "aceptado"
                assert update["ride"]["status"] == "aceptado"
                assert ws.receive_json() == {
                    "type": "DRIVER_AVAILABILITY_CHANGED",
                    "driver_id": 1,
                    "is_available": False,
                }


def test_health_endpoint(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
