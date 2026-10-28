import re

from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text, CheckConstraint, Date, UniqueConstraint, event
from sqlalchemy.orm import relationship
from datetime import datetime
from .crypto import EncryptedString, blind_index
from .validation import normalize_phone
from .database import Base
from .timeutil import utcnow

# Las columnas EncryptedString se guardan cifradas en la base de datos (ver crypto.py).

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    last_name = Column(String, nullable=True)
    age = Column(Integer, nullable=True)
    email = Column(String, unique=True, index=True, nullable=False)
    phone = Column(EncryptedString, nullable=False)
    cedula = Column(EncryptedString, nullable=True)
    cedula_hash = Column(String(64), nullable=True, unique=True, index=True)  # Índice ciego para evitar duplicados
    phone_hash = Column(String(64), nullable=True, index=True)  # Índice ciego: recuperar la cuenta con el teléfono
    career = Column(String, nullable=True)  # Carrera universitaria
    semester = Column(String, nullable=True)
    role = Column(String, default="pasajero")  # 'pasajero', 'conductor', 'ambos'
    avatar_url = Column(String, nullable=True)
    points = Column(Integer, default=100)  # Bono de bienvenida de 100 puntos
    # Sesión única: solo el dispositivo con este identificador puede usar la cuenta.
    active_session_id = Column(String(64), nullable=True)
    # Última edición de datos personales (límite de una cada 7 días; la foto no cuenta).
    profile_updated_at = Column(DateTime, nullable=True)
    # Token de notificaciones push del dispositivo con la sesión activa.
    push_token = Column(String, nullable=True)
    xp_level = Column(String, default="Pasajero Novato")
    firebase_uid = Column(String, nullable=True, unique=True)  # UID de Firebase Auth
    # Billetera: 1 diamante = 1 USD, guardado en centavos para no perder precisión.
    diamonds_cents = Column(Integer, default=0, nullable=False)
    # Fe ganado en total (no baja al canjear): define el nivel por elemento químico.
    fe_lifetime = Column(Integer, default=0, nullable=False)
    friend_code = Column(String(12), nullable=True, unique=True, index=True)  # Código de enlace, p. ej. Li-4F7Q
    created_at = Column(DateTime, default=utcnow)

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
    # Postulación: pendiente -> en_revision -> inspeccion -> aprobado | rechazado
    verification_status = Column(String, default="pendiente", nullable=False)
    verification_notes = Column(Text, nullable=True)  # Mensaje del administrador al conductor
    inspection_date = Column(String, nullable=True)  # Cita para la inspección de la moto
    license_number = Column(EncryptedString, nullable=True)
    moto_year = Column(Integer, nullable=True)
    submitted_at = Column(DateTime, default=utcnow)
    reviewed_at = Column(DateTime, nullable=True)
    # Campos de pago del conductor
    binance_address = Column(EncryptedString, nullable=True)
    mobile_payment_number = Column(EncryptedString, nullable=True)
    mobile_payment_bank = Column(EncryptedString, nullable=True)
    mobile_payment_id = Column(EncryptedString, nullable=True)
    bank_account_number = Column(EncryptedString, nullable=True)

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
    payment_reference = Column(EncryptedString, nullable=True)
    fare_amount = Column(Float, default=3.0)  # Tarifa base en USD / equivalente
    points_rewarded = Column(Integer, default=50)
    # El conductor también gana el Fe del viaje; marca que ya se le pagó (una sola vez).
    driver_fe_awarded = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=utcnow)
    # Línea de tiempo: JSON [{"status": "...", "at": "ISO"}] con cada cambio de estado.
    status_log = Column(Text, nullable=True)
    # Comprobante de pago (captura): archivo privado en EVIDENCE_DIR/receipts.
    receipt_file = Column(String, nullable=True)
    receipt_uploaded_at = Column(DateTime, nullable=True)

    passenger = relationship("User", foreign_keys=[passenger_id], back_populates="passenger_rides")
    driver = relationship("User", foreign_keys=[driver_id], back_populates="driver_rides")
    review = relationship("Review", back_populates="ride", uselist=False)


class Review(Base):
    __tablename__ = "reviews"
    __table_args__ = (CheckConstraint("rating BETWEEN 1 AND 5", name="ck_reviews_rating_range"),)

    id = Column(Integer, primary_key=True, index=True)
    ride_id = Column(Integer, ForeignKey("rides.id"), unique=True, nullable=False)
    passenger_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    driver_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    rating = Column(Integer, nullable=False)  # 1 a 5 estrellas
    badges = Column(String, default="Manejo seguro,Casco limpio")  # Etiquetas seleccionadas
    comment = Column(Text, nullable=True)
    points_earned = Column(Integer, default=20)  # Puntos ganados por dejar feedback
    created_at = Column(DateTime, default=utcnow)

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


class WalletTransaction(Base):
    """Movimiento de la billetera de diamantes. El saldo del usuario se actualiza
    en la misma transacción de base de datos que crea este registro."""
    __tablename__ = "wallet_transactions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    # recarga, retiro, envio, recepcion, donacion, pago_viaje, cobro_viaje, taller, reembolso
    kind = Column(String, nullable=False)
    amount_cents = Column(Integer, nullable=False)  # Positivo entra, negativo sale
    # pendiente (en revisión o retenido), aprobado, rechazado
    status = Column(String, default="aprobado", nullable=False)
    counterpart_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    ride_id = Column(Integer, ForeignKey("rides.id"), nullable=True)
    reward_id = Column(Integer, ForeignKey("workshop_rewards.id"), nullable=True)
    reference = Column(EncryptedString, nullable=True)  # Referencia de Pago Móvil o datos de retiro
    note = Column(String, nullable=True)
    created_at = Column(DateTime, default=utcnow)
    reviewed_at = Column(DateTime, nullable=True)


class WorkshopReward(Base):
    """Servicios del taller aliado que los conductores canjean con diamantes."""
    __tablename__ = "workshop_rewards"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(String, nullable=True)
    cost_cents = Column(Integer, nullable=False)
    icon = Column(String, default="wrench")
    is_active = Column(Boolean, default=True)


class Link(Base):
    """Enlace (amistad) entre dos usuarios."""
    __tablename__ = "links"
    __table_args__ = (UniqueConstraint("requester_id", "addressee_id", name="uq_links_pair"),)

    id = Column(Integer, primary_key=True, index=True)
    requester_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    addressee_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    status = Column(String, default="pendiente", nullable=False)  # pendiente, aceptado
    created_at = Column(DateTime, default=utcnow)


class QuizAnswer(Base):
    """Respuesta a la Reacción del día: una por usuario y día."""
    __tablename__ = "quiz_answers"
    __table_args__ = (UniqueConstraint("user_id", "quiz_date", name="uq_quiz_user_day"),)

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    quiz_date = Column(Date, nullable=False)
    option_index = Column(Integer, nullable=False)
    correct = Column(Boolean, nullable=False)
    created_at = Column(DateTime, default=utcnow)


class Coupon(Base):
    """Cupón de descuento comprado con Fe; se aplica a un viaje."""
    __tablename__ = "coupons"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    percent = Column(Integer, nullable=False)  # 25 o 50
    fe_cost = Column(Integer, nullable=False)
    status = Column(String, default="activo", nullable=False)  # activo, usado
    ride_id = Column(Integer, ForeignKey("rides.id"), nullable=True)
    created_at = Column(DateTime, default=utcnow)


class GradeVoucher(Base):
    """Vale «Pasar con 20»: el Fe queda retenido hasta que el administrador lo revisa."""
    __tablename__ = "grade_vouchers"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    subject = Column(String, nullable=False)
    note = Column(String, nullable=True)
    evidence_file = Column(String, nullable=False)  # Nombre en EVIDENCE_DIR (privado)
    fe_cost = Column(Integer, nullable=False)
    status = Column(String, default="pendiente", nullable=False)  # pendiente, aprobado, rechazado
    review_note = Column(String, nullable=True)
    created_at = Column(DateTime, default=utcnow)
    reviewed_at = Column(DateTime, nullable=True)


class ExchangeRate(Base):
    """Tasa oficial BCV (Bs por USD) de un día en Venezuela."""
    __tablename__ = "exchange_rates"

    id = Column(Integer, primary_key=True, index=True)
    rate_date = Column(Date, nullable=False, unique=True)
    rate = Column(Float, nullable=False)
    source = Column(String, nullable=False)  # dolarapi o manual
    updated_at = Column(DateTime, default=utcnow)


class PerkGrant(Base):
    """Beneficio de nivel ya entregado (cupones de regalo): uno por usuario y nivel."""
    __tablename__ = "perk_grants"
    __table_args__ = (UniqueConstraint("user_id", "z", name="uq_perk_user_level"),)

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    z = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=utcnow)


def phone_fingerprint(phone: str | None) -> str | None:
    """Índice ciego del teléfono normalizado (+58 412 1234567); sin descifrar nada se puede buscar."""
    if not phone:
        return None
    try:
        value = normalize_phone(phone)
    except ValueError:
        value = re.sub(r"\D", "", phone)  # Teléfonos viejos fuera de formato
    return blind_index(value)


@event.listens_for(User, "before_insert")
@event.listens_for(User, "before_update")
def _sync_phone_hash(mapper, connection, user: User) -> None:
    user.phone_hash = phone_fingerprint(user.phone)
