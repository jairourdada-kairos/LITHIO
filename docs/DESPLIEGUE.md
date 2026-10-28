# Despliegue de LITHIO en la nube (Railway)

Al terminar, el servidor de LITHIO vivirá en internet con una dirección
`https://…up.railway.app`. La app funcionará desde cualquier red, sin tu PC
encendida, y podrás instalarla como APK sin Expo Go.

Tiempo estimado: 30–45 minutos. Costo: Railway da un crédito de prueba;
después, el plan Hobby (5 USD/mes) cubre servidor + base de datos.

## Opción rápida (recomendada): dos dobles clics

1. **`desplegar_nube.bat`**: inicia sesión en Railway en el navegador cuando lo pida
   (la cuenta se crea con GitHub). El script crea la base de datos, el disco
   para fotos y la dirección `https`, copia tus datos actuales (opcional),
   sube las claves sin mostrarlas, despliega y apunta la app a la nube.
2. **`generar_apk.bat`**: inicia sesión en Expo la primera vez; al terminar
   te da el enlace del `.apk` para compartir.

Se pueden volver a ejecutar: reutilizan lo que ya existe y despliegan de nuevo.
Para que el servidor siga activo después del crédito de prueba, activa el
plan **Hobby** (5 USD/mes) en Railway → *Account → Plans*. Ese plan no
"duerme" el servidor: queda encendido las 24 horas.

Los pasos de abajo son la versión manual de lo mismo.

> **Antes de empezar:** ten a mano tu archivo `lithio_backend/.env`.
> Las claves `LITHIO_ENCRYPTION_KEYS` y `LITHIO_HASH_KEY` deben ser
> **exactamente las mismas** en la nube. Si las cambias o las pierdes, las
> cédulas, teléfonos y datos de pago cifrados no se podrán leer nunca más.

## 1. Subir el código a GitHub

```bash
git push origin fase-1/backend-seguridad
```

En GitHub, une la rama a `master` (Pull request → Merge). Railway desplegará
desde `master`.

## 2. Crear el proyecto y la base de datos

1. Entra a <https://railway.com> con tu cuenta de GitHub.
2. **New Project → Deploy PostgreSQL.** Espera a que diga *Active*.
3. Abre la base → pestaña **Variables** → copia `DATABASE_PUBLIC_URL`.

## 3. Copiar tus datos actuales a la nube (opcional, recomendado)

Hazlo **antes** de desplegar el servidor: la base debe estar vacía.
Así conservas tus usuarios, conductores aprobados, viajes y rutas.

En PowerShell, desde la carpeta `lithio_backend`:

```powershell
$env:DATABASE_URL = "pega-aquí-DATABASE_PUBLIC_URL"
.\venv\Scripts\python.exe -m app.migrate_to_cloud lithio.db
Remove-Item Env:DATABASE_URL
```

Verás cuántas filas se copiaron por tabla. Si dice que la base ya tiene
usuarios, no copia nada (para no duplicar).

## 4. Desplegar el servidor

1. En el mismo proyecto: **New → GitHub Repo →** `jairourdada-kairos/LITHIO`.
   Railway detecta `railway.json` y construye con el `Dockerfile`.
2. En el servicio nuevo → **Settings → Volumes → Add Volume**, ruta de montaje
   **`/data`**. Ahí se guardan las fotos de perfil y las evidencias.
3. **Variables** del servicio (Raw Editor, pega y completa):

```
APP_ENV=production
DATABASE_URL=${{Postgres.DATABASE_URL}}
LITHIO_ENCRYPTION_KEYS=   (la misma de tu .env)
LITHIO_HASH_KEY=          (la misma de tu .env)
FIREBASE_PROJECT_ID=lithio-app
FIREBASE_SERVICE_ACCOUNT_JSON=   (ver abajo)
ADMIN_FIREBASE_UIDS=      (la misma de tu .env)
MEDIA_DIR=/data/media
EVIDENCE_DIR=/data/evidence
CORS_ALLOWED_ORIGINS=https://TU-DOMINIO.up.railway.app
```

   - **`FIREBASE_SERVICE_ACCOUNT_JSON`**: abre `C:\secure\lithio-firebase.json`
     en el Bloc de notas y pega **todo** su contenido. Nunca lo subas a GitHub
     ni lo compartas por chat.
4. **Settings → Networking → Generate Domain.** Copia la dirección
   (`https://lithio-production-xxxx.up.railway.app`) y ponla también en
   `CORS_ALLOWED_ORIGINS`.
5. Espera el despliegue y abre `https://TU-DOMINIO.up.railway.app/health`.
   Debe responder `{"status":"ok","environment":"production"}`.
   El panel web queda en `https://TU-DOMINIO.up.railway.app/dashboard`.

## 5. Conectar la app al servidor de la nube

En `lithio_mobile/.env` cambia solo la primera línea:

```
EXPO_PUBLIC_API_URL=https://TU-DOMINIO.up.railway.app
```

Reinicia Expo con `.\iniciar_app.bat --clear`. La app ya no depende de tu PC
ni de estar en el mismo Wi-Fi.

## 6. Generar el APK para Android

Desde `lithio_mobile` (la primera vez pide iniciar sesión en Expo):

```bash
npx eas-cli@latest env:push --environment preview --path .env
```

```bash
npx eas-cli@latest build --platform android --profile preview
```

La compilación se hace en los servidores de Expo (≈15 min). Al terminar te da
un enlace para descargar el `.apk` e instalarlo en cualquier Android.

## Notas

- **Una sola instancia** (`numReplicas: 1`): los avisos en tiempo real viven
  en la memoria del servidor. Para escalar a varias haría falta Redis.
- **Fotos actuales:** las fotos de perfil locales están en
  `lithio_backend/media/avatars`. Si no las copias al volumen, esos usuarios
  verán sus iniciales hasta subir la foto de nuevo.
- **Respaldo:** en la base de Railway → **Backups** puedes programar copias.

---

# APK con notificaciones push (gratis, con la PC encendida)

El APK recibe notificaciones aunque la app esté cerrada. No lleva una
dirección fija: al abrirse lee de Firebase la dirección que publica
`iniciar_publico.bat` en cada arranque. Funciona mientras esa ventana esté
abierta en la PC.

## 1. Firebase para Android (una sola vez)

1. Entra a <https://console.firebase.google.com> → proyecto **lithio-app**.
2. **Agregar app → Android**. Nombre del paquete: `com.lithio.app`.
   Registra la app y **descarga `google-services.json`**.
3. Guárdalo en `lithio_mobile\google-services.json` (no se sube a GitHub).

## 2. Firestore para la dirección del servidor (una sola vez)

1. En la consola: **Compilación → Firestore Database → Crear base de datos**
   (modo producción; ubicación `nam5` o la más cercana).
2. Pestaña **Reglas**, reemplaza todo por esto y pulsa **Publicar**:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /config/server {
      allow read: if true;
    }
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

3. Abre `iniciar_publico.bat`: debe decir **"Dirección publicada para el APK"**.

## 3. Generar el APK

Doble clic en **`generar_apk.bat`**. Te pedirá:

- Iniciar sesión en tu cuenta de Expo (la primera vez).
La firma de Android se crea sola la primera vez. No hay que subir ninguna
clave a Expo: el servidor envía las notificaciones directo por Firebase con su
propia cuenta de servicio.

Al terminar (≈15 min) te da el enlace del `.apk` para compartir.

Si dice que el proyecto pertenece a otra cuenta de Expo, ejecuta en
`lithio_mobile`: `npx eas-cli@latest init --force` y vuelve a intentarlo.

---

# Actualizaciones sin reinstalar (EAS Update)

Desde el APK v3, los cambios de pantallas, textos y lógica llegan solos:

1. Doble clic en `publicar_actualizacion.bat` y escribe qué cambió.
2. Cada teléfono la descarga al abrir LITHIO y se reinicia solo con los cambios.
   El script también sube a Expo las claves nuevas del `.env` de la app.

Hace falta un APK nuevo (`generar_apk.bat`) solo si cambia algo nativo: un permiso,
una librería nativa, el ícono o el nombre. En ese caso sube `version` en
`lithio_mobile/app.json` y, cuando todos tengan el APK nuevo, fija
`APP_MIN_BUILD` en el `.env` del servidor: los APK viejos verán la pantalla
"Actualiza LITHIO" con el enlace de `APP_DOWNLOAD_URL`.

---

# Versión web: iPhone y computadoras

El mismo servidor sirve la app web en `/app`. Al abrir `iniciar_publico.bat`
aparece la línea **LINK PARA TODOS**: esa dirección sirve en Android, iPhone y
computadoras, sin instalar nada ni usar Expo.

- **Instalar en iPhone:** abrir el link en **Safari** → botón Compartir →
  **Agregar a inicio**. Queda con el ícono de LITHIO y a pantalla completa.
- **Entrar con Google en iPhone:** solo desde Safari. En el ícono agregado a la
  pantalla de inicio, iOS no deja volver de la ventana de Google; ahí se entra
  con correo y contraseña.
- **El link cambia** cada vez que se abre `iniciar_publico.bat` (túnel gratuito),
  y el ícono agregado deja de abrir. Para un link fijo hay que pasar el servidor
  a la nube (arriba).
- **Actualizar la web:** `publicar_actualizacion.bat` la vuelve a compilar al
  final. Para compilarla sola: `scripts\exportar_web.ps1` (1-2 minutos).

---

# Billetera: Pago Móvil y avisos al administrador

- Recargas y donaciones por Pago Móvil muestran el **Pago Móvil del
  administrador**: el teléfono, banco y cédula de su perfil de conductor. Para
  cambiarlos, edita esos datos en tu perfil de conductor.
- La persona escribe la referencia y adjunta la **captura**. En el panel
  (`/dashboard` → Aprobaciones) y en la app (Administrador) se ve la captura y
  se pulsa **Acreditar diamantes** o **Rechazar**.
- **◆ Acreditar diamantes** (panel) suma diamantes a mano con el código Li-XXXX
  de la persona, por ejemplo si te pagó por WhatsApp sin usar la app.
- Cada solicitud nueva (recarga, donación, comprobante, retiro, taller, vale o
  conductor nuevo) llega al administrador como **aviso flotante** en la app y
  como **notificación** del teléfono con la app cerrada. El panel web revisa cada
  30 segundos y muestra el aviso arriba a la derecha.

---

# Entrar con Google y Facebook

**Estado (28 oct 2026):** Google ya está configurado para el APK v4
(`com.lithio.app`): proveedor activo en Firebase, app Android "LITHIO App" con
las huellas de la firma de Expo, e `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` en el
`.env` y en Expo. Los pasos de abajo sirven para repetirlo (por ejemplo, si
cambia la firma). Facebook sigue pendiente.

El código ya está listo. Mientras falten las claves, los botones dicen "Muy pronto".

|          | En la web             | En el APK v3 (el que ya tienen)                                  |
|----------|-----------------------|------------------------------------------------------------------|
| Google   | Activarlo en Firebase | Claves + `publicar_actualizacion.bat`. **No hace falta APK nuevo.** |
| Facebook | Activarlo en Firebase | Claves + **APK nuevo** (`generar_apk.bat`)                        |

¿Por qué la diferencia? El APK v3 ya trae el módulo de Google; solo le falta el
ID de cliente, que llega con una actualización. Facebook exige que su
identificador vaya escrito dentro del APK, y eso solo se cambia compilando.
En Expo Go ninguno funciona.

Reglas que se mantienen:

- **Solo Gmail.** Con Google siempre es Gmail. Con Facebook solo entra quien
  registró su Facebook con un Gmail; el resto ve "LITHIO solo acepta cuentas
  reales de Gmail".
- **Correo verificado.** Google ya lo da por verificado. Facebook no: la primera
  vez aparece "Verifica tu correo" y la app envía el enlace.
- **Usuario nuevo:** completa su perfil (cédula, carrera, semestre, teléfono) sin
  crear contraseña.
- **Ya tenía cuenta con contraseña:** con Google entra a la misma cuenta. Con
  Facebook, Firebase no lo permite y la app le pide entrar con su correo.

## A. Google (unos 10 minutos)

**A1. Activar Google en Firebase**

1. Abre <https://console.firebase.google.com> → proyecto **lithio-app**.
2. Menú izquierdo: **Compilación → Authentication → Método de acceso**.
3. **Agregar proveedor nuevo → Google** → activa **Habilitar**.
4. *Nombre público del proyecto*: `LITHIO` (el usuario verá "Elige una cuenta
   para ir a LITHIO"). *Correo de asistencia*: el tuyo.
5. Abre **Configuración del SDK web** y copia el **ID de cliente web** (termina
   en `.apps.googleusercontent.com`; no es secreto). Pulsa **Guardar**.

¿Qué es el ID de cliente web? El "nombre" con el que LITHIO se presenta ante
Google. Cuando alguien elige su Gmail, Google entrega una constancia firmada
dirigida a ese ID; Firebase solo la acepta si va dirigida a un ID de su propio
proyecto. Va dentro de la app, así que puede verlo cualquiera. Lo que **nunca**
debe salir de Firebase es el *Secreto del cliente web* que aparece debajo.

Otros lugares donde está el mismo ID:

- <https://console.cloud.google.com> → proyecto **lithio-app** → *APIs y
  servicios → Credenciales* → *IDs de clientes de OAuth 2.0* → la fila
  **Web client (auto created by Google Service)**.
- En `google-services.json` descargado después del paso A2: el `client_id` con
  `"client_type": 3`.

**A2. Registrar la huella (SHA-1) del APK**

Google solo entrega la cuenta a apps que reconoce por su firma.

1. <https://expo.dev> → proyecto **lithio** → **Credentials** → **Android** →
   `com.lithio.app` → en *Keystore* copia el **SHA-1 Fingerprint**
   (forma `AA:BB:CC:...`).
2. Firebase → engranaje **Configuración del proyecto** → pestaña **General** →
   *Tus apps* → la app Android `com.lithio.app` → **Agregar huella digital** →
   pega el SHA-1 → **Guardar**.
3. En esa misma página descarga el **google-services.json** nuevo y reemplaza
   `lithio_mobile\google-services.json` (lo usará el próximo APK).

**A3. Poner el ID en la app y publicar**

1. Abre `lithio_mobile\.env` con el Bloc de notas y añade al final:
   ```
   EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com
   ```
2. Doble clic en `publicar_actualizacion.bat` y escribe `Entrar con Google`.
3. Prueba: cierra LITHIO del todo, ábrelo (se actualiza solo) → **Iniciar
   sesión** → botón **Google** (ya sin la etiqueta "pronto") → elige tu Gmail.
   Si es la primera vez, completa cédula, carrera, semestre y teléfono.

| Qué ves | Qué pasa | Qué hacer |
|---|---|---|
| El botón dice "pronto" / "Muy pronto podrás entrar con Google" | El ID no llegó a la app | Revisa la línea del `.env` (sin espacios ni comillas), publica otra vez y reabre la app |
| "El acceso con Google todavía no está activado" | Google está apagado en Firebase | Paso A1 |
| "No se pudo entrar con Google" | Falta la huella o el ID no es el web | Paso A2; usa el ID **web**, no el de Android ni el secreto |
| "LITHIO solo acepta cuentas reales de Gmail" | Es una cuenta de Google con otro dominio | Entrar con una cuenta `@gmail.com` |
| Google dice "Acceso bloqueado" | La pantalla de permisos está en modo prueba | Google Cloud → *Google Auth Platform → Público* → **Publicar app** |

En la versión web de LITHIO, el dominio donde se abre debe estar en Firebase →
*Authentication → Configuración → Dominios autorizados*.

## B. Facebook (unos 30 minutos)

**B1. Crear la app en Meta**

1. <https://developers.facebook.com> → **Mis apps → Crear app**.
2. Nombre **LITHIO** y tu correo de contacto.
3. Caso de uso: **Autenticar y solicitar datos a los usuarios con el inicio de
   sesión con Facebook**. El portafolio comercial puede quedar para después.
4. En el caso de uso → **Personalizar → Permisos**: deja `public_profile` y
   **agrega `email`**. Sin el correo no se puede comprobar que sea Gmail.

**B2. Copiar las claves**

- *Configuración de la app → Básica*: **Identificador de la app** y **Clave
  secreta de la app** (botón *Mostrar*).
- *Configuración de la app → Avanzada → Seguridad*: **Token de cliente**.

**Atajo para B3 y B5:** con las tres claves de B2 a mano, doble clic en
`configurar_facebook.bat`. Activa Facebook en Firebase, escribe el
Identificador y el Token de cliente en `lithio_mobile\.env` y muestra lo que
falta pegar en Meta: la URI, el paquete, la clase y el hash de clave del APK
(`CH6topAB2Db0C738ufTnYEqiCNE=`). Después sigue en B5 paso 2.

- **Web y iPhone (Safari):** funciona apenas termina el script y se ejecuta
  `publicar_actualizacion.bat`.
- **Android:** necesita el APK nuevo de B5. Mientras tanto, el botón pide
  instalar la versión nueva en vez de fallar.
- Las cuentas de Facebook entran aunque su correo no sea de Gmail y sin
  verificar el correo, porque Facebook ya comprobó a la persona.
- En Meta cambia la app de **Desarrollo** a **Activo**; si no, solo entran los
  probadores.

**B3. Conectar Facebook con Firebase**

1. Firebase → Authentication → Método de acceso → **Agregar proveedor →
   Facebook** → Habilitar → pega el Identificador y la Clave secreta.
2. Copia la **URI de redireccionamiento de OAuth** que muestra Firebase
   (termina en `/__/auth/handler`) → **Guardar**.
3. Meta → tu app → **Casos de uso → Inicio de sesión con Facebook →
   Configuración** → *URI de redireccionamiento de OAuth válidos* → pégala →
   **Guardar cambios**.

**B4. Registrar el APK en Meta**

1. Meta → *Configuración de la app → Básica* → abajo **Agregar plataforma →
   Android**.
2. Nombre del paquete: `com.lithio.app`.
   Nombre de clase: `com.lithio.app.MainActivity`.
3. **Hashes de clave**: el SHA-1 del paso A2 convertido a Base64. En PowerShell
   (cambia el SHA-1 por el tuyo):
   ```
   [Convert]::ToBase64String([byte[]]('AA:BB:CC:...'.Split(':') | % { [Convert]::ToByte($_, 16) }))
   ```
   Pega el resultado (termina en `=`).
4. *Inicio de sesión único*: **Sí** → **Guardar cambios**. Si avisa que no
   encuentra el paquete en Google Play, elige usarlo igual.

**B5. Claves en la app y APK nuevo**

1. Añade a `lithio_mobile\.env` (la Clave secreta **no** va aquí, solo en Firebase):
   ```
   EXPO_PUBLIC_FACEBOOK_APP_ID=1234567890
   FACEBOOK_CLIENT_TOKEN=el_token_de_cliente
   ```
2. Doble clic en `generar_apk.bat` (≈15 min) e instala el APK nuevo (v4).
   No cambies `version` en `app.json`: así el APK v3 y el v4 siguen recibiendo
   las mismas actualizaciones.
3. En `lithio_backend\.env` pon `APP_LATEST_BUILD=4` y en `APP_DOWNLOAD_URL`
   el enlace del APK nuevo; reinicia el servidor. Quien tenga el v3 verá el
   aviso de versión nueva. En el v3 el botón de Facebook falla hasta instalar el v4.

**B6. Abrirlo para todos**

- Mientras la app de Meta esté en **modo desarrollo**, solo entran las cuentas
  que agregues en *Roles de la app → Roles → Evaluadores* (deben aceptar la
  invitación desde su Facebook).
- Para que entre cualquiera, Meta pide en *Configuración → Básica*: URL de
  **política de privacidad**, URL o instrucciones de **eliminación de datos**,
  ícono de 1024×1024 y categoría. Después cambia **Modo de la app** a
  **Activo**. Con solo `email` y `public_profile` no hace falta revisión de Meta.
- Las dos páginas ya existen en el servidor: `https://<tu-servidor>/privacidad` y
  `https://<tu-servidor>/eliminar-cuenta` (ver "Páginas legales" abajo). Meta
  necesita una dirección fija, así que úsalas cuando el servidor esté en la nube.

---

# Páginas legales (Facebook y Google Play)

El servidor publica:

- `/privacidad`: qué datos guarda LITHIO, para qué, con quién se comparten y cómo eliminarlos.
- `/eliminar-cuenta`: los pasos para borrar la cuenta (en la app: **Cuenta → Mis datos →
  Eliminar mi cuenta**) y qué se borra.

Para que muestren un correo de contacto, añade `CONTACT_EMAIL=tu@correo` al `.env` del
servidor y reinícialo. Mientras el servidor esté en esta PC con el túnel, la dirección
cambia en cada arranque; con el servidor en la nube (sección 4) queda fija, por ejemplo
`https://TU-DOMINIO.up.railway.app/privacidad`.

---

# Teléfonos: recuperar la cuenta, llamar y avisos por WhatsApp

## Recuperar con el teléfono y botón "Llamar": no hay que configurar nada

Funcionan con el teléfono que cada usuario guardó en su perfil.

- Debe ser un celular venezolano: 0412, 0414, 0416, 0422, 0424 o 0426 y 7
  dígitos. Se acepta `0414-1234567`, `414 1234567`, `+58 414 1234567`,
  `+58 0414-1234567`, `0058 414 1234567` o `(0414) 123-45-67`; LITHIO lo guarda
  como `+58 414 1234567`.
- Para cambiarlo: **Cuenta → Mis datos → Teléfono**.
- La recuperación envía al correo de la cuenta el enlace de Firebase para crear
  una contraseña nueva, y la app muestra el correo medio oculto. Si el número
  está en varias cuentas, cada una recibe su propio enlace.
- Las cuentas sin correo real (las viejas `…@lithio.local`) no pueden recibirlo:
  la app pide ayuda al administrador.
- "Llamar" abre la app Teléfono del usuario con el número escrito; la llamada
  la cobra su operadora, LITHIO no cobra nada. El número solo se comparte
  mientras el viaje está aceptado, en camino o en curso.

## Avisos de viaje por WhatsApp a los conductores

El servidor ya envía el aviso al WhatsApp del conductor cuando le llega una
solicitud. Faltan las credenciales de Meta (WhatsApp Cloud API).

**W1. Crear la app de WhatsApp**

1. <https://developers.facebook.com> → **Mis apps → Crear app** (puede ser otra,
   distinta de la de Facebook) → caso de uso **Conectarse con los clientes a
   través de WhatsApp** → elige o crea tu **portafolio comercial**.
2. Meta crea una cuenta de WhatsApp Business con un **número de prueba** gratis.

**W2. Copiar el identificador del número**

*WhatsApp → Configuración de la API*: copia el **Identificador del número de
teléfono** (Phone number ID; es un número largo, no el teléfono).

**W3. Token permanente** (el de la página de la API vence en 24 horas)

1. <https://business.facebook.com> → **Configuración** → *Usuarios → Usuarios
   del sistema* → **Agregar** → nombre `lithio-servidor`, rol **Administrador**.
2. **Asignar activos**: la app de WhatsApp (control total) y tu cuenta de
   WhatsApp Business (control total).
3. **Generar token** → elige la app → caducidad **Nunca** → permisos
   `whatsapp_business_messaging` y `whatsapp_business_management` → copia el
   token. Trátalo como una contraseña: no lo compartas.

**W4. Plantilla del aviso**

Sin plantilla aprobada, WhatsApp solo entrega el aviso si el conductor escribió
al número en las últimas 24 horas.

1. *WhatsApp Manager → Plantillas de mensajes → Crear plantilla* → categoría
   **Utilidad** → nombre `nueva_solicitud` → idioma **Español**.
2. Cuerpo (respeta el orden de las variables):
   ```
   LITHIO: nueva solicitud de viaje de {{1}}.
   Origen: {{2}}
   Destino: {{3}}
   Tarifa: {{4}}
   Horario: {{5}}
   Abre LITHIO para aceptarla.
   ```
3. Meta pide ejemplos: `María Pérez`, `Biblioteca UNC`, `Residencias`, `$2.50`, `inmediato`.
4. Envíala; Meta la revisa en minutos u horas.

**W5. Probar con el número de prueba**

En *Configuración de la API → Para*: agrega tu teléfono y el de los conductores
de prueba (hasta 5). A cada uno le llega un código por WhatsApp para confirmarlo.
Con el número de prueba solo se envía a esos teléfonos.

**W6. Datos en el servidor**

Añade a `lithio_backend\.env` y reinicia el servidor:

```
WHATSAPP_ACCESS_TOKEN=el_token_permanente
WHATSAPP_PHONE_NUMBER_ID=el_identificador_del_numero
WHATSAPP_TEMPLATE_NAME=nueva_solicitud
WHATSAPP_TEMPLATE_LANGUAGE=es
```

Prueba: con una cuenta de pasajero pide un viaje a un conductor de la lista del
paso W5; le debe llegar el WhatsApp en segundos.

**W7. Enviar a cualquier conductor (número propio)**

1. *WhatsApp Manager → Números de teléfono → Agregar número*: un número que **no**
   esté usando la app de WhatsApp (o bórralo de ella antes) y que reciba SMS o
   llamadas para el código.
2. Nombre visible: `LITHIO` (Meta lo revisa).
3. Agrega un método de pago en el portafolio comercial: Meta cobra por cada
   plantilla enviada; el precio depende del país (ver
   <https://developers.facebook.com/docs/whatsapp/pricing>).
4. Cambia `WHATSAPP_PHONE_NUMBER_ID` por el identificador del número nuevo y
   reinicia el servidor.

Opcional: para recibir en el servidor las respuestas y los estados de entrega,
configura el webhook en *WhatsApp → Configuración* con la URL
`https://<tu-servidor>/webhooks/whatsapp` y añade al `.env`
`WHATSAPP_WEBHOOK_VERIFY_TOKEN` (una palabra que tú inventes, la misma en Meta)
y `WHATSAPP_APP_SECRET` (la clave secreta de esa app de Meta).
