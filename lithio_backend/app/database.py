from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.pool import StaticPool

from .config import DATABASE_URL

if DATABASE_URL.startswith("sqlite"):
    engine_options = {"connect_args": {"check_same_thread": False}}
    if DATABASE_URL in {"sqlite://", "sqlite:///:memory:"}:
        # Base en memoria (pruebas): una sola conexión compartida.
        engine_options["poolclass"] = StaticPool
else:
    # PostgreSQL en la nube: descartar conexiones caídas antes de usarlas.
    engine_options = {"pool_pre_ping": True, "pool_recycle": 1800}

engine = create_engine(DATABASE_URL, **engine_options)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
