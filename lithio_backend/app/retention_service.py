"""Rachas semanales y recordatorios para volver a viajar.

La racha cuenta semanas seguidas (lunes a domingo, hora de Venezuela) con al
menos un viaje completado. Se calcula de los viajes guardados: no hay un
contador que pueda desincronizarse. La semana en curso no la rompe: sigue viva
hasta que termine una semana completa sin viajar.

Los recordatorios salen como máximo una vez cada 7 días por persona, solo de
día y solo si hay conductores aprobados a quienes pedirles el viaje.
"""
import asyncio
import logging
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from typing import Iterable, Optional

from sqlalchemy.orm import Session

from . import config, push_service
from .database import SessionLocal
from .models import DriverProfile, Ride, User
from .timeutil import utcnow

logger = logging.getLogger(__name__)

REMINDER_GAP = timedelta(days=7)
REMINDER_HOURS = range(9, 19)  # Hora de Venezuela
STREAK_RISK_WEEKDAYS = {3, 4}  # Jueves y viernes: todavía hay clases esa semana
MIN_STREAK_TO_REMIND = 2
FIRST_RIDE_WINDOW = (timedelta(days=3), timedelta(days=10))
INACTIVE_WINDOW = (timedelta(days=14), timedelta(days=30))
OPEN_RIDE_STATUSES = ("solicitado", "aceptado", "en_camino", "en_curso")
FIRST_RUN_DELAY_SECONDS = 600
CYCLE_SECONDS = 3600


def local_time(moment: datetime) -> datetime:
    """Convierte la hora UTC de la base de datos a la hora de Venezuela."""
    return moment.replace(tzinfo=timezone.utc).astimezone(config.VENEZUELA_TZ)


def week_of(moment: datetime) -> date:
    """El lunes de la semana a la que pertenece ese momento."""
    day = local_time(moment).date()
    return day - timedelta(days=day.weekday())


def streak_from(completed_at: Iterable[datetime], now: Optional[datetime] = None) -> dict:
    now = now or utcnow()
    weeks = sorted({week_of(moment) for moment in completed_at if moment})
    best = run = 0
    previous = None
    for week in weeks:
        run = run + 1 if previous and week - previous == timedelta(weeks=1) else 1
        best = max(best, run)
        previous = week
    this_week = week_of(now)
    alive = bool(weeks) and this_week - weeks[-1] <= timedelta(weeks=1)
    return {
        "weeks": run if alive else 0,
        "best": best,
        "active_this_week": bool(weeks) and weeks[-1] == this_week,
    }


def _reminder_for(user: User, completed_at: list[datetime], now: datetime) -> Optional[tuple[str, str]]:
    if completed_at:
        streak = streak_from(completed_at, now)
        if (
            streak["weeks"] >= MIN_STREAK_TO_REMIND
            and not streak["active_this_week"]
            and local_time(now).weekday() in STREAK_RISK_WEEKDAYS
        ):
            return (
                f"Tu racha de {streak['weeks']} semanas sigue viva",
                "Haz un viaje antes del domingo para mantenerla.",
            )
        idle = now - max(completed_at)
        if INACTIVE_WINDOW[0] <= idle < INACTIVE_WINDOW[1]:
            return ("Tus rutas siguen en LITHIO", "Hace un tiempo que no viajas. Pide tu moto cuando la necesites.")
        return None
    age = now - user.created_at if user.created_at else timedelta(0)
    if FIRST_RIDE_WINDOW[0] <= age < FIRST_RIDE_WINDOW[1]:
        return ("Tu primer viaje te espera", "Elige una ruta y un conductor verificado en LITHIO.")
    return None


def send_due_reminders(db: Session, now: Optional[datetime] = None) -> int:
    """Envía los recordatorios que tocan ahora y devuelve cuántos salieron."""
    now = now or utcnow()
    if local_time(now).hour not in REMINDER_HOURS:
        return 0
    if not db.query(DriverProfile.id).filter(DriverProfile.verification_status == "aprobado").first():
        return 0
    cutoff = now - REMINDER_GAP
    users = [
        user
        for user in db.query(User).filter(User.push_token.isnot(None), User.retention_push_enabled.is_(True))
        if not user.last_retention_push_at or user.last_retention_push_at <= cutoff
    ]
    if not users:
        return 0
    rides_by_user: dict[int, list[datetime]] = defaultdict(list)
    for passenger_id, created_at in db.query(Ride.passenger_id, Ride.created_at).filter(
        Ride.status == "completado",
        Ride.passenger_id.in_([user.id for user in users]),
    ):
        rides_by_user[passenger_id].append(created_at)
    riding_now = {
        passenger_id
        for (passenger_id,) in db.query(Ride.passenger_id).filter(Ride.status.in_(OPEN_RIDE_STATUSES))
    }
    due = []
    for user in users:
        if user.id in riding_now:
            continue
        reminder = _reminder_for(user, rides_by_user[user.id], now)
        if reminder:
            user.last_retention_push_at = now
            due.append((user.id, *reminder))
    # Se guarda antes de enviar: un fallo a medias nunca repite el aviso.
    db.commit()
    for user_id, title, body in due:
        push_service.notify(db, user_id, title, body, {"type": "RETENTION_REMINDER"})
    return len(due)


def _run_cycle() -> None:
    db = SessionLocal()
    try:
        sent = send_due_reminders(db)
        if sent:
            logger.info("Recordatorios enviados: %s", sent)
    finally:
        db.close()


async def reminders_loop() -> None:
    await asyncio.sleep(FIRST_RUN_DELAY_SECONDS)
    while True:
        try:
            await asyncio.to_thread(_run_cycle)
        except Exception:  # Un fallo aquí nunca debe tumbar el servidor.
            logger.exception("Falló el ciclo de recordatorios")
        await asyncio.sleep(CYCLE_SECONDS)
