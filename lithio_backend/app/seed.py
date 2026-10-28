from .database import SessionLocal, engine, Base
from .models import User, DriverProfile, Ride, Review, Route, WorkshopReward, phone_fingerprint
from .links_service import RIDE_FE, assign_friend_code, award_fe
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
        "driver_fe_awarded": "BOOLEAN NOT NULL DEFAULT 0",
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


def backfill_driver_fe(db):
    """Paga a los conductores el Fe de los viajes que completaron antes de que lo ganaran."""
    for ride in db.query(Ride).filter(Ride.status == "completado", Ride.driver_fe_awarded.is_(False)).all():
        driver = db.get(User, ride.driver_id)
        if driver:
            award_fe(driver, ride.points_rewarded or 0)
        ride.driver_fe_awarded = True
    db.commit()


def recompute_driver_stats(db):
    """Viajes completados y calificación de cada conductor, contados desde la base."""
    for profile in db.query(DriverProfile).all():
        profile.trips_count = db.query(Ride).filter(
            Ride.driver_id == profile.user_id, Ride.status == "completado"
        ).count()
        ratings = [rating for (rating,) in db.query(Review.rating).filter(Review.driver_id == profile.user_id)]
        if ratings:
            profile.rating_avg = round(sum(ratings) / len(ratings), 2)
    db.commit()


def sync_open_ride_rewards(db):
    """Los viajes aún sin terminar pagan la recompensa vigente (RIDE_FE)."""
    db.query(Ride).filter(
        Ride.status.in_(("solicitado", "aceptado", "en_camino", "en_curso")),
        Ride.points_rewarded != RIDE_FE,
    ).update({"points_rewarded": RIDE_FE}, synchronize_session=False)
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

def sync_legacy_copy(db):
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
    backfill_driver_fe(db)
    sync_open_ride_rewards(db)
    seed_workshop(db)
    sync_route_catalog(db)
    sync_legacy_copy(db)
    recompute_driver_stats(db)

    admin = db.query(User).filter(User.email == "jairourdada@gmail.com").first()
    if admin:
        # Solo completa lo que falte: nunca pisa lo que el administrador cambió
        # desde la app (foto, nombre, teléfono, moto, viajes ni calificación).
        admin.name = admin.name or "Jairo Eduardo Urdaneta González"
        admin.phone = admin.phone or "+58 412 4091527"
        admin.role = "ambos"
        db.flush()

        if not db.query(DriverProfile).filter(DriverProfile.user_id == admin.id).first():
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

    db.commit()
    db.close()
    print("Base de datos inicializada con datos semilla exitosamente.")

if __name__ == "__main__":
    seed_database()
