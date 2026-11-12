"""Reglas de validación y normalización de los datos de registro.

La app móvil aplica las mismas reglas (src/utils/validation.ts) para avisar
antes de enviar, pero la fuente de verdad es este módulo: el backend nunca
confía en lo que valida el cliente.
"""
import os
import re

# Operadoras móviles venezolanas: Movilnet (416, 426), Movistar (414, 424), Digitel (412, 422).
MOBILE_PREFIXES = {"412", "414", "416", "422", "424", "426"}

SEMESTER_OPTIONS = [str(number) for number in range(1, 13)] + ["Egresado", "Personal / Docente"]

# --- REGISTRO: ESTUDIANTE O TRABAJADOR ---
# Para sumar otra universidad o institución (UCV, etc.) basta agregarla aquí: la
# app pide estas listas a GET /api/registration/options, sin sacar otra versión.
OCCUPATIONS = ("estudiante", "trabajador")
STUDENT_SEMESTERS = [str(number) for number in range(1, 13)] + ["Egresado"]

# Carreras de pregrado por institución (solo estudiantes).
# AQUÍ se AÑADE una carrera (nueva línea entre comillas, terminada en coma), se EDITA su
# nombre o se ELIMINA (borra la línea). Después: reiniciar_servidor.bat.
CAREERS = {
    "UNC": [
        "Ingeniería en Inteligencia Artificial",
        "Ingeniería en Ciberseguridad",
        "Ingeniería en Robótica y Automatización",
        "Ingeniería en Electromedicina",
        "Ingeniería en Biomateriales",
        "Ingeniería en Petroquímica",
        "Ingeniería Química",
        "Licenciatura en Ciencia de los Datos",
        "Licenciatura en Ciencias de la Computación",
        "Licenciatura en Nanotecnología",
        "Licenciatura en Biotecnología",
        "Licenciatura en Ciencia Molecular",
        "Licenciatura en Física Nuclear",
        "Licenciatura en Biología y Química Computacional",
        "Licenciatura en Oceanología",
        "Licenciatura en Física",
        "Licenciatura en Matemáticas",
        "Licenciatura en Filosofía",
    ],
}

# Áreas de trabajo por institución (solo trabajadores). La UNC no tiene comedor.
# AQUÍ se AÑADEN, EDITAN o ELIMINAN áreas: cada una va entre comillas y separada por coma.
WORK_AREAS = {
    "UNC": ["Administración", "Dirección", "Docencia", "Seguridad", "Limpieza", "Mantenimiento"],
    "IVIC": ["Administración", "Dirección", "Investigación", "Seguridad", "Limpieza", "Mantenimiento", "Comedor"],
}


def registration_options() -> dict:
    """Listas que la app muestra en el registro."""
    return {
        "student": {"institutions": list(CAREERS), "careers": CAREERS, "semesters": STUDENT_SEMESTERS},
        "worker": {"institutions": list(WORK_AREAS), "areas": WORK_AREAS},
    }


def pick_option(value: str | None, options, message: str) -> str:
    """Devuelve la opción de la lista que coincide (sin distinguir mayúsculas) o lanza ValueError."""
    cleaned = " ".join((value or "").split())
    for option in options:
        if cleaned.casefold() == option.casefold():
            return option
    raise ValueError(message)

_NAME_ALLOWED_PUNCTUATION = {" ", "'", "-", "´", "’"}


def normalize_person_name(value: str, field_label: str) -> str:
    cleaned = " ".join(value.split())
    if not 2 <= len(cleaned) <= 60:
        raise ValueError(f"{field_label} debe tener entre 2 y 60 caracteres.")
    if not all(char.isalpha() or char in _NAME_ALLOWED_PUNCTUATION for char in cleaned):
        raise ValueError(f"{field_label} solo puede contener letras, espacios, apóstrofos o guiones.")
    if not any(char.isalpha() for char in cleaned):
        raise ValueError(f"{field_label} no es válido.")
    return cleaned


def normalize_cedula(value: str) -> str:
    """'v-12.345.678' -> 'V12345678'. Sin letra se asume venezolano (V)."""
    compact = re.sub(r"[\s.\-]", "", value).upper()
    if compact.isdigit():
        compact = "V" + compact
    if not re.fullmatch(r"[VE]\d{6,9}", compact):
        raise ValueError("La cédula debe tener el formato V-12345678 o E-12345678 (6 a 9 dígitos).")
    if int(compact[1:]) == 0:
        raise ValueError("La cédula no es válida.")
    return compact


def format_cedula(normalized: str) -> str:
    return f"{normalized[0]}-{normalized[1:]}"


def normalize_phone(value: str) -> str:
    """Acepta 0412-1234567, 412 1234567, +58 412 1234567, +58 0412 1234567 o
    0058 412 1234567 y devuelve '+58 412 1234567'."""
    digits = re.sub(r"\D", "", value)
    if digits.startswith("00"):  # Prefijo internacional marcado desde otro país
        digits = digits[2:]
    if digits.startswith("58") and len(digits) in (12, 13):
        digits = digits[2:]
    if digits.startswith("0") and len(digits) == 11:
        digits = digits[1:]
    if len(digits) != 10 or digits[:3] not in MOBILE_PREFIXES:
        raise ValueError(
            "El teléfono debe ser un celular venezolano (0412, 0414, 0416, 0422, 0424 o 0426) con 7 dígitos después."
        )
    return f"+58 {digits[:3]} {digits[3:]}"


def normalize_career(value: str) -> str:
    cleaned = " ".join(value.split())
    if not 3 <= len(cleaned) <= 80:
        raise ValueError("La carrera debe tener entre 3 y 80 caracteres.")
    if not any(char.isalpha() for char in cleaned):
        raise ValueError("La carrera no es válida.")
    return cleaned


def normalize_semester(value: str) -> str:
    cleaned = value.strip()
    for option in SEMESTER_OPTIONS:
        if cleaned.casefold() == option.casefold():
            return option
    raise ValueError("Selecciona un semestre del 1 al 12, Egresado o Personal / Docente.")


def allowed_email_domains() -> set[str]:
    """Dominios aceptados (ALLOWED_EMAIL_DOMAINS). Vacío = cualquiera; por defecto solo Gmail."""
    raw = os.getenv("ALLOWED_EMAIL_DOMAINS", "gmail.com,googlemail.com")
    return {domain.strip().lower() for domain in raw.split(",") if domain.strip()}


def email_domain_allowed(email: str | None) -> bool:
    domains = allowed_email_domains()
    return not domains or (email or "").rsplit("@", 1)[-1].lower() in domains


def payment_reference_key(reference: str | None) -> str:
    """Clave alfanumérica canónica para comparar referencias de pago sin espacios ni guiones."""
    return re.sub(r"[\s\-]+", "", (reference or "")).upper()


def normalize_payment_reference(reference: str | None) -> str:
    """Valida y limpia una referencia de Pago Móvil o Binance Pay (4 a 30 caracteres)."""
    cleaned = re.sub(r"\s+", "", reference or "").upper()
    alnum = payment_reference_key(cleaned)
    if not re.fullmatch(r"[A-Z0-9-]{4,30}", cleaned) or len(alnum) < 4:
        raise ValueError("Escribe la referencia que te dio el banco: de 4 a 30 números o letras.")
    return cleaned
