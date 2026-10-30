"""Términos y Condiciones: se aceptan al registrarse (o al entrar si cambiaron),
el servidor guarda la versión y la fecha, y sin aceptarlos no se usan viajes ni diamantes."""
from app import config
from app.models import User
from tests.test_api import VALID_REGISTRATION, auth_headers, client  # noqa: F401  (fixture compartido)

NEW_USER = {"Authorization": "Bearer test-new-user"}
RIDE = {"driver_id": 1, "origin": "UNC", "destination": "IVIC", "payment_method": "efectivo"}


def forget_terms(client, user_id: int) -> None:
    db = client.session_factory()
    db.query(User).filter(User.id == user_id).update({"terms_version": None, "terms_accepted_at": None})
    db.commit()
    db.close()


def test_terms_and_privacy_pages_are_public(client):
    assert client.get("/api/legal").json() == {
        "version": config.LEGAL_VERSION, "terms_url": "/terminos", "privacy_url": "/privacidad",
    }
    terms = client.get("/terminos")
    assert terms.status_code == 200 and "Términos y Condiciones de LITHIO" in terms.text
    assert "6 minutos" in terms.text and "mayor de 18 años" in terms.text
    assert f"Versión {config.LEGAL_VERSION}" in terms.text
    assert "{contacto}" not in terms.text
    privacy = client.get("/privacidad")
    assert privacy.status_code == 200 and f"Versión {config.LEGAL_VERSION}" in privacy.text
    assert "habeas data" in privacy.text


def test_passengers_must_be_adults(client):
    minor = client.post("/api/passengers/register", json={**VALID_REGISTRATION, "age": 17}, headers=NEW_USER)
    assert minor.status_code == 422


def test_registration_requires_accepting_the_current_terms(client):
    missing = {key: value for key, value in VALID_REGISTRATION.items() if key != "accepted_terms_version"}
    assert client.post("/api/passengers/register", json=missing, headers=NEW_USER).status_code == 422
    old = client.post("/api/passengers/register", json={**VALID_REGISTRATION, "accepted_terms_version": "2020-01-01"}, headers=NEW_USER)
    assert old.status_code == 422 and "Términos" in old.text

    created = client.post("/api/passengers/register", json=VALID_REGISTRATION, headers=NEW_USER)
    assert created.status_code == 201
    body = created.json()
    assert body["terms_version"] == config.LEGAL_VERSION and body["terms_pending"] is False
    db = client.session_factory()
    user = db.query(User).filter(User.id == body["id"]).one()
    assert user.terms_accepted_at is not None
    db.close()


def test_existing_account_must_accept_before_riding_or_moving_diamonds(client):
    forget_terms(client, 4)
    forget_terms(client, 1)
    me = client.get("/api/users/me", headers=auth_headers(4)).json()
    assert me["terms_pending"] is True and me["terms_version"] is None

    blocked = client.post("/api/rides?passenger_id=4", json=RIDE, headers=auth_headers(4))
    assert blocked.status_code == 403 and blocked.headers["X-Terms-Required"] == "1"
    assert client.post("/api/wallet/transfers", json={"amount": 1, "to_code": "ABCD"}, headers=auth_headers(4)).status_code == 403
    assert client.put("/api/drivers/1/availability", json={"is_available": True}, headers=auth_headers(1)).status_code == 403
    # Su perfil, el historial y la cuenta siguen disponibles (y puede borrarla).
    assert client.get("/api/rides/mine", headers=auth_headers(4)).status_code == 200

    assert client.post("/api/legal/accept", json={"version": "2020-01-01"}, headers=auth_headers(4)).status_code == 409
    assert client.post("/api/legal/accept", json={"version": config.LEGAL_VERSION, "role": "admin"}, headers=auth_headers(4)).status_code == 422
    accepted = client.post("/api/legal/accept", json={"version": config.LEGAL_VERSION}, headers=auth_headers(4))
    assert accepted.status_code == 200 and accepted.json()["version"] == config.LEGAL_VERSION
    assert client.get("/api/users/me", headers=auth_headers(4)).json()["terms_pending"] is False
    assert client.post("/api/rides?passenger_id=4", json=RIDE, headers=auth_headers(4)).status_code == 200


def test_accepting_terms_requires_a_session(client):
    assert client.post("/api/legal/accept", json={"version": config.LEGAL_VERSION}).status_code == 401
