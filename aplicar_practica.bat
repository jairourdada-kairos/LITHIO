@echo off
title LITHIO - Aplicar cambios de la rama de practica
REM Baja los cambios de colores y letras de la rama "practica" (solo archivos de estilo) y publica si hace falta.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\aplicar_practica.ps1"
pause
