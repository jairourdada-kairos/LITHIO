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

> **Antes de empezar:** ten a mano tu archivo `moto_unc_backend/.env`.
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

En PowerShell, desde la carpeta `moto_unc_backend`:

```powershell
$env:DATABASE_URL = "pega-aquí-DATABASE_PUBLIC_URL"
.\venv\Scripts\python.exe -m app.migrate_to_cloud moto_unc.db
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

En `moto_unc_mobile/.env` cambia solo la primera línea:

```
EXPO_PUBLIC_API_URL=https://TU-DOMINIO.up.railway.app
```

Reinicia Expo con `.\iniciar_app.bat --clear`. La app ya no depende de tu PC
ni de estar en el mismo Wi-Fi.

## 6. Generar el APK para Android

Desde `moto_unc_mobile` (la primera vez pide iniciar sesión en Expo):

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
  `moto_unc_backend/media/avatars`. Si no las copias al volumen, esos usuarios
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
2. **Agregar app → Android**. Nombre del paquete: `com.motounc.mobile`.
   Registra la app y **descarga `google-services.json`**.
3. Guárdalo en `moto_unc_mobile\google-services.json` (no se sube a GitHub).

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
`moto_unc_mobile`: `npx eas-cli@latest init --force` y vuelve a intentarlo.

---

# Actualizaciones sin reinstalar (EAS Update)

Desde el APK v3, los cambios de pantallas, textos y lógica llegan solos:

1. Doble clic en `publicar_actualizacion.bat` y escribe qué cambió.
2. Cada teléfono la descarga al abrir LITHIO y la aplica la siguiente vez que se abre.

Hace falta un APK nuevo (`generar_apk.bat`) solo si cambia algo nativo: un permiso,
una librería nativa, el ícono o el nombre. En ese caso sube `version` en
`moto_unc_mobile/app.json` y, cuando todos tengan el APK nuevo, fija
`APP_MIN_BUILD` en el `.env` del servidor: los APK viejos verán la pantalla
"Actualiza LITHIO" con el enlace de `APP_DOWNLOAD_URL`.

---

# Entrar con Google y Facebook

El código ya está listo. Mientras falten las claves, los botones muestran "pronto".
En la web funcionan con solo activar el proveedor en Firebase (paso A1 / B1).
En el APK hay que poner las claves y **generar un APK nuevo** (`generar_apk.bat`).
En Expo Go no funcionan (no tiene el código nativo de Google ni de Facebook).

Un usuario nuevo que entra con Google o Facebook completa su perfil (cédula,
carrera, semestre, teléfono) sin crear contraseña. El correo queda fijo: es el de esa cuenta.

## A. Google

1. **Firebase → Authentication → Método de acceso → Agregar proveedor → Google** →
   Habilitar → correo de asistencia (el tuyo) → Guardar.
2. **Huella SHA-1 del APK:** en https://expo.dev → proyecto **lithio** →
   *Credentials* → *Android* → `com.motounc.mobile` → copia el **SHA-1 Fingerprint**
   del *Keystore*.
3. **Firebase → Configuración del proyecto (engranaje) → Tus apps → app Android** →
   *Agregar huella digital* → pega el SHA-1 → Guardar.
4. En esa misma página descarga de nuevo **google-services.json** y reemplaza el de
   `moto_unc_mobile/` (ahora incluye el cliente de Google).
5. **ID de cliente web:** Firebase → Authentication → Método de acceso → Google →
   *Configuración del SDK web* → copia el **ID de cliente web**
   (termina en `.apps.googleusercontent.com`).
6. Añade a `moto_unc_mobile/.env`:
   ```
   EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com
   ```

## B. Facebook

1. https://developers.facebook.com → *Mis apps* → **Crear app** → caso de uso
   *Autenticar y solicitar datos a los usuarios con el inicio de sesión con Facebook* →
   nombre **LITHIO**.
2. *Configuración de la app → Básica*: copia el **Identificador de la app** y la
   **Clave secreta de la app**. En *Configuración → Avanzada*, copia el
   **Token de cliente**.
3. **Firebase → Authentication → Agregar proveedor → Facebook** → Habilitar → pega el
   Identificador y la Clave secreta. Copia la **URI de redireccionamiento de OAuth**
   que muestra Firebase y pégala en Facebook → *Inicio de sesión con Facebook →
   Configuración → URI de redireccionamiento de OAuth válidos*.
4. Facebook → *Configuración → Básica → Agregar plataforma → Android*:
   - Nombre del paquete: `com.motounc.mobile`
   - Nombre de clase: `com.motounc.mobile.MainActivity`
   - Hash de clave: el SHA-1 del paso A2 convertido a Base64. Puedes calcularlo en
     PowerShell (cambia el SHA-1 por el tuyo):
     ```
     [Convert]::ToBase64String([byte[]]('AA:BB:CC:...'.Split(':') | % { [Convert]::ToByte($_, 16) }))
     ```
5. Mientras la app de Facebook esté *en desarrollo*, solo pueden entrar las personas
   que agregues en *Roles de la app → Evaluadores*. Para abrirla a todos, Facebook pide
   una URL de política de privacidad y pasar la app a modo *Activo*.
6. Añade a `moto_unc_mobile/.env`:
   ```
   EXPO_PUBLIC_FACEBOOK_APP_ID=1234567890
   FACEBOOK_CLIENT_TOKEN=el_token_de_cliente
   ```

Después de A y/o B: doble clic en `generar_apk.bat` e instala el APK nuevo.

---

# Avisos de viaje por WhatsApp a los conductores

El servidor ya envía el aviso al teléfono del conductor cuando le llega una solicitud.
Solo faltan las credenciales de Meta (WhatsApp Cloud API, gratis para empezar):

1. En https://developers.facebook.com → **Crear app** → tipo *Empresa* → agrega el
   producto **WhatsApp**. Meta crea una cuenta de WhatsApp Business y un número de prueba.
2. *WhatsApp → Configuración de la API*: copia el **Identificador del número de
   teléfono** y el **Identificador de la cuenta de WhatsApp Business**.
3. Token permanente: *business.facebook.com → Configuración → Usuarios del sistema →
   Agregar* (administrador) → *Generar token* con los permisos
   `whatsapp_business_messaging` y `whatsapp_business_management`.
4. **Plantilla** (obligatoria para avisos automáticos: sin ella, WhatsApp solo entrega
   el mensaje si el conductor escribió al número en las últimas 24 horas).
   *WhatsApp → Plantillas de mensajes → Crear* → categoría **Utilidad**, nombre
   `nueva_solicitud`, idioma **Español**, cuerpo:
   ```
   LITHIO: nueva solicitud de viaje de {{1}}.
   Origen: {{2}}
   Destino: {{3}}
   Tarifa: {{4}}
   Horario: {{5}}
   Abre LITHIO para aceptarla.
   ```
   Meta la revisa (minutos u horas).
5. Con el número de prueba solo puedes enviar a los teléfonos que agregues como
   destinatarios en *Configuración de la API*. Para enviar a cualquiera, agrega tu
   propio número de empresa.
6. Completa en `moto_unc_backend/.env` y reinicia el servidor:
   ```
   WHATSAPP_ACCESS_TOKEN=el_token_permanente
   WHATSAPP_PHONE_NUMBER_ID=...
   WHATSAPP_BUSINESS_ACCOUNT_ID=...
   WHATSAPP_APP_SECRET=la_clave_secreta_de_la_app_de_meta
   WHATSAPP_TEMPLATE_NAME=nueva_solicitud
   WHATSAPP_TEMPLATE_LANGUAGE=es
   ```

El teléfono del conductor debe estar guardado con código de país (p. ej. `+58 414 1234567`).
