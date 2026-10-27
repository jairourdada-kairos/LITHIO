import os
import tempfile

from cryptography.fernet import Fernet

# Se define antes de importar la app: las pruebas nunca tocan moto_unc.db
# ni usan las claves reales del .env (load_dotenv no sobrescribe estas).
os.environ["DATABASE_URL"] = "sqlite://"
os.environ["LITHIO_ENCRYPTION_KEYS"] = Fernet.generate_key().decode()
os.environ["LITHIO_HASH_KEY"] = Fernet.generate_key().decode()
os.environ["MEDIA_DIR"] = tempfile.mkdtemp(prefix="lithio-media-")


import pytest  # noqa: E402


@pytest.fixture(autouse=True)
def push_outbox(monkeypatch):
    """Las pruebas nunca envían notificaciones reales: quedan en esta lista."""
    from app import push_service

    sent = []
    monkeypatch.setattr(push_service, "dispatch", sent.extend)
    return sent


@pytest.fixture(autouse=True)
def fresh_rate_limits():
    """Cada prueba empieza con los contadores de límite de peticiones en cero."""
    from app import rate_limit

    rate_limit.reset()
