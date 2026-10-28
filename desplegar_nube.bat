@echo off
title LITHIO - Desplegar en la nube
REM Ejecuta scripts\desplegar_nube.ps1 solo para esta ventana, sin cambiar la configuracion de Windows.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\desplegar_nube.ps1"
pause
