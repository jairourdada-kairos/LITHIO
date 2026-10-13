from fastapi import FastAPI, Depends, HTTPException, WebSocket, WebSocketDisconnect, Request
from fastapi.responses import PlainTextResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Dict
import json
import asyncio
import os
import re
import urllib.request
import urllib.error
from dotenv import load_dotenv
from datetime import datetime

from .database import engine, get_db, Base
from .models import User, DriverProfile, Ride, Review, Reward, Route
from .schemas import (
    UserResponse, SwitchRoleRequest, DriverCardItem,
    ToggleAvailabilityRequest, RideCreate, RideStatusUpdate,
    RideResponse, ReviewCreate, ReviewResponse,
    RewardResponse, RedeemRewardRequest,
    PassengerRegisterRequest, DriverRegisterRequest
)
from .seed import seed_database

load_dotenv()

# Crear tablas y sembrar datos iniciales
Base.metadata.create_all(bind=engine)
seed_database()

app = FastAPI(
    title="LITHIO API",
    description="Linked Intelligent Transport for Higher Innovative Opportunities (Transporte Inteligente Vinculado para Oportunidades Innovadoras).",
    version="1.0.0"
)

# Configuración de CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Montar Dashboard Web (HTML / CSS / JS)
dashboard_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "moto_unc_dashboard"))
if os.path.isdir(dashboard_dir):
    app.mount("/dashboard", StaticFiles(directory=dashboard_dir, html=True), name="dashboard")

    @app.get("/")
    def root_dashboard():
        return RedirectResponse(url="/dashboard")

# -------------------------------------------------------------
# GESTOR DE CONEXIONES EN TIEMPO REAL (WEBSOCKETS)
# Permite enviar notificaciones instantáneas a los teléfonos
# -------------------------------------------------------------
class ConnectionManager:
    def __init__(self):
        # Mapea user_id -> WebSocket
        self.active_connections: Dict[int, WebSocket] = {}

    async def connect(self, user_id: int, websocket: WebSocket):
        await websocket.accept()
        self.active_connections[user_id] = websocket

    def disconnect(self, user_id: int):
        if user_id in self.active_connections:
            del self.active_connections[user_id]

    async def send_personal_message(self, message: dict, user_id: int):
        if user_id in self.active_connections:
            try:
                await self.active_connections[user_id].send_text(json.dumps(message))
            except Exception:
                self.disconnect(user_id)

    async def broadcast(self, message: dict):
        for user_id, connection in list(self.active_connections.items()):
            try:
                await connection.send_text(json.dumps(message))
            except Exception:
                self.disconnect(user_id)

manager = ConnectionManager()


@app.get("/webhooks/whatsapp")
async def verify_whatsapp_webhook(request: Request):
    """Endpoint de verificacion que Meta llama al guardar el webhook."""
    params = request.query_params
    verify_token = os.getenv("WHATSAPP_WEBHOOK_VERIFY_TOKEN", "")
    if params.get("hub.mode") == "subscribe" and params.get("hub.verify_token") == verify_token:
        return PlainTextResponse(params.get("hub.challenge", ""))
    raise HTTPException(status_code=403, detail="Token de verificacion invalido")


@app.post("/webhooks/whatsapp")
async def receive_whatsapp_webhook(request: Request):
    """Recibe mensajes entrantes y actualizaciones de estado de WhatsApp."""
    payload = await request.json()
    print("WhatsApp webhook recibido:", payload.get("object", "unknown"))
    return {"received": True}


async def notify_driver_whatsapp(driver: User, ride: Ride) -> str:
    """Envía una alerta por WhatsApp Cloud API cuando las credenciales están configuradas."""
    token = os.getenv("WHATSAPP_ACCESS_TOKEN")
    phone_number_id = os.getenv("WHATSAPP_PHONE_NUMBER_ID")
    if not token or not phone_number_id or not driver.phone:
        return "not_configured"

    recipient = "".join(character for character in driver.phone if character.isdigit())
    payload = json.dumps({
        "messaging_product": "whatsapp",
        "to": recipient,
        "type": "text",
        "text": {
            "preview_url": False,
            "body": (
                f"LITHIO: nueva solicitud de viaje\\n"
                f"Origen: {ride.origin}\\n"
                f"Destino: {ride.destination}\\n"
                f"Tarifa: ${ride.fare_amount:.2f}\\n"
                f"Horario: {ride.scheduled_time or 'inmediato'}"
            )
        }
    }).encode("utf-8")
    request = urllib.request.Request(
        f"https://graph.facebook.com/v22.0/{phone_number_id}/messages",
        data=payload,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        method="POST"
    )

    try:
        await asyncio.to_thread(urllib.request.urlopen, request, timeout=10)
        return "sent"
    except (urllib.error.URLError, urllib.error.HTTPError):
        return "failed"

@app.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: int):
    await manager.connect(user_id, websocket)
    try:
        while True:
            data = await websocket.receive_text()
            # Mantiene el canal vivo con ping/pong o mensajes bidireccionales
            pass
    except WebSocketDisconnect:
        manager.disconnect(user_id)


# -------------------------------------------------------------
# RUTAS PREDEFINIDAS Y TARIFAS
# -------------------------------------------------------------
@app.get("/api/routes")
def get_preset_routes(db: Session = Depends(get_db)):
    """Retorna las rutas más solicitadas por la comunidad UNC, IVIC, San Antonio y Caracas."""
    routes = db.query(Route).all()
    if routes:
        return [
            {
                "id": route.id,
                "origin": route.origin,
                "destination": route.destination,
                "fare_usd": route.fare_usd,
                "estimated_minutes": route.estimated_minutes,
                "popular": route.popular,
                "tag": route.tag
            }
            for route in routes
        ]

    seed_routes = [
        {
            "origin": "UNC",
            "destination": "BIBLIOTECA",
            "fare_usd": 1.50,
            "estimated_minutes": 8,
            "popular": True,
            "tag": "Ruta corta estudiantil"
        },
        {
            "origin": "UNC",
            "destination": "REDOMA DE SAN ANTONIO",
            "fare_usd": 2.50,
            "estimated_minutes": 12,
            "popular": True,
            "tag": "Ruta principal"
        },
        {
            "origin": "UNC",
            "destination": "RESTO DEL IVIC",
            "fare_usd": 2.00,
            "estimated_minutes": 10,
            "popular": True,
            "tag": "Conexión IVIC"
        },
        {
            "origin": "BIBLIOTECA",
            "destination": "REDOMA DE SAN ANTONIO",
            "fare_usd": 2.50,
            "estimated_minutes": 12,
            "popular": True,
            "tag": "Ruta bibliotecaria"
        },
        {
            "origin": "UNC",
            "destination": "CARACAS",
            "fare_usd": 6.00,
            "estimated_minutes": 35,
            "popular": True,
            "tag": "Bajada a Caracas"
        },
        {
            "origin": "BIBLIOTECA",
            "destination": "CARACAS",
            "fare_usd": 6.50,
            "estimated_minutes": 38,
            "popular": False,
            "tag": "Ruta referencia"
        }
    ]

    created = []
    for item in seed_routes:
        route = Route(**item)
        db.add(route)
        created.append(item)
    db.commit()
    return [
        {**item, "id": index + 1}
        for index, item in enumerate(created)
    ]


@app.post("/api/admin/routes", status_code=201)
def create_route_admin(payload: dict, db: Session = Depends(get_db)):
    route = Route(
        origin=payload.get("origin", ""),
        destination=payload.get("destination", ""),
        fare_usd=float(payload.get("fare_usd", 2.5)),
        estimated_minutes=int(payload.get("estimated_minutes", 10)),
        popular=bool(payload.get("popular", True)),
        tag=payload.get("tag")
    )
    db.add(route)
    db.commit()
    db.refresh(route)
    return {
        "id": route.id,
        "origin": route.origin,
        "destination": route.destination,
        "fare_usd": route.fare_usd,
        "estimated_minutes": route.estimated_minutes,
        "popular": route.popular,
        "tag": route.tag
    }


@app.put("/api/admin/routes/{route_id}")
def update_route_admin(route_id: int, payload: dict, db: Session = Depends(get_db)):
    route = db.query(Route).filter(Route.id == route_id).first()
    if not route:
        raise HTTPException(status_code=404, detail="Ruta no encontrada")

    for field in ("origin", "destination", "tag"):
        if field in payload:
            setattr(route, field, payload[field])
    if "fare_usd" in payload:
        route.fare_usd = float(payload["fare_usd"])
    if "estimated_minutes" in payload:
        route.estimated_minutes = int(payload["estimated_minutes"])
    if "popular" in payload:
        route.popular = bool(payload["popular"])

    db.commit()
    db.refresh(route)
    return {
        "id": route.id,
        "origin": route.origin,
        "destination": route.destination,
        "fare_usd": route.fare_usd,
        "estimated_minutes": route.estimated_minutes,
        "popular": route.popular,
        "tag": route.tag
    }


@app.delete("/api/admin/routes/{route_id}")
def delete_route_admin(route_id: int, db: Session = Depends(get_db)):
    route = db.query(Route).filter(Route.id == route_id).first()
    if not route:
        raise HTTPException(status_code=404, detail="Ruta no encontrada")
    db.delete(route)
    db.commit()
    return {"message": "Ruta eliminada correctamente"}


@app.post("/api/admin/drivers", status_code=201)
def create_admin_driver(payload: dict, db: Session = Depends(get_db)):
    email = payload.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="El correo es obligatorio")

    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Ya existe una cuenta con ese correo")

    user = User(
        name=payload.get("name", "Conductor"),
        last_name=payload.get("last_name"),
        age=payload.get("age"),
        email=email,
        phone=payload.get("phone", ""),
        role="conductor",
        avatar_url=payload.get("avatar_url"),
        points=100,
        xp_level=payload.get("xp_level", "Conductor UNC")
    )
    db.add(user)
    db.flush()

    driver_profile = DriverProfile(
        user_id=user.id,
        moto_brand_model=payload.get("moto_brand_model", "Bera SBR 150"),
        moto_color=payload.get("moto_color", "Negro"),
        plate=payload.get("plate", "ABC123"),
        helmet_provided=bool(payload.get("helmet_provided", True)),
        is_available=bool(payload.get("is_available", True)),
        rating_avg=float(payload.get("rating_avg", 0.0)),
        trips_count=int(payload.get("trips_count", 0)),
        current_location_tag=payload.get("current_location_tag", "Campus UNC"),
    )
    db.add(driver_profile)
    db.commit()
    db.refresh(user)
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "phone": user.phone,
        "role": user.role,
    }


@app.put("/api/admin/profile/{user_id}")
def update_admin_profile(user_id: int, payload: dict, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id, User.role.in_(["admin", "ambos"])).first()
    if not user:
        raise HTTPException(status_code=404, detail="Administrador no encontrado")
    for field in ("name", "email", "phone"):
        if field in payload:
            setattr(user, field, payload[field])
    db.commit()
    db.refresh(user)
    return {"id": user.id, "name": user.name, "email": user.email, "phone": user.phone}


@app.delete("/api/admin/drivers/{driver_id}")
def delete_admin_driver(driver_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == driver_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Conductor no encontrado")
    profile = db.query(DriverProfile).filter(DriverProfile.user_id == driver_id).first()
    if profile:
        db.delete(profile)
    db.delete(user)
    db.commit()
    return {"message": "Conductor eliminado correctamente"}


@app.put("/api/admin/drivers/{driver_id}")
def update_admin_driver(driver_id: int, payload: dict, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == driver_id).first()
    profile = db.query(DriverProfile).filter(DriverProfile.user_id == driver_id).first()
    if not user or not profile:
        raise HTTPException(status_code=404, detail="Conductor no encontrado")

    for field in ("name", "last_name", "phone", "avatar_url", "xp_level"):
        if field in payload:
            setattr(user, field, payload[field])
    for field in ("moto_brand_model", "moto_color", "plate", "current_location_tag"):
        if field in payload:
            setattr(profile, field, payload[field])
    if "is_available" in payload:
        profile.is_available = bool(payload["is_available"])
    if "helmet_provided" in payload:
        profile.helmet_provided = bool(payload["helmet_provided"])
    if "rating_avg" in payload:
        profile.rating_avg = float(payload["rating_avg"])
    if "trips_count" in payload:
        profile.trips_count = int(payload["trips_count"])

    db.commit()
    return {
        "id": user.id,
        "name": user.name,
        "phone": user.phone,
        "moto_brand_model": profile.moto_brand_model,
        "plate": profile.plate,
        "is_available": profile.is_available,
        "rating_avg": profile.rating_avg,
        "trips_count": profile.trips_count,
        "xp_level": user.xp_level,
    }


@app.post("/api/admin/rewards", status_code=201)
def create_admin_reward(payload: dict, db: Session = Depends(get_db)):
    reward = Reward(
        title=payload.get("title", "Recompensa"),
        description=payload.get("description", ""),
        points_cost=int(payload.get("points_cost", 100)),
        discount_percent=int(payload.get("discount_percent", 0)),
        icon=payload.get("icon", "star-circle"),
        is_active=bool(payload.get("is_active", True))
    )
    db.add(reward)
    db.commit()
    db.refresh(reward)
    return {
        "id": reward.id,
        "title": reward.title,
        "description": reward.description,
        "points_cost": reward.points_cost,
        "discount_percent": reward.discount_percent,
        "icon": reward.icon,
        "is_active": reward.is_active,
    }


@app.put("/api/admin/rewards/{reward_id}")
def update_admin_reward(reward_id: int, payload: dict, db: Session = Depends(get_db)):
    reward = db.query(Reward).filter(Reward.id == reward_id).first()
    if not reward:
        raise HTTPException(status_code=404, detail="Recompensa no encontrada")

    for field in ("title", "description", "icon"):
        if field in payload:
            setattr(reward, field, payload[field])
    if "points_cost" in payload:
        reward.points_cost = int(payload["points_cost"])
    if "discount_percent" in payload:
        reward.discount_percent = int(payload["discount_percent"])
    if "is_active" in payload:
        reward.is_active = bool(payload["is_active"])

    db.commit()
    db.refresh(reward)
    return {
        "id": reward.id,
        "title": reward.title,
        "description": reward.description,
        "points_cost": reward.points_cost,
        "discount_percent": reward.discount_percent,
        "icon": reward.icon,
        "is_active": reward.is_active,
    }


@app.delete("/api/admin/rewards/{reward_id}")
def delete_admin_reward(reward_id: int, db: Session = Depends(get_db)):
    reward = db.query(Reward).filter(Reward.id == reward_id).first()
    if not reward:
        raise HTTPException(status_code=404, detail="Recompensa no encontrada")
    db.delete(reward)
    db.commit()
    return {"message": "Recompensa eliminada correctamente"}


# -------------------------------------------------------------
# PERFILES Y ROLES DE USUARIO
# -------------------------------------------------------------
@app.get("/api/users/by-email", response_model=UserResponse)
def get_user_by_email(email: str, db: Session = Depends(get_db)):
    """Obtiene el perfil para el inicio de sesión móvil por correo."""
    user = db.query(User).filter(User.email == email.strip().lower()).first()
    if not user:
        raise HTTPException(status_code=404, detail="Cuenta no encontrada")
    return user


@app.get("/api/users/{user_id}", response_model=UserResponse)
def get_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return user

@app.post("/api/users/{user_id}/switch-role")
def switch_user_role(user_id: int, req: SwitchRoleRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    user.role = req.new_role
    db.commit()
    return {"message": f"Rol cambiado a {req.new_role}", "role": user.role}


# -------------------------------------------------------------
# REGISTRO DE NUEVOS USUARIOS (PASAJERO Y CONDUCTOR)
# -------------------------------------------------------------
@app.post("/api/passengers/register", response_model=UserResponse, status_code=201)
def register_passenger(data: PassengerRegisterRequest, db: Session = Depends(get_db)):
    """
    Registra un nuevo pasajero. Acepta datos extra (last_name, age) y
    opcionalmente el UID de Firebase para usuarios que se autentican
    con Google o Facebook.
    """
    # Verificar email único
    existing = db.query(User).filter(User.email == data.email).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail="Ya existe una cuenta con ese correo electrónico."
        )

    new_user = User(
        name=data.name,
        last_name=data.last_name,
        age=data.age,
        email=data.email,
        phone=data.phone,
        role="pasajero",
        avatar_url=data.avatar_url,
        firebase_uid=data.firebase_uid,
        points=100,  # Bono de bienvenida
        xp_level="Pasajero Novato"
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


@app.post("/api/drivers/register", response_model=UserResponse, status_code=201)
def register_driver(data: DriverRegisterRequest, db: Session = Depends(get_db)):
    """
    Registra un nuevo conductor con datos personales, de la moto y
    métodos de pago (Binance, pago móvil, cuenta bancaria).
    """
    # Verificar email único
    existing = db.query(User).filter(User.email == data.email).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail="Ya existe una cuenta con ese correo electrónico."
        )

    new_user = User(
        name=data.name,
        last_name=data.last_name,
        age=data.age,
        email=data.email,
        phone=data.phone,
        role="conductor",
        avatar_url=data.avatar_url,
        firebase_uid=data.firebase_uid,
        points=100,
        xp_level="Conductor Novato"
    )
    db.add(new_user)
    db.flush()  # Obtener el ID antes del commit

    driver_profile = DriverProfile(
        user_id=new_user.id,
        moto_brand_model=data.moto_brand_model,
        moto_color=data.moto_color,
        plate=data.plate,
        helmet_provided=data.helmet_provided,
        is_available=True,
        rating_avg=0.0,
        trips_count=0,
        current_location_tag="Entrada UNC - Altos Mirandinos",
        binance_address=data.binance_address,
        mobile_payment_number=data.mobile_payment_number,
        bank_account_number=data.bank_account_number
    )
    db.add(driver_profile)
    db.commit()
    db.refresh(new_user)
    return new_user


# -------------------------------------------------------------
# DIRECTO DE CONDUCTORES (LO QUE VE EL PASAJERO)
# -------------------------------------------------------------
@app.get("/api/drivers", response_model=List[DriverCardItem])
def list_drivers(db: Session = Depends(get_db)):
    """Retorna el listado de conductores con su estado, moto y nivel"""
    drivers = db.query(DriverProfile).join(User).all()
    results = []
    for dp in drivers:
        results.append(DriverCardItem(
            user_id=dp.user.id,
            name=dp.user.name,
            phone=dp.user.phone,
            avatar_url=dp.user.avatar_url,
            moto_brand_model=dp.moto_brand_model,
            moto_color=dp.moto_color,
            plate=dp.plate,
            helmet_provided=dp.helmet_provided,
            is_available=dp.is_available,
            rating_avg=dp.rating_avg,
            trips_count=dp.trips_count,
            xp_level=dp.user.xp_level,
            current_location_tag=dp.current_location_tag,
            mobile_payment_number=dp.mobile_payment_number,
            mobile_payment_bank=dp.mobile_payment_bank,
            mobile_payment_id=dp.mobile_payment_id,
            bank_account_number=dp.bank_account_number
        ))
    return results

@app.put("/api/drivers/{driver_id}/availability")
async def toggle_driver_availability(
    driver_id: int, 
    req: ToggleAvailabilityRequest, 
    db: Session = Depends(get_db)
):
    """El conductor cambia entre Disponible y Fuera de Servicio"""
    profile = db.query(DriverProfile).filter(DriverProfile.user_id == driver_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Perfil de conductor no encontrado")
    profile.is_available = req.is_available
    db.commit()

    # Avisar a todos los clientes que el listado de conductores cambió
    await manager.broadcast({
        "type": "DRIVER_AVAILABILITY_CHANGED",
        "driver_id": driver_id,
        "is_available": req.is_available
    })

    return {"message": "Estado actualizado", "is_available": profile.is_available}


# -------------------------------------------------------------
# SOLICITUD Y GESTIÓN DE VIAJES
# -------------------------------------------------------------
@app.post("/api/rides", response_model=RideResponse)
async def request_ride(
    passenger_id: int, 
    ride_data: RideCreate, 
    db: Session = Depends(get_db)
):
    """
    Un pasajero solicita un viaje eligiendo directamente a su conductor.
    Envía una alerta en tiempo real a la app del conductor seleccionado.
    """
    passenger = db.query(User).filter(User.id == passenger_id).first()
    driver = db.query(User).filter(User.id == ride_data.driver_id).first()

    if not passenger or not driver:
        raise HTTPException(status_code=404, detail="Pasajero o conductor no válido")
    if ride_data.payment_method not in {"efectivo", "pago_movil"}:
        raise HTTPException(
            status_code=400,
            detail="El pago con Fe o Diamantes aún no está habilitado. Usa efectivo o Pago Móvil.",
        )

    new_ride = Ride(
        passenger_id=passenger_id,
        driver_id=ride_data.driver_id,
        origin=ride_data.origin,
        destination=ride_data.destination,
        is_scheduled=ride_data.is_scheduled,
        scheduled_time=ride_data.scheduled_time,
        status="solicitado",
        payment_method=ride_data.payment_method,
        payment_reference=ride_data.payment_reference,
        fare_amount=ride_data.fare_amount,
        points_rewarded=35
    )
    db.add(new_ride)
    db.commit()
    db.refresh(new_ride)

    whatsapp_status = await notify_driver_whatsapp(driver, new_ride)

    # Notificar al conductor por WebSocket
    await manager.send_personal_message(
        {
            "type": "NEW_RIDE_REQUEST",
            "ride_id": new_ride.id,
            "passenger_name": passenger.name,
            "passenger_phone": passenger.phone,
            "origin": new_ride.origin,
            "destination": new_ride.destination,
            "is_scheduled": new_ride.is_scheduled,
            "scheduled_time": new_ride.scheduled_time,
            "fare_amount": new_ride.fare_amount,
            "payment_method": new_ride.payment_method
        },
        user_id=ride_data.driver_id
    )

    resp = RideResponse.model_validate(new_ride)
    resp.passenger_name = passenger.name
    resp.driver_name = driver.name
    resp.whatsapp_status = whatsapp_status
    return resp

@app.get("/api/rides/driver/{driver_id}/pending", response_model=List[RideResponse])
def get_pending_rides_for_driver(driver_id: int, db: Session = Depends(get_db)):
    """Viajes pendientes por aceptar para este conductor"""
    rides = db.query(Ride).filter(
        Ride.driver_id == driver_id, 
        Ride.status == "solicitado"
    ).all()
    results = []
    for r in rides:
        res = RideResponse.model_validate(r)
        res.passenger_name = r.passenger.name
        res.driver_name = r.driver.name
        results.append(res)
    return results

@app.get("/api/rides/active/{user_id}", response_model=RideResponse)
def get_active_ride_for_user(user_id: int, db: Session = Depends(get_db)):
    """Obtiene el viaje activo de un usuario (sea pasajero o conductor)"""
    ride = db.query(Ride).filter(
        ((Ride.passenger_id == user_id) | (Ride.driver_id == user_id)),
        Ride.status.in_(["solicitado", "aceptado", "en_camino", "en_curso"])
    ).order_by(Ride.id.desc()).first()

    if not ride:
        raise HTTPException(status_code=404, detail="No hay viaje activo")

    res = RideResponse.model_validate(ride)
    res.passenger_name = ride.passenger.name
    res.driver_name = ride.driver.name
    return res

@app.put("/api/rides/{ride_id}/status")
async def update_ride_status(
    ride_id: int, 
    update: RideStatusUpdate, 
    db: Session = Depends(get_db)
):
    """
    Actualiza el estado del viaje:
    'aceptado' -> 'en_camino' -> 'en_curso' -> 'completado' o 'cancelado'
    """
    ride = db.query(Ride).filter(Ride.id == ride_id).first()
    if not ride:
        raise HTTPException(status_code=404, detail="Viaje no encontrado")

    old_status = ride.status
    ride.status = update.status
    fe_awarded = 0

    # Si se completa el viaje, sumar Fe al pasajero e incrementar contador del conductor
    if update.status == "completado" and old_status != "completado":
        passenger = db.query(User).filter(User.id == ride.passenger_id).first()
        if passenger:
            passenger.points += ride.points_rewarded
            fe_awarded = ride.points_rewarded

        driver_profile = db.query(DriverProfile).filter(DriverProfile.user_id == ride.driver_id).first()
        if driver_profile:
            driver_profile.trips_count += 1
            driver_profile.is_available = True  # Vuelve a quedar disponible

    db.commit()

    # Avisar al pasajero del cambio de estado
    await manager.send_personal_message(
        {
            "type": "RIDE_STATUS_UPDATED",
            "ride_id": ride.id,
            "new_status": update.status
        },
        user_id=ride.passenger_id
    )

    return {"message": "Estado del viaje actualizado", "status": ride.status, "fe_awarded": fe_awarded}


# -------------------------------------------------------------
# CALIFICACIÓN Y GAMIFICACIÓN (RESEÑAS & FE)
# -------------------------------------------------------------
@app.post("/api/reviews", response_model=ReviewResponse)
def create_review(rev_data: ReviewCreate, passenger_id: int, db: Session = Depends(get_db)):
    """El pasajero califica al conductor y gana Fe por una reseña útil."""
    ride = db.query(Ride).filter(Ride.id == rev_data.ride_id).first()
    if not ride:
        raise HTTPException(status_code=404, detail="Viaje no encontrado")

    if ride.passenger_id != passenger_id:
        raise HTTPException(status_code=403, detail="Este viaje no pertenece a este pasajero")
    if ride.status != "completado":
        raise HTTPException(status_code=400, detail="Solo puedes calificar un viaje completado")

    comment = (rev_data.comment or "").strip()
    words = [word.casefold() for word in re.findall(r"[^\W_]+", comment, flags=re.UNICODE)]
    describes_trip = re.search(
        r"\b(viaje|viajar|conductor|conductora|moto|ruta|trayecto|casco|manejo|puntual|recorrido|servicio|pasajero|destino|origen|experiencia|seguridad|amable)\b",
        comment,
        flags=re.IGNORECASE,
    )
    if len(comment) < 25 or len(set(words)) < 4 or not describes_trip:
        raise HTTPException(
            status_code=400,
            detail="La reseña debe tener al menos 25 caracteres, cuatro palabras distintas y describir el viaje para recibir Fe.",
        )

    # Verificar si ya existe reseña
    existing = db.query(Review).filter(Review.ride_id == rev_data.ride_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Este viaje ya fue calificado")

    new_review = Review(
        ride_id=rev_data.ride_id,
        passenger_id=passenger_id,
        driver_id=ride.driver_id,
        rating=rev_data.rating,
        badges=rev_data.badges,
        comment=comment,
        points_earned=20
    )
    db.add(new_review)

    # Cada reseña útil suma 20 Fe al pasajero.
    passenger = db.query(User).filter(User.id == passenger_id).first()
    if passenger:
        passenger.points += 20

    # Recalcular promedio de estrellas del conductor
    driver_profile = db.query(DriverProfile).filter(DriverProfile.user_id == ride.driver_id).first()
    if driver_profile:
        all_reviews = db.query(Review).filter(Review.driver_id == ride.driver_id).all()
        ratings = [r.rating for r in all_reviews] + [rev_data.rating]
        driver_profile.rating_avg = round(sum(ratings) / len(ratings), 2)

    db.commit()
    db.refresh(new_review)
    return new_review

@app.get("/api/gamification/rewards", response_model=List[RewardResponse])
def get_rewards(db: Session = Depends(get_db)):
    """Retorna las recompensas disponibles para canjear con Fe."""
    return db.query(Reward).filter(Reward.is_active == True).all()

@app.post("/api/gamification/redeem")
def redeem_reward(user_id: int, req: RedeemRewardRequest, db: Session = Depends(get_db)):
    """Canjea una recompensa descontando Fe del usuario."""
    user = db.query(User).filter(User.id == user_id).first()
    reward = db.query(Reward).filter(Reward.id == req.reward_id).first()

    if not user or not reward:
        raise HTTPException(status_code=404, detail="Usuario o recompensa no encontrada")

    if user.points < reward.points_cost:
        raise HTTPException(
            status_code=400, 
            detail=f"Fe insuficiente. Tienes {user.points} Fe y necesitas {reward.points_cost} Fe."
        )

    user.points -= reward.points_cost
    db.commit()

    return {
        "message": f"¡Recompensa '{reward.title}' canjeada con éxito!",
        "new_balance": user.points,
        "discount_code": f"LITHIO-{reward.discount_percent}OFF-{user_id}"
    }

@app.get("/api/gamification/leaderboard")
def get_leaderboard(db: Session = Depends(get_db)):
    """Tabla de clasificación de la comunidad LITHIO"""
    top_drivers = db.query(User).join(DriverProfile).order_by(DriverProfile.trips_count.desc()).limit(5).all()
    top_passengers = db.query(User).order_by(User.points.desc()).limit(5).all()

    return {
        "top_drivers": [
            {
                "name": u.name,
                "trips": u.driver_profile.trips_count,
                "rating": u.driver_profile.rating_avg,
                "badge": u.xp_level,
                "moto": u.driver_profile.moto_brand_model
            }
            for u in top_drivers if u.driver_profile
        ],
        "top_passengers": [
            {
                "name": u.name,
                "points": u.points,
                "badge": u.xp_level
            }
            for u in top_passengers
        ]
    }
