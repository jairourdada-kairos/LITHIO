from .database import SessionLocal, engine, Base
from .models import User, DriverProfile, Reward, Ride, Review, Route
from sqlalchemy import text
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

def ensure_payment_columns(db):
    columns = {
        row[1]
        for row in db.execute(text("PRAGMA table_info(driver_profiles)"))
    }
    for column in ("mobile_payment_bank", "mobile_payment_id"):
        if column not in columns:
            db.execute(text(f"ALTER TABLE driver_profiles ADD COLUMN {column} VARCHAR"))
    db.commit()

def sync_driver_payment_data(db):
    payment_data = {
        "Jairo Eduardo Urdaneta González": {
            "number": "04124091527",
            "bank": "0102 Banco de Venezuela",
            "id_number": "29662109"
        },
        "Jhonnyer Andrade": {
            "number": "04221305688",
            "bank": "0102 Banco de Venezuela",
            "id_number": "31705375"
        },
        "Keiver Iglesias": {
            "number": "04247819362",
            "bank": "0163 Banco del Tesoro",
            "id_number": "26349616"
        }
    }
    for name, data in payment_data.items():
        user = db.query(User).filter(User.name == name).first()
        if user and user.driver_profile:
            user.driver_profile.mobile_payment_number = data["number"]
            user.driver_profile.mobile_payment_bank = data["bank"]
            user.driver_profile.mobile_payment_id = data["id_number"]
    db.commit()

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
    ensure_payment_columns(db)
    sync_driver_payment_data(db)
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
        admin.name = "Jairo Eduardo Urdaneta González"
        admin.phone = "+58 412 4091527"
        admin.role = "ambos"
        admin.avatar_url = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80"
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
