import os
import tempfile

from cryptography.fernet import Fernet

# Se define antes de importar la app: las pruebas nunca tocan lithio.db
# ni usan las claves reales del .env (load_dotenv no sobrescribe estas).
os.environ["DATABASE_URL"] = "sqlite://"
os.environ["LITHIO_ENCRYPTION_KEYS"] = Fernet.generate_key().decode()
os.environ["LITHIO_HASH_KEY"] = Fernet.generate_key().decode()
os.environ["MEDIA_DIR"] = tempfile.mkdtemp(prefix="lithio-media-")
# Las cuentas de prueba usan @example.test: la regla "solo Gmail verificado"
# se prueba aparte, activándola en su propio test.
os.environ["ALLOWED_EMAIL_DOMAINS"] = ""
os.environ["REQUIRE_VERIFIED_EMAIL"] = "false"
# Sin token: las pruebas nunca envían un WhatsApp real a los teléfonos de la base.
os.environ["WHATSAPP_ACCESS_TOKEN"] = ""
# El administrador de prueba se reconoce solo por su UID, como en el servidor real.
os.environ["ADMIN_FIREBASE_UIDS"] = "uid-admin"
os.environ["ADMIN_EMAILS"] = ""
os.environ["LOG_DIR"] = tempfile.mkdtemp(prefix="lithio-logs-")


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
