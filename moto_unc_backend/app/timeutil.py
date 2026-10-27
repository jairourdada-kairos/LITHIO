"""Hora UTC sin zona horaria, como se guarda en la base de datos.

Reemplaza a datetime.utcnow(), obsoleto desde Python 3.12. Devuelve el mismo
valor (UTC "naive"), así que no cambia ningún dato existente ni las
comparaciones con fechas ya guardadas.
"""
from datetime import datetime, timezone


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)
