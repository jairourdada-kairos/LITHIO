"""Rachas semanales, recordatorios, demanda sin conductores y analítica del panel."""
from datetime import datetime, timedelta

from app import main, retention_service
from app.database import get_db
from app.models import DemandEvent, DriverProfile, Ride, User
from tests.test_api import auth_headers, client  # noqa: F401  (fixture compartido)

ADMIN = {"Authorization": "Bearer test-admin"}
# Jueves 5 de noviembre de 2026, 12:00 en Venezuela (16:00 UTC).
THURSDAY_NOON = datetime(2026, 11, 5, 16, 0)
TOKEN = "ExponentPushToken[pasajera]"


def session():
    return next(main.app.dependency_overrides[get_db]())


def add_completed(db, passenger_id, created_at, driver_id=1):
    db.add(Ride(passenger_id=passenger_id, driver_id=driver_id, origin="UNC", destination="IVIC",
                status="completado", created_at=created_at))


def set_drivers_unavailable(db):
    db.query(DriverProfile).update({"is_available": False})
    db.commit()


# --- Rachas ----------------------------------------------------------------------

def test_streak_counts_consecutive_weeks_and_forgives_the_current_one():
    now = THURSDAY_NOON
    three_weeks = [now - timedelta(weeks=1), now - timedelta(weeks=2), now - timedelta(weeks=3)]
    assert retention_service.streak_from(three_weeks, now) == {"weeks": 3, "best": 3, "active_this_week": False}
    assert retention_service.streak_from([now, *three_weeks], now) == {"weeks": 4, "best": 4, "active_this_week": True}
    # Dos viajes la misma semana cuentan una sola.
    assert retention_service.streak_from([now, now - timedelta(hours=1)], now)["weeks"] == 1
    # Una semana completa sin viajar la rompe, pero la mejor marca queda.
    broken = [now - timedelta(weeks=2), now - timedelta(weeks=3)]
    assert retention_service.streak_from(broken, now) == {"weeks": 0, "best": 2, "active_this_week": False}
    assert retention_service.streak_from([], now) == {"weeks": 0, "best": 0, "active_this_week": False}


def test_week_boundary_uses_venezuela_time():
    # Lunes 02:00 UTC todavía es domingo en Venezuela.
    monday_utc = datetime(2026, 11, 2, 2, 0)
    assert retention_service.week_of(monday_utc).isoformat() == "2026-10-26"


def test_summary_includes_streak_and_reminder_preference(client):
    db = session()
    add_completed(db, 4, main.utcnow())
    db.commit()
    db.close()
    summary = client.get("/api/users/me/summary?role=pasajero", headers=auth_headers(4)).json()
    assert summary["streak"]["weeks"] == 1 and summary["streak"]["active_this_week"] is True
    assert summary["retention_push_enabled"] is True
    # La racha de conductor es aparte: esa cuenta no ha conducido.
    assert client.get("/api/users/me/summary?role=conductor", headers=auth_headers(4)).json()["streak"]["weeks"] == 0


# --- Recordatorios ---------------------------------------------------------------

def give_token(db):
    db.get(User, 4).push_token = TOKEN
    db.commit()


def test_streak_at_risk_reminder_goes_once_a_week(client, push_outbox):
    db = session()
    give_token(db)
    for weeks in (1, 2):
        add_completed(db, 4, THURSDAY_NOON - timedelta(weeks=weeks))
    db.commit()

    assert retention_service.send_due_reminders(db, THURSDAY_NOON) == 1
    assert push_outbox[-1]["to"] == TOKEN and "racha de 2 semanas" in push_outbox[-1]["title"]
    # Una hora o seis días después no se repite.
    assert retention_service.send_due_reminders(db, THURSDAY_NOON + timedelta(hours=1)) == 0
    assert retention_service.send_due_reminders(db, THURSDAY_NOON + timedelta(days=6)) == 0
    db.close()


def test_no_reminders_at_night_when_disabled_or_without_drivers(client, push_outbox):
    db = session()
    give_token(db)
    add_completed(db, 4, THURSDAY_NOON - timedelta(days=20))
    db.commit()

    assert retention_service.send_due_reminders(db, datetime(2026, 11, 5, 6, 0)) == 0  # 02:00 en Venezuela

    db.get(User, 4).retention_push_enabled = False
    db.commit()
    assert retention_service.send_due_reminders(db, THURSDAY_NOON) == 0

    db.get(User, 4).retention_push_enabled = True
    db.query(DriverProfile).update({"verification_status": "pendiente"})
    db.commit()
    assert retention_service.send_due_reminders(db, THURSDAY_NOON) == 0
    assert push_outbox == []
    db.close()


def test_inactive_and_first_ride_reminders(client, push_outbox):
    db = session()
    give_token(db)
    db.get(User, 4).created_at = THURSDAY_NOON - timedelta(days=5)
    db.commit()
    assert retention_service.send_due_reminders(db, THURSDAY_NOON) == 1
    assert push_outbox[-1]["title"] == "Tu primer viaje te espera"

    db.get(User, 4).last_retention_push_at = None
    add_completed(db, 4, THURSDAY_NOON - timedelta(days=20))
    db.commit()
    assert retention_service.send_due_reminders(db, THURSDAY_NOON) == 1
    assert push_outbox[-1]["title"] == "Tus rutas siguen en LITHIO"
    db.close()


def test_passenger_can_turn_reminders_off(client):
    response = client.put("/api/users/me/retention-push", json={"enabled": False}, headers=auth_headers(4))
    assert response.status_code == 200 and response.json()["retention_push_enabled"] is False
    assert client.get("/api/users/me/summary", headers=auth_headers(4)).json()["retention_push_enabled"] is False


# --- Demanda sin conductores ------------------------------------------------------

def daytime(monkeypatch):
    from app.routers import retention

    monkeypatch.setattr(retention, "utcnow", lambda: THURSDAY_NOON)


def test_no_drivers_report_is_ignored_if_someone_is_free(client, push_outbox):
    response = client.post("/api/demand/no-drivers", headers=auth_headers(4)).json()
    assert response == {"recorded": False, "drivers_notified": 0}
    assert push_outbox == []


def test_no_drivers_alerts_offline_drivers_with_limits(client, push_outbox, monkeypatch):
    daytime(monkeypatch)
    db = session()
    set_drivers_unavailable(db)
    for driver_id in (1, 2):
        db.get(User, driver_id).push_token = f"ExponentPushToken[conductor{driver_id}]"
    db.commit()

    first = client.post("/api/demand/no-drivers", headers=auth_headers(4)).json()
    assert first == {"recorded": True, "drivers_notified": 3}
    assert {m["to"] for m in push_outbox} == {"ExponentPushToken[conductor1]", "ExponentPushToken[conductor2]"}
    assert push_outbox[-1]["title"] == "Hay pasajeros buscando moto"

    # El mismo pasajero insistiendo no cuenta dos veces ni vuelve a avisar.
    sent = len(push_outbox)
    assert client.post("/api/demand/no-drivers", headers=auth_headers(4)).json()["recorded"] is False
    assert len(push_outbox) == sent
    assert db.query(DemandEvent).count() == 1
    db.close()


def test_no_drivers_stays_quiet_at_night(client, push_outbox, monkeypatch):
    from app.routers import retention

    monkeypatch.setattr(retention, "utcnow", lambda: datetime(2026, 11, 5, 6, 0))  # 02:00 en Venezuela
    db = session()
    set_drivers_unavailable(db)
    db.get(User, 1).push_token = "ExponentPushToken[conductor1]"
    db.commit()
    assert client.post("/api/demand/no-drivers", headers=auth_headers(4)).json() == {"recorded": True, "drivers_notified": 0}
    assert push_outbox == []
    db.close()


# --- Analítica --------------------------------------------------------------------

def test_analytics_is_admin_only(client):
    assert client.get("/api/admin/analytics", headers=auth_headers(4)).status_code == 403


def test_analytics_measures_retention_and_unmet_demand(client):
    now = main.utcnow()
    db = session()
    add_completed(db, 4, now - timedelta(days=9))
    add_completed(db, 4, now - timedelta(days=1))
    add_completed(db, 5, now - timedelta(days=9))
    db.add(Ride(passenger_id=4, driver_id=2, origin="UNC", destination="IVIC", status="cancelado", created_at=now - timedelta(days=1)))
    db.add(DemandEvent(user_id=4, drivers_notified=2, created_at=now - timedelta(hours=2)))
    db.commit()
    db.close()

    data = client.get("/api/admin/analytics", headers=ADMIN).json()
    assert data["users"]["total"] == 5
    assert data["passengers"]["with_first_ride"] == 2 and data["passengers"]["activation_pct"] == 40
    assert data["passengers"]["repeat_pct"] == 50
    assert data["passengers"]["active_7d"] == 1
    # De los dos que viajaron la semana anterior, volvió uno.
    assert data["passengers"]["retained_week_pct"] == 50
    assert data["rides_7d"] == {"requested": 2, "completed": 1, "cancelled": 1, "rejected": 0, "completion_pct": 50}
    assert data["drivers"]["approved"] == 3 and data["drivers"]["available_now"] == 2
    assert data["unmet_demand_7d"]["events"] == 1 and data["unmet_demand_7d"]["passengers"] == 1
    assert len(data["weekly"]) == 8 and sum(w["completed"] for w in data["weekly"]) == 3
