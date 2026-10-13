from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    last_name = Column(String, nullable=True)
    age = Column(Integer, nullable=True)
    email = Column(String, unique=True, index=True, nullable=False)
    phone = Column(String, nullable=False)
    role = Column(String, default="pasajero")  # 'pasajero', 'conductor', 'ambos'
    avatar_url = Column(String, nullable=True)
    points = Column(Integer, default=100)  # Bono de bienvenida de 100 puntos
    xp_level = Column(String, default="Pasajero Novato")
    firebase_uid = Column(String, nullable=True, unique=True)  # UID de Firebase Auth
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relaciones
    driver_profile = relationship("DriverProfile", back_populates="user", uselist=False)
    passenger_rides = relationship("Ride", back_populates="passenger", foreign_keys="Ride.passenger_id")
    driver_rides = relationship("Ride", back_populates="driver", foreign_keys="Ride.driver_id")


class DriverProfile(Base):
    __tablename__ = "driver_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)
    moto_brand_model = Column(String, default="Bera SBR 150")  # Muy común en Venezuela
    moto_color = Column(String, default="Negro")
    plate = Column(String, default="AB1C23D")
    helmet_provided = Column(Boolean, default=True)  # Casco adicional para el pasajero
    is_available = Column(Boolean, default=True)
    rating_avg = Column(Float, default=5.0)
    trips_count = Column(Integer, default=0)
    current_location_tag = Column(String, default="Entrada UNC - Altos Mirandinos")
    # Campos de pago del conductor
    binance_address = Column(String, nullable=True)
    mobile_payment_number = Column(String, nullable=True)
    mobile_payment_bank = Column(String, nullable=True)
    mobile_payment_id = Column(String, nullable=True)
    bank_account_number = Column(String, nullable=True)

    user = relationship("User", back_populates="driver_profile")


class Route(Base):
    __tablename__ = "routes"

    id = Column(Integer, primary_key=True, index=True)
    origin = Column(String, nullable=False)
    destination = Column(String, nullable=False)
    fare_usd = Column(Float, default=1.0)
    estimated_minutes = Column(Integer, default=10)
    popular = Column(Boolean, default=True)
    tag = Column(String, nullable=True)


class Ride(Base):
    __tablename__ = "rides"

    id = Column(Integer, primary_key=True, index=True)
    passenger_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    driver_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    origin = Column(String, nullable=False)
    destination = Column(String, nullable=False)
    is_scheduled = Column(Boolean, default=False)
    scheduled_time = Column(String, nullable=True)  # Formato "YYYY-MM-DD HH:MM" si es programado
    status = Column(String, default="solicitado")  
    # Estados: 'solicitado', 'aceptado', 'en_camino', 'en_curso', 'completado', 'cancelado'
    payment_method = Column(String, default="efectivo")  # 'efectivo', 'pago_movil', 'puntos'
    payment_reference = Column(String, nullable=True)
    fare_amount = Column(Float, default=3.0)  # Tarifa base en USD / equivalente
    points_rewarded = Column(Integer, default=50)
    created_at = Column(DateTime, default=datetime.utcnow)

    passenger = relationship("User", foreign_keys=[passenger_id], back_populates="passenger_rides")
    driver = relationship("User", foreign_keys=[driver_id], back_populates="driver_rides")
    review = relationship("Review", back_populates="ride", uselist=False)


class Review(Base):
    __tablename__ = "reviews"

    id = Column(Integer, primary_key=True, index=True)
    ride_id = Column(Integer, ForeignKey("rides.id"), unique=True, nullable=False)
    passenger_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    driver_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    rating = Column(Integer, nullable=False)  # 1 a 5 estrellas
    badges = Column(String, default="Manejo seguro,Casco limpio")  # Etiquetas seleccionadas
    comment = Column(Text, nullable=True)
    points_earned = Column(Integer, default=20)  # Puntos ganados por dejar feedback
    created_at = Column(DateTime, default=datetime.utcnow)

    ride = relationship("Ride", back_populates="review")


class Reward(Base):
    __tablename__ = "rewards"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(String, nullable=False)
    points_cost = Column(Integer, nullable=False)
    discount_percent = Column(Integer, default=20)
    icon = Column(String, default="gift")
    is_active = Column(Boolean, default=True)
