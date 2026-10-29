@echo off
title LITHIO - Actualizar el APK de la pagina de descarga
REM Ejecuta scripts\actualizar_descarga.ps1 solo para esta ventana, sin cambiar la configuracion de Windows.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\actualizar_descarga.ps1"
pause
