# Auditoría LITHIO, 2026-11-08

Alcance: backend FastAPI (`lithio_backend/app`), panel (`lithio_dashboard`), app Expo (`lithio_mobile`), Docker/Railway y preparación para Google Play.
No había informe previo en `docs/` (solo DESPLIEGUE, ORGANIZACION_PROYECTO, GEMINI_CONTEXT y legal). No se hizo commit, push ni despliegue.

## Resultado general

La base es sólida: autenticación con Firebase en todas las rutas privadas, `require_admin` verificado al arrancar para toda ruta `/admin`, tarifa calculada en el servidor (no la envía el teléfono), datos sensibles cifrados (Fernet + índice ciego), CORS sin comodín, `/docs` cerrado, WebSocket autenticado por mensaje inicial, subidas validadas por contenido, saldo con bloqueo de fila, límites de peticiones en acciones sensibles, panel con escape de HTML, sin secretos en git ni en el historial (91 commits revisados con patrones de claves). `pytest`: 206 pruebas pasaban antes; ahora 211. `ruff` y `tsc --noEmit` limpios.

## Hallazgos y estado

### Alto
| # | Hallazgo | Dónde | Estado |
|---|---|---|---|
| A1 | `eas.json` solo tenía el perfil `preview` (APK). Google Play exige AAB. | `lithio_mobile/eas.json` | CORREGIDO: perfil `production` (`app-bundle`, `autoIncrement`, canal `production`) y `submit` a pista interna en borrador. |
| A2 | Las variables `EXPO_PUBLIC_*` (API URL, Firebase) viven en `.env` local, que EAS en la nube no lee. Un AAB compilado sin ellas apunta a `localhost`. | `lithio_mobile/src/config/api.ts:25-47`, `.env.example` | PENDIENTE del dueño: crear las variables en EAS (entorno `production`), ver pasos. |
| A3 | Carrera al completar un viaje: dos PUT simultáneos leían `en_curso` y podían pagar Fe/diamantes dos veces en PostgreSQL. | `app/main.py:1363` (`update_ride_status`) | CORREGIDO: `with_for_update()` sobre la fila del viaje. Prueba de doble finalización. |

### Medio
| # | Hallazgo | Dónde | Estado |
|---|---|---|---|
| M1 | El tope diario de 3 viajes premiados por pareja contaba desde medianoche UTC (8 pm en Venezuela). El resto de la app usa medianoche de Venezuela. **Toca una regla de negocio: ahora el día es el de Venezuela.** | `app/main.py:1415` | CORREGIDO + prueba. |
| M2 | Envíos entre usuarios: bloqueos en orden emisor-receptor (interbloqueo posible con envíos cruzados en PostgreSQL) y límite diario revisado antes del bloqueo (envíos simultáneos podían saltarlo). Igual en donaciones. | `app/routers/wallet.py:173-215` | CORREGIDO: bloqueo en orden de id y límite revisado con el bloqueo puesto. |
| M3 | Verificación del webhook de WhatsApp: sin `WHATSAPP_WEBHOOK_VERIFY_TOKEN` configurado, un `hub.verify_token` vacío era aceptado; comparación no constante. | `app/main.py:227-234` | CORREGIDO + 2 pruebas. |
| M4 | `RideCreate` sin límites de largo (`payment_reference`, `origin`, `destination`, etc.): cuerpo grande cifrado y guardado. | `app/schemas.py:250` | CORREGIDO: `max_length`. |
| M5 | Reseña duplicada simultánea (`ride_id` único) respondía 500. Promedio cargaba todas las reseñas. | `app/main.py:1495-1520` | CORREGIDO: 400 limpio y `AVG()` en SQL. |
| M6 | Sin índices en `rides` (pasajero/conductor + estado) y N+1 en solicitudes pendientes del conductor. | `app/models.py:104`, `app/main.py:1176` | CORREGIDO: índices (`seed.ensure_columns`, se crean al arrancar, también en PostgreSQL) y `joinedload`. |
| M7 | `isTrustedServer` acepta cualquier `*.trycloudflare.com` para la dirección leída de Firestore `config/server`, y esa dirección recibe el token de sesión. Si alguien puede escribir ese documento, roba tokens. | `lithio_mobile/src/config/api.ts:57-66` | PENDIENTE (no cambié el flujo de desarrollo). Para producción: confirmar reglas de Firestore (solo lectura pública, escritura solo admin) y, mejor, quitar `trycloudflare` y Firestore del APK de Play. |
| M8 | Sin migraciones versionadas (Alembic): `seed.py` hace `ALTER TABLE` a mano. Funciona, pero un cambio de esquema no trivial en producción es riesgoso. | `app/seed.py:131-150` | PENDIENTE (recomendado tras el lanzamiento). |
| M9 | `verify_id_token(check_revoked=True)` consulta a Firebase en cada petición: latencia y cuota con muchos usuarios. | `app/auth.py:116` | PENDIENTE: decisión de seguridad/rendimiento; evaluar caché corta del token verificado. |

### Bajo / informativo
- Limitador de peticiones en memoria (1 instancia, ya documentado); los contadores de usuarios inactivos no se purgan (`app/rate_limit.py:22`).
- La creación de viaje valida "sin viaje activo" y "conductor libre" antes de insertar, sin restricción única en la base: dos solicitudes simultáneas del mismo pasajero podrían crear dos viajes (bajo, SQLite serializa; en PostgreSQL requeriría índice único parcial, cambia esquema).
- `print` en `main.py:260,326` en vez de `logging`.
- `npm audit --omit=dev`: 11 avisos (zod alto, deepmerge/glob/minimatch moderados), todos transitivos de Expo; el arreglo forzado baja a Expo 57. No afectan al servidor; revisar al actualizar Expo.
- Dependencias de Python: `fastapi 0.141.1` (hay 0.162), `psycopg 3.3.6`, otras con parches. `pip-audit` no está instalado; PENDIENTE correrlo (`pip install pip-audit && pip-audit -r requirements.txt`).
- `lithio_mobile/google-services.json` existe localmente (ignorado por git, correcto).
- Hay cambios sin commit del dueño en `TripRequestScreen.tsx` y la guía .docx; no los toqué.
- Pagos: no hay pasarela. Diamantes son saldo interno, recargas/retiros los revisa un administrador a mano. Google Play podría pedir aclarar que las "recargas" son un monedero interno sin contenido digital (ver pasos).
- Ubicación: la app no pide permisos de ubicación ni GPS (confirmado: sin `expo-location`, sin permisos en `app.json`). No hace falta justificación de ubicación en Play. Permisos reales: cámara y fotos (foto de perfil/comprobantes), notificaciones, internet.

## Archivos cambiados
- `lithio_backend/app/main.py`, `app/schemas.py`, `app/routers/wallet.py`, `app/seed.py`
- `lithio_backend/tests/test_audit_2026_11_08.py` (nuevo, 5 pruebas)
- `lithio_mobile/eas.json`
- `docs/auditoria-2026-11-08.md`

## Pasos para publicar en Play Store

Requieren cuentas/claves del dueño (no las tengo):
1. Servidor en producción con HTTPS (Railway, ver `docs/DESPLIEGUE.md`): `APP_ENV=production`, `DATABASE_URL` (PostgreSQL), `LITHIO_ENCRYPTION_KEYS`, `LITHIO_HASH_KEY` (respaldadas fuera del repo), `FIREBASE_*`, `ADMIN_FIREBASE_UIDS`, `ADMIN_EMAILS`, `CONTACT_EMAIL`, `CORS_ALLOWED_ORIGINS`, `MEDIA_DIR/EVIDENCE_DIR` en volumen. Probar `https://TU-DOMINIO/health`. Con la base nueva en PostgreSQL, ejecutar `python -m app.migrate_to_cloud` solo si se quieren conservar los datos de prueba (mejor lanzar con base limpia).
2. Respaldar y guardar la copia de las claves de cifrado; sin ellas los datos no se recuperan.
3. Firebase: añadir la huella SHA-1/SHA-256 de la clave de firma de Play (App signing, en la consola de Play) al app Android `com.lithio.app`, descargar el `google-services.json` nuevo (Google Sign-In falla sin esto). Subirlo a EAS como variable de archivo `GOOGLE_SERVICES_JSON`. Revisar reglas de Firestore (M7).
4. EAS: `eas env:create` para el entorno `production` con `EXPO_PUBLIC_API_URL` (https del servidor) y las `EXPO_PUBLIC_FIREBASE_*`. Ver `lithio_mobile/.env.example`.
5. Subir `version`/`versionCode`: `autoIncrement` ya lo hace con `appVersionSource: remote`. Compilar: `cd lithio_mobile && npx eas build -p android --profile production` (genera el AAB).
6. Play Console (cuenta de desarrollador, tarifa única de 25 USD): crear la app; ficha con descripción, íconos 512x512, imagen destacada 1024x500, mínimo 2 capturas de teléfono.
7. Política de privacidad: URL `https://TU-DOMINIO/privacidad`. Eliminación de cuenta (requisito de Play, también la web): `https://TU-DOMINIO/eliminar-cuenta`. Verificar que ambas texto reflejan datos reales (cédula, teléfono, foto, datos de pago del conductor, correo).
8. Formulario "Seguridad de los datos": datos recogidos = nombre, correo, teléfono, cédula (ID oficial), fotos, información de pago del conductor, identificadores de dispositivo (token push); cifrados en tránsito (HTTPS) y en reposo; el usuario puede pedir eliminación.
9. Clasificación de contenido, público objetivo (universitarios, 18+ recomendado), declaración de anuncios (sin anuncios), declaración de permisos.
10. Cuentas de revisión: crear un usuario de prueba y un conductor aprobado y darle las credenciales a Google en "Acceso a la app". Nota: el registro exige Gmail verificado; dar una cuenta Gmail de prueba ya verificada.
11. Subir el AAB a la pista interna (`npx eas submit -p android --profile production` con la clave de servicio de Play, o manual), probar con 3-5 testers, luego pasar a producción. Las cuentas personales nuevas deben cumplir la prueba cerrada de 12 testers durante 14 días antes de producción.
12. Después del lanzamiento: correr `pip-audit`, planificar Alembic, vigilar `logs/seguridad.log`.

## Comandos
Backend (desde `lithio_backend`):
```
.\venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
.\venv\Scripts\python.exe -m pytest -q
.\venv\Scripts\python.exe -m ruff check app tests
```
App (desde `lithio_mobile`): `npx expo start`, `npm run typecheck`.
