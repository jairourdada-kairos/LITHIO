"""Publica en Firebase (Firestore) la dirección pública actual del servidor.

La dirección del túnel de Cloudflare cambia cada vez que se abre el modo
público. El APK de LITHIO la lee de config/server al abrirse, así que sigue
funcionando sin una dirección fija ni un servidor pagado.

Uso (lo hace iniciar_publico.ps1): python -m app.publish_address https://xxxx.trycloudflare.com

Requisitos en la consola de Firebase: base de datos Firestore creada y una
regla que permita leer config/server (ver DESPLIEGUE.md).
"""
import json
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone

from .auth import _get_firebase_app


def publish(api_url: str) -> None:
    project_id = os.environ["FIREBASE_PROJECT_ID"]
    token = _get_firebase_app().credential.get_access_token().access_token
    url = (
        f"https://firestore.googleapis.com/v1/projects/{project_id}/databases/(default)/documents/config/server"
        "?updateMask.fieldPaths=api_url&updateMask.fieldPaths=updated_at"
    )
    body = {
        "fields": {
            "api_url": {"stringValue": api_url},
            "updated_at": {"timestampValue": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")},
        }
    }
    request = urllib.request.Request(
        url,
        data=json.dumps(body).encode(),
        method="PATCH",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=15):
        pass


if __name__ == "__main__":
    if len(sys.argv) != 2 or not sys.argv[1].startswith("https://"):
        sys.exit("Uso: python -m app.publish_address https://...")
    try:
        publish(sys.argv[1])
    except urllib.error.HTTPError as error:
        reason = json.loads(error.read() or b"{}").get("error", {}).get("message", "")
        sys.exit(f"No se pudo publicar la dirección en Firebase ({error.code}): {reason}")
    except Exception as error:  # Firestore sin crear o sin permisos: el modo público sigue funcionando.
        sys.exit(f"No se pudo publicar la dirección en Firebase: {error}")
    print(f"Dirección publicada para el APK: {sys.argv[1]}")
