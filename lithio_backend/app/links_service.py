"""Códigos de enlace y niveles por elemento químico."""
import secrets

from sqlalchemy import and_, event, or_, select
from sqlalchemy.orm import Session

from .models import Link, Ride, User

# Sin 0/O ni 1/I para que el código se pueda dictar sin confusiones.
_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def _new_code() -> str:
    return "Li-" + "".join(secrets.choice(_CODE_ALPHABET) for _ in range(4))


def assign_friend_code(db: Session, user: User) -> str:
    """Asigna un código único con forma Li-XXXX."""
    while True:
        code = _new_code()
        if not db.query(User.id).filter(User.friend_code == code).first():
            user.friend_code = code
            return code


@event.listens_for(User, "before_insert")
def _friend_code_on_insert(mapper, connection, user: User) -> None:
    """Todo usuario nuevo nace con su código de enlace."""
    if user.friend_code:
        return
    while True:
        code = _new_code()
        if connection.execute(select(User.id).where(User.friend_code == code)).first() is None:
            user.friend_code = code
            return


# (símbolo, nombre) de los primeros 36 elementos: de Hidrógeno a Kriptón.
ELEMENTS = [
    ("H", "Hidrógeno"), ("He", "Helio"), ("Li", "Litio"), ("Be", "Berilio"), ("B", "Boro"),
    ("C", "Carbono"), ("N", "Nitrógeno"), ("O", "Oxígeno"), ("F", "Flúor"), ("Ne", "Neón"),
    ("Na", "Sodio"), ("Mg", "Magnesio"), ("Al", "Aluminio"), ("Si", "Silicio"), ("P", "Fósforo"),
    ("S", "Azufre"), ("Cl", "Cloro"), ("Ar", "Argón"), ("K", "Potasio"), ("Ca", "Calcio"),
    ("Sc", "Escandio"), ("Ti", "Titanio"), ("V", "Vanadio"), ("Cr", "Cromo"), ("Mn", "Manganeso"),
    ("Fe", "Hierro"), ("Co", "Cobalto"), ("Ni", "Níquel"), ("Cu", "Cobre"), ("Zn", "Zinc"),
    ("Ga", "Galio"), ("Ge", "Germanio"), ("As", "Arsénico"), ("Se", "Selenio"), ("Br", "Bromo"),
    ("Kr", "Kriptón"),
]


# Beneficio que se muestra al alcanzar ciertos elementos.
LEVEL_PERKS = {
    1: "Tu primer paso en la comunidad LITHIO",
    2: "Acceso a la tienda de Fe",
    3: "Insignia LITHIO en tu perfil",
    6: "Cupón de 25 % en un viaje",
    8: "+5 Fe extra en cada Reacción del día",
    10: "Insignia de gas noble",
    13: "Cupón de 50 % en un viaje",
    18: "Prioridad en viajes programados",
    26: "10 % permanente en la tienda de Fe",
    29: "Un viaje gratis (cupón de 100 %)",
    36: "Leyenda LITHIO: insignia dorada",
}


# Niveles que regalan un cupón (porcentaje de descuento) al alcanzarlos.
GIFT_COUPONS = {6: 25, 13: 50, 29: 100}
QUIZ_BONUS_LEVEL = 8      # +5 Fe en la Reacción del día
PRIORITY_LEVEL = 18       # Sus solicitudes aparecen primero al conductor
STORE_DISCOUNT_LEVEL = 26  # 10 % en la tienda de Fe


def user_z(user: User) -> int:
    return level_for(user.fe_lifetime or 0)["z"]


def next_perk(z: int) -> tuple[int, str] | None:
    for level in sorted(LEVEL_PERKS):
        if level > z:
            return level, LEVEL_PERKS[level]
    return None


def threshold_for(z: int) -> int:
    """Fe histórico necesario para llegar al elemento z: 0, 50, 150, 300, 500…"""
    return 25 * z * (z - 1)


def level_for(fe_lifetime: int) -> dict:
    z = 1
    while z < len(ELEMENTS) and fe_lifetime >= threshold_for(z + 1):
        z += 1
    symbol, name = ELEMENTS[z - 1]
    next_z = z + 1 if z < len(ELEMENTS) else None
    return {
        "z": z,
        "symbol": symbol,
        "name": name,
        "fe_lifetime": fe_lifetime,
        "current_threshold": threshold_for(z),
        "next_threshold": threshold_for(next_z) if next_z else None,
        "next_symbol": ELEMENTS[next_z - 1][0] if next_z else None,
        "next_name": ELEMENTS[next_z - 1][1] if next_z else None,
        "perk": LEVEL_PERKS.get(z),
        "next_perk": _next_perk_payload(z),
    }


def _next_perk_payload(z: int) -> dict | None:
    found = next_perk(z)
    if not found:
        return None
    perk_z, perk = found
    symbol, name = ELEMENTS[perk_z - 1]
    return {"z": perk_z, "symbol": symbol, "name": name, "perk": perk, "threshold": threshold_for(perk_z)}


def link_between(db: Session, a: int, b: int) -> Link | None:
    return db.query(Link).filter(
        or_(
            and_(Link.requester_id == a, Link.addressee_id == b),
            and_(Link.requester_id == b, Link.addressee_id == a),
        )
    ).first()


def are_linked(db: Session, a: int, b: int) -> bool:
    link = link_between(db, a, b)
    return link is not None and link.status == "aceptado"


def rides_together(db: Session, a: int, b: int) -> int:
    return db.query(Ride.id).filter(
        Ride.status == "completado",
        or_(
            and_(Ride.passenger_id == a, Ride.driver_id == b),
            and_(Ride.passenger_id == b, Ride.driver_id == a),
        ),
    ).count()


def bond_type(rides: int) -> str:
    """Tipo de enlace químico según los viajes compartidos."""
    if rides >= 5:
        return "covalente"
    if rides >= 1:
        return "iónico"
    return "nuevo"


# Fe que gana cada uno (pasajero y conductor) por viaje completado, y el pasajero por reseña útil.
RIDE_FE = 15
REVIEW_FE = 5


def award_fe(user: User, amount: int) -> None:
    """Suma Fe al saldo canjeable y al histórico que define el nivel."""
    user.points = (user.points or 0) + amount
    user.fe_lifetime = (user.fe_lifetime or 0) + amount
