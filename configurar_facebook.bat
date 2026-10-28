@echo off
title LITHIO - Configurar Facebook
REM Activa Entrar con Facebook con las claves de tu app de Meta (ver docs\DESPLIEGUE.md, parte B).
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\configurar_facebook.ps1"
pause
