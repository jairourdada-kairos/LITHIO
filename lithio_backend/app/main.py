from . import config  # Carga el .env antes que cualquier otro módulo de la app
from .rate_limit import rate_limit
from fastapi import FastAPI, Depends, HTTPException, WebSocket, WebSocketDisconnect, Request
from fastapi.responses import PlainTextResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from typing import List, Dict, Set
import hashlib
import hmac
import json
import asyncio
import os
import re
import urllib.request
import urllib.error
from datetime import datetime, timedelta, timezone

from . import crypto
from .database import engine, get_db, Base, SessionLocal
from .models import User, DriverProfile, Ride, Review, Route, Coupon
from .auth import (
    EMAIL_VERIFICATION_REQUIRED,
    FirebaseIdentity,
    get_current_user,
    get_firebase_identity,
    get_user_for_identity,
    is_admin,
    require_admin,
    session_is_current,
    verify_firebase_token,
)
from .schemas import (
    AdminDriverCreate, AdminDriverUpdate, AdminProfileUpdate,
    AdminRouteIn, AdminRouteUpdate,
    UserResponse, SwitchRoleRequest, DriverCardItem, DriverFinancialResponse,
    AdminProfileResponse, AdminDriverResponse, AdminRouteResponse,
    ToggleAvailabilityRequest, RideCreate, RideStatusUpdate,
    RideResponse, ReviewCreate, ReviewResponse,
    PassengerRegisterRequest, DriverRegisterRequest
)
from .seed import seed_database
from . import wallet_service
from .drivers import is_approved, require_approved_driver
from .links_service import PRIORITY_LEVEL, REVIEW_FE, RIDE_FE, award_fe, level_for, user_z
from . import push_service
from .routers import app_version, driver_applications, fe_store, legal, links, profile, quiz, rates, recovery, ride_details, wallet
from .timeutil import utcnow

ACTIVE_RIDE_STATUSES = ("solicitado", "aceptado", "en_camino", "en_curso")
VENEZUELA_TZ = config.VENEZUELA_TZ
# Estados en los que el conductor ya está ocupado con un pasajero.
BUSY_RIDE_STATUSES = ("aceptado", "en_camino", "en_curso")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Falla al arrancar si faltan las claves de cifrado, antes de tocar datos.
    crypto.validate_configuration()
    # Crear tablas, migrar columnas, cifrar datos heredados y sembrar datos iniciales
    Base.metadata.create_all(bind=engine)
    seed_database()
    yield


app = FastAPI(
    title="LITHIO API",
    description="Linked Intelligent Transport for Higher Innovative Opportunities (Transporte Inteligente Vinculado para Oportunidades Innovadoras).",
    version="1.0.0",
    lifespan=lifespan,
)

# Configuración de CORS
cors_origins = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ALLOWED_ORIGINS",
        "http://localhost:8080,http://127.0.0.1:8080",
    ).split(",")
    if origin.strip()
]
if "*" in cors_origins:
    raise ValueError("CORS_ALLOWED_ORIGINS no puede incluir el origen comodín.")

app.include_router(wallet.router)
app.include_router(links.router)
app.include_router(quiz.router)
app.include_router(driver_applications.router)
app.include_router(profile.router)
app.include_router(fe_store.router)
app.include_router(rates.router)
app.include_router(ride_details.router)
app.include_router(recovery.router)
app.include_router(app_version.router)
app.include_router(legal.router)

# Fotos de perfil subidas por los usuarios.
config.MEDIA_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/media", StaticFiles(directory=config.MEDIA_DIR), name="media")

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    # En local, la versión web publicada con iniciar_publico.bat usa un túnel de
    # Cloudflare cuya dirección cambia en cada arranque.
    # También la web de Expo abierta por la IP local de la PC, que cambia según la red.
    allow_origin_regex=None
    if config.IS_PRODUCTION
    else r"https://[a-z0-9-]+\.trycloudflare\.com|http://(localhost|127\.0\.0\.1|(\d{1,3}\.){3}\d{1,3}):80(8[0-2]|00)",
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Session-Id"],
    # La app web necesita leerla para cerrar la sesión cuando otro dispositivo entra.
    expose_headers=["X-Session-Replaced", "X-Email-Verification", "X-Email-Domain"],
)

# Montar Dashboard Web (HTML / CSS / JS)
dashboard_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "lithio_dashboard"))
if os.path.isdir(dashboard_dir):
    app.mount("/dashboard", StaticFiles(directory=dashboard_dir, html=True), name="dashboard")

    @app.get("/")
    def root_dashboard():
        return RedirectResponse(url="/dashboard")

# -------------------------------------------------------------
# GESTOR DE CONEXIONES EN TIEMPO REAL (WEBSOCKETS)
# Permite enviar notificaciones instantáneas a los teléfonos
# -------------------------------------------------------------
from .realtime import manager  # noqa: E402  (gestor compartido de WebSockets)


def serialize_ride_for_socket(ride: Ride) -> dict:
    """Resumen del viaje que viaja por WebSocket (sin datos de pago)."""
    return {
        "id": ride.id,
        "passenger_id": ride.passenger_id,
        "driver_id": ride.driver_id,
        "passenger_name": ride.passenger.name if ride.passenger else None,
        "driver_name": ride.driver.name if ride.driver else None,
        "origin": ride.origin,
        "destination": ride.destination,
        "is_scheduled": ride.is_scheduled,
        "scheduled_time": ride.scheduled_time,
        "status": ride.status,
        "payment_method": ride.payment_method,
        "fare_amount": ride.fare_amount,
        "points_rewarded": ride.points_rewarded,
        "created_at": ride.created_at.isoformat() if ride.created_at else None,
    }


# Estados en los que pasajero y conductor pueden llamarse.
CONTACT_RIDE_STATUSES = {"aceptado", "en_camino", "en_curso"}


def get_active_ride(db: Session, user_id: int) -> Ride | None:
    return db.query(Ride).filter(
        (Ride.passenger_id == user_id) | (Ride.driver_id == user_id),
        Ride.status.in_(ACTIVE_RIDE_STATUSES),
    ).order_by(Ride.id.desc()).first()


def driver_is_busy(db: Session, driver_id: int, exclude_ride_id: int | None = None) -> bool:
    query = db.query(Ride.id).filter(
        Ride.driver_id == driver_id,
        Ride.status.in_(BUSY_RIDE_STATUSES),
    )
    if exclude_ride_id is not None:
        query = query.filter(Ride.id != exclude_ride_id)
    return query.first() is not None


@app.get("/webhooks/whatsapp")
async def verify_whatsapp_webhook(request: Request):
    """Endpoint de verificacion que Meta llama al guardar el webhook."""
    params = request.query_params
    verify_token = os.getenv("WHATSAPP_WEBHOOK_VERIFY_TOKEN", "")
    if params.get("hub.mode") == "subscribe" and params.get("hub.verify_token") == verify_token:
        return PlainTextResponse(params.get("hub.challenge", ""))
    raise HTTPException(status_code=403, detail="Token de verificacion invalido")


def whatsapp_signature_is_valid(raw_body: bytes, signature_header: str | None) -> bool:
    """Meta firma cada POST con HMAC-SHA256 del cuerpo usando el App Secret.

    Sin WHATSAPP_APP_SECRET configurado no se acepta nada: no hay forma de
    saber si el mensaje viene de Meta.
    """
    secret = os.getenv("WHATSAPP_APP_SECRET", "")
    if not secret or not signature_header or not signature_header.startswith("sha256="):
        return False
    expected = hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature_header.removeprefix("sha256="))


@app.post("/webhooks/whatsapp")
async def receive_whatsapp_webhook(request: Request):
    """Recibe mensajes entrantes y actualizaciones de estado de WhatsApp."""
    raw_body = await request.body()
    if not whatsapp_signature_is_valid(raw_body, request.headers.get("X-Hub-Signature-256")):
        raise HTTPException(status_code=403, detail="Firma de WhatsApp no válida")
    try:
        payload = json.loads(raw_body)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Cuerpo no válido")
    print("WhatsApp webhook recibido:", payload.get("object", "unknown"))
    return {"received": True}


def whatsapp_ride_message(recipient: str, ride: Ride, passenger_name: str) -> dict:
    """Mensaje de WhatsApp para el conductor con la nueva solicitud.

    Meta solo entrega texto libre si el conductor escribió al número en las
    últimas 24 h. Para avisos automáticos hace falta una plantilla aprobada:
    si WHATSAPP_TEMPLATE_NAME está configurada se usa, con 5 variables en este
    orden: pasajero, origen, destino, tarifa y horario.
    """
    schedule = ride.scheduled_time or "inmediato"
    fare = f"${ride.fare_amount:.2f}"
    template = os.getenv("WHATSAPP_TEMPLATE_NAME", "").strip()
    if template:
        values = [passenger_name, ride.origin, ride.destination, fare, schedule]
        return {
            "messaging_product": "whatsapp",
            "to": recipient,
            "type": "template",
            "template": {
                "name": template,
                "language": {"code": os.getenv("WHATSAPP_TEMPLATE_LANGUAGE", "es")},
                "components": [{"type": "body", "parameters": [{"type": "text", "text": v} for v in values]}],
            },
        }
    return {
        "messaging_product": "whatsapp",
        "to": recipient,
        "type": "text",
        "text": {
            "preview_url": False,
            "body": (
                "LITHIO: nueva solicitud de viaje\n"
                f"Pasajero: {passenger_name}\n"
                f"Origen: {ride.origin}\n"
                f"Destino: {ride.destination}\n"
                f"Tarifa: {fare}\n"
                f"Horario: {schedule}\n"
                "Abre LITHIO para aceptarla."
            ),
        },
    }


async def notify_driver_whatsapp(driver: User, ride: Ride, passenger_name: str = "") -> str:
    """Envía una alerta por WhatsApp Cloud API cuando las credenciales están configuradas."""
    token = os.getenv("WHATSAPP_ACCESS_TOKEN")
    phone_number_id = os.getenv("WHATSAPP_PHONE_NUMBER_ID")
    if not token or not phone_number_id or not driver.phone:
        return "not_configured"

    recipient = "".join(character for character in driver.phone if character.isdigit())
    payload = json.dumps(whatsapp_ride_message(recipient, ride, passenger_name)).encode("utf-8")
    request = urllib.request.Request(
        f"https://graph.facebook.com/v22.0/{phone_number_id}/messages",
        data=payload,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        method="POST"
    )

    try:
        await asyncio.to_thread(urllib.request.urlopen, request, timeout=10)
        return "sent"
    except urllib.error.HTTPError as error:
        print("WhatsApp rechazó el aviso:", error.code, error.read()[:300])
        return "failed"
    except urllib.error.URLError:
        return "failed"

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    user_id = None
    await websocket.accept()
    try:
        try:
            raw_auth_message = await asyncio.wait_for(
                websocket.receive_text(),
                timeout=10,
            )
        except asyncio.TimeoutError:
            await websocket.close(code=1008, reason="Tiempo de autenticación agotado")
            return

        if len(raw_auth_message) > 8192:
            await websocket.close(code=1008, reason="Mensaje de autenticación no válido")
            return

        try:
            auth_message = json.loads(raw_auth_message)
        except json.JSONDecodeError:
            await websocket.close(code=1008, reason="Mensaje de autenticación no válido")
            return

        if not isinstance(auth_message, dict) or auth_message.get("type") != "AUTH":
            await websocket.close(code=1008, reason="Autenticación requerida")
            return

        token = auth_message.get("token")
        if not isinstance(token, str) or not token:
            await websocket.close(code=1008, reason="Autenticación requerida")
            return

        identity = verify_firebase_token(token)
        db = SessionLocal()
        try:
            user = get_user_for_identity(identity, db)
            session_id = auth_message.get("session_id") if isinstance(auth_message.get("session_id"), str) else None
            if not session_is_current(user, session_id):
                await websocket.send_json({"type": "SESSION_REPLACED"})
                await websocket.close(code=4001, reason="Sesión iniciada en otro dispositivo")
                return
            user_id = user.id
            active_ride = get_active_ride(db, user_id)
            snapshot = serialize_ride_for_socket(active_ride) if active_ride else None
        finally:
            db.close()

        manager.connect(user_id, websocket, session_id)
        await websocket.send_json({"type": "AUTHENTICATED", "user_id": user_id})
        # Tras cada (re)conexión el cliente recibe el viaje activo para
        # recuperar cualquier cambio de estado que se perdió estando offline.
        await websocket.send_json({"type": "ACTIVE_RIDE_SYNC", "ride": snapshot})
        while True:
            raw_message = await websocket.receive_text()
            if len(raw_message) > 8192:
                continue
            try:
                message = json.loads(raw_message)
            except json.JSONDecodeError:
                continue
            # Latido de la app para detectar conexiones muertas (redes móviles).
            if isinstance(message, dict) and message.get("type") == "PING":
                await websocket.send_json({"type": "PONG"})
    except WebSocketDisconnect:
        pass
    except HTTPException:
        await websocket.close(code=1008, reason="Sesión no válida")
    finally:
        if user_id is not None:
            manager.disconnect(user_id, websocket)


@app.get("/health")
def health_check(db: Session = Depends(get_db)):
    """Usado por Railway/Render para saber si el servicio está vivo."""
    try:
        db.execute(text("SELECT 1"))
    except Exception:
        raise HTTPException(status_code=503, detail="Base de datos no disponible")
    return {"status": "ok", "environment": config.APP_ENV}


@app.get("/api/auth/config")
def get_firebase_web_config():
    api_key = os.getenv("FIREBASE_WEB_API_KEY")
    project_id = os.getenv("FIREBASE_PROJECT_ID")
    if not api_key or not project_id:
        raise HTTPException(
            status_code=503,
            detail=(
                "Configura FIREBASE_PROJECT_ID y FIREBASE_WEB_API_KEY "
                "en lithio_backend/.env y reinicia el backend."
            ),
        )
    return {
        "apiKey": api_key,
        "authDomain": os.getenv(
            "FIREBASE_AUTH_DOMAIN",
            f"{project_id}.firebaseapp.com",
        ),
        "projectId": project_id,
    }


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


@app.post(
    "/api/admin/routes",
    status_code=201,
    response_model=AdminRouteResponse,
    dependencies=[Depends(require_admin)],
)
def create_route_admin(data: AdminRouteIn, db: Session = Depends(get_db)):
    payload = data.model_dump()
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


@app.put(
    "/api/admin/routes/{route_id}",
    response_model=AdminRouteResponse,
    dependencies=[Depends(require_admin)],
)
def update_route_admin(route_id: int, data: AdminRouteUpdate, db: Session = Depends(get_db)):
    payload = data.model_dump(exclude_unset=True)
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


@app.delete("/api/admin/routes/{route_id}", dependencies=[Depends(require_admin)])
def delete_route_admin(route_id: int, db: Session = Depends(get_db)):
    route = db.query(Route).filter(Route.id == route_id).first()
    if not route:
        raise HTTPException(status_code=404, detail="Ruta no encontrada")
    db.delete(route)
    db.commit()
    return {"message": "Ruta eliminada correctamente"}


@app.post(
    "/api/admin/drivers",
    status_code=201,
    response_model=AdminDriverResponse,
    dependencies=[Depends(require_admin)],
)
def create_admin_driver(data: AdminDriverCreate, db: Session = Depends(get_db)):
    payload = data.model_dump()
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
        fe_lifetime=100,
        xp_level=payload.get("xp_level", "Conductor UNC")
    )
    db.add(user)
    db.flush()

    driver_profile = DriverProfile(
        user_id=user.id,
        verification_status="aprobado",
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


@app.put(
    "/api/admin/profile/{user_id}",
    response_model=AdminProfileResponse,
    dependencies=[Depends(require_admin)],
)
def update_admin_profile(user_id: int, data: AdminProfileUpdate, db: Session = Depends(get_db)):
    payload = data.model_dump(exclude_unset=True)
    user = db.query(User).filter(User.id == user_id).first()
    if not user or not is_admin(user):
        raise HTTPException(status_code=404, detail="Administrador no encontrado")
    for field in ("name", "email", "phone"):
        if field in payload:
            setattr(user, field, payload[field])
    db.commit()
    db.refresh(user)
    return {"id": user.id, "name": user.name, "email": user.email, "phone": user.phone}


@app.delete("/api/admin/drivers/{driver_id}", dependencies=[Depends(require_admin)])
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


@app.put(
    "/api/admin/drivers/{driver_id}",
    response_model=AdminDriverResponse,
    dependencies=[Depends(require_admin)],
)
def update_admin_driver(driver_id: int, data: AdminDriverUpdate, db: Session = Depends(get_db)):
    payload = data.model_dump(exclude_unset=True)
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


# -------------------------------------------------------------
# PERFILES Y ROLES DE USUARIO
# -------------------------------------------------------------
@app.get("/api/users/me", response_model=UserResponse)
def get_my_user(user: User = Depends(get_current_user)):
    return user


@app.get("/api/admin/me", response_model=AdminProfileResponse)
def get_admin_profile(user: User = Depends(require_admin)):
    return user


@app.get("/api/users/me/financial", response_model=DriverFinancialResponse)
def get_my_financial_profile(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = db.query(DriverProfile).filter(DriverProfile.user_id == user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Perfil de conductor no encontrado")
    return profile


@app.get("/api/users/{user_id}", response_model=UserResponse)
def get_user(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.id != user_id and not is_admin(current_user):
        raise HTTPException(status_code=403, detail="No puedes consultar el perfil de otro usuario.")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return user

@app.post("/api/users/{user_id}/switch-role")
def switch_user_role(
    user_id: int,
    req: SwitchRoleRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Solo puedes cambiar tu propio rol.")
    if req.new_role not in {"pasajero", "conductor", "ambos"}:
        raise HTTPException(status_code=400, detail="El rol solicitado no es válido.")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if req.new_role in {"conductor", "ambos"}:
        profile = db.query(DriverProfile).filter(DriverProfile.user_id == user_id).first()
        if not profile:
            raise HTTPException(status_code=400, detail="Debes registrar un perfil de conductor primero.")
        if profile.verification_status != "aprobado":
            raise HTTPException(status_code=403, detail="Tu postulación de conductor debe estar aprobada.")
    user.role = req.new_role
    db.commit()
    return {"message": f"Rol cambiado a {req.new_role}", "role": user.role}


# -------------------------------------------------------------
# REGISTRO DE NUEVOS USUARIOS (PASAJERO Y CONDUCTOR)
# -------------------------------------------------------------
def ensure_cedula_available(db: Session, cedula: str, owner_id: int | None = None) -> str:
    """Devuelve el índice ciego de la cédula o 409 si ya pertenece a otra cuenta."""
    cedula_hash = crypto.blind_index(cedula)
    holder = db.query(User.id).filter(User.cedula_hash == cedula_hash).first()
    if holder and holder.id != owner_id:
        raise HTTPException(status_code=409, detail="Ya existe una cuenta registrada con esa cédula.")
    return cedula_hash


def fill_missing_identity(user: User, data: PassengerRegisterRequest | DriverRegisterRequest, db: Session):
    """Completa cédula, carrera y semestre de cuentas creadas antes de estos campos."""
    if not user.cedula_hash:
        user.cedula_hash = ensure_cedula_available(db, data.cedula, owner_id=user.id)
        user.cedula = data.cedula
    user.career = user.career or data.career
    user.semester = user.semester or data.semester


def require_verified_email_to_link(existing: User, identity: FirebaseIdentity):
    """Una cuenta creada antes de Firebase solo se vincula si el correo está verificado."""
    if not existing.firebase_uid and not identity.email_verified:
        raise HTTPException(
            status_code=EMAIL_VERIFICATION_REQUIRED,
            detail="Este correo ya tiene un perfil en LITHIO. Verifica tu correo para vincularlo a tu cuenta.",
        )


def commit_registration(db: Session, user: User) -> User:
    try:
        db.commit()
    except IntegrityError:
        # Dos registros simultáneos con la misma cédula o correo.
        db.rollback()
        raise HTTPException(status_code=409, detail="Ya existe una cuenta con esa cédula o correo.")
    db.refresh(user)
    return user


@app.post("/api/passengers/register", response_model=UserResponse, status_code=201, dependencies=[Depends(rate_limit("registro", 5, 600))])
def register_passenger(
    data: PassengerRegisterRequest,
    identity: FirebaseIdentity = Depends(get_firebase_identity),
    db: Session = Depends(get_db),
):
    """
    Registra un nuevo pasajero con nombres, apellidos, cédula, correo,
    carrera, semestre y teléfono (validados en schemas.RegistrationFields).
    La cuenta queda vinculada al UID de Firebase del token, nunca a uno enviado.
    """
    email = data.email
    if not identity.email or identity.email != email:
        raise HTTPException(status_code=403, detail="El correo debe coincidir con la cuenta Firebase autenticada.")
    existing = db.query(User).filter(User.firebase_uid == identity.uid).first()
    if existing:
        if existing.role == "pasajero":
            return existing
        raise HTTPException(status_code=409, detail="Esta cuenta ya tiene un perfil.")
    existing_email = db.query(User).filter(User.email == email).first()
    if existing_email:
        require_verified_email_to_link(existing_email, identity)
        if (
            identity.email_verified
            and not existing_email.firebase_uid
            and existing_email.role in {"pasajero", "ambos"}
        ):
            existing_email.firebase_uid = identity.uid
            fill_missing_identity(existing_email, data, db)
            return commit_registration(db, existing_email)
        raise HTTPException(status_code=409, detail="Ya existe una cuenta con ese correo.")

    cedula_hash = ensure_cedula_available(db, data.cedula)
    new_user = User(
        name=data.name,
        last_name=data.last_name,
        age=data.age,
        email=email,
        phone=data.phone,
        cedula=data.cedula,
        cedula_hash=cedula_hash,
        career=data.career,
        semester=data.semester,
        role="pasajero",
        avatar_url=data.avatar_url,
        firebase_uid=identity.uid,
        points=100,  # Bono de bienvenida
        fe_lifetime=100,  # Cuenta para el nivel desde el primer día
        xp_level="Pasajero Novato"
    )
    db.add(new_user)
    return commit_registration(db, new_user)


@app.post("/api/drivers/register", response_model=UserResponse, status_code=201, dependencies=[Depends(rate_limit("registro", 5, 600))])
def register_driver(
    data: DriverRegisterRequest,
    identity: FirebaseIdentity = Depends(get_firebase_identity),
    db: Session = Depends(get_db),
):
    """
    Registra un nuevo conductor con datos personales, de la moto y
    métodos de pago (Binance, pago móvil, cuenta bancaria).
    """
    email = data.email
    if not identity.email or identity.email != email:
        raise HTTPException(status_code=403, detail="El correo debe coincidir con la cuenta Firebase autenticada.")
    existing = db.query(User).filter(User.firebase_uid == identity.uid).first()
    if existing:
        if existing.role == "conductor" and existing.driver_profile:
            return existing
        raise HTTPException(status_code=409, detail="Esta cuenta ya tiene un perfil.")
    existing_email = db.query(User).filter(User.email == email).first()
    if existing_email:
        require_verified_email_to_link(existing_email, identity)
        if (
            identity.email_verified
            and not existing_email.firebase_uid
            and existing_email.role in {"conductor", "ambos"}
            and existing_email.driver_profile
        ):
            existing_email.firebase_uid = identity.uid
            fill_missing_identity(existing_email, data, db)
            return commit_registration(db, existing_email)
        raise HTTPException(status_code=409, detail="Ya existe una cuenta con ese correo.")

    cedula_hash = ensure_cedula_available(db, data.cedula)
    new_user = User(
        name=data.name,
        last_name=data.last_name,
        age=data.age,
        email=email,
        phone=data.phone,
        cedula=data.cedula,
        cedula_hash=cedula_hash,
        career=data.career,
        semester=data.semester,
        role="conductor",
        avatar_url=data.avatar_url,
        firebase_uid=identity.uid,
        points=100,
        fe_lifetime=100,
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
        # No aparece en el directorio hasta que el administrador lo apruebe.
        is_available=False,
        verification_status="pendiente",
        license_number=data.license_number,
        moto_year=data.moto_year,
        rating_avg=0.0,
        trips_count=0,
        current_location_tag="Entrada UNC - Altos Mirandinos",
        binance_address=data.binance_address,
        mobile_payment_number=data.mobile_payment_number,
        mobile_payment_bank=data.mobile_payment_bank,
        mobile_payment_id=data.mobile_payment_id,
        bank_account_number=data.bank_account_number
    )
    db.add(driver_profile)
    return commit_registration(db, new_user)


# -------------------------------------------------------------
# DIRECTO DE CONDUCTORES (LO QUE VE EL PASAJERO)
# -------------------------------------------------------------
@app.get("/api/drivers", response_model=List[DriverCardItem])
def list_drivers(db: Session = Depends(get_db)):
    """Retorna el listado de conductores con su estado, moto y nivel"""
    drivers = db.query(DriverProfile).join(User).filter(DriverProfile.verification_status == "aprobado").all()
    busy_driver_ids = {
        driver_id
        for (driver_id,) in db.query(Ride.driver_id).filter(Ride.status.in_(BUSY_RIDE_STATUSES)).distinct()
    }
    results = []
    for dp in drivers:
        results.append(DriverCardItem(
            user_id=dp.user.id,
            name=dp.user.name,
            avatar_url=dp.user.avatar_url,
            moto_brand_model=dp.moto_brand_model,
            moto_color=dp.moto_color,
            helmet_provided=dp.helmet_provided,
            # Un conductor con un viaje aceptado nunca aparece disponible.
            is_available=dp.is_available and dp.user_id not in busy_driver_ids,
            rating_avg=dp.rating_avg,
            trips_count=dp.trips_count,
            xp_level=dp.user.xp_level,
        ))
    return results

@app.put("/api/drivers/{driver_id}/availability")
async def toggle_driver_availability(
    driver_id: int, 
    req: ToggleAvailabilityRequest, 
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """El conductor cambia entre Disponible y Fuera de Servicio"""
    if current_user.id != driver_id:
        raise HTTPException(status_code=403, detail="Solo puedes cambiar tu propia disponibilidad.")
    profile = require_approved_driver(db, current_user)
    if req.is_available and driver_is_busy(db, driver_id):
        raise HTTPException(
            status_code=409,
            detail="Tienes un viaje en curso. Finalízalo antes de marcarte como disponible.",
        )
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
@app.post("/api/rides", response_model=RideResponse, dependencies=[Depends(rate_limit("viajes", 10, 600))])
async def request_ride(
    ride_data: RideCreate, 
    passenger_id: int | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Un pasajero solicita un viaje eligiendo directamente a su conductor.
    Envía una alerta en tiempo real a la app del conductor seleccionado.
    """
    if passenger_id is not None and passenger_id != current_user.id:
        raise HTTPException(status_code=403, detail="No puedes solicitar un viaje como otro usuario.")
    passenger = current_user
    driver = db.query(User).filter(User.id == ride_data.driver_id).first()

    if not driver or not driver.driver_profile:
        raise HTTPException(status_code=404, detail="Pasajero o conductor no válido")
    if driver.id == passenger.id:
        raise HTTPException(status_code=400, detail="No puedes solicitar un viaje a tu propia cuenta.")
    if ride_data.payment_method not in {"efectivo", "pago_movil", "diamantes"}:
        raise HTTPException(
            status_code=400,
            detail="Método de pago no válido. Usa efectivo, Pago Móvil o diamantes.",
        )
    if not is_approved(driver.driver_profile):
        raise HTTPException(status_code=404, detail="Pasajero o conductor no válido")
    fare = ride_data.fare_amount
    coupon = None
    if ride_data.coupon_id is not None:
        coupon = db.query(Coupon).filter(
            Coupon.id == ride_data.coupon_id, Coupon.user_id == passenger.id, Coupon.status == "activo"
        ).first()
        if not coupon:
            raise HTTPException(status_code=400, detail="Ese cupón no está disponible.")
        fare = round(fare * (100 - coupon.percent) / 100, 2)
    # round() y no to_cents(): con un cupón del 100 % la tarifa es 0 y to_cents la rechaza con otro mensaje.
    if ride_data.payment_method == "diamantes" and round(fare * 100) < wallet_service.MIN_RIDE_PAYMENT_CENTS:
        raise HTTPException(
            status_code=400,
            detail="El mínimo para pagar con diamantes es ◆ 0.50. Elige efectivo o Pago Móvil para este viaje.",
        )
    if ride_data.payment_method == "diamantes" and (passenger.diamonds_cents or 0) < wallet_service.to_cents(fare):
        raise HTTPException(status_code=400, detail="No tienes diamantes suficientes para este viaje. Recarga tu billetera.")
    if ride_data.is_scheduled:
        try:
            scheduled_at = datetime.strptime(ride_data.scheduled_time or "", "%Y-%m-%d %H:%M")
        except ValueError:
            raise HTTPException(status_code=400, detail="La hora programada debe tener el formato AAAA-MM-DD HH:MM.")
        now_in_venezuela = datetime.now(VENEZUELA_TZ).replace(tzinfo=None)
        if scheduled_at <= now_in_venezuela:
            raise HTTPException(status_code=400, detail="La hora programada ya pasó. Elige una fecha y hora futuras.")
    if get_active_ride(db, passenger.id):
        raise HTTPException(status_code=409, detail="Ya tienes un viaje activo. Finalízalo o cancélalo primero.")
    if not driver.driver_profile.is_available or driver_is_busy(db, driver.id):
        raise HTTPException(status_code=409, detail="Este conductor no está disponible en este momento.")

    new_ride = Ride(
        passenger_id=passenger.id,
        driver_id=ride_data.driver_id,
        origin=ride_data.origin,
        destination=ride_data.destination,
        is_scheduled=ride_data.is_scheduled,
        scheduled_time=ride_data.scheduled_time,
        status="solicitado",
        payment_method=ride_data.payment_method,
        payment_reference=ride_data.payment_reference,
        fare_amount=fare,
        points_rewarded=RIDE_FE
    )
    log_status(new_ride, "solicitado")
    db.add(new_ride)
    db.flush()
    if coupon:
        coupon.status = "usado"
        coupon.ride_id = new_ride.id
    if new_ride.payment_method == "diamantes":
        # La tarifa queda retenida y se cobra al completar el viaje.
        wallet_service.hold_ride_payment(db, wallet_service.lock_user(db, passenger.id), new_ride)
    db.commit()
    db.refresh(new_ride)

    whatsapp_status = await notify_driver_whatsapp(driver, new_ride, passenger.name)

    when = f" · programado {new_ride.scheduled_time}" if new_ride.is_scheduled else ""
    push_service.notify(
        db, driver.id, "Nueva solicitud de viaje",
        f"{passenger.name}: {new_ride.origin} → {new_ride.destination}{when}",
        {"type": "NEW_RIDE_REQUEST", "ride_id": new_ride.id},
    )

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
            "payment_method": new_ride.payment_method,
            "ride": serialize_ride_for_socket(new_ride),
        },
        user_id=ride_data.driver_id
    )

    resp = RideResponse.model_validate(new_ride)
    resp.passenger_name = passenger.name
    resp.driver_name = driver.name
    resp.whatsapp_status = whatsapp_status
    driver_profile = driver.driver_profile
    if ride_data.payment_method == "pago_movil" and driver_profile:
        resp.driver_mobile_payment_number = driver_profile.mobile_payment_number
        resp.driver_mobile_payment_bank = driver_profile.mobile_payment_bank
        resp.driver_mobile_payment_id = driver_profile.mobile_payment_id
        resp.driver_bank_account_number = driver_profile.bank_account_number
        resp.driver_binance_address = driver_profile.binance_address
    return resp

@app.get("/api/rides/driver/{driver_id}/pending", response_model=List[RideResponse])
def get_pending_rides_for_driver(
    driver_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Viajes pendientes por aceptar para este conductor"""
    if current_user.id != driver_id:
        raise HTTPException(status_code=403, detail="Solo el conductor asignado puede ver estas solicitudes.")
    rides = db.query(Ride).filter(
        Ride.driver_id == driver_id, 
        Ride.status == "solicitado"
    ).order_by(Ride.id).all()
    # Beneficio del Argón (Z=18): sus solicitudes aparecen primero.
    rides.sort(key=lambda r: user_z(r.passenger) < PRIORITY_LEVEL)
    results = []
    for r in rides:
        res = RideResponse.model_validate(r)
        res.passenger_name = r.passenger.name
        res.driver_name = r.driver.name
        results.append(res)
    return results

@app.get("/api/rides/active/{user_id}", response_model=RideResponse)
def get_active_ride_for_user(
    user_id: int,
    role: str | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Obtiene el viaje activo de un usuario (como pasajero, conductor o ambos)."""
    if current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Solo puedes consultar tus propios viajes.")
    ride = db.query(Ride).filter(
        participant_filter(user_id, role),
        Ride.status.in_(BUSY_RIDE_STATUSES if role == "conductor" else ACTIVE_RIDE_STATUSES)
    ).order_by(Ride.id.desc()).first()

    if not ride:
        raise HTTPException(status_code=404, detail="No hay viaje activo")

    res = RideResponse.model_validate(ride)
    res.passenger_name = ride.passenger.name
    res.driver_name = ride.driver.name
    # Con el viaje aceptado, cada uno ve el teléfono del otro para poder llamarlo.
    if ride.status in CONTACT_RIDE_STATUSES:
        counterpart = ride.driver if current_user.id == ride.passenger_id else ride.passenger
        res.counterpart_phone = counterpart.phone if counterpart else None
    if current_user.id == ride.passenger_id and ride.status in {"aceptado", "en_camino", "en_curso"}:
        profile = db.query(DriverProfile).filter(DriverProfile.user_id == ride.driver_id).first()
        if profile:
            res.driver_mobile_payment_number = profile.mobile_payment_number
            res.driver_mobile_payment_bank = profile.mobile_payment_bank
            res.driver_mobile_payment_id = profile.mobile_payment_id
            res.driver_bank_account_number = profile.bank_account_number
            res.driver_binance_address = profile.binance_address
    return res

def participant_filter(user_id: int, role: str | None):
    if role == "pasajero":
        return Ride.passenger_id == user_id
    if role == "conductor":
        return Ride.driver_id == user_id
    if role is None:
        return (Ride.passenger_id == user_id) | (Ride.driver_id == user_id)
    raise HTTPException(status_code=400, detail="role debe ser 'pasajero' o 'conductor'.")


@app.get("/api/rides/mine", response_model=List[RideResponse])
def list_my_rides(
    scope: str = "history",
    role: str | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Viajes del usuario autenticado, como pasajero o conductor.
    scope=history: completados, cancelados y rechazados (más recientes primero).
    scope=scheduled: programados que siguen pendientes.
    role=pasajero|conductor limita a los viajes de la sesión actual.
    """
    query = db.query(Ride).filter(participant_filter(current_user.id, role))
    if scope == "history":
        query = query.filter(Ride.status.in_(["completado", "cancelado", "rechazado"]))
    elif scope == "scheduled":
        query = query.filter(Ride.is_scheduled.is_(True), Ride.status.in_(ACTIVE_RIDE_STATUSES))
    else:
        raise HTTPException(status_code=400, detail="scope debe ser 'history' o 'scheduled'.")

    results = []
    for ride in query.order_by(Ride.id.desc()).limit(50).all():
        item = RideResponse.model_validate(ride)
        item.passenger_name = ride.passenger.name
        item.driver_name = ride.driver.name
        # La referencia y el comprobante se consultan en el detalle del viaje.
        item.payment_reference = None
        item.has_receipt = bool(ride.receipt_file)
        results.append(item)
    return results


@app.get("/api/users/me/summary")
def get_my_summary(
    role: str | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Números de la pantalla de cuenta: viajes completados, calificación y agendados."""
    completed = db.query(Ride.id).filter(
        participant_filter(current_user.id, role),
        Ride.status == "completado",
    ).count()
    scheduled = db.query(Ride.id).filter(
        participant_filter(current_user.id, role),
        Ride.is_scheduled.is_(True),
        Ride.status.in_(ACTIVE_RIDE_STATUSES),
    ).count()
    profile = current_user.driver_profile
    return {
        "trips_completed": completed,
        "scheduled_count": scheduled,
        "points": current_user.points,
        "diamonds": wallet_service.as_diamonds(current_user.diamonds_cents or 0),
        "friend_code": current_user.friend_code,
        "level": level_for(current_user.fe_lifetime or 0),
        "rating_avg": profile.rating_avg if profile else None,
        "is_available": profile.is_available if profile else None,
        "has_driver_profile": profile is not None,
        "verification_status": profile.verification_status if profile else None,
        "is_admin": is_admin(current_user),
    }



def push_ride_status(db: Session, ride: Ride, status: str, actor: User, fe_awarded: int) -> None:
    """Notificación push a la otra persona del viaje cuando cambia su estado."""
    driver, passenger = ride.driver.name, ride.passenger.name
    data = {"type": "RIDE_STATUS_UPDATED", "ride_id": ride.id, "status": status}
    to_passenger = {
        "aceptado": ("Tu viaje fue aceptado", f"{driver} va por ti. Prepárate en {ride.origin}."),
        "rechazado": ("Tu solicitud no fue aceptada", f"{driver} no puede tomarla. Elige otro conductor."),
        "en_camino": ("Tu conductor va en camino", f"{driver} se dirige a {ride.origin}."),
        "en_curso": ("Viaje iniciado", f"Rumbo a {ride.destination}. ¡Buen viaje!"),
        "completado": (
            "Llegaste a tu destino",
            f"Ganaste +{fe_awarded} Fe. Califica a {driver}." if fe_awarded else f"Califica a {driver}.",
        ),
    }
    if status == "cancelado":
        other_id = ride.driver_id if actor.id == ride.passenger_id else ride.passenger_id
        who = passenger if actor.id == ride.passenger_id else driver
        push_service.notify(db, other_id, "Viaje cancelado", f"{who} canceló el viaje a {ride.destination}.", data)
    elif status in to_passenger:
        title, body = to_passenger[status]
        push_service.notify(db, ride.passenger_id, title, body, data)


def log_status(ride: Ride, status: str) -> None:
    """Agrega el cambio de estado a la línea de tiempo del viaje."""
    entries = json.loads(ride.status_log) if ride.status_log else []
    entries.append({"status": status, "at": utcnow().isoformat()})
    ride.status_log = json.dumps(entries)

@app.put("/api/rides/{ride_id}/status")
async def update_ride_status(
    ride_id: int, 
    update: RideStatusUpdate, 
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Actualiza el estado del viaje:
    'aceptado' -> 'en_camino' -> 'en_curso' -> 'completado' o 'cancelado'
    """
    ride = db.query(Ride).filter(Ride.id == ride_id).first()
    if not ride:
        raise HTTPException(status_code=404, detail="Viaje no encontrado")

    driver_actions = {"aceptado", "rechazado", "en_camino", "en_curso", "completado"}
    if update.status not in driver_actions | {"cancelado"}:
        raise HTTPException(status_code=400, detail="El estado solicitado no es válido.")
    if update.status in driver_actions and current_user.id != ride.driver_id:
        raise HTTPException(status_code=403, detail="Solo el conductor asignado puede actualizar este estado.")
    if update.status == "cancelado" and current_user.id not in {ride.passenger_id, ride.driver_id}:
        raise HTTPException(status_code=403, detail="Solo los participantes pueden cancelar este viaje.")
    # Con el pasajero a bordo, solo el conductor puede cancelar: así nadie viaja y
    # luego cancela para recuperar los diamantes retenidos.
    if update.status == "cancelado" and ride.status == "en_curso" and current_user.id != ride.driver_id:
        raise HTTPException(
            status_code=400,
            detail="El viaje ya empezó. Si hay un problema, pídele al conductor que lo cancele.",
        )

    transitions = {
        "solicitado": {"aceptado", "rechazado", "cancelado"},
        "aceptado": {"en_camino", "en_curso", "cancelado"},
        "en_camino": {"en_curso", "cancelado"},
        "en_curso": {"completado", "cancelado"},
    }
    if update.status not in transitions.get(ride.status, set()):
        raise HTTPException(status_code=400, detail="La transición de estado no está permitida.")

    driver_profile = db.query(DriverProfile).filter(DriverProfile.user_id == ride.driver_id).first()
    if update.status == "aceptado" and driver_is_busy(db, ride.driver_id, exclude_ride_id=ride.id):
        raise HTTPException(status_code=409, detail="Ya tienes un viaje aceptado. Finalízalo antes de aceptar otro.")

    old_status = ride.status
    ride.status = update.status
    log_status(ride, update.status)
    fe_awarded = 0
    availability_changed = False

    # Mientras atiende un viaje, el conductor sale del directorio de disponibles.
    if update.status == "aceptado" and driver_profile and driver_profile.is_available:
        driver_profile.is_available = False
        availability_changed = True
    if update.status == "cancelado" and old_status in BUSY_RIDE_STATUSES and driver_profile:
        driver_profile.is_available = True
        availability_changed = True
    if update.status in {"cancelado", "rechazado"}:
        wallet_service.refund_ride_payment(db, ride)
        # El cupón vuelve a estar disponible si el viaje no se hizo.
        db.query(Coupon).filter(Coupon.ride_id == ride.id).update({"status": "activo", "ride_id": None})

    # Si se completa el viaje, pasajero y conductor ganan el Fe del viaje
    if update.status == "completado" and old_status != "completado":
        passenger = db.query(User).filter(User.id == ride.passenger_id).first()
        if passenger:
            award_fe(passenger, ride.points_rewarded)
            fe_awarded = ride.points_rewarded
        driver = db.query(User).filter(User.id == ride.driver_id).first()
        if driver and not ride.driver_fe_awarded:
            award_fe(driver, ride.points_rewarded)
            ride.driver_fe_awarded = True
        wallet_service.settle_ride_payment(db, ride)

        if driver_profile:
            driver_profile.trips_count += 1
            driver_profile.is_available = True  # Vuelve a quedar disponible
            availability_changed = True

    db.commit()
    db.refresh(ride)

    # Avisar a ambos participantes (el conductor puede tener varios dispositivos)
    status_message = {
        "type": "RIDE_STATUS_UPDATED",
        "ride_id": ride.id,
        "new_status": update.status,
        "previous_status": old_status,
        "fe_awarded": fe_awarded,
        "ride": serialize_ride_for_socket(ride),
    }
    for participant_id in {ride.passenger_id, ride.driver_id}:
        await manager.send_personal_message(status_message, user_id=participant_id)
    push_ride_status(db, ride, update.status, current_user, fe_awarded)

    if availability_changed and driver_profile:
        await manager.broadcast({
            "type": "DRIVER_AVAILABILITY_CHANGED",
            "driver_id": ride.driver_id,
            "is_available": driver_profile.is_available,
        })

    return {"message": "Estado del viaje actualizado", "status": ride.status, "fe_awarded": fe_awarded}


# -------------------------------------------------------------
# CALIFICACIÓN Y GAMIFICACIÓN (RESEÑAS & FE)
# -------------------------------------------------------------
@app.post("/api/reviews", response_model=ReviewResponse)
def create_review(
    rev_data: ReviewCreate,
    passenger_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """El pasajero califica al conductor y gana Fe por una reseña útil."""
    ride = db.query(Ride).filter(Ride.id == rev_data.ride_id).first()
    if not ride:
        raise HTTPException(status_code=404, detail="Viaje no encontrado")

    if passenger_id != current_user.id or ride.passenger_id != current_user.id:
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
        points_earned=REVIEW_FE
    )
    db.add(new_review)

    # Cada reseña útil suma Fe al pasajero.
    passenger = db.query(User).filter(User.id == passenger_id).first()
    if passenger:
        award_fe(passenger, REVIEW_FE)

    # Recalcular promedio de estrellas del conductor
    driver_profile = db.query(DriverProfile).filter(DriverProfile.user_id == ride.driver_id).first()
    if driver_profile:
        all_reviews = db.query(Review).filter(Review.driver_id == ride.driver_id).all()
        ratings = [r.rating for r in all_reviews] + [rev_data.rating]
        driver_profile.rating_avg = round(sum(ratings) / len(ratings), 2)

    db.commit()
    db.refresh(new_review)
    return new_review


@app.get("/api/gamification/rewards")
def legacy_rewards():
    """El catálogo viejo se reemplazó por la tienda de Fe; las apps sin actualizar
    todavía lo piden al abrir. Borrar cuando todas tengan la versión de oct. 2026."""
    return []
