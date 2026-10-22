# Imagen del backend LITHIO para Railway, Render o cualquier VPS con Docker.
# Se construye desde la raíz del repositorio para incluir el dashboard web,
# que el backend sirve en /dashboard.
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    APP_ENV=production

WORKDIR /srv/moto_unc_backend

COPY moto_unc_backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY moto_unc_backend/app ./app
COPY moto_unc_dashboard /srv/moto_unc_dashboard

RUN useradd --create-home lithio && chown -R lithio /srv
USER lithio

EXPOSE 8000
# Una sola instancia: el gestor de WebSockets vive en memoria del proceso.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers --forwarded-allow-ips='*' --ws-ping-interval 20 --ws-ping-timeout 20"]
