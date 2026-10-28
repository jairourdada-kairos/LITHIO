# LITHIO - Transporte inteligente conectado

Proyecto universitario para la materia de Programación - **Universidad Nacional de las Ciencias Dr. Humberto Fernández Morán (UNC)**.
Desarrollado por **Jairo** (Estudiante de Ingeniería en Inteligencia Artificial) en conjunto con **Anti** (Antigravity).

---

## 🎯 Objetivo & Filosofía del Proyecto

A diferencia de aplicaciones comerciales tradicionales que dependen de un rastreo GPS pesado en segundo plano, **LITHIO (Linked Intelligent Transport for Higher Innovative Opportunities / Transporte Inteligente Vinculado para Oportunidades Innovadoras)** implementa una arquitectura de **Directorio Comunitario de Confianza**:

1. **Rendimiento Ultraliviano:** Cero lag, animaciones a 60 fps y mínimo consumo de memoria y datos móviles.
2. **Selección Directa de Conductores:** El estudiante visualiza su ruta y selecciona con un toque a su conductor preferido o conocido (con datos de su moto, placa, reputación y disponibilidad).
3. **Doble Rol Integrado (Pasajero y Conductor):** En la misma app, el usuario puede alternar con un toque entre pedir una carrera o recibir solicitudes entrantes en su apartado de **Conductor**.
4. **Recompensas Fe:** Acumulación de 35 Fe por viaje completado y 20 Fe por reseña útil. Tienda para canjear descuentos y beneficios de viaje.
5. **Métodos de Pago:** Efectivo y Pago Móvil entre pasajero y conductor. Los Diamantes, recargas y transferencias están pendientes de autenticación y proveedores de pago seguros.
6. **Cobertura Estratégica:** Rectorado y Campus UNC, IVIC, San Antonio de los Altos, Los Teques y bajada por la Panamericana a Caracas (Plaza Venezuela / La Hoyada).

---

## 🛠️ Stack Tecnológico

| Componente | Tecnología | Razón de Elección |
|---|---|---|
| **App Móvil** | React Native + Expo (TypeScript) | Render nativo fluido, pruebas instantáneas en teléfonos Android con Expo Go sin necesidad de Android Studio ni emuladores pesados. |
| **Backend API** | FastAPI (Python 3.14) | Asíncrono, ultrarrápido, tipado estricto con Pydantic v2 y extensible para futuros modelos de Inteligencia Artificial. |
| **Base de Datos** | SQLite (SQLAlchemy ORM) | Liviana, sin configuración de servidores externos, portable y lista para migrar a PostgreSQL / Supabase en producción. |
| **Tiempo Real** | WebSockets | Canal de notificación directa para alertar al conductor al instante cuando un pasajero solicita una carrera. |

---

## 📁 Estructura del Repositorio

```text
hopeful-galileo/
├── .vscode/
│   └── tasks.json             # Tareas para correr backend, app y tests en 1 clic
├── lithio_backend/          # Servidor FastAPI
│   ├── app/
│   │   ├── database.py        # Configuración SQLAlchemy SQLite
│   │   ├── models.py          # Modelos User, DriverProfile, Ride, Review, Reward
│   │   ├── schemas.py         # Validación Pydantic v2 (ConfigDict)
│   │   ├── seed.py            # Semilla con perfil de Jairo y rutas iniciales
│   │   └── main.py            # Endpoints REST y WebSockets
│   ├── tests/
│   │   └── test_api.py        # Pruebas automatizadas (pytest)
│   ├── requirements.txt
│   └── venv/
└── lithio_mobile/           # App Móvil Expo
    ├── src/
    │   ├── components/        # Header, RoutePicker, DriverCard, ActiveRideCard, etc.
    │   ├── constants/         # Rutas fijas (UNC/IVIC/Caracas) y Tema Gamificado
    │   ├── services/          # Cliente API híbrido con respaldo offline
    │   └── types/             # Tipado TypeScript
    ├── App.tsx                # Pantalla principal con selector de roles
    └── package.json
```

---

## 🚀 Cómo Ejecutar en Visual Studio Code

### Opción Rápida: Desde la paleta de comandos de VS Code
1. Presiona `Ctrl + Shift + P` en VS Code.
2. Escribe `Tasks: Run Task` y selecciona:
   - **`🚀 Iniciar Backend FastAPI (Puerto 8000)`**
   - **`📱 Iniciar App Móvil (Expo)`**

---

### Opción Manual: Desde dos terminales de PowerShell

#### Terminal 1: Backend
```powershell
cd lithio_backend
.\venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
> La documentación Swagger interactiva estará disponible en: **http://127.0.0.1:8000/docs**

#### Terminal 2: App Móvil (Expo)
```powershell
cd lithio_mobile
npx expo start
```
> Aparecerá un código QR en la terminal. 
> - **En tu teléfono Android:** Abre la aplicación **Expo Go** (descárgala gratis en Google Play) y escanea el código QR para ver la app corriendo en vivo en tu teléfono físico.
> - **En tu navegador:** Presiona `w` para abrir la versión web en Chrome o Edge.

---

## 🧪 Pruebas Automatizadas

Para validar que todos los flujos de negocio (solicitud, aceptación, cambio de estados, asignación de puntos y reseñas) funcionan a la perfección:

```powershell
cd lithio_backend
$env:PYTHONPATH="."
.\venv\Scripts\pytest tests/test_api.py -v
```
El conjunto verifica autenticación, permisos de administrador, privacidad de perfiles, viajes, recompensas y WebSockets.

## Autenticación y datos privados

El backend verifica Firebase ID tokens en las rutas privadas. Para configurarlo:

1. Crea una app web en Firebase y habilita el proveedor **Correo/contraseña**.
2. Copia `lithio_mobile/firebase-config.example` a `lithio_mobile/.env` y completa la configuración web de Firebase y `EXPO_PUBLIC_API_URL`.
3. Configura `lithio_backend/.env` con el ID del proyecto, la clave web pública de Firebase (`FIREBASE_WEB_API_KEY`), el dominio de autenticación y la ruta local a un archivo de cuenta de servicio. No guardes ni compartas el archivo de cuenta de servicio; mantenlo fuera del repositorio.
4. Para autorizar administradores, coloca sus Firebase UIDs en `ADMIN_FIREBASE_UIDS` (separados por comas) o asigna el rol `admin` directamente en la base de datos con acceso administrativo seguro.
5. Configura `CORS_ALLOWED_ORIGINS` con los orígenes web que usarás, separados por comas. El dashboard servido por el backend no requiere un origen adicional; el servidor estático local predeterminado en el puerto 8080 sí.
6. Reinicia backend y Expo. Los registros existentes se vinculan a Firebase solo cuando el token presenta el mismo correo verificado.

El dashboard solicita inicio de sesión con Firebase y verifica permisos de administrador en el backend antes de mostrar los datos. Los endpoints de perfil requieren autenticación y devuelven datos solo al propietario o a un administrador autorizado. Los datos financieros del conductor no están en la lista pública; se devuelven al pasajero únicamente dentro de su viaje. Las conexiones WebSocket requieren un mensaje inicial de autenticación con ID token y derivan el usuario del token, no de un ID enviado por el cliente.
