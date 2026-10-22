@echo off
REM Abre el servidor y la app de LITHIO, cada uno en su propia ventana.
start "Servidor LITHIO" cmd /c "%~dp0iniciar_servidor.bat"
timeout /t 4 /nobreak >nul
start "App LITHIO (Expo)" cmd /c "%~dp0iniciar_app.bat"
