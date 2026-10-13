@echo off
title Backend FastAPI - LITHIO
echo ===================================================
echo   Iniciando Servidor Backend FastAPI (LITHIO)
echo   Documentacion interactiva: http://127.0.0.1:8000/docs
echo ===================================================
cd /d "%~dp0moto_unc_backend"
call .\venv\Scripts\activate.bat
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
pause

