@echo off
title LITHIO - Reiniciar el servidor
REM Aplica los cambios hechos en el backend (.py). El enlace publico no cambia.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\reiniciar_servidor.ps1"
pause
