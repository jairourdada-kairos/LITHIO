"""Copia la base local (SQLite) a la base de la nube (PostgreSQL).

Uso, desde lithio_backend:
    set DATABASE_URL=postgresql://...   (la URL pública que da Railway)
    python -m app.migrate_to_cloud lithio.db

Los datos cifrados se copian tal cual (sin descifrar), así que en la nube
deben usarse las MISMAS claves LITHIO_ENCRYPTION_KEYS y LITHIO_HASH_KEY.
La base de destino debe estar vacía: el script se detiene si ya hay usuarios.
"""
import sys
from pathlib import Path

from sqlalchemy import MetaData, create_engine, func, select, text

from . import models  # noqa: F401  (registra las tablas en Base.metadata)
from .config import DATABASE_URL
from .database import Base


def main(sqlite_path: str, target_url: str | None = None) -> None:
    if not Path(sqlite_path).exists():
        sys.exit(f"No existe {sqlite_path}")
    if target_url is None and DATABASE_URL.startswith("sqlite"):
        sys.exit("Define DATABASE_URL con la URL de PostgreSQL de la nube.")

    source = create_engine(f"sqlite:///{Path(sqlite_path).resolve().as_posix()}")
    target = create_engine(target_url or DATABASE_URL)
    Base.metadata.create_all(bind=target)

    # Tablas reflejadas: los tipos son genéricos y el texto cifrado pasa sin tocarse.
    source_meta = MetaData()
    source_meta.reflect(bind=source)
    target_meta = MetaData()
    target_meta.reflect(bind=target)

    with source.connect() as src, target.begin() as dst:
        if dst.execute(select(func.count()).select_from(target_meta.tables["users"])).scalar():
            sys.exit("La base de la nube ya tiene usuarios; no se copia nada para no duplicar.")
        for table in Base.metadata.sorted_tables:
            if table.name not in source_meta.tables:
                continue
            target_table = target_meta.tables[table.name]
            columns = [c.name for c in target_table.columns if c.name in source_meta.tables[table.name].columns]
            rows = [dict(row._mapping) for row in src.execute(select(*(source_meta.tables[table.name].c[c] for c in columns)))]
            if rows:
                dst.execute(target_table.insert(), rows)
            # Los id se copiaron a mano: la secuencia debe continuar después del mayor.
            if "id" in target_table.columns and target.dialect.name == "postgresql":
                dst.execute(text(
                    f"SELECT setval(pg_get_serial_sequence('{table.name}', 'id'), "
                    f"COALESCE((SELECT MAX(id) FROM {table.name}), 0) + 1, false)"
                ))
            print(f"{table.name}: {len(rows)} filas")
    print("Listo. Copia también la carpeta media/ al volumen si quieres conservar las fotos.")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "lithio.db")
