@echo off
title LITHIO - Respaldar base de datos de la nube
REM Ejecuta scripts\respaldar_nube.ps1 solo para esta ventana, sin cambiar la configuracion de Windows.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\respaldar_nube.ps1"
pause
