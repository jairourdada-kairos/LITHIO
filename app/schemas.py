from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class UserBase(BaseModel):
    name: str
    email: str
    phone: Optional[str] = None
    role: Optional[str] = "passenger"

class UserResponse(UserBase):
    id: int
    puntos_gamificacion: Optional[int] = 0

    class Config:
        from_attributes = True

class RideCreate(BaseModel):
    origin: str
    destination: str
    fare: float
    scheduled_time: Optional[datetime] = None # Opcional si es inmediato o programado

class RideResponse(RideCreate):
    id: int
    passenger_id: int
    status: str
    created_at: datetime

    class Config:
        from_attributes = True
from pydantic import BaseModel
from typing import Optional

class RideRequest(BaseModel):
    passenger_id: int
    origen: str      # Ej: "UNC" o "IVIC"
    destino: str     # Ej: "Caracas" o "San Antonio"
    tarifa_base: float
    usar_descuento: Optional[bool] = False # Si el usuario quiere canjear sus puntos

