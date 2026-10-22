@echo off
title LITHIO publico (fuera de tu Wi-Fi)
REM Servidor + tunel de Cloudflare + Expo en modo tunel. Deja esta ventana abierta.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0iniciar_publico.ps1"
pause
