"""Tasa BCV del día (bolívares por dólar).

Se consulta una vez al día a ve.dolarapi.com (promedio oficial del BCV) y se
guarda en la base. Si la fuente falla se usa la última tasa conocida, marcada
como no actualizada. El administrador puede fijarla a mano; la tasa manual
del día no se sobrescribe.
"""
import asyncio
import json
import logging
import urllib.request
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..auth import require_admin
from ..config import VENEZUELA_TZ
from ..database import get_db
from ..models import ExchangeRate
from ..timeutil import utcnow

router = APIRouter(prefix="/api", tags=["tasa-bcv"])
logger = logging.getLogger(__name__)

SOURCE_URL = "https://ve.dolarapi.com/v1/dolares/oficial"


def venezuela_today():
    return datetime.now(VENEZUELA_TZ).date()


def fetch_official_rate() -> float:
    """Pide la tasa oficial. Lanza una excepción si la respuesta no sirve."""
    request = urllib.request.Request(SOURCE_URL, headers={"User-Agent": "LITHIO/1.0"})
    with urllib.request.urlopen(request, timeout=6) as response:
        data = json.load(response)
    rate = float(data["promedio"])
    if not 1 <= rate <= 1_000_000:
        raise ValueError(f"Tasa fuera de rango: {rate}")
    return rate


def payload(row: ExchangeRate, today) -> dict:
    return {
        "rate": row.rate,
        "date": row.rate_date.isoformat(),
        "source": row.source,
        "is_current": row.rate_date == today,
    }


@router.get("/rates/bcv")
async def bcv_rate(db: Session = Depends(get_db)):
    today = venezuela_today()
    row = db.query(ExchangeRate).filter(ExchangeRate.rate_date == today).first()
    if not row:
        try:
            rate = await asyncio.to_thread(fetch_official_rate)
            row = ExchangeRate(rate_date=today, rate=rate, source="dolarapi")
            db.add(row)
            db.commit()
        except IntegrityError:
            # Otra petición guardó la tasa de hoy al mismo tiempo.
            db.rollback()
            row = db.query(ExchangeRate).filter(ExchangeRate.rate_date == today).first()
        except Exception as error:  # Fuente caída o respuesta inválida
            logger.warning("No se pudo actualizar la tasa BCV: %s", error)
            db.rollback()
            row = db.query(ExchangeRate).order_by(ExchangeRate.rate_date.desc()).first()
    if not row:
        raise HTTPException(status_code=503, detail="La tasa BCV no está disponible por ahora.")
    return payload(row, today)


class RateIn(BaseModel):
    rate: float = Field(gt=0, le=1_000_000)


@router.put("/admin/rates/bcv", dependencies=[Depends(require_admin)])
def set_bcv_rate(data: RateIn, db: Session = Depends(get_db)):
    today = venezuela_today()
    row = db.query(ExchangeRate).filter(ExchangeRate.rate_date == today).first()
    if not row:
        row = ExchangeRate(rate_date=today)
        db.add(row)
    row.rate = round(data.rate, 4)
    row.source = "manual"
    row.updated_at = utcnow()
    db.commit()
    return payload(row, today)
