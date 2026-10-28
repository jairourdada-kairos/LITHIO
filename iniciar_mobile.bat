@echo off
title App Movil Expo - LITHIO
echo ===================================================
echo   Iniciando App Movil Expo (LITHIO)
echo   Escanea el codigo QR con la app Expo Go
echo ===================================================
cd /d "%~dp0lithio_mobile"
npx expo start
pause

