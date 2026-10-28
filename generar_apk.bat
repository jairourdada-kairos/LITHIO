@echo off
title LITHIO - Generar APK de Android
REM Ejecuta scripts\generar_apk.ps1 solo para esta ventana, sin cambiar la configuracion de Windows.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\generar_apk.ps1"
pause
