# Contexto técnico del proyecto LITHIO para Claude o Gemini

Este documento describe el estado del código de LITHIO en el repositorio al momento de su creación. Sirve como contexto inicial para analizar, explicar o continuar el desarrollo; no sustituye la lectura del código cuando se vaya a modificar una función concreta.

## Instrucción inicial para el asistente

Lee este contexto como una descripción del estado actual, no como una especificación de que todas las funciones estén terminadas. Antes de proponer cambios, revisa los archivos involucrados y comprueba cómo se conecta cada pantalla con la API. Conserva el nombre del producto **LITHIO**, el stack y la estructura existentes; no reanimes ni uses como backend oficial la carpeta histórica `app/`. Distingue claramente entre funciones implementadas, funciones parciales y propuestas futuras. No inventes credenciales ni pongas secretos en el repositorio.

## 1. Qué es el proyecto

**LITHIO** significa **Linked Intelligent Transport for Higher Innovative Opportunities** (Transporte Inteligente Vinculado para Oportunidades Innovadoras). Es un proyecto universitario de movilidad comunitaria pensado inicialmente para conectar pasajeros y conductores de moto de la comunidad UNC y zonas cercanas: campus/rectorado, Biblioteca, IVIC, San Antonio de los Altos y Caracas.

La propuesta principal es un **directorio comunitario de conductores de confianza**, no una plataforma que dependa de rastreo GPS continuo. El pasajero puede elegir directamente a un conductor. La tarjeta pública móvil hoy muestra nombre, avatar, moto/color, disponibilidad, casco y nivel; aunque el planteamiento del producto menciona placa y reputación, la tarjeta actual no presenta la placa, el promedio de estrellas ni el contador de viajes. La aplicación móvil contiene modos de pasajero y conductor. La gamificación usa **Fe (hierro)** como saldo de recompensas; “puntos” sigue siendo el nombre usado en varios campos internos de la base de datos y API.

El producto incluye tres piezas:

1. Aplicación móvil React Native + Expo + TypeScript.
2. Backend API FastAPI + Python + SQLAlchemy + SQLite.
3. Panel web administrativo estático en HTML, CSS y JavaScript.

## 2. Estructura que se debe considerar oficial

```text
/
├── lithio_backend/           # Backend oficial
│   ├── app/
│   │   ├── auth.py             # Verificación de identidad Firebase y autorización admin
│   │   ├── database.py         # Engine, sesiones y dependencia de DB
│   │   ├── main.py             # Aplicación FastAPI, endpoints y WebSocket
│   │   ├── models.py           # Modelos SQLAlchemy
│   │   ├── schemas.py          # Contratos/validación Pydantic
│   │   └── seed.py             # Migración ligera y datos iniciales
│   ├── tests/test_api.py       # Pruebas de API, permisos, viajes y gamificación
│   ├── requirements.txt
│   └── firebase-config.example
├── lithio_dashboard/         # Panel administrativo web (HTML/CSS/JS)
├── lithio_mobile/            # Aplicación React Native / Expo
│   ├── App.tsx                 # Composición de pantallas y estado principal
│   └── src/
│       ├── components/         # Componentes de viaje, rutas, conductor, reseñas y Fe
│       ├── constants/          # Tema visual
│       ├── screens/            # Bienvenida, autenticación, inicio y programación
│       ├── services/           # API, Firebase Auth y WebSocket
│       └── types/              # Tipos TypeScript
├── ORGANIZACION_PROYECTO.md
├── README.md
├── iniciar_servidor.bat        # Servidor en esta PC
├── iniciar_app.bat             # Expo (app en el teléfono, misma Wi-Fi)
├── iniciar_todo.bat            # Servidor + Expo
├── iniciar_publico.bat         # Túnel público para los APK (fuera de la Wi-Fi)
├── generar_apk.bat / publicar_actualizacion.bat / desplegar_nube.bat
```

Todo el proyecto usa el nombre LITHIO: carpetas `lithio_*`, identificador de Android `com.lithio.app` y base `lithio_backend/lithio.db`.

## 3. Tecnologías y responsabilidades

- **Móvil:** React Native, Expo, TypeScript, React 19, Firebase JS SDK y AsyncStorage para persistir la sesión Firebase en React Native.
- **Backend:** FastAPI, Pydantic v2, SQLAlchemy 2 y SQLite. La documentación interactiva de FastAPI queda disponible en `/docs`.
- **Autenticación:** Firebase Authentication para correo y contraseña; el backend valida Firebase ID tokens mediante Firebase Admin SDK. La autenticación real y el perfil de aplicación son dos partes coordinadas: Firebase prueba la identidad y la tabla `users` contiene el perfil LITHIO.
- **Tiempo real:** WebSocket en `/ws`, autenticado con un primer mensaje JSON `{"type":"AUTH","token":"<Firebase ID token>"}`. Se utiliza para solicitudes de viaje, cambios de estado y disponibilidad.
- **Panel:** HTML, CSS y JavaScript sin framework. Llama la API y usa Firebase Identity Toolkit para iniciar sesión con Firebase, luego comprueba privilegios administrativos con el backend.
- **Base de datos:** SQLite local para desarrollo/demostración. La migración a un servicio administrado o a PostgreSQL no está implementada automáticamente.

## 4. Funciones de la aplicación móvil

### Entrada y cuentas

- Pantalla de bienvenida con elección de pasajero o conductor, e inicio de sesión.
- Registro separado de pasajero y conductor.
- Los datos del pasajero incluyen nombre, apellido, edad, teléfono, correo y avatar opcional.
- El conductor registra también modelo/color de moto, placa, casco disponible y datos de pago admitidos por el perfil.
- Inicio de sesión de correo/contraseña contra Firebase; después se consulta `/api/users/me` para obtener el perfil de LITHIO.
- La app obtiene el token Firebase y lo adjunta como `Authorization: Bearer ...` en peticiones protegidas.

### Modo pasajero

- Inicio con saldo Fe, acceso a solicitar viaje, programarlo, ver recompensas y abrir perfil.
- Selección de ruta predefinida con tarifa y duración estimada, posibilidad de invertir origen/destino y entrada manual de origen/destino.
- Catálogo inicial de rutas UNC–Biblioteca, UNC–Redoma de San Antonio, UNC–IVIC, Biblioteca–Redoma y rutas hacia Caracas. Las rutas también vienen del backend y pueden administrarse en el panel.
- Listado de conductores para seleccionar directamente. Las tarjetas muestran datos públicos del conductor, moto, disponibilidad, valoración, viajes y nivel; no deben exponer información financiera.
- Solicitud de viaje inmediato o programado con selección de efectivo o Pago Móvil y campo de referencia para Pago Móvil.
- Tarjeta del viaje con sus estados; el backend acredita Fe al pasajero al completarse el viaje.
- Reseña posterior al viaje con estrellas, etiquetas y comentario. El backend exige que sea un viaje completado y que el texto tenga al menos 25 caracteres, cuatro palabras distintas y describa el viaje para otorgar los 5 Fe.
- Tienda de recompensas: ver saldo/costo, canjear Fe y mostrar el código generado por el backend.

### Modo conductor

- Registro con la información personal, de la moto y disponibilidad.
- Interruptor de disponibilidad (disponible/fuera de servicio), propagado por el backend y notificado por WebSocket.
- El backend dispone de endpoints protegidos para consultar solicitudes pendientes del conductor y actualizar su estado: aceptar, rechazar, marcar en camino, iniciar y completar.
- El WebSocket puede avisar de una nueva solicitud; la app muestra una alerta cuando recibe `NEW_RIDE_REQUEST`.

### Diseño visual

- App móvil en tema oscuro: fondo verde azulado profundo, tarjetas elevadas y bordes discretos, turquesa como color primario, coral como acento y dorado para Fe.
- Interfaz en español, con tarjetas, chips, emojis/íconos, modales inferiores y navegación/pantallas simples.
- El panel web comparte el fondo oscuro y paleta turquesa/coral/dorada; usa paneles translúcidos tipo “glass”, navegación lateral, tarjetas de estadísticas, tabla/listas, formularios modales y estados de conexión.

## 5. Funciones del backend y contratos principales

### Modelos persistidos

- `User`: perfil, correo, teléfono, rol (`pasajero`, `conductor`, `ambos`; también se usa `admin`), Firebase UID, saldo `points` y nivel.
- `DriverProfile`: moto, placa, casco, disponibilidad, valoración, contador de viajes y datos financieros (Pago Móvil, cuenta y Binance).
- `Route`: origen, destino, tarifa USD, duración estimada, popularidad y etiqueta.
- `Ride`: pasajero/conductor, ruta, horario, estado, método/referencia de pago, tarifa y recompensa Fe.
- `Review`: viaje único, pasajeros/conductor, rating, etiquetas, comentario y Fe entregado.
- `Reward`: nombre, descripción, coste Fe, descuento, icono y estado activo.

### Rutas HTTP relevantes

- **Configuración/autenticación:** `GET /api/auth/config` entrega la configuración pública web de Firebase cuando el backend está configurado.
- **Catálogos públicos:** `GET /api/routes`, `GET /api/drivers`, `GET /api/gamification/rewards` y `GET /api/gamification/leaderboard`.
- **Perfil y rol autenticados:** `GET /api/users/me`, `GET /api/users/me/financial`, `GET /api/users/{user_id}` (propietario/admin) y `POST /api/users/{user_id}/switch-role`.
- **Registro:** `POST /api/passengers/register` y `POST /api/drivers/register`; la identidad Firebase debe corresponder al correo declarado.
- **Conductor:** `PUT /api/drivers/{driver_id}/availability` y `GET /api/rides/driver/{driver_id}/pending`.
- **Viajes:** `POST /api/rides`, `GET /api/rides/active/{user_id}` y `PUT /api/rides/{ride_id}/status`.
- **Reseñas/Fe:** `POST /api/reviews`, `POST /api/gamification/redeem`.
- **Administración:** `GET /api/admin/me`; CRUD de rutas (`/api/admin/routes`), conductores (`/api/admin/drivers`), recompensas (`/api/admin/rewards`) y actualización del perfil admin (`/api/admin/profile/{user_id}`). Las rutas administrativas exigen `require_admin`.
- **WhatsApp:** `GET/POST /webhooks/whatsapp` para verificación/recepción básica del webhook de Meta.

El flujo de estados implementado es `solicitado → aceptado → en_camino → en_curso → completado`, con rechazo desde solicitud y cancelación por los participantes en estados permitidos. La API comprueba quién puede realizar cada transición. Al completar, suma la recompensa configurada al pasajero e incrementa el contador del conductor. Un viaje completado puede tener una sola reseña.

## 6. Seguridad y privacidad ya presentes

- El backend verifica tokens Firebase ID y comprueba revocación (`check_revoked=True`).
- El UID verificado se vincula al perfil local; una vinculación por correo requiere correo verificado.
- No se confía en el ID de usuario enviado por la app para identificar al usuario: la API deriva al usuario de la identidad autenticada y compara los parámetros de ID con esa identidad.
- El cambio de rol no permite elevarse a administrador y requiere un perfil de conductor antes de activar ese rol.
- Los datos financieros del conductor se exponen a su propietario en `/api/users/me/financial` y al pasajero solo en el contexto del viaje cuando procede; la lista pública usa un esquema limitado.
- El panel no muestra contenido de administración hasta validar la sesión Firebase y consultar `/api/admin/me`.
- CORS usa una lista de orígenes configurada y rechaza `*`.
- Las credenciales de Firebase Admin deben permanecer fuera del repositorio. Los archivos `firebase-config.example` son plantillas sin credenciales funcionales.

## 7. Panel administrativo

Vistas: **Resumen**, **Conductores**, **Rutas**, **Recompensas** y **Perfil**. El administrador inicia sesión con correo/contraseña de Firebase. El panel carga los datos mediante la API y permite:

- Crear, editar y retirar conductores.
- Crear, editar y eliminar rutas (origen/destino, tarifa, duración y etiqueta).
- Crear, editar y eliminar recompensas (descripción, coste Fe, porcentaje de descuento).
- Editar nombre, correo y teléfono del perfil administrativo.
- Consultar el número de conductores y rutas, y ver el estado de conexión.

El formulario contiene un campo “Ciudad principal”, pero el endpoint del backend no guarda ese campo. El indicador de Fe del resumen está escrito como `0` en el JavaScript y no es un agregado real de la base de datos.

## 8. Datos semilla y configuración de desarrollo

- `seed.py` crea las tablas y el catálogo inicial de rutas/recompensas, sincroniza nombres antiguos hacia Fe/LITHIO y añade de forma compatible columnas de Pago Móvil que podrían faltar en una base previa.
- Hay un perfil de demostración asociado a Jairo y un perfil pasajero de prueba en la lógica de semilla. No se deben tratar estos datos como cuentas de producción ni como credenciales de acceso.
- Backend: archivo `.env` local con `FIREBASE_PROJECT_ID`, `FIREBASE_SERVICE_ACCOUNT_PATH`, `ADMIN_FIREBASE_UIDS`, `FIREBASE_WEB_API_KEY`, `FIREBASE_AUTH_DOMAIN` y `CORS_ALLOWED_ORIGINS`.
- App: copiar `lithio_mobile/firebase-config.example` a `.env` y completar las variables `EXPO_PUBLIC_FIREBASE_*` y `EXPO_PUBLIC_API_URL`. La URL debe apuntar a una dirección accesible desde el dispositivo, no necesariamente `localhost`.
- Panel: lo sirve el backend en `/dashboard`.
- Scripts Windows: `iniciar_servidor.bat`, `iniciar_app.bat`, `iniciar_todo.bat`, `iniciar_publico.bat`, `generar_apk.bat`, `publicar_actualizacion.bat` y `desplegar_nube.bat`. También hay instrucciones en `README.md`, `ORGANIZACION_PROYECTO.md` y `DESPLIEGUE.md`.
- La configuración del paquete móvil indica Expo, Android/iOS/web y mantiene el identificador Android `com.lithio.app`.

## 9. Lo implementado, lo parcial y lo futuro

No describir como completado lo que sigue siendo parcial:

- **Pagos:** en los viajes se aceptan efectivo y Pago Móvil. El backend rechaza pago con Fe/Diamantes. No hay procesador de pagos, transferencia, recarga ni saldo de Diamantes integrado. Los datos bancarios se guardan como datos del perfil, no se realiza el pago.
- **Ubicación:** las rutas son textos/valores predefinidos o introducidos manualmente. No hay mapa, geocodificación ni rastreo GPS en vivo.
- **Tiempo real del conductor:** existe backend para listar solicitudes pendientes y notificar por WebSocket, pero el cliente móvil actualmente maneja la notificación `NEW_RIDE_REQUEST` con una alerta; no convierte ese mensaje en un `activeRide` ni consulta automáticamente el endpoint de pendientes. Por tanto, no asumir que el flujo completo de aceptar una solicitud entrante está terminado en la interfaz.
- **Persistencia del rol en la app:** el botón de alternar modo en la pantalla principal cambia estado local. Aunque el backend tiene `switch-role`, la interfaz actual no invoca ese endpoint al alternar.
- **Recuperación de viaje:** `apiService` incluye lectura de viaje activo, pero el flujo principal actual no restaura automáticamente un viaje activo después de reiniciar la app.
- **Métricas:** algunas cifras del panel del conductor (por ejemplo, viajes, rating y porcentaje de casco) son valores fijos de presentación, no datos del perfil consultados al backend.
- **WhatsApp:** se intenta mandar una alerta Cloud API si hay token e ID de número; los webhooks solo hacen verificación y recepción básica. No es un flujo robusto de procesamiento/confirmación de mensajes.
- **Clasificación:** existe endpoint de leaderboard, pero no aparece integrado como pantalla en la app.
- **Social login:** no asumir que Google/Facebook u otros proveedores están terminados solo porque haya botones/UI relacionados; el servicio autenticador principal verificado utiliza email/contraseña.
- **Plataforma de producción:** no hay despliegue, migración automatizada a PostgreSQL, gestión de secretos remota ni proveedores de pago de producción definidos en este repositorio.

## 10. Recorrido técnico de los flujos principales

### Conexión entre app y backend

1. El usuario crea cuenta o inicia sesión en Firebase Authentication desde la app.
2. `lithio_mobile/src/services/firebase.ts` inicializa Firebase y la persistencia de la sesión; `getFirebaseIdToken()` obtiene el ID token.
3. `authenticatedFetch()` añade el token como Bearer a peticiones protegidas.
4. `lithio_backend/app/auth.py` valida el token con Firebase Admin SDK, resuelve UID/correo y busca o vincula el perfil local.
5. FastAPI usa dependencias para obtener el usuario autenticado, autorizar acciones y abrir una sesión SQLAlchemy.
6. `lithio_backend/app/database.py` conecta con SQLite. `models.py` define tablas; `schemas.py` define respuestas y entradas Pydantic.
7. `lithio_mobile/src/services/api.ts` agrupa llamadas al backend; `App.tsx` administra el estado de pantalla y viaje, mientras los componentes renderizan la interfaz.

Las rutas, lista pública de conductores y recompensas se consultan con endpoints públicos. Las operaciones de usuario y viaje que cambian datos requieren el token. Para tiempo real, el cliente abre `/ws` y envía un mensaje `AUTH` con el ID token antes de recibir notificaciones.

### Flujo de pasajero (implementación actual)

Bienvenida → registro/inicio de sesión de pasajero → carga de perfil LITHIO → selección de ruta frecuente o manual → selección de conductor disponible → confirmación con efectivo o Pago Móvil → solicitud al backend → intento de notificación al conductor por WebSocket/WhatsApp → avance del viaje en estados → reseña después de completar → acreditación/canje de Fe.

El backend confirma la identidad por token, no por el `passenger_id` de la URL. Las opciones visuales no equivalen a pagos procesados: Pago Móvil es un acuerdo externo entre usuario y conductor.

### Flujo de conductor (diseño y estado actual)

Bienvenida → registro/inicio de sesión → perfil de conductor con moto, placa, disponibilidad y datos de pago → cambio de disponibilidad → recibir solicitud → aceptar/rechazar → avanzar estados → completar.

La API tiene endpoints para pendientes y transiciones, pero la app no conecta aún todos esos pasos en pantalla: la notificación entrante solo presenta una alerta, sin hidratar el viaje activo ni exponer las acciones al conductor. Ver errores confirmados abajo.

## 11. Notificaciones: lo disponible hoy

- **WebSocket:** `ConnectionManager` mantiene una conexión activa por ID de usuario en el proceso del backend. Envía `NEW_RIDE_REQUEST` al conductor elegido, `RIDE_STATUS_UPDATED` al pasajero y `DRIVER_AVAILABILITY_CHANGED` a los clientes conectados. La app intenta reconectar cada tres segundos.
- **Límite operativo:** el gestor es memoria local de un proceso, no un servicio distribuido; varias réplicas del backend necesitarían un broker/pub-sub compartido. El cliente actual muestra alertas para solicitudes/estados, pero no persiste esos eventos ni actualiza correctamente el viaje de la pantalla.
- **WhatsApp:** si están configurados `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` y el teléfono del conductor, el backend intenta enviar un mensaje de texto con origen, destino, tarifa y horario a través de WhatsApp Cloud API. La respuesta del endpoint de viaje incluye un estado básico (`sent`, `failed` o `not_configured`).
- **Webhook WhatsApp:** el GET implementa el desafío de verificación; el POST actual solo recibe el JSON, imprime el tipo de objeto y contesta recibido. No valida firma, no procesa mensajes ni estados y no tiene persistencia/reintentos.
- **SMS:** no hay integración SMS, proveedor, endpoint ni configuración en el repositorio.
- **Entregabilidad:** no hay confirmación durable de que el conductor haya leído/aceptado ni mecanismo de reintento. No presentar WhatsApp/SMS como sistema de notificaciones de producción.

## 12. Gamificación y tokens: reglas existentes frente a ideas

### Implementado

- El saldo se almacena como entero `User.points`, mostrado en UI como Fe.
- El registro de usuario otorga 100 Fe de bienvenida.
- Cada viaje exitoso otorga 15 Fe al pasajero y 15 Fe al conductor; el backend incrementa también el contador de viajes del conductor.
- Una reseña elegible otorga 5 Fe al pasajero. Debe corresponder a su viaje completado, no existir otra para ese viaje, tener 25 caracteres, cuatro palabras distintas y al menos una palabra relacionada con la experiencia del viaje.
- El catálogo de recompensas permite definir costo y porcentaje de descuento; el canje descuenta el costo si el saldo alcanza y genera un código con formato `LITHIO-<descuento>OFF-<user_id>`.
- Existe leaderboard de conductores y pasajeros en el backend.

### No implementado / propuesta por definir

- No hay modelo separado de “token”, cartera, transferencia de Fe, recarga, retiro, conversión a dinero ni liquidación financiera.
- La idea de conceder **20 Fe por aprobar/pasar materias** no existe en modelos, API ni app. Antes de implementarla se debe definir cómo se verifica la nota, quién la aprueba, límites por materia/período, prevención de abuso, auditoría y si “20” significa Fe, puntos o unidades distintas.
- El código de descuento es una cadena generada, no una orden/cupón validado en caja ni un sistema que impida reutilizarlo. No hay historial de canjes ni registro contable de movimientos.
- La leaderboard no se expone actualmente como pantalla móvil.

## 13. UI/UX e identidad del producto

- **Nombre visible:** LITHIO. Nombre largo: *Linked Intelligent Transport for Higher Innovative Opportunities*. Mantener los identificadores técnicos existentes por compatibilidad.
- **Público/ámbito inicial:** comunidad universitaria UNC, IVIC, San Antonio de los Altos, Los Teques y conexiones hacia Caracas, según rutas semilla y documentación.
- **Estilo actual:** oscuro, tecnológico y comunitario; idioma español; tarjetas redondeadas, jerarquía clara, botones táctiles, modales, indicadores de estado y uso expresivo de iconos/emojis.
- **Colores móvil:** fondo `#10191C`, tarjetas `#1B292B`/`#243638`, turquesa `#45D6C5`, coral `#FF765E`, dorado `#FFC857`, texto claro y secundario gris azulado.
- **Panel web:** gradiente oscuro, superficies translúcidas, desenfoque, tipografías web Inter/Outfit y la misma paleta.
- **Identidad que no debe confundirse:** el valor de marca es comunidad/conexión y elección de conductor de confianza; no se debe describir como una app ya basada en mapa y seguimiento GPS en tiempo real.

## 14. Seguridad, datos sensibles y consideraciones legales

### Lo que el código almacena o transmite hoy

- El perfil recoge nombre, apellido, edad, correo, teléfono, avatar, rol y UID de Firebase.
- El perfil de conductor puede guardar placa, modelo/color de moto, casco y datos de Pago Móvil, cuenta bancaria y dirección Binance. Estos campos se guardan como columnas SQLite normales: **no se observa cifrado de campo a nivel aplicación**.
- No existe campo ni flujo para número de cédula/documento de identidad, fotografía del documento o verificación de identidad; no se debe asumir que se recopilan.
- Los datos privados de Pago Móvil aparecen en la respuesta de un viaje y en la tarjeta de viaje al pasajero autorizado cuando aplica. La lista pública de conductores usa un esquema reducido.
- Las plantillas de configuración indican guardar la clave privada de Firebase Admin fuera del repositorio. La clave web/API pública de Firebase se usa en cliente; no equivale a la credencial privada del servicio.
- En desarrollo hay URL HTTP/WS y el backend no fuerza HTTPS/WSS desde el código. Producción debe usar TLS en proxy/hosting y configurar orígenes/CORS apropiados.

### Requisitos antes de producción (no implementados)

- Definir finalidad y base legal/consentimiento para cada dato; solicitar solo lo necesario, decidir retención/borrado, acceso del usuario, respuesta a incidentes y política de privacidad/condiciones aplicables.
- Diseñar protección de datos financieros y cualquier documento de identidad antes de empezar a recogerlos: cifrado en tránsito y reposo, claves gestionadas fuera de la base, control de acceso mínimo, auditoría, redacción de logs, backups protegidos y reglas de retención.
- No recopilar cédulas o documentos hasta que exista necesidad clara, consentimiento y un diseño seguro; preferir un proveedor especializado para verificaciones si fueran necesarias.
- Revisar los logs y respuestas de WhatsApp; no imprimir payloads que pudieran contener datos personales.
- Obtener revisión legal local antes del lanzamiento. Este resumen técnico no constituye asesoría legal ni certificación de cumplimiento normativo.

## 15. Errores y deuda técnica observados en el código

Hallazgos por lectura estática del árbol de trabajo; no equivalen a una auditoría de seguridad ni todos fueron reproducidos ejecutando la app:

| Prioridad | Hallazgo | Efecto observable / evidencia |
|---|---|---|
| Alta | **El dashboard consulta endpoints GET administrativos que el backend no define.** `fetchData()` solicita `/api/admin/drivers`, `/api/admin/routes` y `/api/admin/gamification/rewards`; en el backend solo existen las lecturas públicas `/api/drivers`, `/api/routes` y `/api/gamification/rewards`, junto con CRUD admin de escritura. | `Promise.all` falla por las lecturas inexistentes; tras login, el panel no carga sus listas y muestra error de conexión/datos. Crear los GET administrativos o cambiar el cliente para usar endpoints existentes con autorización apropiada. |
| Alta | **La app del conductor no muestra ni carga las solicitudes recibidas.** La rama `NEW_RIDE_REQUEST` solo ejecuta `Alert.alert`; no llama a `/api/rides/driver/{id}/pending`, no asigna el viaje a `activeRide` ni permite aceptar desde esa notificación. | Aunque el backend envía la notificación y tiene endpoint de pendientes, el conductor no tiene un flujo normal en la UI para aceptar o rechazar una nueva solicitud. |
| Alta | **La pantalla del pasajero no sincroniza las transiciones del viaje.** Para `RIDE_STATUS_UPDATED` solo muestra una alerta; no actualiza `activeRide.status`. `getActiveRide()` está implementado en el servicio, pero no se invoca al entrar ni al reconectar. | La tarjeta puede permanecer en “solicitado”; el pasajero no ve los estados reales ni necesariamente llega al botón de reseña tras finalizar, y al reiniciar se pierde el viaje activo de la UI. |
| Alta | **El conductor se muestra disponible durante un viaje aceptado y la API no comprueba disponibilidad al solicitar.** El backend vuelve a marcarlo disponible al completar, pero no lo pone no disponible al aceptar; `/api/rides` tampoco rechaza conductores fuera de servicio. | Se pueden enviar varias solicitudes al mismo conductor y el directorio puede mostrarlo disponible mientras ya tiene un viaje; el cliente solo deshabilita el botón con un estado potencialmente desactualizado. |
| Media | **La acreditación local de Fe también se ejecuta al completar desde la cuenta del conductor.** `handleUpdateRideStatus()` suma `fe_awarded` al saldo visible de quien usa la app, aunque la API acredita esos Fe al pasajero. | Al completar desde la UI del conductor, su saldo local puede aumentar erróneamente; el backend conserva la atribución correcta al pasajero. |
| Media | **El cambio de modo es solo estado local y se ofrece aunque el usuario no tenga perfil de conductor.** `handleToggleRole()` no usa el endpoint de cambio de rol ni comprueba la existencia de `DriverProfile`. | Un pasajero puede entrar visualmente a modo conductor y luego recibir error 404 al cambiar disponibilidad; el modo no refleja una autorización/perfil persistente y se pierde al reiniciar. |
| Media | **Se muestran valores de perfil/estadísticas fijos.** La pantalla de perfil de `App.tsx` enseña siempre una Bera SBR 2026 roja y la vista de conductor presenta cifras fijas (142 viajes, 4.95 y 100%). | Los datos pueden no corresponder al usuario real; las métricas no están enlazadas con la API. |
| Media | **La validación del rating no impone el rango 1–5 en el backend.** `ReviewCreate.rating` es un entero sin límites Pydantic; el comentario sí tiene validación de elegibilidad. | Una llamada API puede guardar calificaciones fuera de rango y alterar el promedio del conductor. Debe aplicarse validación de servidor aunque la UI limite las estrellas. |
| Media | **Los formularios y la disponibilidad de pagos no coinciden del todo.** El registro de conductor exige al menos Binance, Pago Móvil o cuenta bancaria, aunque no hay integración de esos pagos. Además, el formulario no captura todos los campos de Pago Móvil que el backend modela (banco e identificación). | El usuario puede registrar un método que la app no procesa, y el pasajero podría no recibir todos los datos necesarios para Pago Móvil. |
| Baja | **Datos mock/cosméticos y campos sin persistencia.** El dashboard fija el indicador de Fe en `0`; el perfil web ofrece “Ciudad principal”, pero el backend no la guarda; algunas tarjetas conservan textos/etiquetas de demostración. | El panel da apariencia de datos reales donde hay valores estáticos o controles que no producen cambios persistidos. |

Priorizar antes de ampliar funcionalidades: reparar GET del dashboard, completar el flujo de conductor y la sincronización de viajes, y endurecer la consistencia de disponibilidad/rating. Confirmar la corrección con pruebas específicas de API y pruebas de interacción móvil/panel.

## 16. Pruebas y modificaciones visibles en el árbol de trabajo

`lithio_backend/tests/test_api.py` tiene pruebas de Firebase no configurado, CORS, privacidad de tarjetas/perfiles/datos financieros, vinculación de Firebase, disponibilidad, autorización y privacidad de viajes, ciclo de viaje y Fe, validación de reseñas/pagos, canje, rutas administrativas, perfil de admin, cambio de rol y WebSocket autenticado.

Entre las modificaciones que ya se ven reflejadas en el árbol de trabajo están:

- Adición de autenticación Firebase del lado servidor, configuración de administradores por UID, verificación de tokens revocados y vínculo controlado entre identidad Firebase y perfil local.
- Endurecimiento de autorización y privacidad en perfil, datos financieros, roles, disponibilidad, transiciones de viaje, reseñas, canjes, administración y WebSocket.
- Conexión de la app móvil a Firebase; uso de ID tokens en peticiones protegidas; incorporación de límites de tiempo y errores legibles para llamadas de registro/API.
- Actualización del dashboard para exigir autenticación administrativa y operar sobre perfiles, conductores, rutas y recompensas desde la API.
- Ajustes de esquemas/tipos, estado de viajes y recompensa Fe; sincronización de rutas/etiquetas heredadas y columnas financieras en la semilla.
- Ejemplos de configuración Firebase, dependencias y pruebas adicionales para los flujos autenticados.
- Actualización de README y documento de organización para declarar la estructura oficial y diferenciar el backend activo de la implementación histórica `app/`.

Al momento de elaborar este documento, esos cambios están **sin commit** en el repositorio local. El historial Git visible solo muestra dos commits (`Initial commit` y `Upload LITHIO project`). Por ello, este resumen representa el código presente en el árbol de trabajo y no debe interpretarse como una reconstrucción exhaustiva de todas las conversaciones o cada cambio histórico fuera del repositorio.

## 17. Instrucción útil para continuar

Cuando se solicite una mejora, identifica primero la pantalla, componente, servicio, endpoint, esquema/modelo y pruebas que la afectan. Mantén consistentes los contratos entre TypeScript, Pydantic y SQLAlchemy. Separa requisitos actuales de propuestas (en particular tokens por materias aprobadas, SMS, cédula y pagos). Si la petición cambia una decisión funcional importante, pregunta antes de diseñar un flujo irreversible. Añade o ajusta pruebas del backend cuando cambien autorización, privacidad, estados de viaje o gamificación. Documenta los requisitos reales de entorno, pero nunca copies claves privadas, tokens o credenciales reales a archivos versionados.
