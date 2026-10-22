"""Configuración central leída desde variables de entorno.

En local se cargan desde moto_unc_backend/.env; en la nube (Railway, Render
o un VPS) se definen en el panel del proveedor. Este módulo debe importarse
antes que cualquier otro que lea variables de entorno.
"""
import os
from datetime import timedelta, timezone
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent.parent

# Las variables ya definidas en el entorno tienen prioridad sobre el .env.
load_dotenv(BACKEND_DIR / ".env")

APP_ENV = os.getenv("APP_ENV", "development").strip().lower()
IS_PRODUCTION = APP_ENV == "production"


def _normalize_database_url(url: str) -> str:
    # Railway y Heroku entregan "postgres://", que SQLAlchemy 2 ya no acepta.
    if url.startswith("postgres://"):
        url = "postgresql://" + url.removeprefix("postgres://")
    if url.startswith("postgresql://"):
        url = "postgresql+psycopg://" + url.removeprefix("postgresql://")
    return url


DATABASE_URL = _normalize_database_url(
    os.getenv("DATABASE_URL", f"sqlite:///{(BACKEND_DIR / 'moto_unc.db').as_posix()}")
)

# Venezuela no cambia de horario: UTC-4 todo el año.
VENEZUELA_TZ = timezone(timedelta(hours=-4), "VET")
