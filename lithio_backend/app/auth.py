import json
import logging
import os
from dataclasses import dataclass
from functools import lru_cache

import firebase_admin
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from firebase_admin import auth as firebase_auth
from firebase_admin.exceptions import FirebaseError
from sqlalchemy import func
from sqlalchemy.orm import Session

from .database import get_db
from .models import User
from .validation import email_domain_allowed

logger = logging.getLogger(__name__)
bearer_scheme = HTTPBearer(auto_error=False)

# 428 Precondition Required: la app responde enviando el correo de verificación.
EMAIL_VERIFICATION_REQUIRED = 428
# La app reconoce este encabezado y muestra la pantalla "Verifica tu correo".
EMAIL_VERIFICATION_HEADERS = {"X-Email-Verification": "required"}


def require_verified_email() -> bool:
    """REQUIRE_VERIFIED_EMAIL=false desactiva la verificación (solo para pruebas)."""
    return os.getenv("REQUIRE_VERIFIED_EMAIL", "true").strip().lower() not in {"0", "false", "no"}


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


def update_firebase_email(uid: str, email: str) -> None:
    """Cambia el correo de inicio de sesión en Firebase (queda sin verificar)."""
    try:
        firebase_auth.update_user(uid, email=email, email_verified=False, app=_get_firebase_app())
    except firebase_auth.EmailAlreadyExistsError:
        raise HTTPException(status_code=409, detail="Ese correo ya lo usa otra cuenta.") from None
    except (ValueError, FirebaseError):
        logger.exception("Firebase email update failed.")
        raise HTTPException(status_code=503, detail="No se pudo cambiar el correo en este momento. Intenta más tarde.") from None


def delete_firebase_user(uid: str) -> None:
    """Borra el acceso de Firebase (correo, Google o Facebook) de una cuenta eliminada."""
    try:
        firebase_auth.delete_user(uid, app=_get_firebase_app())
    except firebase_auth.UserNotFoundError:
        return
    except (ValueError, FirebaseError):
        logger.exception("Firebase user deletion failed.")
        raise HTTPException(status_code=503, detail="No se pudo eliminar la cuenta en este momento. Intenta más tarde.") from None


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


def enforce_email_policy(identity: FirebaseIdentity, user: User) -> User:
    """Para entrar hace falta una cuenta real: correo de Gmail y verificado.

    El administrador queda exento para que el panel nunca se bloquee.
    """
    if is_admin(user):
        return user
    if not email_domain_allowed(identity.email):
        raise HTTPException(
            status_code=403,
            detail="LITHIO solo acepta cuentas reales de Gmail. Pide al administrador que cambie tu correo a uno @gmail.com.",
            headers={"X-Email-Domain": "not-allowed"},
        )
    if require_verified_email() and not identity.email_verified:
        raise HTTPException(
            status_code=EMAIL_VERIFICATION_REQUIRED,
            detail="Verifica tu correo de Gmail para entrar: abre el enlace que te enviamos.",
            headers=EMAIL_VERIFICATION_HEADERS,
        )
    return user


def get_user_for_identity(identity: FirebaseIdentity, db: Session) -> User:
    user = db.query(User).filter(User.firebase_uid == identity.uid).first()
    if user:
        return enforce_email_policy(identity, user)

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
                    headers=EMAIL_VERIFICATION_HEADERS,
                )
            user.firebase_uid = identity.uid
            db.commit()
            db.refresh(user)
            return enforce_email_policy(identity, user)

    raise HTTPException(
        status_code=403,
        detail="No existe un perfil vinculado a esta cuenta. Regístrate primero.",
    )


SESSION_HEADER = "X-Session-Id"
SESSION_REPLACED = "Tu cuenta se abrió en otro dispositivo. Vuelve a iniciar sesión para usarla aquí."


def session_is_current(user: User, session_id: str | None) -> bool:
    """Política de sesión única: gana el último dispositivo que inició sesión.

    Un cliente sin identificador de sesión (p. ej. el panel web de
    administración) no compite por la sesión de la app y se acepta.
    """
    return not session_id or not user.active_session_id or session_id == user.active_session_id


def get_current_user_any_session(
    identity: FirebaseIdentity = Depends(get_firebase_identity),
    db: Session = Depends(get_db),
) -> User:
    """Usuario autenticado sin comprobar la sesión (solo para iniciar una nueva)."""
    return get_user_for_identity(identity, db)


def get_current_user(
    request: Request,
    user: User = Depends(get_current_user_any_session),
) -> User:
    if not session_is_current(user, request.headers.get(SESSION_HEADER)):
        raise HTTPException(status_code=401, detail=SESSION_REPLACED, headers={"X-Session-Replaced": "1"})
    return user


def _configured_admin_uids() -> set[str]:
    return {value.strip() for value in os.getenv("ADMIN_FIREBASE_UIDS", "").split(",") if value.strip()}


def is_admin(user: User) -> bool:
    return user.role == "admin" or user.firebase_uid in _configured_admin_uids()


def admin_users(db: Session) -> list[User]:
    """Las cuentas de administrador (para avisarles de solicitudes nuevas)."""
    uids = _configured_admin_uids()
    condition = User.role == "admin"
    if uids:
        condition = condition | User.firebase_uid.in_(uids)
    return db.query(User).filter(condition).all()


def require_admin(user: User = Depends(get_current_user)) -> User:
    if not is_admin(user):
        raise HTTPException(status_code=403, detail="Se requiere permiso de administrador.")
    return user
