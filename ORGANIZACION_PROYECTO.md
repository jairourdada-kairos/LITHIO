# Estructura oficial del proyecto

El producto se denomina **LITHIO**: **Linked Intelligent Transport for Higher Innovative Opportunities** (Transporte Inteligente Vinculado para Oportunidades Innovadoras). Las carpetas se llaman `lithio_*` y la app de Android usa el identificador `com.lithio.app`.

Este repositorio queda organizado para trabajar en 3 piezas principales:

- Backend: [lithio_backend](lithio_backend)
- Dashboard web: [lithio_dashboard](lithio_dashboard)
- App móvil: [lithio_mobile](lithio_mobile)

## Backend principal

Usar [lithio_backend](lithio_backend) como fuente oficial de la API.

Para arrancarlo: doble clic en `iniciar_servidor.bat`, o desde PowerShell:

```powershell
cd lithio_backend
.\venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Documentación:

- http://127.0.0.1:8000/docs

## Dashboard

El dashboard web queda en [lithio_dashboard](lithio_dashboard) y lo sirve el
propio servidor en http://localhost:8000/dashboard (no hace falta arrancarlo aparte).

## App móvil

La app móvil queda en [lithio_mobile](lithio_mobile). Para probarla con Expo Go
en la misma Wi-Fi: doble clic en `iniciar_app.bat` (o `iniciar_todo.bat` para
servidor + app). Para los APK fuera de la Wi-Fi: `iniciar_publico.bat`.
APK nuevo, actualizaciones y nube: ver [DESPLIEGUE.md](DESPLIEGUE.md).

## Estado recomendado

Para empezar a practicar y desarrollar la aplicación, usar esta base:

1. Backend en [lithio_backend](lithio_backend)
2. Dashboard en [lithio_dashboard](lithio_dashboard)
3. App móvil en [lithio_mobile](lithio_mobile)
4. Repositorio limpio con [ .gitignore ](.gitignore)

## Tareas rápidas

- Revisar endpoints en la API
- Probar la app móvil con Expo
- Verificar dashboard con el backend
- Empujar cambios de forma gradual
