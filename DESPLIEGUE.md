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
RAILWAY_RUN_UID=0
CORS_ALLOWED_ORIGINS=https://TU-DOMINIO.up.railway.app
```

   - **`FIREBASE_SERVICE_ACCOUNT_JSON`**: abre `C:\secure\lithio-firebase.json`
     en el Bloc de notas y pega **todo** su contenido. Nunca lo subas a GitHub
     ni lo compartas por chat.
   - **`RAILWAY_RUN_UID=0`**: permite al servidor escribir en el volumen `/data`.
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
- Subir la clave de notificaciones **FCM V1** (la primera vez): en el menú
  elige *Android → preview → Google Service Account → Manage your Google
  Service Account Key for Push Notifications (FCM V1) → Upload* y selecciona el
  JSON de la cuenta de servicio de Firebase (`C:\secure\...`).
- Aceptar crear la firma de Android (la primera vez).

Al terminar (≈15 min) te da el enlace del `.apk` para compartir.

Si dice que el proyecto pertenece a otra cuenta de Expo, ejecuta en
`moto_unc_mobile`: `npx eas-cli@latest init --force` y vuelve a intentarlo.
