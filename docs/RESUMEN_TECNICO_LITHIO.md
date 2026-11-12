# LITHIO: resumen técnico (estado al 11 de noviembre de 2026)

> Contexto para un asistente de IA (Gemini o Claude). Sustituye a `GEMINI_CONTEXT.md` (4 de noviembre), que quedó desactualizado. Léelo antes de tocar código.

## 1. Qué es
App de moto-taxi universitario para la comunidad de la UNC y del IVIC (Altos Mirandinos, Venezuela). Tiene dos roles en la misma cuenta, **pasajero** y **conductor** (el conductor pasa por una postulación aprobada por el administrador), y un **panel de administración**.

- **Monedas:**
  - **Iones (Li⁺):** saldo prepagado, 1 Li⁺ = 1 USD, mostrado en Bs a la tasa del BCV. Antes se llamaban "Diamantes"; en la base de datos y en la API el valor sigue siendo `diamantes` y los campos `diamonds_*`.
  - **Hierro (Fe):** puntos de recompensa.
- **Pagos:** efectivo, Pago Móvil (con referencia y captura), iones y pases de combo. Binance Pay se usa solo para recargar.
- **Identidad:** química del litio. El logo es el átomo 2+1 y el sello es el monograma "Li" (ver `docs/marca/Guia_de_marca_LITHIO.md`).

## 2. Árbol de directorios (lo relevante)
```
hopeful-galileo/
├── lithio_mobile/            App Expo (Android + web). Es el producto principal.
│   ├── App.tsx               Raíz: fuentes, tema, sesión, OTA y elección del shell por rol
│   ├── app.json / app.config.js / eas.json   Configuración Expo y EAS (com.lithio.app, v1.0.0)
│   ├── assets/               Ícono, splash, favicon (átomo 2+1) y fuente Eva-Icons
│   ├── android/              Proyecto nativo generado (no editar a mano)
│   ├── dist-web/             Web exportada; el backend la sirve en /app
│   └── src/
│       ├── shells/           PassengerApp.tsx, DriverApp.tsx: navegación por pestañas y estado global de cada rol
│       ├── screens/          Auth*, PassengerSignIn/SignUp, DriverSignIn/SignUp, TermsGate, VerifyEmail, UpdateRequired
│       │   ├── passenger/    PassengerHome, TripRequestScreen
│       │   ├── driver/       DriverHome, DriverApplicationScreen, DriverReviewsScreen
│       │   ├── shared/       Trips, RidesList, RideDetail, Wallet, Account, Profile, Level, LevelsTable, Links, Quiz
│       │   └── admin/        AdminScreen
│       ├── components/       Modales y hojas: RequestRideModal, ActiveRideCard, WalletActionSheet, FeStoreModal, Tutorial, About…
│       │   ├── brand/        LithiumAtom (logo animado), LiSeal (sello), PeriodicTile, ElementTile, PressableScale, PrimaryButton, PulseRing…
│       │   ├── ui/           Motion (animaciones), Decor (títulos, rombos, órbitas, EmptyState), GlassSurface, Feedback, Avatar, ScreenHeader…
│       │   ├── nav/          BottomTabBar
│       │   ├── driver/ home/ admin/
│       ├── services/         api.ts (cliente HTTP), auth/firebase/socialAuth, websocket, notifications, liveUpdates (OTA),
│       │                     remoteTheme, termsGate, rates (BCV), haptics, session, deviceSession…
│       ├── hooks/            useRideCenter (viaje activo en tiempo real), useAdminAlerts
│       ├── constants/theme.ts  Paletas oscura y clara, fuentes, radios, sombras; estilos con themed(() => ({…}))
│       ├── theme/ThemeMode.tsx  Cambio de modo oscuro o claro
│       ├── utils/            text.ts (nombres de lugares y personas), validation, elements (niveles químicos), registrationOptions
│       ├── config/api.ts     URL del backend
│       └── types/index.ts    Tipos compartidos (Ride, PaymentMethod, etc.)
├── lithio_backend/           API FastAPI + SQLAlchemy
│   ├── app/
│   │   ├── main.py           App, rutas principales (registro, viajes, rutas, conductores, admin, /ws, /app web)
│   │   ├── routers/          wallet, fe_store, profile, links, quiz, rates, recovery, retention, ride_details,
│   │   │                     driver_applications, legal, theme, app_version
│   │   ├── models.py         Tablas: User, DriverProfile, Route, Ride, Review, WalletTransaction, WorkshopReward, Link,
│   │   │                     QuizAnswer, Coupon, GradeVoucher, ExchangeRate, PerkGrant, DemandEvent, StreakFreeze
│   │   ├── auth.py           Verificación de tokens de Firebase (revocación y política de correo verificado)
│   │   ├── wallet_service.py Saldo en centavos y límites (envío Li⁺ 50, diario Li⁺ 100, recarga Li⁺ 500)
│   │   ├── realtime.py / push_service.py   WebSocket y notificaciones push de Expo
│   │   ├── rate_limit.py, security_log.py, crypto.py, validation.py   Seguridad
│   │   ├── tema_app.py       Tema remoto (colores y escala de letra) que la app aplica sin APK
│   │   ├── legal/            terminos.html, privacidad.html, eliminar-cuenta.html (se sirven en /terminos, etc.)
│   │   └── seed.py, quiz_questions.py   Datos semilla y preguntas por carrera de la UNC
│   ├── tests/                18 archivos pytest (255 pruebas, todas pasan al 100%)
│   ├── lithio.db             SQLite local; en la nube, PostgreSQL (psycopg)
│   └── media/ backups/ logs/ evidence/   Archivos generados (no versionar)
├── lithio_dashboard/         Panel web estático (index.html, app.js, style.css)
├── lithio_descarga/          Página de descarga del APK (index, flyer, apk.json)
├── scripts/                  PowerShell: publicar_actualizacion, reiniciar_servidor, generar_apk, exportar_web,
│                             iniciar_publico (túnel Cloudflare), desplegar_nube, aplicar_practica…
├── *.bat                     Accesos directos a esos scripts (iniciar_servidor.bat, iniciar_todo.bat…)
├── Dockerfile, docker-entrypoint.sh, railway.json   Despliegue en la nube (Railway, healthcheck /health)
└── docs/                     Guías, auditorías, marca/, legal/, play_store/, pendientes de diseño
```

## 3. Stack y versiones
| Capa | Tecnología |
|---|---|
| Móvil | Expo SDK 58, React Native 0.88, React 19.3, TypeScript, Reanimated 4.7 (API `.get()`/`.set()`), react-native-web 0.21 |
| Auth | Firebase 12 (correo, Google con @react-native-google-signin, Facebook con fbsdk-next); el backend verifica con firebase-admin 7.7 |
| Actualizaciones | expo-updates (OTA por EAS Update). `runtimeVersion` = `appVersion` (1.0.0) |
| Notificaciones | expo-notifications + Expo Push |
| Fuentes | Space Grotesk (títulos y botones), Manrope (texto y cifras tabulares), Space Mono, Eva Icons |
| Backend | Python 3.14, FastAPI 0.141, Uvicorn 0.53, SQLAlchemy 2.0, Pydantic 2.13, websockets 17, cryptography 50 |
| Base de datos | SQLite local (`lithio.db`) y PostgreSQL en la nube |
| Tamaño | Móvil: unas 20 800 líneas en 96 archivos. Backend: unas 7 000 líneas en 40 archivos, más 3 350 de pruebas |

## 4. API (resumen por grupos)
- **Público y salud:** `GET /health`, `/version`, `/theme`, `/terminos`, `/privacidad`, `/eliminar-cuenta`, `/app` (web).
- **Cuentas:** `POST /api/passengers/register`, `/api/drivers/register`, `GET /api/users/me`, `/me/summary`, `/me/financial`, `POST /api/users/{id}/switch-role`, perfil y avatar en `/api/users/me/*`, `DELETE /api/users/me`, recuperación en `/api/auth/recover`.
- **Viajes:** `GET /api/routes`, `POST /api/rides`, `PUT /api/rides/{id}/status`, `GET /api/rides/active/{user_id}`, `/rides/mine`, `/rides/driver/{id}/pending`, detalle y comprobante en `/api/rides/{id}/detail` y `/receipt`, `POST /api/reviews`.
- **Conductores:** `GET /api/drivers`, `PUT /api/drivers/{id}/availability`, postulación en `/api/drivers/me/application`, horas de demanda.
- **Billetera:** `GET /api/wallet`, `POST /api/wallet/topups|transfers|donations|withdrawals`, comprobantes, taller aliado.
- **Fe y retención:** `/api/fe-store` (cupones, vales «Pasar con 20», combos de pases), `/api/levels`, `/api/quiz/today`, rachas.
- **Enlaces (amigos):** `/api/links/*`.
- **Legal:** `GET /api/legal`, `POST /api/legal/accept` (versión en `LEGAL_VERSION`).
- **Admin:** postulaciones, conductores, recargas pendientes, vales, comprobantes, tasa BCV, taller, analítica, reseñas, rutas.
- **Tiempo real:** `WS /ws`. Webhook de WhatsApp en `/webhooks/whatsapp`.

## 5. Reglas del proyecto (obligatorias)
1. **Todo llega por OTA.** Nada de módulos nativos nuevos ni subir la versión 1.0.0, para que los APK instalados reciban los cambios. El ícono y el splash nativos solo cambian con una APK nueva.
2. **Colores siempre desde `theme`.** Los estilos se declaran con `themed(() => ({…}))`, nunca con `StyleSheet.create`. No se borran los comentarios "CAMBIA AQUÍ".
3. **Diseño:** tema oscuro petróleo (#0B1416), turquesa #45D6C5 (pasajero), coral #FF765E (conductor), oro (Fe), turquesa claro #8EE6DA (iones), rosado #FF5C7A (solo errores). Sin azules fuertes, nada infantil, sin layouts nuevos. Botones simétricos, del mismo tamaño y centrados. Textos de 11 px como mínimo.
4. **No se cambian los nombres de rutas ni el valor `diamantes` en la base de datos:** las pruebas dependen de ellos.
5. **Los textos legales** (`app/legal/*.html`) se modifican solo con aprobación del dueño. Cada flujo de registro o de pago exige aceptar los TyC.
6. **Verificación antes de publicar:** `npx tsc --noEmit` en `lithio_mobile` y `venv\Scripts\python.exe -m pytest -q` en `lithio_backend`.
7. **Publicar:** `scripts\publicar_actualizacion.ps1 -Message "…"` (OTA + web). Para que el backend tome cambios en `.py`: `scripts\reiniciar_servidor.ps1`.
8. **Expo cambió:** lee la documentación de la versión 58 (https://docs.expo.dev/versions/v58.0.0/) antes de escribir código.

## 6. Estado actual
- **Rama:** `auditoria/antigravity` (con commits limpios por fase para revertir cualquier cambio en un paso).
- **Verificado:** `npx tsc --noEmit` sin errores; 18 archivos `pytest` con 255 pruebas del backend que pasan al 100%.
- **Auditoría y endurecimiento (Fases 1 y 2):** blindaje contra BOLA/IDOR, operaciones atómicas de saldo en centavos sobre SQLite (`lithio.db`), rechazo `409 Conflict` ante referencias de Pago Móvil repetidas (normalizadas sin guiones ni espacios), validación de cabeceras mágicas (magic bytes) y protección contra Path Traversal en comprobantes/avatares, limpieza de listeners/timers en WebSockets y hooks (`useRideCenter`, `useAdminAlerts`), prevención de doble clic en acciones financieras/viajes y visualización de errores con `theme.colors.error`.
- **Funciones de producto completadas hoy (Fase 3):**
  1. **Insignia de conductor verificado con placa visible** en selección de conductor, confirmación, tarjeta de viaje activo (`ActiveRideCard`) y detalle del viaje (`RideDetailScreen`).
  2. **Compartir viaje en curso con un contacto** mediante `Share.share` nativo de `react-native` (100% compatible con OTA, sin módulos nativos nuevos).
  3. **Calificación automática justo al terminar el viaje** abriendo `ReviewModal` en cuanto el viaje pasa a `"completado"` sin reseña previa (una sola vez por sesión sin duplicarse).
  4. **Introducción de 3 pasos sobre saldo (Iones Li⁺) y Fe** (`WalletFeIntroModal`), mostrada en el primer ingreso a la billetera y accesible desde el botón de ayuda `?` en `WalletScreen` y `FeStoreModal`.
- **Trabajo visual previo (11 de noviembre):** logo átomo 2+1 (dentro de la app y en los assets), sello `LiSeal`, transición de la pestaña activa, adornos en la tarjeta del conductor, avatar con electrón de valencia, recibo troquelado en el detalle del viaje, color de error separado del coral, acrónimo en inglés retirado de la portada y "Diamantes" renombrados a "Iones (Li⁺)" en la app, el servidor y los textos legales.

## 7. Pendiente y deuda conocida
- **APK nueva:** único pendiente para que el ícono y el splash nativos del teléfono muestren el átomo 2+1 (`scripts\generar_apk.ps1`, sin cambiar la versión 1.0.0).
- **Pruebas:** no hay pruebas automáticas de la app móvil; la verificación es tsc más una revisión manual en la web y en el teléfono.
- **Comentarios:** algunos comentarios de código todavía dicen "diamantes" (es intencional donde se refieren al valor `diamantes` de la base de datos).
- `GEMINI_CONTEXT.md`, `auditoria-2026-11-08.md` y los `PENDIENTE_*.md` en `docs/` son históricos: contrástalos con el código.
- Los secretos viven en `lithio_backend/.env`, `lithio_mobile/credentials/` y `google-services.json`. No los copies a prompts ni a servicios externos.
