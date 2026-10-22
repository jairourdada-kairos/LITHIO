"""Cifrado en reposo de datos sensibles (cédula, teléfono y datos de pago).

- Los valores se cifran con Fernet (AES-128-CBC + HMAC-SHA256) antes de
  escribirse en la base de datos y se descifran al leerlos.
- LITHIO_ENCRYPTION_KEYS admite varias claves separadas por comas: la primera
  cifra y todas descifran, lo que permite rotar claves sin perder datos.
- LITHIO_HASH_KEY genera un "índice ciego" (HMAC-SHA256) para buscar o exigir
  unicidad sobre un dato cifrado (por ejemplo, la cédula) sin descifrarlo.

Generar claves nuevas:  python -m app.crypto
"""
import hashlib
import hmac
import logging
import os
from functools import lru_cache

from cryptography.fernet import Fernet, InvalidToken, MultiFernet
from sqlalchemy import Text
from sqlalchemy.types import TypeDecorator

logger = logging.getLogger(__name__)

# Todo token Fernet empieza por la versión 0x80 codificada en base64.
FERNET_PREFIX = "gAAAAA"


class EncryptionNotConfigured(RuntimeError):
    pass


@lru_cache(maxsize=1)
def _get_fernet() -> MultiFernet:
    raw_keys = [key.strip() for key in os.getenv("LITHIO_ENCRYPTION_KEYS", "").split(",") if key.strip()]
    if not raw_keys:
        raise EncryptionNotConfigured(
            "Falta LITHIO_ENCRYPTION_KEYS. Genera una clave con 'python -m app.crypto' "
            "y agrégala al .env o a las variables del servidor."
        )
    try:
        return MultiFernet([Fernet(key.encode()) for key in raw_keys])
    except ValueError as error:
        raise EncryptionNotConfigured("LITHIO_ENCRYPTION_KEYS contiene una clave Fernet no válida.") from error


@lru_cache(maxsize=1)
def _get_hash_key() -> bytes:
    key = os.getenv("LITHIO_HASH_KEY", "").strip()
    if len(key) < 32:
        raise EncryptionNotConfigured(
            "Falta LITHIO_HASH_KEY (mínimo 32 caracteres). Genera una con 'python -m app.crypto'."
        )
    return key.encode()


def reset_key_cache() -> None:
    _get_fernet.cache_clear()
    _get_hash_key.cache_clear()


def validate_configuration() -> None:
    """Falla al arrancar si faltan las claves, en vez de fallar en la primera escritura."""
    _get_fernet()
    _get_hash_key()


def encrypt(value: str) -> str:
    return _get_fernet().encrypt(value.encode("utf-8")).decode("ascii")


def decrypt(token: str) -> str:
    return _get_fernet().decrypt(token.encode("ascii")).decode("utf-8")


def is_encrypted(value: str) -> bool:
    if not value.startswith(FERNET_PREFIX):
        return False
    try:
        decrypt(value)
        return True
    except InvalidToken:
        return False


def blind_index(value: str) -> str:
    """Huella HMAC determinista de un valor normalizado (no reversible)."""
    return hmac.new(_get_hash_key(), value.encode("utf-8"), hashlib.sha256).hexdigest()


def mask(value: str | None, visible: int = 4) -> str | None:
    """Enmascara un dato para mostrarlo sin revelarlo: '04121234567' -> '*******4567'."""
    if not value:
        return value
    if len(value) <= visible:
        return "*" * len(value)
    return "*" * (len(value) - visible) + value[-visible:]


class EncryptedString(TypeDecorator):
    """Columna de texto que se guarda cifrada y se lee en claro de forma transparente.

    No se puede filtrar ni ordenar por estas columnas en SQL; para búsquedas
    exactas se guarda además un blind_index() en otra columna.
    """

    impl = Text
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        return encrypt(str(value))

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        try:
            return decrypt(value)
        except InvalidToken:
            # Dato heredado en texto plano: migrate_plaintext_columns() lo cifra al arrancar.
            logger.warning("Se leyó un valor sensible sin cifrar; se cifrará en el próximo arranque.")
            return value


if __name__ == "__main__":
    print("Agrega estas líneas a moto_unc_backend/.env (o a las variables del servidor):")
    print(f"LITHIO_ENCRYPTION_KEYS={Fernet.generate_key().decode()}")
    print(f"LITHIO_HASH_KEY={Fernet.generate_key().decode()}")
