"""Bono de bienvenida: 2 diamantes a cada cuenta nueva, una sola vez."""
from app import wallet_service
from tests.test_api import VALID_REGISTRATION, auth_headers, client  # noqa: F401  (fixture compartido)

NEW_USER = {"Authorization": "Bearer test-new-user"}


def test_new_passenger_gets_two_diamonds_once(client):
    res = client.post("/api/passengers/register", json=VALID_REGISTRATION, headers=NEW_USER)
    assert res.status_code == 201, res.text

    wallet = client.get("/api/wallet", headers=NEW_USER).json()
    assert wallet["balance"] == 2.0
    bonus = [t for t in wallet["transactions"] if t["kind"] == "bono_bienvenida"]
    assert len(bonus) == 1 and bonus[0]["amount"] == 2.0 and bonus[0]["label"] == "Bono de bienvenida"

    # Registrarse otra vez con la misma cuenta no da otro bono.
    again = client.post("/api/passengers/register", json=VALID_REGISTRATION, headers=NEW_USER)
    assert again.status_code in (200, 201)
    assert client.get("/api/wallet", headers=NEW_USER).json()["balance"] == 2.0


def test_existing_accounts_do_not_get_the_bonus(client):
    wallet = client.get("/api/wallet", headers=auth_headers(4)).json()
    assert not [t for t in wallet["transactions"] if t["kind"] == "bono_bienvenida"]


def test_bonus_can_be_turned_off(client, monkeypatch):
    monkeypatch.setattr(wallet_service, "WELCOME_BONUS_CENTS", 0)
    assert client.post("/api/passengers/register", json=VALID_REGISTRATION, headers=NEW_USER).status_code == 201
    assert client.get("/api/wallet", headers=NEW_USER).json()["balance"] == 0
