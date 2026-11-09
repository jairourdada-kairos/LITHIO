"""El tema de la app: se lee del archivo de práctica, sin ejecutarlo, y se valida."""
import json

from app.routers import theme
from tests.test_api import client  # noqa: F401  (fixture compartido)


def test_default_file_is_neutral(client):
    res = client.get("/api/theme")
    assert res.status_code == 200
    assert res.headers["cache-control"] == "no-store"
    assert res.json() == {"font_scale": 1.0, "colors": {"dark": {}, "light": {}}}


def test_parse_accepts_valid_and_drops_invalid():
    src = '''
ESCALA_LETRA = 1.25
COLORES_OSCURO = {"primary": "#FF8800", "gold": "rgba(255, 200, 87, 0.5)", "error": "rojo", "x y": "#FFF"}
COLORES_CLARO = {"bgDark": "#fff", "secondary": 5}
'''
    tema = theme.parse_tema(src)
    assert tema["font_scale"] == 1.25
    assert tema["colors"]["dark"] == {"primary": "#FF8800", "gold": "rgba(255, 200, 87, 0.5)"}
    assert tema["colors"]["light"] == {"bgDark": "#fff"}


def test_scale_is_clamped_and_bad_types_ignored():
    assert theme.parse_tema("ESCALA_LETRA = 9")["font_scale"] == 1.4
    assert theme.parse_tema("ESCALA_LETRA = 0.1")["font_scale"] == 0.8
    assert theme.parse_tema("ESCALA_LETRA = 'grande'")["font_scale"] == 1.0
    assert theme.parse_tema("ESCALA_LETRA = True")["font_scale"] == 1.0


def test_file_is_never_executed(tmp_path):
    marca = tmp_path / "ejecutado.txt"
    src = f"open({str(marca)!r}, 'w').write('x')\nESCALA_LETRA = __import__('os').getpid()\nCOLORES_OSCURO = {{'primary': '#112233'}}\n"
    tema = theme.parse_tema(src)
    assert not marca.exists()
    assert tema["font_scale"] == 1.0  # La llamada no es un valor sencillo: se ignora.
    assert tema["colors"]["dark"] == {"primary": "#112233"}


def test_broken_file_keeps_last_good_theme(tmp_path):
    f = tmp_path / "tema_app.py"
    f.write_text("ESCALA_LETRA = 1.1\n", encoding="utf-8")
    assert theme.load_tema(f)["font_scale"] == 1.1
    f.write_text("ESCALA_LETRA = (\n", encoding="utf-8")  # A medio escribir
    assert theme.load_tema(f)["font_scale"] == 1.1
    f.write_text("ESCALA_LETRA = 1.3\n", encoding="utf-8")
    assert theme.load_tema(f)["font_scale"] == 1.3
    json.dumps(theme.load_tema(f))
