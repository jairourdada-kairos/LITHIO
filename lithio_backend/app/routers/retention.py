"""Comodín de racha, demanda sin conductores, recordatorios y analítica del panel."""
from collections import Counter, defaultdict
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .. import push_service
from ..auth import get_current_user, require_admin
from ..database import get_db
from ..drivers import require_approved_driver
from ..models import DemandEvent, DriverProfile, Ride, StreakFreeze, User
from ..rate_limit import rate_limit
from ..retention_service import local_time, streak_from, week_of
from ..timeutil import utcnow
from .fe_store import _spend_fe, price
from .legal import require_current_terms

router = APIRouter(prefix="/api", tags=["retention"])

BUSY_STATUSES = ("aceptado", "en_camino", "en_curso")
PENDING_APPLICATION_STATUSES = ("pendiente", "en_revision", "inspeccion")
DEMAND_DEDUP = timedelta(minutes=15)
DEMAND_PUSH_GAP = timedelta(minutes=30)
QUIET_HOURS = {22, 23, 0, 1, 2, 3, 4, 5}  # Hora de Venezuela: no despertar a los conductores
ANALYTICS_WEEKS = 8
FREEZE_BASE_COST = 40  # Unos tres viajes de Fe; los niveles altos pagan menos, como en la tienda.
FREEZE_MIN_STREAK = 2
FREEZE_GAP = timedelta(days=28)  # Si fuera ilimitado, la racha dejaría de significar algo.
DEMAND_WINDOW = timedelta(days=14)
DEMAND_HOURS = range(5, 23)  # Hora de Venezuela; las mismas horas en que se pueden pedir viajes.


def percent(part: int, whole: int) -> int | None:
    return round(100 * part / whole) if whole else None


class RetentionPushIn(BaseModel):
    enabled: bool


@router.put("/users/me/retention-push")
def set_retention_push(data: RetentionPushIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    user.retention_push_enabled = data.enabled
    db.commit()
    return {"retention_push_enabled": user.retention_push_enabled}


def streak_payload(db: Session, user: User, completed_at: list) -> dict:
    """La racha de la cuenta y si puede usar un comodín esta semana."""
    now = utcnow()
    freezes = db.query(StreakFreeze.week_start, StreakFreeze.created_at).filter(StreakFreeze.user_id == user.id).all()
    streak = streak_from(completed_at, now, [freeze.week_start for freeze in freezes])
    last = max((freeze.created_at for freeze in freezes if freeze.created_at), default=None)
    streak["freeze"] = {
        "cost": price(user, FREEZE_BASE_COST),
        "available": (
            streak["weeks"] >= FREEZE_MIN_STREAK
            and not streak["active_this_week"]
            and not streak["protected_this_week"]
            and (last is None or now - last >= FREEZE_GAP)
        ),
    }
    return streak


@router.post(
    "/streak/freeze",
    dependencies=[Depends(require_current_terms), Depends(rate_limit("comodin", 5, 600))],
)
def freeze_streak(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Compra un comodín con Fe para la semana en curso."""
    completed_at = [
        created_at
        for (created_at,) in db.query(Ride.created_at).filter(Ride.passenger_id == user.id, Ride.status == "completado")
    ]
    streak = streak_payload(db, user, completed_at)
    if not streak["freeze"]["available"]:
        raise HTTPException(status_code=409, detail="No puedes usar un comodín en este momento.")
    cost = streak["freeze"]["cost"]
    _spend_fe(user, cost)
    db.add(StreakFreeze(user_id=user.id, week_start=week_of(utcnow()), fe_cost=cost))
    try:
        db.commit()
    except IntegrityError:  # Dos toques a la vez: el índice único deja pasar solo uno y el Fe no se cobra.
        db.rollback()
        raise HTTPException(status_code=409, detail="Esta semana ya está protegida.") from None
    return {"points": user.points, "streak": streak_payload(db, user, completed_at)}


@router.get("/drivers/demand-hours")
def demand_hours(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """A qué horas se piden más viajes: solo cuentas, sin datos de ninguna persona."""
    require_approved_driver(db, user)
    now = utcnow()
    since = now - DEMAND_WINDOW
    moments = [moment for (moment,) in db.query(Ride.created_at).filter(Ride.created_at >= since)]
    moments += [moment for (moment,) in db.query(DemandEvent.created_at).filter(DemandEvent.created_at >= since)]
    counts = Counter(local_time(moment).hour for moment in moments if moment)
    hours = [{"hour": hour, "requests": counts[hour]} for hour in DEMAND_HOURS]
    return {"hours": hours, "total": sum(item["requests"] for item in hours), "current_hour": local_time(now).hour}


@router.post("/demand/no-drivers", dependencies=[Depends(rate_limit("demanda", 6, 600))])
def report_no_drivers(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """El pasajero no encontró conductor: se registra y se avisa a los que están fuera de servicio."""
    now = utcnow()
    approved = db.query(DriverProfile).filter(
        DriverProfile.verification_status == "aprobado",
        DriverProfile.user_id != user.id,
    ).all()
    busy = {driver_id for (driver_id,) in db.query(Ride.driver_id).filter(Ride.status.in_(BUSY_STATUSES)).distinct()}
    # El reporte del cliente puede estar viejo: un conductor libre lo invalida.
    if any(profile.is_available and profile.user_id not in busy for profile in approved):
        return {"recorded": False, "drivers_notified": 0}
    recent = db.query(DemandEvent.id).filter(
        DemandEvent.user_id == user.id,
        DemandEvent.created_at >= now - DEMAND_DEDUP,
    ).first()
    if recent:
        return {"recorded": False, "drivers_notified": 0}

    to_notify = []
    if local_time(now).hour not in QUIET_HOURS:
        for profile in approved:
            last = profile.last_demand_push_at
            if profile.user_id not in busy and (not last or now - last >= DEMAND_PUSH_GAP):
                profile.last_demand_push_at = now
                to_notify.append(profile.user_id)
    db.add(DemandEvent(user_id=user.id, drivers_notified=len(to_notify), created_at=now))
    db.commit()
    for driver_id in to_notify:
        push_service.notify(
            db, driver_id,
            "Hay pasajeros buscando moto",
            "No hay conductores disponibles ahora. Ponte disponible en LITHIO para tomar el viaje.",
            {"type": "DEMAND_NO_DRIVERS"},
        )
    return {"recorded": True, "drivers_notified": len(to_notify)}


@router.get("/admin/analytics", dependencies=[Depends(require_admin)])
def analytics(db: Session = Depends(get_db)):
    """Métricas de uso y retención. Se calculan en Python: funcionan igual en SQLite y PostgreSQL."""
    now = utcnow()
    last_7, previous_7, last_30 = now - timedelta(days=7), now - timedelta(days=14), now - timedelta(days=30)

    users = db.query(User.id, User.created_at, User.push_token, User.retention_push_enabled).all()
    rides = db.query(Ride.passenger_id, Ride.driver_id, Ride.status, Ride.created_at).all()
    completed = [ride for ride in rides if ride.status == "completado" and ride.created_at]
    rides_by_passenger = defaultdict(list)
    for ride in completed:
        rides_by_passenger[ride.passenger_id].append(ride.created_at)

    def riders_between(start, end=now):
        return {ride.passenger_id for ride in completed if start <= ride.created_at < end}

    active_7, active_previous = riders_between(last_7, now + timedelta(seconds=1)), riders_between(previous_7, last_7)
    recent_rides = [ride for ride in rides if ride.created_at and ride.created_at >= last_7]
    status_counts = Counter(ride.status for ride in recent_rides)
    streaks = [streak_from(times, now) for times in rides_by_passenger.values()]

    profiles = db.query(DriverProfile.user_id, DriverProfile.verification_status, DriverProfile.is_available).all()
    approved = [profile for profile in profiles if profile.verification_status == "aprobado"]
    busy = {ride.driver_id for ride in rides if ride.status in BUSY_STATUSES}

    events = db.query(DemandEvent.user_id, DemandEvent.created_at).filter(DemandEvent.created_at >= last_7).all()
    peak_hours = Counter(local_time(event.created_at).hour for event in events).most_common(3)

    this_week = week_of(now)
    weeks = [this_week - timedelta(weeks=offset) for offset in range(ANALYTICS_WEEKS - 1, -1, -1)]
    weekly = {week: {"completed": 0, "passengers": set()} for week in weeks}
    for ride in completed:
        bucket = weekly.get(week_of(ride.created_at))
        if bucket:
            bucket["completed"] += 1
            bucket["passengers"].add(ride.passenger_id)

    riders = len(rides_by_passenger)
    repeat = sum(1 for times in rides_by_passenger.values() if len(times) >= 2)
    return {
        "users": {
            "total": len(users),
            "new_7d": sum(1 for user in users if user.created_at and user.created_at >= last_7),
            "reachable_by_push": sum(1 for user in users if user.push_token),
            "reminders_off": sum(1 for user in users if not user.retention_push_enabled),
        },
        "passengers": {
            "with_first_ride": riders,
            "activation_pct": percent(riders, len(users)),
            "repeat_pct": percent(repeat, riders),
            "active_7d": len(active_7),
            "active_30d": len(riders_between(last_30, now + timedelta(seconds=1))),
            "retained_week_pct": percent(len(active_7 & active_previous), len(active_previous)),
        },
        "rides_7d": {
            "requested": len(recent_rides),
            "completed": status_counts["completado"],
            "cancelled": status_counts["cancelado"],
            "rejected": status_counts["rechazado"],
            "completion_pct": percent(status_counts["completado"], len(recent_rides)),
        },
        "drivers": {
            "approved": len(approved),
            "available_now": sum(1 for p in approved if p.is_available and p.user_id not in busy),
            "active_7d": len({ride.driver_id for ride in completed if ride.created_at >= last_7}),
            "pending_applications": sum(1 for p in profiles if p.verification_status in PENDING_APPLICATION_STATUSES),
        },
        "unmet_demand_7d": {
            "events": len(events),
            "passengers": len({event.user_id for event in events}),
            "peak_hours": [{"hour": hour, "events": count} for hour, count in peak_hours],
        },
        "streaks": {
            "alive_2_plus": sum(1 for streak in streaks if streak["weeks"] >= 2),
            "best": max((streak["best"] for streak in streaks), default=0),
        },
        "weekly": [
            {"week": week.isoformat(), "completed": weekly[week]["completed"], "passengers": len(weekly[week]["passengers"])}
            for week in weeks
        ],
    }
