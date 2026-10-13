from fastapi import FastAPI
from app.database import engine, Base
from app.routers import rides

# Crea las tablas automáticamente al iniciar si no existen
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="MotoTaxi UNC & IVIC API",
    description="Backend para el sistema de mototaxi enfocado en la comunidad estudiantil de la UNC, IVIC, San Antonio y Caracas.",
    version="1.0.0"
)

# Incluir las rutas de viajes y de usuarios
app.include_router(rides.router)

@app.get("/")
def read_root():
    return {"message": "¡Bienvenido a la API de MotoTaxi UNC/IVIC!", "developer": "Jairo Urdaneta"}