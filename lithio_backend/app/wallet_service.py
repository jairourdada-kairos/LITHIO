"""Reglas de la billetera de iones (1 Li⁺ = 1 USD, guardado en centavos).

- Un débito (monto negativo) se descuenta del saldo al crearse, aunque quede
  pendiente: así el saldo nunca se gasta dos veces. Si se rechaza, se devuelve.
- Un crédito (monto positivo) solo suma al saldo cuando está aprobado: una
  recarga en revisión no se puede gastar.
- Cada cambio de saldo queda registrado en WalletTransaction en la misma
  transacción de base de datos.
"""
from datetime import datetime, timezone
from decimal import ROUND_HALF_UP, Decimal

from fastapi import HTTPException
from sqlalchemy.orm import Session

from .config import VENEZUELA_TZ
from .models import Ride, User, WalletTransaction
from .timeutil import utcnow

# Límites para envíos y donaciones entre usuarios.
# AQUÍ se cambian los límites de la billetera. Van en centavos de diamante: 5_000 = 50 iones.
MAX_TRANSFER_CENTS = 5_000          # 50 Li⁺ por envío
MAX_DAILY_OUTGOING_CENTS = 10_000   # 100 Li⁺ al día entre envíos y donaciones
MAX_TOPUP_CENTS = 50_000            # 500 Li⁺ por recarga
MIN_RIDE_PAYMENT_CENTS = 50         # 0.50 Li⁺: mínimo para pagar un viaje con iones
# Bono de bienvenida: iones que recibe cada cuenta NUEVA al registrarse (200 = 2 Li⁺).
# AQUÍ se cambia el monto; con 0 se desactiva el bono.
WELCOME_BONUS_CENTS = 200


def to_cents(amount: float) -> int:
    cents = int((Decimal(str(amount)) * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP))
    if cents <= 0:
        raise HTTPException(status_code=400, detail="El monto debe ser mayor que cero.")
    return cents


def as_diamonds(cents: int) -> float:
    return round(cents / 100, 2)


def lock_user(db: Session, user_id: int) -> User:
    """Bloquea la fila del usuario (en PostgreSQL) mientras se modifica su saldo."""
    user = db.query(User).filter(User.id == user_id).with_for_update().first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return user


def record(
    db: Session,
    user: User,
    kind: str,
    amount_cents: int,
    status: str = "aprobado",
    **fields,
) -> WalletTransaction:
    if amount_cents < 0:
        if (user.diamonds_cents or 0) + amount_cents < 0:
            raise HTTPException(
                status_code=400,
                detail=f"Saldo insuficiente. Tienes Li⁺ {as_diamonds(user.diamonds_cents or 0):.2f}.",
            )
        user.diamonds_cents = (user.diamonds_cents or 0) + amount_cents
    elif status == "aprobado":
        user.diamonds_cents = (user.diamonds_cents or 0) + amount_cents

    tx = WalletTransaction(user_id=user.id, kind=kind, amount_cents=amount_cents, status=status, **fields)
    db.add(tx)
    return tx


def grant_welcome_bonus(db: Session, user: User) -> None:
    """Regala los iones de bienvenida a una cuenta recién creada (una sola vez, al registrarse).
    Deja el movimiento en el historial; el usuario ya debe tener id (db.flush())."""
    if WELCOME_BONUS_CENTS > 0:
        record(db, user, "bono_bienvenida", WELCOME_BONUS_CENTS, note="Bono de bienvenida")


def approve(db: Session, tx: WalletTransaction) -> None:
    if tx.status != "pendiente":
        raise HTTPException(status_code=409, detail="Este movimiento ya fue procesado.")
    # Una donación por Pago Móvil va al Fondo Solidario, no al saldo de quien dona.
    if tx.amount_cents > 0 and tx.kind != "donacion_pm":
        user = lock_user(db, tx.user_id)
        user.diamonds_cents = (user.diamonds_cents or 0) + tx.amount_cents
    tx.status = "aprobado"
    tx.reviewed_at = utcnow()


def reject(db: Session, tx: WalletTransaction) -> None:
    if tx.status != "pendiente":
        raise HTTPException(status_code=409, detail="Este movimiento ya fue procesado.")
    if tx.amount_cents < 0:
        user = lock_user(db, tx.user_id)
        user.diamonds_cents = (user.diamonds_cents or 0) - tx.amount_cents  # Devuelve lo retenido
    tx.status = "rechazado"
    tx.reviewed_at = utcnow()


def outgoing_today_cents(db: Session, user_id: int) -> int:
    # El día cuenta desde la medianoche de Venezuela (guardamos UTC sin zona).
    local_midnight = datetime.now(VENEZUELA_TZ).replace(hour=0, minute=0, second=0, microsecond=0)
    start = local_midnight.astimezone(timezone.utc).replace(tzinfo=None)
    rows = db.query(WalletTransaction.amount_cents).filter(
        WalletTransaction.user_id == user_id,
        WalletTransaction.kind.in_(["envio", "donacion"]),
        WalletTransaction.created_at >= start,
    ).all()
    return -sum(amount for (amount,) in rows)


# --- Pago de viajes con iones -------------------------------------------

def hold_ride_payment(db: Session, passenger: User, ride: Ride) -> None:
    """Retiene la tarifa al pedir el viaje; se cobra al completarlo."""
    record(
        db,
        passenger,
        "pago_viaje",
        -to_cents(ride.fare_amount),
        status="pendiente",
        ride_id=ride.id,
        counterpart_id=ride.driver_id,
        note=f"{ride.origin} → {ride.destination}",
    )


def _held_payment(db: Session, ride: Ride) -> WalletTransaction | None:
    return db.query(WalletTransaction).filter(
        WalletTransaction.ride_id == ride.id,
        WalletTransaction.kind == "pago_viaje",
        WalletTransaction.status == "pendiente",
    ).first()


def hold_ride_pass(db: Session, passenger: User, ride: Ride) -> None:
    """Aparta un pase de combo al pedir el viaje; se gasta al completarlo."""
    if (passenger.ride_passes or 0) < 1:
        raise HTTPException(status_code=400, detail="No tienes pases de viaje. Compra un combo en la Tienda Fe.")
    passenger.ride_passes -= 1
    record(
        db,
        passenger,
        "pase_viaje",
        0,
        status="pendiente",
        ride_id=ride.id,
        counterpart_id=ride.driver_id,
        note=f"{ride.origin} → {ride.destination}",
    )


def _held_pass(db: Session, ride: Ride) -> WalletTransaction | None:
    return db.query(WalletTransaction).filter(
        WalletTransaction.ride_id == ride.id,
        WalletTransaction.kind == "pase_viaje",
        WalletTransaction.status == "pendiente",
    ).first()


def settle_ride_payment(db: Session, ride: Ride) -> None:
    """Viaje completado: confirma el pago y acredita al conductor."""
    used_pass = _held_pass(db, ride)
    if used_pass:
        # Pase de combo: el conductor cobra la tarifa completa en iones; la diferencia
        # con lo que costó el combo la pone LITHIO como promoción.
        approve(db, used_pass)
        driver = lock_user(db, ride.driver_id)
        record(
            db,
            driver,
            "cobro_viaje",
            to_cents(ride.fare_amount),
            ride_id=ride.id,
            counterpart_id=ride.passenger_id,
            note=f"{ride.origin} → {ride.destination} · pase de combo",
        )
        return
    held = _held_payment(db, ride)
    if not held:
        return
    approve(db, held)
    driver = lock_user(db, ride.driver_id)
    record(
        db,
        driver,
        "cobro_viaje",
        -held.amount_cents,
        ride_id=ride.id,
        counterpart_id=ride.passenger_id,
        note=f"{ride.origin} → {ride.destination}",
    )


def refund_ride_payment(db: Session, ride: Ride) -> None:
    """Viaje cancelado o rechazado: devuelve la tarifa retenida."""
    held = _held_payment(db, ride)
    if held:
        reject(db, held)
    used_pass = _held_pass(db, ride)
    if used_pass:
        reject(db, used_pass)
        passenger = lock_user(db, ride.passenger_id)
        passenger.ride_passes = (passenger.ride_passes or 0) + 1  # El pase vuelve al pasajero
