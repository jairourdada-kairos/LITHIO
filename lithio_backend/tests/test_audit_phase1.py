"""Auditoría Fase 1 (AppSec): BOLA/IDOR, atomicidad financiera en SQLite,
prevención de reutilización de referencias de Pago Móvil, subida segura de
archivos y limpieza de sesiones WebSocket."""
from fastapi import HTTPException
import pytest

from app import main, wallet_service
from app.database import get_db
from app.models import DriverProfile, Ride, User, WalletTransaction
from app.realtime import ConnectionManager
from app.routers.profile import _detect_format, safe_evidence_path
from tests.test_api import auth_headers, client  # noqa: F401  (fixture compartido)
from tests.test_phase4a import ADMIN, PNG, balance, give_diamonds


def session():
    return next(main.app.dependency_overrides[get_db]())


# --- 1. Control de Acceso y BOLA / IDOR --------------------------------------

def test_switch_role_requires_own_account_and_approved_driver_for_conductor_or_ambos(client):
    # Un pasajero sin DriverProfile no puede pasar a conductor ni a ambos.
    for target_role in ("conductor", "ambos"):
        res = client.post(
            "/api/users/4/switch-role",
            json={"new_role": target_role},
            headers=auth_headers(4),
        )
        assert res.status_code == 400

    # Un conductor cuya postulación no está aprobada no puede activar conductor ni ambos.
    db = session()
    profile = db.query(DriverProfile).filter(DriverProfile.user_id == 1).one()
    for status in ("pendiente", "en_revision", "inspeccion", "rechazado", "eliminado"):
        profile.verification_status = status
        db.commit()
        for target_role in ("conductor", "ambos"):
            denied = client.post(
                "/api/users/1/switch-role",
                json={"new_role": target_role},
                headers=auth_headers(1),
            )
            assert denied.status_code == 403, (status, target_role)
        # Pero siempre puede volver al modo pasajero.
        assert client.post(
            "/api/users/1/switch-role",
            json={"new_role": "pasajero"},
            headers=auth_headers(1),
        ).status_code == 200

    profile.verification_status = "aprobado"
    db.commit()
    for target_role in ("conductor", "ambos"):
        ok = client.post(
            "/api/users/1/switch-role",
            json={"new_role": target_role},
            headers=auth_headers(1),
        )
        assert ok.status_code == 200 and ok.json()["role"] == target_role


def test_bola_idor_protection_across_ride_and_wallet_endpoints(client):
    ride = client.post(
        "/api/rides?passenger_id=4",
        json={
            "driver_id": 1,
            "origin": "UNC",
            "destination": "IVIC",
            "payment_method": "pago_movil",
        },
        headers=auth_headers(4),
    ).json()
    ride_id = ride["id"]

    # Otro usuario autenticado (conductor 2) no puede leer ni modificar recursos ajenos.
    assert client.get("/api/rides/active/4", headers=auth_headers(2)).status_code == 403
    assert client.put("/api/drivers/1/availability", json={"is_available": False}, headers=auth_headers(2)).status_code == 403
    for status in ("aceptado", "en_camino", "en_curso", "completado", "cancelado"):
        assert client.put(f"/api/rides/{ride_id}/status", json={"status": status}, headers=auth_headers(2)).status_code == 403
    assert client.get(f"/api/rides/{ride_id}/detail", headers=auth_headers(2)).status_code == 404
    assert client.get(f"/api/rides/{ride_id}/receipt", headers=auth_headers(2)).status_code == 404
    assert client.post(
        f"/api/rides/{ride_id}/receipt",
        files={"photo": ("p.png", PNG, "image/png")},
        headers=auth_headers(2),
    ).status_code == 404

    # Si la postulación del conductor deja de estar aprobada antes de aceptar, no puede aceptar el viaje.
    db = session()
    profile = db.query(DriverProfile).filter(DriverProfile.user_id == 1).one()
    profile.verification_status = "rechazado"
    db.commit()
    assert client.put(f"/api/rides/{ride_id}/status", json={"status": "aceptado"}, headers=auth_headers(1)).status_code == 403
    profile.verification_status = "aprobado"
    db.commit()

    # En la billetera, ni otro usuario ni el administrador pueden subir comprobantes en nombre del titular.
    topup = client.post(
        "/api/wallet/topups",
        json={"amount": 10, "reference": "PM-BOLA01"},
        headers=auth_headers(4),
    ).json()
    tx_receipt_url = f"/api/wallet/transactions/{topup['id']}/receipt"
    photo = {"photo": ("p.png", PNG, "image/png")}
    assert client.post(tx_receipt_url, files=photo, headers=auth_headers(2)).status_code == 404
    assert client.post(tx_receipt_url, files=photo, headers=ADMIN).status_code == 403


# --- 2. Integridad Financiera sobre SQLite -----------------------------------

def test_atomic_wallet_debit_prevents_double_spend_on_sqlite(client):
    """Dos sesiones concurrentes leen 1000 centavos (10 Li⁺): solo una logra gastarlos."""
    db_a, db_b = session(), session()
    db_a.get(User, 4).diamonds_cents = 1000
    db_a.commit()

    user_a = db_a.get(User, 4)
    user_b = db_b.get(User, 4)
    assert user_a.diamonds_cents == 1000 and user_b.diamonds_cents == 1000

    wallet_service.record(db_a, user_a, "donacion", -1000)
    db_a.commit()

    with pytest.raises(HTTPException) as exc:
        wallet_service.record(db_b, user_b, "donacion", -1000)
    assert exc.value.status_code == 400
    assert session().get(User, 4).diamonds_cents == 0


def test_atomic_wallet_approve_and_reject_prevent_double_processing_on_sqlite(client):
    """Dos sesiones concurrentes no pueden aprobar ni reembolsar dos veces el mismo movimiento."""
    db_a, db_b = session(), session()
    tx = wallet_service.record(db_a, db_a.get(User, 4), "recarga", 2500, status="pendiente", reference="PM-ATOM1")
    db_a.commit()
    tx_id = tx.id

    tx_a = db_a.get(WalletTransaction, tx_id)
    tx_b = db_b.get(WalletTransaction, tx_id)
    wallet_service.approve(db_a, tx_a)
    db_a.commit()

    with pytest.raises(HTTPException) as exc:
        wallet_service.approve(db_b, tx_b)
    assert exc.value.status_code == 409
    assert session().get(User, 4).diamonds_cents == 2500

    # Ahora un retiro pendiente: rechazarlo en dos sesiones solo devuelve el saldo una vez.
    withdrawal = wallet_service.record(db_a, db_a.get(User, 4), "retiro", -1000, status="pendiente")
    db_a.commit()
    assert session().get(User, 4).diamonds_cents == 1500

    w_a = db_a.get(WalletTransaction, withdrawal.id)
    w_b = db_b.get(WalletTransaction, withdrawal.id)
    wallet_service.reject(db_a, w_a)
    db_a.commit()

    with pytest.raises(HTTPException) as exc:
        wallet_service.reject(db_b, w_b)
    assert exc.value.status_code == 409
    assert session().get(User, 4).diamonds_cents == 2500


def test_atomic_ride_pass_prevents_double_hold_on_sqlite(client):
    db_a, db_b = session(), session()
    db_a.get(User, 4).ride_passes = 1
    ride = Ride(passenger_id=4, driver_id=1, origin="UNC", destination="BIBLIOTECA", fare_amount=1.5)
    db_a.add(ride)
    db_a.commit()

    user_a = db_a.get(User, 4)
    user_b = db_b.get(User, 4)
    wallet_service.hold_ride_pass(db_a, user_a, ride)
    db_a.commit()

    with pytest.raises(HTTPException) as exc:
        wallet_service.hold_ride_pass(db_b, user_b, ride)
    assert exc.value.status_code == 400
    assert session().get(User, 4).ride_passes == 0


@pytest.mark.parametrize("bad_amount", [0, -0.01, -50, float("nan"), float("inf"), float("-inf"), True, False, "abc"])
def test_to_cents_rejects_invalid_and_negative_amounts(bad_amount):
    with pytest.raises(HTTPException) as exc:
        wallet_service.to_cents(bad_amount)
    assert exc.value.status_code == 400


def test_wallet_limits_enforced_for_topups_donations_and_withdrawals(client):
    # Recarga > 500 Li⁺ devuelve 400.
    over_topup = client.post(
        "/api/wallet/topups",
        json={"amount": 500.01, "reference": "PM-LIM501"},
        headers=auth_headers(4),
    )
    assert over_topup.status_code == 400 and "500" in over_topup.json()["detail"]

    # Donación por Pago Móvil > 500 Li⁺ devuelve 400.
    over_donation_pm = client.post(
        "/api/wallet/donations",
        json={"amount": 501, "method": "pago_movil", "reference": "PM-LIM502"},
        headers=auth_headers(4),
    )
    assert over_donation_pm.status_code == 400 and "500" in over_donation_pm.json()["detail"]

    # Donación con iones respeta el tope diario de 100 Li⁺.
    give_diamonds(client, 4, 150)
    assert client.post("/api/wallet/donations", json={"amount": 60}, headers=auth_headers(4)).status_code == 201
    over_daily = client.post("/api/wallet/donations", json={"amount": 40.01}, headers=auth_headers(4))
    assert over_daily.status_code == 400 and "100" in over_daily.json()["detail"]
    assert balance(client, 4) == 90


def test_pago_movil_references_cannot_be_reused(client):
    first = client.post(
        "/api/wallet/topups",
        json={"amount": 10, "reference": "PM-UNICO-01"},
        headers=auth_headers(4),
    )
    assert first.status_code == 201

    # Ni el mismo usuario ni otro pueden reutilizar la misma referencia (incluso con espacios o minúsculas).
    dup_topup = client.post(
        "/api/wallet/topups",
        json={"amount": 5, "reference": " pm-unico-01 "},
        headers=auth_headers(1),
    )
    assert dup_topup.status_code == 409

    dup_donation = client.post(
        "/api/wallet/donations",
        json={"amount": 5, "method": "pago_movil", "reference": "pm-unico-01"},
        headers=auth_headers(4),
    )
    assert dup_donation.status_code == 409

    # Si el administrador rechaza la recarga (ej. error al escribir el monto), la referencia queda libre.
    client.put(f"/api/admin/wallet/transactions/{first.json()['id']}", json={"action": "rechazar"}, headers=ADMIN)
    retry = client.post(
        "/api/wallet/topups",
        json={"amount": 10, "reference": "PM-UNICO-01"},
        headers=auth_headers(4),
    )
    assert retry.status_code == 201

    # Tampoco se puede reutilizar la misma referencia de Pago Móvil en dos viajes activos/completados.
    ride_1 = client.post(
        "/api/rides?passenger_id=4",
        json={"driver_id": 1, "origin": "UNC", "destination": "IVIC", "payment_method": "pago_movil"},
        headers=auth_headers(4),
    ).json()
    assert client.put(
        f"/api/rides/{ride_1['id']}/payment-reference",
        json={"reference": "BANCO-998877"},
        headers=auth_headers(4),
    ).status_code == 200
    for status in ("aceptado", "en_curso", "completado"):
        client.put(f"/api/rides/{ride_1['id']}/status", json={"status": status}, headers=auth_headers(1))

    ride_2 = client.post(
        "/api/rides?passenger_id=4",
        json={"driver_id": 1, "origin": "UNC", "destination": "IVIC", "payment_method": "pago_movil"},
        headers=auth_headers(4),
    ).json()
    dup_ride_ref = client.put(
        f"/api/rides/{ride_2['id']}/payment-reference",
        json={"reference": " banco 998877 "},
        headers=auth_headers(4),
    )
    assert dup_ride_ref.status_code == 409


# --- 3. Subida de Archivos y Tiempo Real (WS /ws) ----------------------------

def test_file_validation_and_path_traversal_defense(tmp_path):
    # Archivos truncados (< 12 bytes) aunque empiecen con magic bytes no pasan.
    assert _detect_format(b"") is None
    assert _detect_format(b"\xff\xd8\xff") is None
    assert _detect_format(b"\x89PNG\r\n\x1a\n") is None
    assert _detect_format(PNG) == "png"

    base = tmp_path / "evidence"
    base.mkdir()
    secret = tmp_path / "secret.txt"
    secret.write_text("top-secret", encoding="utf-8")
    valid = base / "1-abcdef.png"
    valid.write_bytes(PNG)
    subdir = base / "subdir"
    subdir.mkdir()

    assert safe_evidence_path(base, "1-abcdef.png") == valid.resolve()
    for malicious in (
        None,
        "",
        ".",
        "..",
        "../secret.txt",
        "..\\secret.txt",
        "subdir/../../secret.txt",
        "subdir",
        str(secret),
    ):
        assert safe_evidence_path(base, malicious) is None


def test_connection_manager_cleans_up_broken_sockets_and_sessions():
    import asyncio

    mgr = ConnectionManager()

    class BrokenSocket:
        async def send_text(self, payload: str):
            raise Exception("stream closed")

        async def close(self, code: int = 1000, reason: str = ""):
            raise Exception("already closed")

    ws = BrokenSocket()
    mgr.connect(99, ws, session_id="sess-1")
    assert mgr.is_connected(99)
    assert ws in mgr.sessions

    # Al fallar el envío se limpia tanto active_connections como sessions.
    asyncio.run(mgr.send_personal_message({"type": "PING"}, user_id=99))
    assert not mgr.is_connected(99)
    assert ws not in mgr.sessions
