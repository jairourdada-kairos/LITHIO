"""Activa "Entrar con Facebook" en Firebase Authentication.

Reemplaza el paso manual de la consola de Firebase (Authentication → Método de
acceso → Facebook): con el Identificador y la Clave secreta de la app de Meta,
habilita el proveedor con la cuenta de servicio del servidor. La clave secreta
solo viaja a Firebase; no se guarda en ningún archivo.

Uso (lo hace scripts/configurar_facebook.ps1):
    python -m app.enable_facebook APP_ID APP_SECRET
"""
import json
import os
import sys
import urllib.error
import urllib.request

from dotenv import load_dotenv

from .auth import _get_firebase_app


def enable(app_id: str, app_secret: str) -> str:
    """Habilita Facebook y devuelve la URI de redireccionamiento que se pega en Meta."""
    project_id = os.environ["FIREBASE_PROJECT_ID"]
    token = _get_firebase_app().credential.get_access_token().access_token
    base = f"https://identitytoolkit.googleapis.com/admin/v2/projects/{project_id}/defaultSupportedIdpConfigs"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "x-goog-user-project": project_id,
    }
    body = json.dumps({"enabled": True, "clientId": app_id, "clientSecret": app_secret}).encode()
    try:
        # Si ya existe, se actualiza; si no, se crea.
        request = urllib.request.Request(
            f"{base}/facebook.com?updateMask=enabled,clientId,clientSecret", data=body, method="PATCH", headers=headers
        )
        urllib.request.urlopen(request, timeout=15).close()
    except urllib.error.HTTPError as error:
        if error.code != 404:
            raise
        request = urllib.request.Request(f"{base}?idpId=facebook.com", data=body, method="POST", headers=headers)
        urllib.request.urlopen(request, timeout=15).close()
    return f"https://{project_id}.firebaseapp.com/__/auth/handler"


if __name__ == "__main__":
    load_dotenv()
    # La clave va en la variable FACEBOOK_APP_SECRET (así no queda a la vista en la lista de procesos).
    secret = os.environ.get("FACEBOOK_APP_SECRET") or (sys.argv[2] if len(sys.argv) == 3 else "")
    if len(sys.argv) not in (2, 3) or not sys.argv[1].isdigit() or not secret:
        sys.exit("Uso: FACEBOOK_APP_SECRET=... python -m app.enable_facebook IDENTIFICADOR_DE_LA_APP")
    try:
        redirect = enable(sys.argv[1], secret)
    except urllib.error.HTTPError as error:
        reason = json.loads(error.read() or b"{}").get("error", {}).get("message", "")
        sys.exit(f"Firebase no activó Facebook ({error.code}): {reason}")
    except Exception as error:
        sys.exit(f"Firebase no activó Facebook: {error}")
    print("Facebook activado en Firebase.")
    print(f"URI de redireccionamiento para Meta: {redirect}")
