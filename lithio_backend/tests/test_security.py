"""Blindaje del administrador: nadie salvo la cuenta del servidor (UID en
ADMIN_FIREBASE_UIDS) puede usar el panel, ni falsificando datos."""
import re

import pytest
from fastapi import FastAPI

from app import config, main, security_log
from app.models import User
from tests.test_api import auth_headers, client  # noqa: F401  (fixture compartido)

ADMIN = {"Authorization": "Bearer test-admin"}


def admin_routes():
    for route in security_log._api_routes(main.app.routes):
        if security_log.is_admin_path(route.path):
            for method in sorted(route.methods - {"HEAD", "OPTIONS"}):
                yield method, re.sub(r"\{[^}]+\}", "1", route.path)


ADMIN_ROUTES = sorted(set(admin_routes()))


def security_log_text() -> str:
    for handler in security_log.security_logger.handlers:
        handler.flush()
    path = config.LOG_DIR / "seguridad.log"
    return path.read_text(encoding="utf-8") if path.exists() else ""


def test_every_admin_route_requires_require_admin():
    assert len(ADMIN_ROUTES) >= 20
    assert security_log.unprotected_admin_routes(main.app) == []


def test_server_refuses_to_start_with_an_unprotected_admin_route():
    app = FastAPI()

    @app.delete("/api/admin/users/{user_id}")
    def borrar(user_id: int):
        return {}

    with pytest.raises(RuntimeError, match="/api/admin/users"):
        security_log.assert_admin_routes_protected(app)


@pytest.mark.parametrize(("method", "path"), ADMIN_ROUTES)
def test_passenger_and_driver_are_rejected_on_every_admin_route(client, method, path):
    for user_id in (4, 1):  # pasajero y conductor aprobado
        response = client.request(method, path, headers=auth_headers(user_id), json={})
        assert response.status_code == 403, (user_id, method, path, response.text)
    assert client.request(method, path, json={}).status_code == 401


def test_role_admin_in_the_database_is_not_enough(client):
    db = client.session_factory()
    db.query(User).filter(User.id == 4).update({"role": "admin"})
    db.commit()
    db.close()

    assert client.get("/api/admin/drivers", headers=auth_headers(4)).status_code == 403
    assert client.get("/api/users/me/summary", headers=auth_headers(4)).json()["is_admin"] is False
    assert client.get("/api/admin/drivers", headers=ADMIN).status_code == 200


def test_admin_email_allowlist_is_also_enforced(client, monkeypatch):
    monkeypatch.setenv("ADMIN_EMAILS", "jairourdada@gmail.com")
    assert client.get("/api/admin/drivers", headers=ADMIN).status_code == 403
    monkeypatch.setenv("ADMIN_EMAILS", "ADMIN@example.test")
    assert client.get("/api/admin/drivers", headers=ADMIN).status_code == 200


def test_forged_headers_and_fields_do_not_grant_admin(client):
    forged = {
        **auth_headers(4),
        "X-Admin": "true",
        "X-Role": "admin",
        "X-User-Id": "5",
        "X-Forwarded-User": "admin@example.test",
    }
    assert client.post("/api/admin/wallet/credit", headers=forged, json={"friend_code": "X", "amount": 50}).status_code == 403
    # Un token que no firmó Firebase no abre sesión.
    assert client.get("/api/admin/drivers", headers={"Authorization": "Bearer eyJhbGciOiJub25lIn0.eyJ1aWQiOiJ1aWQtYWRtaW4ifQ."}).status_code == 401
    # Nadie puede darse el rol de administrador.
    assert client.post("/api/users/4/switch-role", headers=auth_headers(4), json={"new_role": "admin"}).status_code == 400
    assert client.put("/api/users/me/profile", headers=auth_headers(4), json={"role": "admin"}).status_code == 422
    # Ni cambiar el rol de otra persona.
    assert client.post("/api/users/1/switch-role", headers=auth_headers(4), json={"new_role": "pasajero"}).status_code == 403


def test_denied_attempts_and_admin_actions_are_logged(client):
    client.put("/api/admin/routes/1", headers=auth_headers(4), json={"fare_usd": 0.01})
    client.delete("/api/admin/drivers/2")
    client.put("/api/admin/rates/bcv", headers=ADMIN, json={"rate": 123.45})

    log = security_log_text()
    assert re.search(r"ACCESO DENEGADO al panel \(403\): usuario=4 PUT /api/admin/routes/1", log)
    assert re.search(r"ACCESO DENEGADO al panel \(401\): sin sesión válida DELETE /api/admin/drivers/2", log)
    assert re.search(r"Acción de administrador: usuario=5 PUT /api/admin/rates/bcv", log)


def test_security_headers_block_clickjacking(client):
    for path in ("/health", "/dashboard/"):
        response = client.get(path)
        assert response.headers["X-Frame-Options"] == "DENY"
        assert response.headers["X-Content-Type-Options"] == "nosniff"
        assert "frame-ancestors 'none'" in response.headers["Content-Security-Policy"]
