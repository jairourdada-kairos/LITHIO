from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app import models, schemas
from app.database import SessionLocal

router = APIRouter(prefix="/api/rides", tags=["Rides"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.post("/", response_model=dict)
def crear_viaje(ride: schemas.RideCreate, db: Session = Depends(get_db)):
    ride_data = ride.model_dump()

    # 1. Buscar al pasajero
    passenger_id = ride_data.get("passenger_id", ride_data.get("pasajero_id"))
    passenger = db.query(models.User).filter(models.User.id == passenger_id).first()
    if not passenger:
        raise HTTPException(status_code=404, detail="Pasajero no encontrado")
    
    # Accept both the Spanish names used by this router and the English names
    # commonly exposed by the schema.
    tarifa_base = ride_data.get("tarifa_base", ride_data.get("base_fare", ride_data.get("fare", 0.0)))
    usar_descuento = ride_data.get("usar_descuento", ride_data.get("use_discount", False))
    origen = ride_data.get("origen", ride_data.get("origin"))
    destino = ride_data.get("destino", ride_data.get("destination"))

    tarifa_final = float(tarifa_base)
    descuento_aplicado = 0.0
    COSTO_EN_PUNTOS = 100
    VALOR_DESCUENTO = 2.0

    # 2. Si el usuario solicitó usar descuento por puntos
    puntos = int(getattr(passenger, "puntos_gamificacion", 0))
    if usar_descuento:
        if puntos < COSTO_EN_PUNTOS:
            raise HTTPException(
                status_code=400, 
                detail=f"No tienes suficientes puntos para el descuento. Tienes {puntos} y necesitas {COSTO_EN_PUNTOS}."
            )
        
        # Descontar puntos y aplicar rebaja a la tarifa
        puntos -= COSTO_EN_PUNTOS
        descuento_aplicado = VALOR_DESCUENTO
        tarifa_final = max(0.0, float(tarifa_base) - VALOR_DESCUENTO)

    # 3. Registrar el viaje en la base de datos (asegúrate de tener tu modelo de Ride configurado)
    nuevo_viaje = models.Ride(
        passenger_id=passenger.id,
        origen=origen,
        destino=destino,
        tarifa=tarifa_final,
        estado="solicitado"
    )
    
    db.add(nuevo_viaje)
    db.commit()
    db.refresh(nuevo_viaje)

    # Recompensar con +50 puntos base por solicitar el viaje (gamificación para jóvenes)
    puntos += 50
    setattr(passenger, "puntos_gamificacion", puntos)
    db.commit()

    return {
        "message": "¡Viaje solicitado con éxito! 🛵💨",
        "ride_id": nuevo_viaje.id,
        "origen": nuevo_viaje.origen,
        "destino": nuevo_viaje.destino,
        "tarifa_original": tarifa_base,
        "descuento_por_puntos": f"-${descuento_aplicado} USD",
        "tarifa_final_a_pagar": f"${tarifa_final} USD",
        "puntos_actuales_en_cuenta": puntos,
        "nota_gamificacion": "+50 puntos ganados por solicitar esta carrera"
    }