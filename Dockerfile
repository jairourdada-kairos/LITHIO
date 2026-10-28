# Imagen del backend LITHIO para Railway, Render o cualquier VPS con Docker.
# Se construye desde la raíz del repositorio para incluir el dashboard web,
# que el backend sirve en /dashboard.
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    APP_ENV=production

WORKDIR /srv/lithio_backend

# gosu: el arranque baja de root al usuario "lithio" (ver docker-entrypoint.sh).
RUN apt-get update \
    && apt-get install -y --no-install-recommends gosu \
    && rm -rf /var/lib/apt/lists/*

COPY lithio_backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY lithio_backend/app ./app
COPY lithio_dashboard /srv/lithio_dashboard

RUN useradd --create-home lithio && chown -R lithio /srv
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
# Quita finales de línea de Windows (CR) por si el archivo se editó en Windows.
RUN sed -i 's/\r$//' /usr/local/bin/docker-entrypoint.sh && chmod +x /usr/local/bin/docker-entrypoint.sh
# Arranca como root solo para preparar el volumen /data; el servidor corre como "lithio".
ENTRYPOINT ["docker-entrypoint.sh"]

EXPOSE 8000
# Una sola instancia: el gestor de WebSockets vive en memoria del proceso.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers --forwarded-allow-ips='*' --ws-ping-interval 20 --ws-ping-timeout 20"]
