"""Fase 6: tienda de Fe con cupones y vale «Pasar con 20»."""
from app.database import get_db
from app.main import app
from app.models import User
from tests.test_api import auth_headers, client  # noqa: F401  (fixture compartido)
from tests.test_phase4a import ADMIN, PNG, balance, give_diamonds


def set_fe(user_id, points):
    db = next(app.dependency_overrides[get_db]())  # La misma base de datos de prueba del cliente
    db.get(User, user_id).points = points
    db.commit()


def fe(client, user_id):
    return client.get("/api/fe-store", headers=auth_headers(user_id)).json()["points"]


def test_coupon_discounts_a_ride_and_returns_if_cancelled(client):
    set_fe(4, 200)
    assert client.post("/api/fe-store/coupons", json={"percent": 50}, headers=auth_headers(4)).status_code == 400
    assert client.post("/api/fe-store/coupons", json={"percent": 30}, headers=auth_headers(4)).status_code == 422
    coupon = client.post("/api/fe-store/coupons", json={"percent": 25}, headers=auth_headers(4)).json()["coupon"]
    assert fe(client, 4) == 50

    give_diamonds(client, 4, 5)
    payload = {"driver_id": 1, "origin": "UNC", "destination": "IVIC", "payment_method": "diamantes",
               "fare_amount": 4, "coupon_id": coupon["id"]}
    assert client.post("/api/rides?passenger_id=2", json=payload, headers=auth_headers(2)).status_code == 400  # Ajeno
    ride = client.post("/api/rides?passenger_id=4", json=payload, headers=auth_headers(4)).json()
    assert ride["fare_amount"] == 3
    assert balance(client, 4) == 2

    client.put(f"/api/rides/{ride['id']}/status", json={"status": "rechazado"}, headers=auth_headers(1))
    coupons = client.get("/api/fe-store", headers=auth_headers(4)).json()["coupons"]
    assert coupons[0]["status"] == "activo" and balance(client, 4) == 5


def test_grade_voucher_holds_fe_until_admin_review(client):
    set_fe(4, 1100)
    form = {"subject": "Cálculo II"}
    photo = {"photo": ("nota.png", PNG, "image/png")}
    assert client.post("/api/fe-store/vouchers", data=form, files={"photo": ("x.png", b"nope", "image/png")},
                       headers=auth_headers(4)).status_code == 400
    voucher = client.post("/api/fe-store/vouchers", data=form, files=photo, headers=auth_headers(4)).json()["voucher"]
    assert fe(client, 4) == 600
    assert client.post("/api/fe-store/vouchers", data=form, files=photo, headers=auth_headers(4)).status_code == 409

    # La evidencia no es pública: solo el administrador la ve.
    assert client.get(f"/api/admin/vouchers/{voucher['id']}/evidence", headers=auth_headers(4)).status_code == 403
    assert client.get(f"/api/admin/vouchers/{voucher['id']}/evidence", headers=ADMIN).content == PNG

    rejected = client.put(f"/api/admin/vouchers/{voucher['id']}", json={"action": "rechazar", "note": "Ilegible"}, headers=ADMIN)
    assert rejected.json()["status"] == "rechazado" and fe(client, 4) == 1100

    second = client.post("/api/fe-store/vouchers", data=form, files=photo, headers=auth_headers(4)).json()["voucher"]
    assert [v["id"] for v in client.get("/api/admin/vouchers", headers=ADMIN).json()] == [second["id"]]
    approved = client.put(f"/api/admin/vouchers/{second['id']}", json={"action": "aprobar"}, headers=ADMIN).json()
    assert approved["code"] == f"P20-{second['id']:04d}" and fe(client, 4) == 600
    assert client.put(f"/api/admin/vouchers/{second['id']}", json={"action": "rechazar"}, headers=ADMIN).status_code == 409


# --- Tasa BCV ------------------------------------------------------------------

def test_bcv_rate_is_cached_and_falls_back(client, monkeypatch):
    from datetime import date

    from app.routers import rates

    monkeypatch.setattr(rates, "venezuela_today", lambda: date(2026, 10, 20))
    monkeypatch.setattr(rates, "fetch_official_rate", lambda: (_ for _ in ()).throw(OSError("sin red")))
    assert client.get("/api/rates/bcv").status_code == 503  # Sin fuente ni historial

    calls = []
    monkeypatch.setattr(rates, "fetch_official_rate", lambda: calls.append(1) or 884.75)
    first = client.get("/api/rates/bcv").json()
    assert first == {"rate": 884.75, "date": "2026-10-20", "source": "dolarapi", "is_current": True}
    client.get("/api/rates/bcv")
    assert len(calls) == 1  # Una consulta por día

    # Al día siguiente la fuente falla: se usa la última tasa, marcada como vieja.
    monkeypatch.setattr(rates, "venezuela_today", lambda: date(2026, 10, 21))
    monkeypatch.setattr(rates, "fetch_official_rate", lambda: (_ for _ in ()).throw(OSError("sin red")))
    assert client.get("/api/rates/bcv").json()["is_current"] is False

    assert client.put("/api/admin/rates/bcv", json={"rate": 900}, headers=auth_headers(4)).status_code == 403
    manual = client.put("/api/admin/rates/bcv", json={"rate": 900}, headers=ADMIN).json()
    assert manual["source"] == "manual" and manual["is_current"]
    assert client.get("/api/rates/bcv").json()["rate"] == 900


# --- Panel web -----------------------------------------------------------------

def test_admin_lists_every_driver_and_manages_workshop(client):
    assert client.get("/api/admin/drivers", headers=auth_headers(4)).status_code == 403
    drivers = client.get("/api/admin/drivers", headers=ADMIN).json()
    assert {d["user_id"] for d in drivers} >= {1, 2, 3}
    assert all("status" in d and "is_available" in d for d in drivers)

    created = client.post("/api/admin/workshop", json={"title": "Frenos", "cost": 6}, headers=ADMIN).json()
    assert created["cost"] == 6
    updated = client.put(f"/api/admin/workshop/{created['id']}", json={"title": "Frenos", "cost": 7, "is_active": False}, headers=ADMIN).json()
    assert updated["cost"] == 7 and not updated["is_active"]
    assert created["id"] not in [w["id"] for w in client.get("/api/wallet/workshop", headers=auth_headers(1)).json()]
    assert client.delete(f"/api/admin/workshop/{created['id']}", headers=ADMIN).json() == {"ok": True}
    assert created["id"] not in [w["id"] for w in client.get("/api/admin/workshop", headers=ADMIN).json()]


# --- Beneficios por nivel ---------------------------------------------------------

def set_lifetime(user_id, fe_lifetime):
    db = next(app.dependency_overrides[get_db]())
    db.get(User, user_id).fe_lifetime = fe_lifetime
    db.commit()


def test_level_perks_gift_coupons_once_and_discount_store(client):
    from app.links_service import threshold_for

    set_lifetime(4, threshold_for(13))  # Aluminio: regalos del Carbono (25 %) y del Aluminio (50 %)
    store = client.get("/api/fe-store", headers=auth_headers(4)).json()
    assert sorted(c["percent"] for c in store["coupons"]) == [25, 50]
    assert store["voucher_cost"] == 500 and not store["store_discount"]
    client.get("/api/fe-store", headers=auth_headers(4))
    assert len(client.get("/api/fe-store", headers=auth_headers(4)).json()["coupons"]) == 2  # No se repiten

    set_lifetime(4, threshold_for(29))  # Cobre: viaje gratis y 10 % en la tienda
    store = client.get("/api/fe-store", headers=auth_headers(4)).json()
    assert sorted(c["percent"] for c in store["coupons"]) == [25, 50, 100]
    assert store["store_discount"] and store["voucher_cost"] == 450
    assert [p["cost"] for p in store["coupon_prices"]] == [135, 270]


def test_oxygen_level_earns_quiz_bonus(client):
    from app.links_service import threshold_for

    assert client.get("/api/quiz/today", headers=auth_headers(4)).json()["reward"] == 10
    set_lifetime(4, threshold_for(8))
    assert client.get("/api/quiz/today", headers=auth_headers(4)).json()["reward"] == 15


def test_argon_passengers_appear_first_to_the_driver(client):
    from app.links_service import threshold_for

    base = {"driver_id": 1, "origin": "UNC", "destination": "IVIC", "payment_method": "efectivo", "fare_amount": 2}
    first = client.post("/api/rides?passenger_id=4", json=base, headers=auth_headers(4)).json()
    second = client.post("/api/rides?passenger_id=2", json=base, headers=auth_headers(2)).json()
    set_lifetime(2, threshold_for(18))
    pending = client.get("/api/rides/driver/1/pending", headers=auth_headers(1)).json()
    assert [r["id"] for r in pending] == [second["id"], first["id"]]
