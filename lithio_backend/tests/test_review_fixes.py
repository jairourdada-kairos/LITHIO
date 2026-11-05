"""Arreglos de la revisión de código: gasto de Fe atómico, borrado de conductores, IP real y límites."""
from datetime import datetime
from types import SimpleNamespace

from fastapi import HTTPException
import pytest

from app import config, main, rate_limit, wallet_service
from app.database import get_db
from app.models import Ride, User
from app.routers.fe_store import _spend_fe
from tests.test_api import auth_headers, client  # noqa: F401  (fixture compartido)

ADMIN = {"Authorization": "Bearer test-admin"}


def session():
    return next(main.app.dependency_overrides[get_db]())


def test_spend_fe_cannot_use_the_same_balance_twice(client):
    """Dos peticiones cargaron al usuario con 150 Fe: solo una puede gastarlo."""
    db_a, db_b = session(), session()
    db_a.get(User, 4).points = 150
    db_a.commit()
    user_a, user_b = db_a.get(User, 4), db_b.get(User, 4)
    _spend_fe(db_a, user_a, 150)
    db_a.commit()
    with pytest.raises(HTTPException) as error:
        _spend_fe(db_b, user_b, 150)
    assert error.value.status_code == 400
    assert session().get(User, 4).points == 0


def test_store_requires_current_terms(client):
    db = session()
    db.get(User, 4).terms_version = "vieja"
    db.commit()
    response = client.post("/api/fe-store/coupons", json={"percent": 25}, headers=auth_headers(4))
    assert response.status_code == 403
    assert response.headers.get("X-Terms-Required") == "1"


def test_admin_delete_driver_keeps_history_and_hides_the_driver(client):
    db = session()
    db.add(Ride(passenger_id=4, driver_id=2, origin="UNC", destination="IVIC", status="completado"))
    db.commit()
    assert client.delete("/api/admin/drivers/2", headers=ADMIN).status_code == 200
    user = session().get(User, 2)
    assert user is not None and user.name == "Usuario eliminado" and user.email.endswith("@lithio.invalid")
    # El historial del pasajero sigue funcionando.
    history = client.get("/api/rides/mine", headers=auth_headers(4))
    assert history.status_code == 200 and history.json()[0]["driver_name"] == "Usuario eliminado"
    drivers = client.get("/api/admin/drivers", headers=ADMIN).json()
    assert 2 not in [item["user_id"] for item in drivers]


def test_admin_cannot_delete_driver_with_open_ride(client):
    db = session()
    db.add(Ride(passenger_id=4, driver_id=2, origin="UNC", destination="IVIC", status="aceptado"))
    db.commit()
    assert client.delete("/api/admin/drivers/2", headers=ADMIN).status_code == 409


def test_transfer_gives_the_same_answer_for_unknown_and_unlinked_codes(client):
    db = session()
    db.get(User, 4).diamonds_cents = 1000
    db.get(User, 1).friend_code = "Li-AAAA"
    db.commit()
    unlinked = client.post("/api/wallet/transfers", json={"amount": 1, "to_code": "Li-AAAA"}, headers=auth_headers(4))
    unknown = client.post("/api/wallet/transfers", json={"amount": 1, "to_code": "Li-ZZZZ"}, headers=auth_headers(4))
    assert unlinked.status_code == unknown.status_code == 404
    assert unlinked.json() == unknown.json()


def test_daily_limit_counts_from_venezuelan_midnight(client, monkeypatch):
    """A las 21:00 en Venezuela (01:00 UTC del día siguiente) lo enviado a las 19:00 sigue contando."""
    db = session()
    db.get(User, 4).diamonds_cents = 10_000
    db.commit()
    wallet_service.record(db, db.get(User, 4), "envio", -3000)
    db.commit()
    real_datetime = datetime

    class FakeDatetime(real_datetime):
        @classmethod
        def now(cls, tz=None):
            return real_datetime(2026, 11, 5, 21, 0, tzinfo=config.VENEZUELA_TZ).astimezone(tz)

    monkeypatch.setattr(wallet_service, "datetime", FakeDatetime)
    # La transacción de arriba se guardó "ahora" real; se la deja a las 19:00 locales (23:00 UTC).
    from app.models import WalletTransaction
    tx = db.query(WalletTransaction).filter(WalletTransaction.kind == "envio").first()
    tx.created_at = real_datetime(2026, 11, 5, 23, 0)
    db.commit()
    assert wallet_service.outgoing_today_cents(db, 4) == 3000


def request_with(host, headers):
    return SimpleNamespace(client=SimpleNamespace(host=host), headers=headers)


def test_client_ip_ignores_forged_forwarded_for_in_the_cloud(monkeypatch):
    monkeypatch.setattr(config, "BEHIND_PROXY", True)
    request = request_with("1.2.3.4", {"X-Forwarded-For": "9.9.9.9, 203.0.113.7"})
    assert rate_limit.client_ip(request) == "203.0.113.7"
    # Un cliente que dice ser 127.0.0.1 y trae su propio CF-Connecting-IP tampoco engaña al límite.
    forged = request_with("9.9.9.9", {"X-Forwarded-For": "127.0.0.1, 203.0.113.8", "CF-Connecting-IP": "6.6.6.6"})
    assert rate_limit.client_ip(forged) == "203.0.113.8"


def test_client_ip_uses_cloudflare_header_on_the_local_tunnel(monkeypatch):
    monkeypatch.setattr(config, "BEHIND_PROXY", False)
    request = request_with("127.0.0.1", {"CF-Connecting-IP": "198.51.100.4", "X-Forwarded-For": "1.1.1.1"})
    assert rate_limit.client_ip(request) == "198.51.100.4"


def test_quiz_questions_are_well_formed_and_mix_topics():
    from app.routers.quiz import GENERAL, QUESTIONS

    assert len(QUESTIONS) > len(GENERAL) + 30
    for question, options, correct, fact in QUESTIONS:
        assert question.strip() and fact.strip()
        assert len(options) == 3 and len(set(options)) == 3
        assert 0 <= correct < 3
    assert len({item[0] for item in QUESTIONS}) == len(QUESTIONS)
    # Cada tema nuevo aparece en las primeras vueltas, no al final de la lista.
    assert any("LLM" in item[0] for item in QUESTIONS[:12])
    assert any("epistemicidio" in item[0] for item in QUESTIONS[:12])


def test_erasing_an_account_deletes_receipt_and_voucher_photos(client, tmp_path, monkeypatch):
    from app.models import GradeVoucher, WalletTransaction
    from app.routers import profile

    monkeypatch.setattr(profile, "EVIDENCE_DIR", tmp_path)
    (tmp_path / "wallet").mkdir()
    (tmp_path / "receipts").mkdir()
    for folder, name in (("wallet", "tx.png"), ("receipts", "ride.png"), (".", "nota.png")):
        (tmp_path / folder / name).write_bytes(b"x")
    db = session()
    db.add(WalletTransaction(user_id=4, kind="recarga", amount_cents=500, status="aprobado", receipt_file="tx.png"))
    db.add(Ride(passenger_id=4, driver_id=1, origin="UNC", destination="IVIC", status="completado", receipt_file="ride.png"))
    db.add(GradeVoucher(user_id=4, subject="Física", status="aprobado", evidence_file="nota.png", fe_cost=500))
    db.commit()
    assert client.delete("/api/users/me", headers=auth_headers(4)).status_code == 200
    assert not (tmp_path / "wallet" / "tx.png").exists()
    assert not (tmp_path / "receipts" / "ride.png").exists()
    assert not (tmp_path / "nota.png").exists()
