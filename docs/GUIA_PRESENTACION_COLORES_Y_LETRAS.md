# Guía corta: cambiar colores y tamaño de letra (presentación)

En cada archivo busca con **Ctrl+F** el texto `CAMBIA AQUÍ` (colores) o `AQUÍ` (letras).
Los comentarios ya están puestos al lado de cada línea.

## 1. Panel web del backend (`/dashboard`) — el más fácil de mostrar
Archivo: `lithio_dashboard/style.css`

| Qué quieres cambiar | Dónde |
|---|---|
| Colores de todo el panel | bloque `:root` (arriba): `--primary`, `--accent`, `--danger`, `--text-main`... |
| Fondo de la página | `body` → `background: linear-gradient(...)` |
| Tamaño de TODO el texto | agrega `html { font-size: 18px; }` debajo de `:root` |
| Tamaño de un texto concreto | busca `font-size`: cada línea dice qué texto es (título, número grande, tablas...) |
| Tipo de letra | `font-family` (`body` = general, `Outfit` = títulos) |

**Cómo se ve el cambio:** guarda y recarga el navegador con **Ctrl+F5**. No hay que reiniciar nada.

## 2. Páginas que sirve el backend
- `lithio_backend/app/legal/terminos.html`, `privacidad.html`, `eliminar-cuenta.html`: colores y tamaños en el bloque `<style>` del inicio (`--bg`, `--accent`, `16px`, `30px`...).
- `lithio_descarga/index.html` (página `/descargar`): variables `--primary`, `--bg`... y los `font-size` del título y del botón.
- `lithio_backend/app/push_service.py`: `BRAND_COLOR` es el color de las notificaciones.
- Se ven recargando con Ctrl+F5.

## 3. La app del teléfono y la web `/app`
- **Colores:** `lithio_mobile/src/constants/theme.ts`. `dark` = modo oscuro, `light` = modo claro. Cambia el código `#RRGGBB`.
- **Tipo de letra:** en el mismo archivo, bloque `fonts`.
- **Tamaño de letra** (cada texto tiene su `fontSize`):
  - Botones grandes: `lithio_mobile/src/components/brand/PrimaryButton.tsx`
  - Barra de abajo: `lithio_mobile/src/components/nav/BottomTabBar.tsx`
  - Título de cada pantalla: `lithio_mobile/src/components/ui/ScreenHeader.tsx`
  - Otros textos: Ctrl+Shift+F y busca `fontSize` en `lithio_mobile/src/screens`.
- **Para que llegue al teléfono y a la web:** después de guardar, ejecuta `publicar_actualizacion.bat`. Luego cierra y abre la app del teléfono dos veces, y recarga la web con Ctrl+F5.

## Consejos para la presentación
- Practica primero con el **panel web (punto 1)**: se ve al instante, sin publicar.
- Antes de practicar, copia el archivo que vas a editar (por ejemplo `style.css` → `style.css.bak`) para volver atrás rápido.
- Cambia un valor a la vez y recarga, para poder explicar qué hizo cada uno.
