# Estructura oficial del proyecto

El producto se denomina **LITHIO**: **Linked Intelligent Transport for Higher Innovative Opportunities** (Transporte Inteligente Vinculado para Oportunidades Innovadoras). Los nombres de carpetas y el identificador Android existentes se conservan como identificadores técnicos para mantener los builds y las instalaciones compatibles.

Este repositorio queda organizado para trabajar en 3 piezas principales:

- Backend: [lithio_backend](lithio_backend)
- Dashboard web: [lithio_dashboard](lithio_dashboard)
- App móvil: [lithio_mobile](lithio_mobile)

## Backend principal

Usar [lithio_backend](lithio_backend) como fuente oficial de la API.

Comandos de arranque:

```powershell
cd lithio_backend
.\venv\Scripts\Activate.ps1
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Documentación:

- http://127.0.0.1:8000/docs

## Dashboard

El dashboard web queda en [lithio_dashboard](lithio_dashboard).

Para ejecutarlo:

```powershell
cd lithio_dashboard
python -m http.server 8080
```

Abrir:

- http://localhost:8080/

## App móvil

La app móvil queda en [lithio_mobile](lithio_mobile).

Para ejecutarla:

```powershell
cd lithio_mobile
npx expo start
```

## Archivos antiguos o duplicados

La carpeta [app](app) existe como versión antigua, está deshabilitada por seguridad y debe usarse solo como referencia histórica.
La carpeta oficial para desarrollo es [lithio_backend](lithio_backend).

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
