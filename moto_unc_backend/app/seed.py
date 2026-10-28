from .database import SessionLocal, engine, Base
from .models import User, DriverProfile, Reward, Ride, Review, Route, WorkshopReward, phone_fingerprint
from .links_service import assign_friend_code
from sqlalchemy import inspect, text
from .crypto import encrypt, is_encrypted
from datetime import datetime

ROUTE_CATALOG = [
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

def sync_route_catalog(db):
    """Replace the original demo routes once with the requested UNC catalog."""
    existing_routes = db.query(Route).all()
    legacy_names = {
        "Campus UNC",
        "Biblioteca Central UNC",
        "Biblioteca UNC",
        "IVIC",
        "San Antonio de los Altos",
        "Caracas"
    }
    has_legacy_routes = any(
        route.origin in legacy_names or route.destination in legacy_names
        for route in existing_routes
    )

    if not existing_routes or has_legacy_routes:
        db.query(Route).delete(synchronize_session=False)
        for route_data in ROUTE_CATALOG:
            db.add(Route(**route_data))

# Columnas agregadas después de la primera versión; create_all() no altera tablas existentes.
ADDED_COLUMNS = {
    "users": {
        "cedula": "TEXT",
        "cedula_hash": "VARCHAR(64)",
        "phone_hash": "VARCHAR(64)",
        "career": "VARCHAR",
        "semester": "VARCHAR",
        "diamonds_cents": "INTEGER NOT NULL DEFAULT 0",
        "fe_lifetime": "INTEGER NOT NULL DEFAULT 0",
        "friend_code": "VARCHAR(12)",
        "active_session_id": "VARCHAR(64)",
        "profile_updated_at": "TIMESTAMP",
        "push_token": "VARCHAR",
    },
    "rides": {
        "status_log": "TEXT",
        "receipt_file": "VARCHAR",
        "receipt_uploaded_at": "TIMESTAMP",
    },
    "driver_profiles": {
        "mobile_payment_bank": "TEXT",
        "mobile_payment_id": "TEXT",
        # Los conductores que ya existían antes de la verificación quedan aprobados.
        "verification_status": "VARCHAR NOT NULL DEFAULT 'aprobado'",
        "verification_notes": "TEXT",
        "inspection_date": "VARCHAR",
        "license_number": "TEXT",
        "moto_year": "INTEGER",
        "submitted_at": "TIMESTAMP",
        "reviewed_at": "TIMESTAMP",
    },
}

# Columnas EncryptedString que pudieron guardarse en texto plano antes del cifrado.
ENCRYPTED_COLUMNS = {
    "users": ("phone", "cedula"),
    "driver_profiles": (
        "license_number",
        "binance_address",
        "mobile_payment_number",
        "mobile_payment_bank",
        "mobile_payment_id",
        "bank_account_number",
    ),
    "rides": ("payment_reference",),
}


def ensure_columns(db):
    inspector = inspect(db.get_bind())
    for table, columns in ADDED_COLUMNS.items():
        existing = {column["name"] for column in inspector.get_columns(table)}
        for column, column_type in columns.items():
            if column not in existing:
                db.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {column_type}"))
    if "cedula_hash" not in {index["name"] for index in inspector.get_indexes("users")}:
        db.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_cedula_hash ON users (cedula_hash)"))
    db.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_friend_code ON users (friend_code)"))
    db.execute(text("CREATE INDEX IF NOT EXISTS ix_users_phone_hash ON users (phone_hash)"))
    db.commit()


def backfill_user_fields(db):
    """Código de enlace para todos y Fe histórico mínimo igual al saldo actual."""
    for user in db.query(User).filter(User.friend_code.is_(None)).all():
        assign_friend_code(db, user)
    for user in db.query(User).filter(User.phone_hash.is_(None)).all():
        user.phone_hash = phone_fingerprint(user.phone)
    db.execute(text("UPDATE users SET fe_lifetime = points WHERE fe_lifetime < points"))
    db.commit()


WORKSHOP_CATALOG = [
    {"title": "Cambio de aceite", "description": "Aceite y mano de obra en el taller aliado.", "cost_cents": 800, "icon": "oil"},
    {"title": "Ajuste de cadena", "description": "Tensado y lubricación de la cadena.", "cost_cents": 300, "icon": "link-variant"},
    {"title": "Lavado de moto", "description": "Lavado completo de la moto.", "cost_cents": 400, "icon": "water"},
    {"title": "Mantenimiento general", "description": "Revisión de frenos, luces y cauchos.", "cost_cents": 1500, "icon": "wrench"},
]


def seed_workshop(db):
    if db.query(WorkshopReward).count() == 0:
        for item in WORKSHOP_CATALOG:
            db.add(WorkshopReward(**item))
        db.commit()


def migrate_plaintext_columns(db):
    """Cifra los datos sensibles heredados que siguen en texto plano. Es idempotente."""
    migrated = 0
    for table, columns in ENCRYPTED_COLUMNS.items():
        for column in columns:
            rows = db.execute(
                text(f"SELECT id, {column} FROM {table} WHERE {column} IS NOT NULL")
            ).all()
            for row_id, value in rows:
                if not is_encrypted(value):
                    db.execute(
                        text(f"UPDATE {table} SET {column} = :value WHERE id = :id"),
                        {"value": encrypt(value), "id": row_id},
                    )
                    migrated += 1
    db.commit()
    if migrated:
        print(f"Cifrado en reposo: {migrated} valores sensibles heredados fueron cifrados.")

def sync_legacy_reward_copy(db):
    for reward in db.query(Reward).all():
        reward.title = reward.title.replace("Monedas Estelares", "Fe").replace("Puntos UNC", "Fe")
        reward.description = (
            reward.description
            .replace("Monedas Estelares", "Fe")
            .replace("Puntos UNC", "Fe")
            .replace("+50 pts", "+35 Fe")
        )
    for user in db.query(User).all():
        if user.xp_level and "UNC" in user.xp_level:
            user.xp_level = user.xp_level.replace("UNC", "LITHIO")
    db.commit()

def seed_database():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    ensure_columns(db)
    migrate_plaintext_columns(db)
    backfill_user_fields(db)
    seed_workshop(db)
    sync_route_catalog(db)
    sync_legacy_reward_copy(db)

    # Limpieza defensiva para remover registros heredados y evitar duplicados en la base local
    stale_users = ["Carlos Silva", "Alejandro Díaz"]
    stale_driver_ids = db.query(User.id).filter(User.name.in_(stale_users)).all()
    for (user_id,) in stale_driver_ids:
        db.query(DriverProfile).filter(DriverProfile.user_id == user_id).delete(synchronize_session=False)
    db.query(User).filter(User.name.in_(stale_users)).delete(synchronize_session=False)

    admin = db.query(User).filter(User.email == "jairourdada@gmail.com").first()
    if admin:
        # Solo completa lo que falte: nunca pisa la foto, el nombre ni el teléfono
        # que el administrador cambió desde la app (antes se reiniciaban al arrancar).
        admin.name = admin.name or "Jairo Eduardo Urdaneta González"
        admin.phone = admin.phone or "+58 412 4091527"
        admin.role = "ambos"
        admin.xp_level = "Administrador LITHIO 🏍️"
        db.flush()

        existing_driver = db.query(DriverProfile).filter(DriverProfile.user_id == admin.id).first()
        if existing_driver:
            existing_driver.moto_brand_model = "Bera SBR 2026"
            existing_driver.moto_color = "Roja"
            existing_driver.rating_avg = 0
            existing_driver.trips_count = 0
            existing_driver.is_available = True
        else:
            db.add(DriverProfile(
                user_id=admin.id,
                verification_status="aprobado",
                moto_brand_model="Bera SBR 2026",
                moto_color="Roja",
                plate="AA9X12Y",
                helmet_provided=True,
                is_available=True,
                rating_avg=0,
                trips_count=0,
                current_location_tag="Campus UNC - Edificio Central"
            ))
        passenger = db.query(User).filter(User.email == "sofia.valero@unc.edu.ve").first()
        if passenger and passenger.id != 4 and not db.query(User).filter(User.id == 4).first():
            passenger.id = 4
        db.commit()
        db.close()
        return

    # 1. Creador del proyecto: Jairo
    jairo = User(
        name="Jairo Eduardo Urdaneta González",
        email="jairourdada@gmail.com",
        phone="+58 412 4091527",
        role="ambos",
        avatar_url="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80",
        points=0,
        xp_level="Administrador LITHIO 🏍️"
    )
    db.add(jairo)
    db.flush()

    jairo_driver = DriverProfile(
        user_id=jairo.id,
        verification_status="aprobado",
        moto_brand_model="Bera SBR 2026",
        moto_color="Roja",
        plate="AA9X12Y",
        helmet_provided=True,
        is_available=True,
        rating_avg=0,
        trips_count=0,
        current_location_tag="Campus UNC - Edificio Central"
    )
    db.add(jairo_driver)

    # 2. Pasajero demo mínimo para pruebas de flujo de viajes
    sofia = User(
        id=4,
        name="Sofía Valero",
        email="sofia.valero@unc.edu.ve",
        phone="+58 416 3332211",
        role="pasajero",
        avatar_url="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&auto=format&fit=crop&q=80",
        points=220,
        xp_level="Viajera Frecuente LITHIO ⭐"
    )
    db.add(sofia)

    # 5. Catálogo de recompensas canjeables con Fe
    rewards = [
        Reward(
            title="Cupón 20% por Fe",
            description="Gana Fe al completar viajes y dejar reseñas útiles. Canjéalos por descuentos en tus próximos viajes.",
            points_cost=100,
            discount_percent=20,
            icon="star-circle",
            is_active=True
        ),
        Reward(
            title="Viaje Gratis UNC <-> Biblioteca / IVIC",
            description="Canjea el Fe acumulado por un viaje en rutas universitarias.",
            points_cost=250,
            discount_percent=100,
            icon="bike",
            is_active=True
        ),
        Reward(
            title="50% de descuento en Caracas",
            description="Acumula Fe al viajar y úsalo para obtener un descuento del 50%.",
            points_cost=400,
            discount_percent=50,
            icon="ticket-percent",
            is_active=True
        ),
        Reward(
            title="Insignia VIP + 15% Extra",
            description="Tus viajes completados te entregan Fe para desbloquear beneficios de viaje.",
            points_cost=180,
            discount_percent=15,
            icon="trophy",
            is_active=True
        ),
    ]
    for r in rewards:
        db.add(r)

    db.commit()
    db.close()
    print("Base de datos inicializada con datos semilla exitosamente.")

if __name__ == "__main__":
    seed_database()
