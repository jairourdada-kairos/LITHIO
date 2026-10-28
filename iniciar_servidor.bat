@echo off
title Servidor LITHIO (puerto 8000)
echo ===================================================
echo   Servidor de LITHIO en http://192.168.0.106:8000
echo   Panel web: http://localhost:8000/dashboard
echo   Deja esta ventana abierta mientras usas la app.
echo ===================================================
cd /d "%~dp0lithio_backend"
if not exist "venv\Scripts\python.exe" (
  echo No se encontro lithio_backend\venv. Instala las dependencias primero.
  pause
  exit /b 1
)
venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --timeout-graceful-shutdown 3
pause
