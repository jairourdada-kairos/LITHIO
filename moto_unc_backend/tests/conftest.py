import os
import tempfile

from cryptography.fernet import Fernet

# Se define antes de importar la app: las pruebas nunca tocan moto_unc.db
# ni usan las claves reales del .env (load_dotenv no sobrescribe estas).
os.environ["DATABASE_URL"] = "sqlite://"
os.environ["LITHIO_ENCRYPTION_KEYS"] = Fernet.generate_key().decode()
os.environ["LITHIO_HASH_KEY"] = Fernet.generate_key().decode()
os.environ["MEDIA_DIR"] = tempfile.mkdtemp(prefix="lithio-media-")
