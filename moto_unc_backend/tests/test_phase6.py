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
