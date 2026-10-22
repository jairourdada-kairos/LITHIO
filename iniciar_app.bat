@echo off
title App LITHIO (Expo)
echo ===================================================
echo   Iniciando la app LITHIO con Expo (puerto 8082)
echo   Escanea el codigo QR con Expo Go
echo   Uso: iniciar_app.bat          (normal)
echo        iniciar_app.bat --clear  (limpia la cache)
echo ===================================================
cd /d "%~dp0moto_unc_mobile"
npx expo start --port 8082 %*
pause
