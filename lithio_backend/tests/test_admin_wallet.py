"""Pago Móvil del administrador, donaciones por Pago Móvil, comprobantes de la
billetera, acreditación manual y avisos al administrador."""
from tests.test_api import auth_headers, client  # noqa: F401  (fixture compartido)
from tests.test_phase4a import ADMIN, PNG, balance, friend_code


def admin_pago_movil(client):
    from app.models import DriverProfile

    with client.session_factory() as db:
        db.add(DriverProfile(
            user_id=5, moto_brand_model="Moto admin", moto_color="Negro", plate="ADM-1",
            mobile_payment_number="04120000000", mobile_payment_bank="0102 Banco de Venezuela",
            mobile_payment_id="12345678",
        ))
        db.commit()


def test_wallet_shows_the_admin_pago_movil(client):
    assert client.get("/api/wallet", headers=auth_headers(4)).json()["pago_movil"] is None
    admin_pago_movil(client)
    destination = client.get("/api/wallet", headers=auth_headers(4)).json()["pago_movil"]
    assert destination == {
        "holder": "Admin", "phone": "04120000000", "bank": "0102 Banco de Venezuela", "id_number": "12345678",
    }


def test_pago_movil_donation_waits_for_admin_and_never_credits_the_donor(client, push_outbox):
    from app.models import User

    with client.session_factory() as db:
        db.get(User, 5).push_token = "ExponentPushToken[admin]"
        db.commit()
    assert client.post("/api/wallet/donations", json={"amount": 5, "method": "pago_movil"}, headers=auth_headers(4)).status_code == 400
    donation = client.post(
        "/api/wallet/donations", json={"amount": 5, "method": "pago_movil", "reference": "778899"}, headers=auth_headers(4)
    ).json()
    assert donation["status"] == "pendiente" and donation["kind"] == "donacion_pm"
    assert any(m["data"].get("type") == "ADMIN_ALERT" and m["data"]["kind"] == "donacion_pm" for m in push_outbox)

    pending = client.get("/api/admin/wallet/pending", headers=ADMIN).json()
    assert [item["kind"] for item in pending] == ["donacion_pm"]
    client.put(f"/api/admin/wallet/transactions/{donation['id']}", json={"action": "aprobar"}, headers=ADMIN)
    wallet = client.get("/api/wallet", headers=auth_headers(4)).json()
    assert wallet["balance"] == 0  # Va al Fondo Solidario, no al saldo
    assert wallet["fund"] == {"donated": 5.0, "donors": 1}


def test_topup_receipt_is_private_and_visible_to_the_admin(client):
    topup = client.post("/api/wallet/topups", json={"amount": 10, "reference": "PM-4821"}, headers=auth_headers(4)).json()
    photo = {"photo": ("pago.png", PNG, "image/png")}
    url = f"/api/wallet/transactions/{topup['id']}/receipt"
    assert client.post(url, files=photo, headers=auth_headers(2)).status_code == 404
    assert client.post(url, files={"photo": ("x.png", b"nope", "image/png")}, headers=auth_headers(4)).status_code == 400
    assert client.post(url, files=photo, headers=auth_headers(4)).json()["has_receipt"]

    assert client.get(url, headers=auth_headers(4)).content == PNG
    assert client.get(url, headers=ADMIN).content == PNG
    assert client.get(url, headers=auth_headers(2)).status_code == 404
    assert client.get("/api/admin/wallet/pending", headers=ADMIN).json()[0]["has_receipt"]

    client.put(f"/api/admin/wallet/transactions/{topup['id']}", json={"action": "aprobar"}, headers=ADMIN)
    assert balance(client, 4) == 10
    # Ya revisada: no se cambia la captura.
    assert client.post(url, files=photo, headers=auth_headers(4)).status_code == 409


def test_admin_credits_diamonds_by_friend_code(client):
    code = friend_code(client, 4)
    assert client.post("/api/admin/wallet/credit", json={"friend_code": code, "amount": 4}, headers=auth_headers(4)).status_code == 403
    assert client.post("/api/admin/wallet/credit", json={"friend_code": "Li-NOPE", "amount": 4}, headers=ADMIN).status_code == 404
    credited = client.post("/api/admin/wallet/credit", json={"friend_code": code, "amount": 4, "note": "Pago Móvil del lunes"}, headers=ADMIN)
    assert credited.status_code == 201 and credited.json()["status"] == "aprobado"
    assert balance(client, 4) == 4


def test_admin_gets_a_floating_alert_for_each_request(client):
    from app.models import User, WorkshopReward

    with client.session_factory() as db:
        db.add(WorkshopReward(title="Frenos", cost_cents=100))
        db.get(User, 4).points = 1000  # Alcanza para un vale de nota
        db.commit()
    client.post("/api/admin/wallet/credit", json={"friend_code": friend_code(client, 1), "amount": 5}, headers=ADMIN)

    with client.websocket_connect("/ws") as admin_socket:
        admin_socket.send_json({"type": "AUTH", "token": "test-admin"})
        assert admin_socket.receive_json()["type"] == "AUTHENTICATED"
        admin_socket.receive_json()  # ACTIVE_RIDE_SYNC

        client.post("/api/wallet/topups", json={"amount": 3, "reference": "PM-1111"}, headers=auth_headers(4))
        alert = admin_socket.receive_json()
        assert alert["type"] == "ADMIN_ALERT" and alert["kind"] == "recarga" and "Sofia" in alert["body"]

        reward = client.get("/api/wallet/workshop", headers=auth_headers(1)).json()[0]
        client.post(f"/api/wallet/workshop/{reward['id']}/redeem", headers=auth_headers(1))
        assert admin_socket.receive_json()["kind"] == "taller"

        client.post("/api/fe-store/vouchers", data={"subject": "Cálculo I"}, files={"photo": ("n.png", PNG, "image/png")},
                    headers=auth_headers(4))
        assert admin_socket.receive_json()["kind"] == "vale"


def test_admin_lists_ride_receipts(client):
    ride = client.post(
        "/api/rides?passenger_id=4",
        json={"driver_id": 1, "origin": "UNC", "destination": "IVIC", "payment_method": "pago_movil",
              "payment_reference": "123456", "fare_amount": 2},
        headers=auth_headers(4),
    ).json()
    client.post(f"/api/rides/{ride['id']}/receipt", files={"photo": ("p.png", PNG, "image/png")}, headers=auth_headers(1))
    assert client.get("/api/rides/admin/receipts", headers=auth_headers(4)).status_code == 403
    receipts = client.get("/api/rides/admin/receipts", headers=ADMIN).json()
    assert [r["id"] for r in receipts] == [ride["id"]] and receipts[0]["passenger_name"] == "Sofia"
