"""Autoriza en Firebase Authentication el dominio de la versión web pública.

Google y Facebook solo abren su ventana de inicio de sesión desde dominios
autorizados. Las direcciones de los túneles de Cloudflare cambian en cada
arranque, así que scripts/iniciar_publico.ps1 agrega las actuales (la del
servidor, que sirve la web en /app, y la de Expo) y quita las de túneles viejos.

Uso: python -m app.authorize_domain https://xxxx.trycloudflare.com [https://yyyy.trycloudflare.com]
"""
import json
import os
import sys
import urllib.error
import urllib.request
from urllib.parse import urlparse

from dotenv import load_dotenv

from .auth import _get_firebase_app

TUNNEL_SUFFIX = ".trycloudflare.com"


def authorize(*urls: str) -> list[str]:
    hosts = [urlparse(url).hostname for url in urls]
    if not hosts or not all(hosts):
        raise ValueError(f"Dirección no válida: {' '.join(urls)}")
    project_id = os.environ["FIREBASE_PROJECT_ID"]
    token = _get_firebase_app().credential.get_access_token().access_token
    url = f"https://identitytoolkit.googleapis.com/admin/v2/projects/{project_id}/config"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "x-goog-user-project": project_id,
    }
    with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=15) as response:
        current = json.load(response).get("authorizedDomains", [])
    domains = [d for d in current if not d.endswith(TUNNEL_SUFFIX)] + list(dict.fromkeys(hosts))
    request = urllib.request.Request(
        f"{url}?updateMask=authorizedDomains",
        data=json.dumps({"authorizedDomains": domains}).encode(),
        method="PATCH",
        headers=headers,
    )
    with urllib.request.urlopen(request, timeout=15):
        pass
    return domains


if __name__ == "__main__":
    load_dotenv()
    urls = sys.argv[1:]
    if not urls or not all(url.startswith("https://") for url in urls):
        sys.exit("Uso: python -m app.authorize_domain https://... [https://...]")
    try:
        authorize(*urls)
    except urllib.error.HTTPError as error:
        reason = json.loads(error.read() or b"{}").get("error", {}).get("message", "")
        sys.exit(f"No se pudo autorizar el dominio en Firebase ({error.code}): {reason}")
    except Exception as error:
        sys.exit(f"No se pudo autorizar el dominio en Firebase: {error}")
    print("Google y Facebook autorizados en " + ", ".join(urlparse(url).hostname for url in urls))
