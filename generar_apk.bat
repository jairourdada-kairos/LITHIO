@echo off
title LITHIO - Generar APK de Android
REM Ejecuta generar_apk.ps1 solo para esta ventana, sin cambiar la configuracion de Windows.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0generar_apk.ps1"
pause
