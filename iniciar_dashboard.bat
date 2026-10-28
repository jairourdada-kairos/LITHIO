@echo off
title Dashboard Web - LITHIO
echo ===================================================
echo   Iniciando Dashboard Web HTML (LITHIO)
echo   Abre en tu navegador o telefono:
echo   - En tu PC:     http://localhost:8080/
echo   - En tu Celular: http://172.17.101.213:8080/
echo ===================================================
cd /d "%~dp0lithio_dashboard"
python -m http.server 8080 --bind 0.0.0.0
pause
