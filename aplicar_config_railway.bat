@echo off
title LITHIO - Aplicar configuracion de Railway
REM Ejecuta scripts\aplicar_config_railway.ps1 solo para esta ventana, sin cambiar la configuracion de Windows.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\aplicar_config_railway.ps1"
pause
