"""Versión del APK: obliga o sugiere instalar uno nuevo.

Los cambios de pantallas y lógica llegan solos con EAS Update. Este aviso es
para los cambios nativos (permisos, módulos, ícono), que exigen otro APK. Se
configura en el .env del servidor, con el número de compilación de Android
(el que va entre paréntesis en Expo, p. ej. "1.0.0 (3)"):

- APP_MIN_BUILD: por debajo de esta compilación la app pide actualizar y no
  deja continuar.
- APP_LATEST_BUILD: por debajo de esta, sugiere actualizar (se puede omitir).
- APP_DOWNLOAD_URL: enlace del APK nuevo.
"""
import os

from fastapi import APIRouter

router = APIRouter(prefix="/api/app", tags=["version"])


def _int_env(name: str) -> int:
    try:
        return int(os.getenv(name, "0") or 0)
    except ValueError:
        return 0


@router.get("/version")
def app_version():
    return {
        "min_build": _int_env("APP_MIN_BUILD"),
        "latest_build": _int_env("APP_LATEST_BUILD"),
        "download_url": os.getenv("APP_DOWNLOAD_URL", "").strip() or None,
    }
