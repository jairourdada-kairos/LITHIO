from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app import models, schemas
from app.database import SessionLocal

router = APIRouter(prefix="/api/users", tags=["Users"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.get("/{user_id}", response_model=schemas.UserResponse)
def get_user_profile(user_id: int, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return user

@router.post("/{user_id}/canjear-puntos")
def canjear_puntos(user_id: int, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    COSTO_EN_PUNTOS = 100
    DESCUENTO_OTORGADO = 2.0  # $2 de descuento en la carrera
    puntos_actuales = int(getattr(user, "puntos_gamificacion", 0) or 0)

    if puntos_actuales < COSTO_EN_PUNTOS:
        raise HTTPException(
            status_code=400,
            detail=f"Puntos insuficientes. Tienes {puntos_actuales} puntos y necesitas {COSTO_EN_PUNTOS}."
        )

    # Restamos los puntos y aplicamos la recompensa
    setattr(user, "puntos_gamificacion", puntos_actuales - COSTO_EN_PUNTOS)
    db.commit()
    db.refresh(user)

    return {
        "message": "¡Canje exitoso! 🎉",
        "descuento_aplicado": f"${DESCUENTO_OTORGADO} USD",
        "puntos_restantes": user.puntos_gamificacion
    }