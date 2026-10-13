import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_get_routes():
    response = client.get("/api/routes")
    assert response.status_code == 200
    routes = response.json()
    assert len(routes) >= 3
    # Comprobar que incluye la ruta de la UNC y el IVIC
    origins = [r["origin"] for r in routes]
    assert any("UNC" in o for o in origins)

def test_list_drivers():
    response = client.get("/api/drivers")
    assert response.status_code == 200
    drivers = response.json()
    assert len(drivers) >= 1
    names = [d["name"] for d in drivers]
    assert any("Jairo" in name for name in names)
    assert "Carlos Silva" not in names
    assert "Alejandro Díaz" not in names
    jairo = next((d for d in drivers if "Jairo" in d["name"]), None)
    assert jairo is not None
    assert "Bera" in jairo["moto_brand_model"]
    assert jairo["is_available"] == True

def test_toggle_driver_availability():
    # Cambiar a no disponible
    res = client.put("/api/drivers/1/availability", json={"is_available": False})
    assert res.status_code == 200
    assert res.json()["is_available"] == False

    # Restaurar a disponible
    res2 = client.put("/api/drivers/1/availability", json={"is_available": True})
    assert res2.status_code == 200
    assert res2.json()["is_available"] == True

def test_ride_flow_and_gamification():
    # 1. Pasajero Sofía (id=4) solicita viaje a Conductor Jairo (id=1)
    ride_payload = {
        "driver_id": 1,
        "origin": "Rectorado / Campus UNC",
        "destination": "Redoma de San Antonio de los Altos",
        "is_scheduled": False,
        "payment_method": "pago_movil",
        "payment_reference": "REF-987654",
        "fare_amount": 2.50
    }
    create_res = client.post("/api/rides?passenger_id=4", json=ride_payload)
    assert create_res.status_code == 200
    ride = create_res.json()
    assert ride["status"] == "solicitado"
    ride_id = ride["id"]

    # 2. Conductor Jairo acepta el viaje
    accept_res = client.put(f"/api/rides/{ride_id}/status", json={"status": "aceptado"})
    assert accept_res.status_code == 200
    assert accept_res.json()["status"] == "aceptado"

    # 3. Conductor inicia el viaje
    start_res = client.put(f"/api/rides/{ride_id}/status", json={"status": "en_curso"})
    assert start_res.status_code == 200

    # 4. Conductor completa el viaje
    user_before = client.get("/api/users/4").json()
    pts_before = user_before["points"]

    complete_res = client.put(f"/api/rides/{ride_id}/status", json={"status": "completado"})
    assert complete_res.status_code == 200

    # 5. Comprobar que Sofía recibió 35 Fe de recompensa
    user_after = client.get("/api/users/4").json()
    assert user_after["points"] == pts_before + 35

    # 6. Sofía califica el viaje con 5 estrellas
    review_payload = {
        "ride_id": ride_id,
        "rating": 5,
        "badges": "Manejo seguro,Casco impecable,Muy puntual",
        "comment": "¡Excelente viaje de la UNC a San Antonio! Manejo muy responsable."
    }
    review_res = client.post("/api/reviews?passenger_id=4", json=review_payload)
    assert review_res.status_code == 200
    assert review_res.json()["points_earned"] == 20

    # Sofía gana otros 20 puntos por la reseña
    user_final = client.get("/api/users/4").json()
    assert user_final["points"] == pts_before + 35 + 20

def test_review_requires_useful_comment():
    ride_payload = {
        "driver_id": 1,
        "origin": "Campus",
        "destination": "San Antonio",
        "payment_method": "efectivo",
        "fare_amount": 2.5
    }
    ride_res = client.post("/api/rides?passenger_id=4", json=ride_payload)
    ride_id = ride_res.json()["id"]
    client.put(f"/api/rides/{ride_id}/status", json={"status": "completado"})

    short_review = client.post("/api/reviews?passenger_id=4", json={
        "ride_id": ride_id,
        "rating": 5,
        "comment": "Buen viaje"
    })
    assert short_review.status_code == 400

    unrelated_review = client.post("/api/reviews?passenger_id=4", json={
        "ride_id": ride_id,
        "rating": 5,
        "comment": "La astronomía moderna explica galaxias lejanas."
    })
    assert unrelated_review.status_code == 400

def test_diamond_ride_payment_is_not_enabled():
    response = client.post("/api/rides?passenger_id=4", json={
        "driver_id": 1,
        "origin": "Campus",
        "destination": "San Antonio",
        "payment_method": "diamantes",
        "fare_amount": 2.5
    })
    assert response.status_code == 400

def test_rewards_and_redeem():
    # Obtener recompensas
    res = client.get("/api/gamification/rewards")
    assert res.status_code == 200
    rewards = res.json()
    assert len(rewards) >= 1

    # Canjear recompensa con Sofía, que conserva sus monedas de prueba
    redeem_res = client.post("/api/gamification/redeem?user_id=4", json={"reward_id": rewards[0]["id"]})
    assert redeem_res.status_code == 200
    assert "exito" in redeem_res.json()["message"].lower() or "éxito" in redeem_res.json()["message"].lower()


def test_admin_crud_routes_and_rewards():
    route_payload = {
        "origin": "Prueba Admin Ruta",
        "destination": "Campus UNC",
        "fare_usd": 3.5,
        "estimated_minutes": 18,
        "tag": "Ruta de prueba admin"
    }
    route_res = client.post("/api/admin/routes", json=route_payload)
    assert route_res.status_code == 201
    created_route = route_res.json()
    assert created_route["origin"] == route_payload["origin"]

    reward_payload = {
        "title": "Recompensa Admin Test",
        "description": "Descuento para pruebas administrativas",
        "points_cost": 125,
        "discount_percent": 25,
        "icon": "star-circle",
        "is_active": True
    }
    reward_res = client.post("/api/admin/rewards", json=reward_payload)
    assert reward_res.status_code == 201
    created_reward = reward_res.json()
    assert created_reward["title"] == reward_payload["title"]

    update_route = client.put(f"/api/admin/routes/{created_route['id']}", json={"origin": "Ruta Actualizada"})
    assert update_route.status_code == 200
    assert update_route.json()["origin"] == "Ruta Actualizada"

    update_reward = client.put(f"/api/admin/rewards/{created_reward['id']}", json={"title": "Recompensa Actualizada"})
    assert update_reward.status_code == 200
    assert update_reward.json()["title"] == "Recompensa Actualizada"

    delete_route = client.delete(f"/api/admin/routes/{created_route['id']}")
    assert delete_route.status_code == 200

    delete_reward = client.delete(f"/api/admin/rewards/{created_reward['id']}")
    assert delete_reward.status_code == 200


def test_admin_create_and_delete_driver():
    driver_payload = {
        "name": "Conductor Admin Test",
        "last_name": "Prueba",
        "age": 32,
        "email": "admin-test-driver@example.com",
        "phone": "+58 400 1112233",
        "moto_brand_model": "Yamaha 150",
        "moto_color": "Rojo",
        "plate": "ZZ-ADMIN-01",
        "helmet_provided": True,
        "is_available": True,
        "rating_avg": 4.9,
        "trips_count": 10,
        "xp_level": "Conductor de prueba"
    }
    create_res = client.post("/api/admin/drivers", json=driver_payload)
    assert create_res.status_code == 201
    created = create_res.json()
    assert created["name"] == driver_payload["name"]

    delete_res = client.delete(f"/api/admin/drivers/{created['id']}")
    assert delete_res.status_code == 200
