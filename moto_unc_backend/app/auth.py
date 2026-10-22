import json
import logging
import os
from dataclasses import dataclass
from functools import lru_cache

import firebase_admin
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from firebase_admin import auth as firebase_auth
from firebase_admin.exceptions import FirebaseError
from sqlalchemy import func
from sqlalchemy.orm import Session

from .database import get_db
from .models import User

logger = logging.getLogger(__name__)
bearer_scheme = HTTPBearer(auto_error=False)

# 428 Precondition Required: la app responde enviando el correo de verificación.
EMAIL_VERIFICATION_REQUIRED = 428


@dataclass(frozen=True)
class FirebaseIdentity:
    uid: str
    email: str | None
    email_verified: bool


@lru_cache(maxsize=1)
def _get_firebase_app():
    project_id = os.getenv("FIREBASE_PROJECT_ID")
    # En la nube no hay archivos: el JSON de la cuenta de servicio va completo
    # en FIREBASE_SERVICE_ACCOUNT_JSON. En local se puede usar la ruta al archivo.
    credentials_json = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON", "").strip()
    credentials_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH")
    if not project_id or not (credentials_json or credentials_path):
        raise HTTPException(
            status_code=503,
            detail="La autenticación Firebase no está configurada en el servidor.",
        )
    if not credentials_json and not os.path.isfile(credentials_path):
        logger.error("Firebase service-account file is not available.")
        raise HTTPException(
            status_code=503,
            detail="La autenticación Firebase no está configurada en el servidor.",
        )

    try:
        credential = firebase_admin.credentials.Certificate(
            json.loads(credentials_json) if credentials_json else credentials_path
        )
        return firebase_admin.initialize_app(credential, {"projectId": project_id})
    except (ValueError, FirebaseError):
        logger.exception("Firebase Admin SDK could not be initialized.")
        raise HTTPException(
            status_code=503,
            detail="La autenticación Firebase no está disponible.",
        ) from None


def verify_firebase_token(token: str) -> FirebaseIdentity:
    try:
        claims = firebase_auth.verify_id_token(
            token,
            app=_get_firebase_app(),
            check_revoked=True,
        )
    except HTTPException:
        raise
    except (ValueError, FirebaseError) as error:
        logger.info("Rejected Firebase ID token (%s).", type(error).__name__)
        raise HTTPException(
            status_code=401,
            detail="La sesión no es válida o ha expirado.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from None

    uid = claims.get("uid")
    if not isinstance(uid, str) or not uid:
        raise HTTPException(status_code=401, detail="La sesión no es válida.")
    email = claims.get("email")
    return FirebaseIdentity(
        uid=uid,
        email=email.lower() if isinstance(email, str) else None,
        email_verified=claims.get("email_verified") is True,
    )


def get_firebase_identity(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> FirebaseIdentity:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=401,
            detail="Se requiere iniciar sesión.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return verify_firebase_token(credentials.credentials)


def get_user_for_identity(identity: FirebaseIdentity, db: Session) -> User:
    user = db.query(User).filter(User.firebase_uid == identity.uid).first()
    if user:
        return user

    if identity.email:
        user = (
            db.query(User)
            .filter(func.lower(User.email) == identity.email)
            .first()
        )
        if user and not user.firebase_uid:
            # Perfil creado antes de Firebase: se vincula solo si el correo es del usuario.
            if not identity.email_verified:
                raise HTTPException(
                    status_code=EMAIL_VERIFICATION_REQUIRED,
                    detail="Este correo ya tiene un perfil en LITHIO. Verifica tu correo para vincularlo a tu cuenta.",
                )
            user.firebase_uid = identity.uid
            db.commit()
            db.refresh(user)
            return user

    raise HTTPException(
        status_code=403,
        detail="No existe un perfil vinculado a esta cuenta. Regístrate primero.",
    )


def get_current_user(
    identity: FirebaseIdentity = Depends(get_firebase_identity),
    db: Session = Depends(get_db),
) -> User:
    return get_user_for_identity(identity, db)


def is_admin(user: User) -> bool:
    configured_admin_uids = {
        value.strip()
        for value in os.getenv("ADMIN_FIREBASE_UIDS", "").split(",")
        if value.strip()
    }
    return user.role == "admin" or user.firebase_uid in configured_admin_uids


def require_admin(user: User = Depends(get_current_user)) -> User:
    if not is_admin(user):
        raise HTTPException(status_code=403, detail="Se requiere permiso de administrador.")
    return user
