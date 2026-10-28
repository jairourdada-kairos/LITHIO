@echo off
title LITHIO - Publicar actualizacion
REM Envia los cambios de la app a todos los APK instalados, sin compilar otro APK.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\publicar_actualizacion.ps1"
pause
