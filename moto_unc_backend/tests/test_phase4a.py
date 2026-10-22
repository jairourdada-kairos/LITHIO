"""Fase 4A: postulación de conductores, billetera de diamantes, enlaces,
niveles por elemento y Reacción del día."""
import pytest
from sqlalchemy import text

from app.links_service import level_for, threshold_for
from app.routers import quiz as quiz_module
from tests.test_api import VALID_REGISTRATION, auth_headers, client  # noqa: F401  (fixture compartido)

ADMIN = {"Authorization": "Bearer test-admin"}


def friend_code(client, user_id):
    return client.get("/api/users/me/summary", headers=auth_headers(user_id)).json()["friend_code"]


def link_users(client, a, b):
    """a envía la solicitud con el código de b y b la acepta."""
    created = client.post("/api/links", json={"code": friend_code(client, b)}, headers=auth_headers(a))
    assert created.status_code == 201
    accepted = client.post(f"/api/links/{created.json()['link_id']}/accept", headers=auth_headers(b))
    assert accepted.status_code == 200


def give_diamonds(client, user_id, amount):
    topup = client.post(
        "/api/wallet/topups", json={"amount": amount, "reference": "PM-123456"}, headers=auth_headers(user_id)
    ).json()
    reviewed = client.put(f"/api/admin/wallet/transactions/{topup['id']}", json={"action": "aprobar"}, headers=ADMIN)
    assert reviewed.status_code == 200


def balance(client, user_id):
    return client.get("/api/wallet", headers=auth_headers(user_id)).json()["balance"]


# --- Postulación de conductores ----------------------------------------------

def test_new_driver_waits_for_admin_approval(client):
    driver = client.post(
        "/api/drivers/register",
        json={**VALID_REGISTRATION, "age": 24, "plate": "AB123CD", "license_number": "LIC-778899", "moto_year": 2021},
        headers={"Authorization": "Bearer test-new-user"},
    )
    assert driver.status_code == 201
    driver_id = driver.json()["id"]
    headers = {"Authorization": "Bearer test-new-user"}

    application = client.get("/api/drivers/me/application", headers=headers).json()
    assert application["status"] == "pendiente"
    assert [step["done"] for step in application["steps"]] == [True, False, False, False]

    # Mientras está en revisión no aparece ni puede conectarse ni retirar.
    assert all(d["user_id"] != driver_id for d in client.get("/api/drivers").json())
    toggle = client.put(f"/api/drivers/{driver_id}/availability", json={"is_available": True}, headers=headers)
    assert toggle.status_code == 403
    assert "revisión" in toggle.json()["detail"]
    ride = client.post(
        "/api/rides?passenger_id=4",
        json={"driver_id": driver_id, "origin": "UNC", "destination": "IVIC", "payment_method": "efectivo"},
        headers=auth_headers(4),
    )
    assert ride.status_code == 404

    # Solo el administrador revisa postulaciones.
    assert client.get("/api/admin/driver-applications", headers=auth_headers(4)).status_code == 403
    pending = client.get("/api/admin/driver-applications", headers=ADMIN).json()
    assert [item["user_id"] for item in pending] == [driver_id]
    assert pending[0]["license_number"] == "LIC-778899"

    inspection = client.put(
        f"/api/admin/driver-applications/{driver_id}",
        json={"status": "inspeccion", "inspection_date": "Lunes 9:00, estacionamiento UNC", "notes": "Trae tus papeles"},
        headers=ADMIN,
    ).json()
    assert inspection["inspection_date"].startswith("Lunes")
    assert [step["done"] for step in inspection["steps"]] == [True, True, True, False]

    approved = client.put(f"/api/admin/driver-applications/{driver_id}", json={"status": "aprobado"}, headers=ADMIN)
    assert approved.json()["status"] == "aprobado"
    assert client.put(f"/api/drivers/{driver_id}/availability", json={"is_available": True}, headers=headers).status_code == 200
    assert any(d["user_id"] == driver_id and d["is_available"] for d in client.get("/api/drivers").json())

    with client.session_factory() as db:
        raw = db.execute(text("SELECT license_number FROM driver_profiles WHERE user_id = :id"), {"id": driver_id}).scalar_one()
    assert "LIC-778899" not in raw


def test_application_status_must_be_valid(client):
    assert client.put("/api/admin/driver-applications/1", json={"status": "vip"}, headers=ADMIN).status_code == 400


# --- Billetera ---------------------------------------------------------------

def test_topup_is_not_spendable_until_admin_approves(client):
    topup = client.post("/api/wallet/topups", json={"amount": 10, "reference": "PM-4821"}, headers=auth_headers(4))
    assert topup.status_code == 201
    assert topup.json()["status"] == "pendiente"
    assert balance(client, 4) == 0

    pending = client.get("/api/admin/wallet/pending", headers=ADMIN).json()
    assert pending[0]["reference"] == "PM-4821"
    client.put(f"/api/admin/wallet/transactions/{topup.json()['id']}", json={"action": "aprobar"}, headers=ADMIN)
    assert balance(client, 4) == 10
    # Procesar dos veces no duplica el saldo.
    again = client.put(f"/api/admin/wallet/transactions/{topup.json()['id']}", json={"action": "aprobar"}, headers=ADMIN)
    assert again.status_code == 409
    assert balance(client, 4) == 10


def test_transfers_only_to_links_and_within_limits(client):
    give_diamonds(client, 4, 120)
    code_2 = friend_code(client, 2)

    not_linked = client.post("/api/wallet/transfers", json={"to_code": code_2, "amount": 5}, headers=auth_headers(4))
    assert not_linked.status_code == 403

    link_users(client, 4, 2)
    sent = client.post("/api/wallet/transfers", json={"to_code": code_2.lower(), "amount": 5.25, "note": "Pasaje"}, headers=auth_headers(4))
    assert sent.status_code == 201
    assert balance(client, 4) == 114.75
    assert balance(client, 2) == 5.25

    too_big = client.post("/api/wallet/transfers", json={"to_code": code_2, "amount": 60}, headers=auth_headers(4))
    assert too_big.status_code == 400
    for _ in range(2):
        assert client.post("/api/wallet/transfers", json={"to_code": code_2, "amount": 45}, headers=auth_headers(4)).status_code == 201
    daily_limit = client.post("/api/wallet/transfers", json={"to_code": code_2, "amount": 10}, headers=auth_headers(4))
    assert daily_limit.status_code == 400
    assert "límite diario" in daily_limit.json()["detail"]


def test_cannot_send_more_than_balance(client):
    link_users(client, 4, 2)
    response = client.post("/api/wallet/transfers", json={"to_code": friend_code(client, 2), "amount": 1}, headers=auth_headers(4))
    assert response.status_code == 400
    assert "Saldo insuficiente" in response.json()["detail"]


def test_donations_feed_the_solidarity_fund(client):
    give_diamonds(client, 4, 10)
    donation = client.post("/api/wallet/donations", json={"amount": 3}, headers=auth_headers(4))
    assert donation.status_code == 201
    wallet = client.get("/api/wallet", headers=auth_headers(4)).json()
    assert wallet["balance"] == 7
    assert wallet["fund"] == {"donated": 3.0, "donors": 1}
    assert wallet["transactions"][0]["label"] == "Donación al Fondo Solidario"


def test_driver_withdrawal_and_workshop_hold_until_reviewed(client):
    from app.models import WorkshopReward

    with client.session_factory() as db:
        db.add(WorkshopReward(title="Cambio de aceite", cost_cents=800))
        db.commit()
    give_diamonds(client, 1, 20)
    # Un pasajero no puede retirar.
    assert client.post("/api/wallet/withdrawals", json={"amount": 5, "destination": "0412-1234567 BDV"}, headers=auth_headers(4)).status_code == 403

    withdrawal = client.post("/api/wallet/withdrawals", json={"amount": 5, "destination": "0412-1234567 BDV"}, headers=auth_headers(1)).json()
    assert balance(client, 1) == 15  # Retenido mientras se revisa
    client.put(f"/api/admin/wallet/transactions/{withdrawal['id']}", json={"action": "rechazar", "note": "Datos incompletos"}, headers=ADMIN)
    assert balance(client, 1) == 20  # Devuelto

    catalog = client.get("/api/wallet/workshop", headers=auth_headers(1)).json()
    oil = next(item for item in catalog if item["title"] == "Cambio de aceite")
    redeem = client.post(f"/api/wallet/workshop/{oil['id']}/redeem", headers=auth_headers(1))
    assert redeem.status_code == 201
    assert balance(client, 1) == 12
    client.put(f"/api/admin/wallet/transactions/{redeem.json()['id']}", json={"action": "aprobar"}, headers=ADMIN)
    assert balance(client, 1) == 12


def test_ride_paid_with_diamonds_is_held_then_settled(client):
    ride_payload = {"driver_id": 1, "origin": "UNC", "destination": "IVIC", "payment_method": "diamantes", "fare_amount": 2}
    insufficient = client.post("/api/rides?passenger_id=4", json=ride_payload, headers=auth_headers(4))
    assert insufficient.status_code == 400

    give_diamonds(client, 4, 5)
    ride = client.post("/api/rides?passenger_id=4", json=ride_payload, headers=auth_headers(4)).json()
    assert balance(client, 4) == 3  # Tarifa retenida

    for status in ("aceptado", "en_curso", "completado"):
        assert client.put(f"/api/rides/{ride['id']}/status", json={"status": status}, headers=auth_headers(1)).status_code == 200
    assert balance(client, 4) == 3
    assert balance(client, 1) == 2


def test_cancelled_diamond_ride_is_refunded(client):
    give_diamonds(client, 4, 5)
    ride = client.post(
        "/api/rides?passenger_id=4",
        json={"driver_id": 1, "origin": "UNC", "destination": "IVIC", "payment_method": "diamantes", "fare_amount": 2},
        headers=auth_headers(4),
    ).json()
    client.put(f"/api/rides/{ride['id']}/status", json={"status": "rechazado"}, headers=auth_headers(1))
    assert balance(client, 4) == 5


# --- Enlaces -------------------------------------------------------------------

def test_links_request_accept_and_remove(client):
    code_1 = friend_code(client, 1)
    assert code_1.startswith("Li-") and len(code_1) == 7

    assert client.post("/api/links", json={"code": friend_code(client, 4)}, headers=auth_headers(4)).status_code == 400
    assert client.post("/api/links", json={"code": "Li-ZZZZ"}, headers=auth_headers(4)).status_code == 404

    request = client.post("/api/links", json={"code": code_1}, headers=auth_headers(4)).json()
    assert client.post("/api/links", json={"code": code_1}, headers=auth_headers(4)).status_code == 409
    incoming = client.get("/api/links", headers=auth_headers(1)).json()["incoming"]
    assert incoming[0]["name"] == "Sofia"

    # Si el otro también envía el código, el enlace se acepta.
    mutual = client.post("/api/links", json={"code": friend_code(client, 4)}, headers=auth_headers(1))
    assert mutual.status_code == 201
    links = client.get("/api/links", headers=auth_headers(4)).json()["links"]
    assert links[0]["name"] == "Jairo"
    assert links[0]["bond"] == "nuevo"
    assert links[0]["element"]["symbol"] == "H"

    # Un tercero no puede aceptar ni borrar el enlace ajeno.
    assert client.delete(f"/api/links/{request['link_id']}", headers=auth_headers(2)).status_code == 404
    assert client.delete(f"/api/links/{request['link_id']}", headers=auth_headers(4)).status_code == 200
    assert client.get("/api/links", headers=auth_headers(4)).json()["links"] == []


# --- Niveles y Reacción del día -------------------------------------------------

def test_levels_follow_the_periodic_table():
    assert [threshold_for(z) for z in (1, 2, 3, 4)] == [0, 50, 150, 300]
    assert level_for(0)["symbol"] == "H"
    assert level_for(149)["symbol"] == "He"
    lithium = level_for(150)
    assert (lithium["z"], lithium["symbol"], lithium["next_symbol"], lithium["next_threshold"]) == (3, "Li", "Be", 300)
    assert level_for(10**9)["symbol"] == "Kr"
    assert level_for(10**9)["next_threshold"] is None


def test_daily_reaction_awards_fe_once(client, monkeypatch):
    day = quiz_module.venezuela_today()
    _, _, correct, _ = quiz_module.question_for(day)

    today = client.get("/api/quiz/today", headers=auth_headers(4)).json()
    assert today["answered"] is False
    assert len(today["options"]) == 3
    assert "correct_index" not in today  # La respuesta no se filtra antes de contestar

    before = client.get("/api/users/me/summary", headers=auth_headers(4)).json()
    answer = client.post("/api/quiz/today", json={"option": correct}, headers=auth_headers(4)).json()
    assert answer["correct"] is True and answer["fe_awarded"] == 10
    after = client.get("/api/users/me/summary", headers=auth_headers(4)).json()
    assert after["points"] == before["points"] + 10
    assert after["level"]["fe_lifetime"] == before["level"]["fe_lifetime"] + 10

    again = client.post("/api/quiz/today", json={"option": correct}, headers=auth_headers(4))
    assert again.status_code == 409
    assert client.get("/api/quiz/today", headers=auth_headers(4)).json()["answered"] is True


def test_quiz_correct_answer_position_varies():
    from datetime import date, timedelta

    start = date(2026, 1, 1)
    positions = {quiz_module.question_for(start + timedelta(days=i))[2] for i in range(30)}
    assert len(positions) > 1
