# Estructura oficial del proyecto

El producto se denomina **LITHIO**: **Linked Intelligent Transport for Higher Innovative Opportunities** (Transporte Inteligente Vinculado para Oportunidades Innovadoras). Los nombres de carpetas y el identificador Android existentes se conservan como identificadores técnicos para mantener los builds y las instalaciones compatibles.

Este repositorio queda organizado para trabajar en 3 piezas principales:

- Backend: [moto_unc_backend](moto_unc_backend)
- Dashboard web: [moto_unc_dashboard](moto_unc_dashboard)
- App móvil: [moto_unc_mobile](moto_unc_mobile)

## Backend principal

Usar [moto_unc_backend](moto_unc_backend) como fuente oficial de la API.

Comandos de arranque:

```powershell
cd moto_unc_backend
.\venv\Scripts\Activate.ps1
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Documentación:

- http://127.0.0.1:8000/docs

## Dashboard

El dashboard web queda en [moto_unc_dashboard](moto_unc_dashboard).

Para ejecutarlo:

```powershell
cd moto_unc_dashboard
python -m http.server 8080
```

Abrir:

- http://localhost:8080/

## App móvil

La app móvil queda en [moto_unc_mobile](moto_unc_mobile).

Para ejecutarla:

```powershell
cd moto_unc_mobile
npx expo start
```

## Archivos antiguos o duplicados

La carpeta [app](app) existe como versión antigua y debe usarse solo como referencia histórica.
La carpeta oficial para desarrollo es [moto_unc_backend](moto_unc_backend).

## Estado recomendado

Para empezar a practicar y desarrollar la aplicación, usar esta base:

1. Backend en [moto_unc_backend](moto_unc_backend)
2. Dashboard en [moto_unc_dashboard](moto_unc_dashboard)
3. App móvil en [moto_unc_mobile](moto_unc_mobile)
4. Repositorio limpio con [ .gitignore ](.gitignore)

## Tareas rápidas

- Revisar endpoints en la API
- Probar la app móvil con Expo
- Verificar dashboard con el backend
- Empujar cambios de forma gradual
