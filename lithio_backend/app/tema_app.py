"""TEMA DE LA APP: AQUÍ se cambian los colores y el tamaño de la letra de LITHIO.

Este es el archivo para practicar. Lo que cambies aquí se ve en la app del
teléfono y en la web (/app) SIN reiniciar el servidor y SIN publicar nada:
guarda el archivo, y en el teléfono cierra y abre LITHIO (en la web, F5).

REGLAS (así no se rompe nada):
- Cambia solo lo que está a la derecha del signo "=" o de los dos puntos.
- Los colores van entre comillas, en código hexadecimal: "#FF8800".
- Si escribes algo inválido, ese valor se ignora y la app sigue con el color de siempre.
- Para quitar un cambio, bórralo o ponle "#" delante (así queda como comentario).
- Este archivo solo admite valores sencillos: no escribas código aquí.
"""

# ---------------------------------------------------------------------------
# TAMAÑO DE LA LETRA (de toda la app)
# AQUÍ poniendo otro número se cambia el tamaño de TODAS las letras de la app:
#   1.0 = normal      1.2 = 20 % más grande      0.9 = un poco más pequeña
# Se permite de 0.8 a 1.4.
# ---------------------------------------------------------------------------
ESCALA_LETRA = 1.0

# ---------------------------------------------------------------------------
# COLORES DEL MODO OSCURO (el que usa la app por defecto)
# Quita el "#" del principio de una línea y cambia el color para activarla.
# ---------------------------------------------------------------------------
COLORES_OSCURO = {
    # "bgDark": "#0B1416",        # AQUÍ el color de fondo de las pantallas
    # "primary": "#45D6C5",       # AQUÍ el color principal (turquesa): botones, íconos y textos resaltados
    # "secondary": "#FF765E",     # AQUÍ el color secundario (coral): lo del conductor
    # "gold": "#FFC857",          # AQUÍ el dorado de la Fe
    # "diamond": "#7FD4FF",       # AQUÍ el azul de los diamantes
    # "success": "#34D399",       # AQUÍ el verde de éxito
    # "error": "#FF6B6B",         # AQUÍ el rojo de errores
    # "warning": "#FF9F4A",       # AQUÍ el naranja de avisos
    # "textPrimary": "#F2F8F7",   # AQUÍ el color del texto principal
    # "textSecondary": "#A6BABB", # AQUÍ el color del texto secundario
    # "textMuted": "#8AA0A2",     # AQUÍ el color del texto atenuado
    # "surfaceSolid": "#162528",  # AQUÍ el color de las tarjetas y ventanas que flotan
    # "onPrimary": "#0E2A27",     # AQUÍ el color del texto que va sobre el color principal
}

# ---------------------------------------------------------------------------
# COLORES DEL MODO CLARO (los mismos nombres, para quien usa el tema claro)
# ---------------------------------------------------------------------------
COLORES_CLARO = {
    # "bgDark": "#F0F5F3",        # AQUÍ el color de fondo de las pantallas
    # "primary": "#0B7E72",       # AQUÍ el color principal
    # "secondary": "#C8432B",     # AQUÍ el color secundario
    # "gold": "#8A6308",          # AQUÍ el dorado de la Fe
    # "textPrimary": "#0F2024",   # AQUÍ el color del texto principal
    # "surfaceSolid": "#FFFFFF",  # AQUÍ el color de las tarjetas
}
