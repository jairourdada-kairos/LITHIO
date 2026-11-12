# Guía para los compañeros: practicar colores y letras de LITHIO

Repositorio: https://github.com/jairourdada-kairos/LITHIO
Rama de práctica: `practica`

## Una sola vez: preparar el dispositivo
1. **Cuenta de GitHub.** Crea una si no tienes y dile a Jairo tu usuario. Él te agrega como colaborador.
2. **Acepta la invitación.** Llega a tu correo, o en https://github.com/jairourdada-kairos/LITHIO/invitations. Sin aceptarla no podrás clonar.
3. **Instala Git:** https://git-scm.com/downloads (todo "Next"). Comprueba en una terminal: `git --version`.
4. **Instala VS Code:** https://code.visualstudio.com
5. **Dile a Git quién eres** (terminal):
   ```
   git config --global user.name "Tu Nombre"
   git config --global user.email "tu-correo@ejemplo.com"
   ```

## Una sola vez: bajar el proyecto
6. Terminal en la carpeta donde quieras guardarlo:
   ```
   git clone https://github.com/jairourdada-kairos/LITHIO.git
   cd LITHIO
   git checkout practica
   ```
   Se abre una ventana para iniciar sesión en GitHub: inicia sesión y autoriza.
7. Abre la carpeta en VS Code: `code .` (o Archivo → Abrir carpeta).
   No hace falta instalar nada más: no se corre el proyecto en tu dispositivo.

## Cada vez que practiques
8. **Antes de empezar**, trae lo último (por si el otro compañero ya subió algo):
   ```
   git pull origin practica
   ```
9. **Edita.** En VS Code usa Ctrl+Shift+F y busca `CAMBIA AQUÍ` (colores) o `AQUÍ` (letras).
   Archivos:
   | Qué cambiar | Archivo |
   |---|---|
   | Tamaño de TODA la letra de la app y colores | `lithio_backend/app/tema_app.py` |
   | Colores y letras del panel web | `lithio_dashboard/style.css` |
   | Colores del tema de la app (modo oscuro/claro) | `lithio_mobile/src/constants/theme.ts` |
   | Tamaño de letra de botones, barra de abajo y títulos | `lithio_mobile/src/components/brand/PrimaryButton.tsx`, `.../nav/BottomTabBar.tsx`, `.../ui/ScreenHeader.tsx` |
   | Páginas de términos y de descarga | `lithio_backend/app/legal/*.html`, `lithio_descarga/index.html` |

   Ejemplo en `tema_app.py`: cambia `ESCALA_LETRA = 1.0` por `1.2`, o quita el `#` de una línea de `COLORES_OSCURO` y cambia el color.
   Cambia **solo valores** (números y colores entre comillas). Un valor mal escrito se ignora y no rompe la app.
10. **Guarda** (Ctrl+S) y **sube**:
    ```
    git add .
    git commit -m "Describe tu cambio"
    git push origin practica
    ```
    Si dice que hay cambios nuevos en el servidor: `git pull --rebase origin practica` y vuelve a `git push origin practica`.
11. **Avisa a Jairo.** Él hace doble clic en `aplicar_practica.bat` y tus cambios aparecen en la app del teléfono y en la web.

## Importante
- Solo se aplican los archivos de la tabla; cualquier otro cambio se ignora por seguridad.
- Si ambos editan **el mismo archivo y la misma línea**, Git avisará de un conflicto: pónganse de acuerdo en quién edita qué, o cada quien un color/tamaño distinto.
- No subas claves ni archivos `.env`.
- Para ver el resultado, pide a Jairo el enlace público del día (cambia cada vez que se reinicia el servidor).
