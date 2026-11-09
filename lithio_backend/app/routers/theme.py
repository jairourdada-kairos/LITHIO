"""Tema de la app: colores y tamaño de letra que el backend le da a la interfaz.

Los valores salen de `app/tema_app.py`, el archivo para practicar. Se vuelve a
leer cuando el archivo cambia, así que editarlo no exige reiniciar el servidor.

Seguridad: el archivo se lee con `ast` (solo valores literales); nunca se
ejecuta. Los colores y la escala se validan: lo que no sea válido se ignora y la
app conserva su color de siempre.
"""
import ast
import re
from pathlib import Path

from fastapi import APIRouter
from fastapi.responses import JSONResponse

router = APIRouter(prefix="/api", tags=["tema"])

TEMA_PATH = Path(__file__).resolve().parent.parent / "tema_app.py"

ESCALA_MIN, ESCALA_MAX = 0.8, 1.4
_COLOR = re.compile(r"^(#[0-9a-fA-F]{3,8}|rgba?\([0-9.,%\s]{3,40}\))$")
_CLAVE = re.compile(r"^[A-Za-z][A-Za-z0-9]{0,40}$")

_DEFAULT = {"font_scale": 1.0, "colors": {"dark": {}, "light": {}}}
_cache: dict = {"mtime": None, "tema": _DEFAULT}


def _colores(valor) -> dict:
    if not isinstance(valor, dict):
        return {}
    return {
        k: v
        for k, v in valor.items()
        if isinstance(k, str) and _CLAVE.match(k) and isinstance(v, str) and _COLOR.match(v.strip())
    }


def _escala(valor) -> float:
    if isinstance(valor, bool) or not isinstance(valor, (int, float)):
        return 1.0
    return round(min(ESCALA_MAX, max(ESCALA_MIN, float(valor))), 2)


def parse_tema(source: str) -> dict:
    """Lee las constantes del archivo sin ejecutarlo. Lanza SyntaxError si está mal escrito."""
    valores: dict = {}
    for nodo in ast.parse(source).body:
        if isinstance(nodo, ast.Assign) and len(nodo.targets) == 1 and isinstance(nodo.targets[0], ast.Name):
            try:
                valores[nodo.targets[0].id] = ast.literal_eval(nodo.value)
            except (ValueError, SyntaxError):
                continue  # Valor no sencillo: se ignora.
    return {
        "font_scale": _escala(valores.get("ESCALA_LETRA", 1.0)),
        "colors": {
            "dark": _colores(valores.get("COLORES_OSCURO")),
            "light": _colores(valores.get("COLORES_CLARO")),
        },
    }


def load_tema(path: Path = TEMA_PATH) -> dict:
    """Tema vigente. Si el archivo se rompe a medio editar, sigue el último que funcionaba."""
    try:
        info = path.stat()
        mtime = (info.st_mtime_ns, info.st_size)  # El tamaño evita confundir dos guardados seguidos.
    except OSError:
        return _cache["tema"]
    if mtime != _cache["mtime"]:
        _cache["mtime"] = mtime  # También si falla: no se vuelve a leer hasta que el archivo cambie.
        try:
            _cache["tema"] = parse_tema(path.read_text(encoding="utf-8"))
        except (OSError, SyntaxError, ValueError):
            pass
    return _cache["tema"]


@router.get("/theme")
def get_theme():
    return JSONResponse(load_tema(), headers={"Cache-Control": "no-store"})
