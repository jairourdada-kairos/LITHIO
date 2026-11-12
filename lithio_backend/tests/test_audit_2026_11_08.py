"""Auditoría 2026-11-08: webhook sin token, día de Venezuela, límites de entrada y orden de bloqueos."""
from datetime import datetime, timedelta, timezone

from app import config
from app.database import get_db
from app import main
from app.models import Ride, User
from tests.test_api import auth_headers, client  # noqa: F401  (fixture compartido)


def session():
    return next(main.app.dependency_overrides[get_db]())


def test_whatsapp_verification_rejects_empty_token_when_not_configured(client, monkeypatch):
    monkeypatch.delenv("WHATSAPP_WEBHOOK_VERIFY_TOKEN", raising=False)
    response = client.get(
        "/webhooks/whatsapp",
        params={"hub.mode": "subscribe", "hub.verify_token": "", "hub.challenge": "x"},
    )
    assert response.status_code == 403


def test_whatsapp_verification_accepts_the_configured_token(client, monkeypatch):
    monkeypatch.setenv("WHATSAPP_WEBHOOK_VERIFY_TOKEN", "secreto-123")
    ok = client.get("/webhooks/whatsapp", params={"hub.mode": "subscribe", "hub.verify_token": "secreto-123", "hub.challenge": "42"})
    assert ok.status_code == 200 and ok.text == "42"
    bad = client.get("/webhooks/whatsapp", params={"hub.mode": "subscribe", "hub.verify_token": "otro", "hub.challenge": "42"})
    assert bad.status_code == 403


def test_ride_request_rejects_oversized_fields(client):
    response = client.post(
        "/api/rides",
        json={"driver_id": 1, "origin": "UNC", "destination": "IVIC", "payment_method": "efectivo", "payment_reference": "x" * 5000},
        headers=auth_headers(4),
    )
    assert response.status_code == 422


def test_fe_daily_cap_counts_the_venezuelan_day(client, monkeypatch):
    """Tres viajes premiados ayer en la noche de Venezuela (ya es el día siguiente en UTC) no cuentan hoy."""
    from app.links_service import RIDE_FE

    def complete_ride():
        ride = client.post(
            "/api/rides?passenger_id=4",
            json={"driver_id": 1, "origin": "UNC", "destination": "IVIC", "payment_method": "efectivo"},
            headers=auth_headers(4),
        ).json()
        for status in ("aceptado", "en_curso", "completado"):
            client.put(f"/api/rides/{ride['id']}/status", json={"status": status}, headers=auth_headers(1))
        return ride["id"]

    ids = [complete_ride() for _ in range(3)]
    # Los pasamos a las 21:00 de ayer en Venezuela = 01:00 UTC de hoy (si fuera hoy en UTC contarían).
    local_midnight = datetime.now(config.VENEZUELA_TZ).replace(hour=0, minute=0, second=0, microsecond=0)
    yesterday_9pm_utc = (local_midnight - timedelta(hours=3)).astimezone(timezone.utc).replace(tzinfo=None)
    db = session()
    for ride_id in ids:
        db.get(Ride, ride_id).created_at = yesterday_9pm_utc
    db.commit()

    before = client.get("/api/fe-store", headers=auth_headers(4)).json()["points"]
    complete_ride()
    after = client.get("/api/fe-store", headers=auth_headers(4)).json()["points"]
    assert after - before == RIDE_FE


def test_double_completion_does_not_pay_twice(client):
    ride = client.post(
        "/api/rides?passenger_id=4",
        json={"driver_id": 1, "origin": "UNC", "destination": "IVIC", "payment_method": "efectivo"},
        headers=auth_headers(4),
    ).json()
    for status in ("aceptado", "en_curso", "completado"):
        assert client.put(f"/api/rides/{ride['id']}/status", json={"status": status}, headers=auth_headers(1)).status_code == 200
    points = client.get("/api/fe-store", headers=auth_headers(4)).json()["points"]
    again = client.put(f"/api/rides/{ride['id']}/status", json={"status": "completado"}, headers=auth_headers(1))
    assert again.status_code == 400
    assert client.get("/api/fe-store", headers=auth_headers(4)).json()["points"] == points
    assert db_user_fe(1) >= 0


def db_user_fe(user_id):
    return session().get(User, user_id).points
