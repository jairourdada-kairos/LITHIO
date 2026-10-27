#!/bin/sh
# Arranque del contenedor de LITHIO.
#
# Railway (y otros proveedores) montan el volumen persistente como root, así
# que el usuario sin privilegios no podría escribir fotos ni evidencias. Este
# script arranca como root solo para darle esas carpetas al usuario "lithio" y
# luego ejecuta el servidor como "lithio" (nunca como root).
set -e

if [ "$(id -u)" = "0" ]; then
  for dir in "${MEDIA_DIR:-}" "${EVIDENCE_DIR:-}"; do
    if [ -n "$dir" ]; then
      mkdir -p "$dir"
      chown -R lithio:lithio "$dir"
    fi
  done
  exec gosu lithio "$@"
fi

exec "$@"
