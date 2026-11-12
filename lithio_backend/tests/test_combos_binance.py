"""COMBOS de la Tienda Fe (pases para rutas internas) y recargas por Binance Pay."""
from app.models import Route, User
from app.routers import fe_store, wallet as wallet_router
from tests.test_api import auth_headers, client  # noqa: F401  (fixture compartido)
from tests.test_phase4a import balance, give_diamonds

ADMIN = {"Authorization": "Bearer test-admin"}
INTERNAL = {"driver_id": 1, "origin": "UNC", "destination": "BIBLIOTECA", "payment_method": "pase"}


def make_internal(client):
    with client.session_factory() as db:
        db.query(Route).filter(Route.origin == "UNC", Route.destination == "BIBLIOTECA").update({"scope": "interna"})
        db.commit()


def passes(client, user_id):
    return client.get("/api/fe-store", headers=auth_headers(user_id)).json()["ride_passes"]


def buy(client, combo_id="combo-10", user_id=4):
    return client.post("/api/fe-store/combos", json={"combo_id": combo_id}, headers=auth_headers(user_id))


def test_store_lists_combos_and_buying_credits_passes_at_once(client):
    store = client.get("/api/fe-store", headers=auth_headers(4)).json()
    assert {"id": "combo-10", "title": "10 viajes internos", "passes": 10, "price": 10.0} in store["combos"]
    assert store["ride_passes"] == 0

    assert buy(client).status_code == 400  # Sin diamantes
    give_diamonds(client, 4, 12)
    bought = buy(client)
    assert bought.status_code == 200, bought.text
    assert bought.json() == {"ride_passes": 10, "diamonds": 2.0}
    assert balance(client, 4) == 2
    history = client.get("/api/wallet", headers=auth_headers(4)).json()["transactions"]
    assert history[0]["kind"] == "combo" and history[0]["amount"] == -10.0
    assert buy(client, "no-existe").status_code == 404


def test_pass_pays_an_internal_ride_and_driver_gets_the_full_fare(client):
    make_internal(client)
    assert client.post("/api/rides?passenger_id=4", json=INTERNAL, headers=auth_headers(4)).status_code == 400  # Sin pases
    give_diamonds(client, 4, 10)
    buy(client)

    ride = client.post("/api/rides?passenger_id=4", json=INTERNAL, headers=auth_headers(4))
    assert ride.status_code == 200, ride.text
    assert passes(client, 4) == 9
    for status in ("aceptado", "en_curso", "completado"):
        assert client.put(f"/api/rides/{ride.json()['id']}/status", json={"status": status}, headers=auth_headers(1)).status_code == 200
    assert passes(client, 4) == 9
    assert balance(client, 4) == 0
    assert balance(client, 1) == 1.5  # Tarifa completa de la ruta, en diamantes
    # El pase no ensucia el historial de diamantes del pasajero.
    kinds = [t["kind"] for t in client.get("/api/wallet", headers=auth_headers(4)).json()["transactions"]]
    assert "pase_viaje" not in kinds


def test_pass_returns_when_the_ride_is_rejected(client):
    make_internal(client)
    give_diamonds(client, 4, 10)
    buy(client)
    ride = client.post("/api/rides?passenger_id=4", json=INTERNAL, headers=auth_headers(4)).json()
    client.put(f"/api/rides/{ride['id']}/status", json={"status": "rechazado"}, headers=auth_headers(1))
    assert passes(client, 4) == 10
    assert balance(client, 1) == 0


def test_pass_is_rejected_on_external_routes(client):
    give_diamonds(client, 4, 10)
    buy(client)
    external = client.post(
        "/api/rides?passenger_id=4", json={**INTERNAL, "destination": "CARACAS"}, headers=auth_headers(4)
    )
    assert external.status_code == 400 and "internas" in external.json()["detail"]
    assert passes(client, 4) == 10


def test_topup_by_binance_pay_needs_configuration_and_is_reviewed(client, monkeypatch):
    payload = {"amount": 5, "reference": "BIN12345", "method": "binance_pay"}
    monkeypatch.setattr(wallet_router, "BINANCE_PAY_ID", "")
    assert client.get("/api/wallet", headers=auth_headers(4)).json()["binance_pay"] is None
    assert client.post("/api/wallet/topups", json=payload, headers=auth_headers(4)).status_code == 400

    monkeypatch.setattr(wallet_router, "BINANCE_PAY_ID", "pagos@example.test")
    info = client.get("/api/wallet", headers=auth_headers(4)).json()["binance_pay"]
    assert info["pay_id"] == "pagos@example.test" and info["url"].startswith("https://")
    topup = client.post("/api/wallet/topups", json=payload, headers=auth_headers(4))
    assert topup.status_code == 201 and topup.json()["note"] == "Binance Pay en revisión"
    assert balance(client, 4) == 0  # Queda en revisión hasta que el administrador la aprueba
    client.put(f"/api/admin/wallet/transactions/{topup.json()['id']}", json={"action": "aprobar"}, headers=ADMIN)
    assert balance(client, 4) == 5
    assert client.post("/api/wallet/topups", json={**payload, "method": "zelle"}, headers=auth_headers(4)).status_code == 422


def test_combo_catalog_is_well_formed():
    ids = [c["id"] for c in fe_store.COMBOS]
    assert len(ids) == len(set(ids))
    assert all(c["passes"] > 0 and c["price"] > 0 for c in fe_store.COMBOS)
    assert User.ride_passes is not None
