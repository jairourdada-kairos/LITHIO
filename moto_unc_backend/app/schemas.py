from pydantic import BaseModel, ConfigDict, Field
from typing import Optional
from datetime import datetime

# --- USUARIOS & AUTENTICACIÓN ---
class UserBase(BaseModel):
    name: str
    email: str
    phone: str
    role: str = "pasajero"

class UserCreate(UserBase):
    password: Optional[str] = "123456"

# --- REGISTRO DE PASAJERO ---
class PassengerRegisterRequest(BaseModel):
    name: str
    last_name: str
    age: int
    phone: str
    email: str
    avatar_url: Optional[str] = None

# --- REGISTRO DE CONDUCTOR ---
class DriverRegisterRequest(BaseModel):
    name: str
    last_name: str
    age: int
    phone: str
    email: str
    avatar_url: Optional[str] = None
    # Datos de la moto
    moto_brand_model: str = "Bera SBR 150"
    moto_color: str = "Negro"
    plate: str
    helmet_provided: bool = True
    # Métodos de pago (al menos uno recomendado)
    binance_address: Optional[str] = None
    mobile_payment_number: Optional[str] = None
    mobile_payment_bank: Optional[str] = None
    mobile_payment_id: Optional[str] = None
    bank_account_number: Optional[str] = None

class UserResponse(UserBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    last_name: Optional[str] = None
    age: Optional[int] = None
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
