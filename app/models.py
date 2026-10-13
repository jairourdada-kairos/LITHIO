from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from datetime import datetime
from app.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    email = Column(String, unique=True, index=True)
    phone = Column(String)
    role = Column(String, default="passenger") # passenger, driver, admin
    password_hash = Column(String)
    puntos_gamificacion = Column(Integer, default=0) # Sistema de puntos para descuentos y promociones

class Ride(Base):
    __tablename__ = "rides"

    id = Column(Integer, primary_key=True, index=True)
    passenger_id = Column(Integer, ForeignKey("users.id"))
    origin = Column(String, index=True)     # Ej: "UNC", "IVIC", "San Antonio", "Caracas"
    destination = Column(String, index=True)
    fare = Column(Float, default=0.0)
    status = Column(String, default="solicitado") # solicitado, programado, en_curso, completado
    scheduled_time = Column(DateTime, nullable=True) # Para viajes programados en el futuro
    created_at = Column(DateTime, default=datetime.utcnow)