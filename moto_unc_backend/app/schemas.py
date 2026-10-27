from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator
from typing import Optional
from datetime import datetime

from . import validation
from .crypto import mask

# --- USUARIOS & AUTENTICACIÓN ---
class UserBase(BaseModel):
    name: str
    email: str
    phone: str
    role: str = "pasajero"

class UserCreate(UserBase):
    password: Optional[str] = "123456"

# --- REGISTRO: CAMPOS COMUNES A PASAJERO Y CONDUCTOR ---
class RegistrationFields(BaseModel):
    """Datos obligatorios de identidad. Ver reglas en validation.py."""
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    name: str = Field(description="Nombres")
    last_name: str = Field(description="Apellidos")
    cedula: str = Field(description="Cédula de identidad, p. ej. V-12345678")
    email: EmailStr
    career: str = Field(description="Carrera universitaria")
    semester: str = Field(description="1 a 12, Egresado o Personal / Docente")
    phone: str = Field(description="Celular venezolano")
    avatar_url: Optional[str] = Field(default=None, max_length=500)

    @field_validator("name")
    @classmethod
    def _name(cls, value: str) -> str:
        return validation.normalize_person_name(value, "El nombre")

    @field_validator("last_name")
    @classmethod
    def _last_name(cls, value: str) -> str:
        return validation.normalize_person_name(value, "El apellido")

    @field_validator("cedula")
    @classmethod
    def _cedula(cls, value: str) -> str:
        return validation.normalize_cedula(value)

    @field_validator("email")
    @classmethod
    def _email(cls, value: str) -> str:
        return value.lower()

    @field_validator("career")
    @classmethod
    def _career(cls, value: str) -> str:
        return validation.normalize_career(value)

    @field_validator("semester")
    @classmethod
    def _semester(cls, value: str) -> str:
        return validation.normalize_semester(value)

    @field_validator("phone")
    @classmethod
    def _phone(cls, value: str) -> str:
        return validation.normalize_phone(value)


# --- REGISTRO DE PASAJERO ---
class PassengerRegisterRequest(RegistrationFields):
    age: Optional[int] = Field(default=None, ge=16, le=100)

# --- REGISTRO DE CONDUCTOR ---
class DriverRegisterRequest(RegistrationFields):
    age: int = Field(ge=18, le=80, description="Los conductores deben ser mayores de edad")
    # Datos de la moto
    moto_brand_model: str = Field(default="Bera SBR 150", min_length=2, max_length=60)
    moto_color: str = Field(default="Negro", min_length=2, max_length=30)
    plate: str = Field(min_length=5, max_length=10)
    license_number: Optional[str] = Field(default=None, min_length=5, max_length=20, description="Licencia de conducir")
    moto_year: Optional[int] = Field(default=None, ge=1990, le=2030)
    helmet_provided: bool = True
    # Métodos de pago (al menos uno recomendado)
    binance_address: Optional[str] = None
    mobile_payment_number: Optional[str] = None
    mobile_payment_bank: Optional[str] = None
    mobile_payment_id: Optional[str] = None
    bank_account_number: Optional[str] = None

    @field_validator("plate")
    @classmethod
    def _plate(cls, value: str) -> str:
        return value.replace(" ", "").replace("-", "").upper()

class UserResponse(UserBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    last_name: Optional[str] = None
    age: Optional[int] = None
    # La cédula solo se devuelve enmascarada (V-****5678), nunca completa.
    cedula: Optional[str] = None
    career: Optional[str] = None
    semester: Optional[str] = None

    @field_validator("cedula")
    @classmethod
    def _mask_cedula(cls, value: Optional[str]) -> Optional[str]:
        if not value:
            return value
        return f"{value[0]}-{mask(value[1:])}"
    avatar_url: Optional[str] = None
    points: int
    xp_level: str
    created_at: datetime

class DriverFinancialResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    binance_address: Optional[str] = None
    mobile_payment_number: Optional[str] = None
    mobile_payment_bank: Optional[str] = None
    mobile_payment_id: Optional[str] = None
    bank_account_number: Optional[str] = None

class AdminProfileResponse(BaseModel):
    id: int
    name: str
    email: str
    phone: str

class AdminDriverResponse(BaseModel):
    id: int
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[str] = None
    moto_brand_model: Optional[str] = None
    plate: Optional[str] = None
    is_available: Optional[bool] = None
    rating_avg: Optional[float] = None
    trips_count: Optional[int] = None
    xp_level: Optional[str] = None

class AdminRouteResponse(BaseModel):
    id: int
    origin: str
    destination: str
    fare_usd: float
    estimated_minutes: int
    popular: bool
    tag: Optional[str] = None

class AdminRewardResponse(BaseModel):
    id: int
    title: str
    description: str
    points_cost: int
    discount_percent: int
    icon: str
    is_active: bool

class SwitchRoleRequest(BaseModel):
    new_role: str  # 'pasajero' o 'conductor'

class ToggleAvailabilityRequest(BaseModel):
    is_available: bool

# --- LISTA DE CONDUCTORES PARA EL PASAJERO ---
class DriverCardItem(BaseModel):
    user_id: int
    name: str
    avatar_url: Optional[str] = None
    moto_brand_model: str
    moto_color: str
    helmet_provided: bool
    is_available: bool
    rating_avg: float = 0.0
    trips_count: int
    xp_level: str

# --- VIAJES ---
class RideCreate(BaseModel):
    driver_id: int
    origin: str
    destination: str
    is_scheduled: bool = False
    scheduled_time: Optional[str] = None
    payment_method: str = "efectivo"  # 'efectivo', 'pago_movil', 'puntos'
    payment_reference: Optional[str] = None
    fare_amount: float = 3.0
    coupon_id: Optional[int] = None

class RideStatusUpdate(BaseModel):
    status: str  # 'aceptado', 'rechazado', 'en_camino', 'en_curso', 'completado', 'cancelado'

class RideResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    passenger_id: int
    driver_id: int
    origin: str
    destination: str
    is_scheduled: bool
    scheduled_time: Optional[str]
    status: str
    payment_method: str
    payment_reference: Optional[str]
    fare_amount: float
    points_rewarded: int
    created_at: datetime
    passenger_name: Optional[str] = None
    driver_name: Optional[str] = None
    whatsapp_status: Optional[str] = None
    driver_mobile_payment_number: Optional[str] = None
    driver_mobile_payment_bank: Optional[str] = None
    driver_mobile_payment_id: Optional[str] = None
    driver_bank_account_number: Optional[str] = None
    driver_binance_address: Optional[str] = None
    has_receipt: bool = False

# --- RESEÑAS & GAMIFICACIÓN ---
class ReviewCreate(BaseModel):
    ride_id: int
    rating: int = Field(ge=1, le=5, strict=True)  # Solo enteros de 1 a 5 estrellas
    badges: Optional[str] = "Manejo seguro,Casco limpio"
    comment: Optional[str] = None

class ReviewResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    ride_id: int
    passenger_id: int
    driver_id: int
    rating: int
    badges: str
    comment: Optional[str]
    points_earned: int
    created_at: datetime

# --- RECOMPENSAS / TIENDA ---
class RewardResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    title: str
    description: str
    points_cost: int
    discount_percent: int
    icon: str
    is_active: bool

class RedeemRewardRequest(BaseModel):
    reward_id: int
