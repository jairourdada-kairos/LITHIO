"""Pedir viaje: cada ruta es 'interna' (dentro del IVIC) o 'externa' (hacia afuera)."""
from tests.test_api import auth_headers, client  # noqa: F401  (fixture compartido)

ADMIN = {"Authorization": "Bearer test-admin"}


def test_public_routes_include_scope(client):
    routes = client.get("/api/routes").json()
    assert routes and all(r["scope"] in ("interna", "externa") for r in routes)


def test_catalog_marks_only_two_routes_as_internal():
    from app.seed import ROUTE_CATALOG

    internas = {(r["origin"], r["destination"]) for r in ROUTE_CATALOG if r["scope"] == "interna"}
    assert internas == {("UNC", "BIBLIOTECA"), ("UNC", "RESTO DEL IVIC")}
    assert all(r["scope"] in ("interna", "externa") for r in ROUTE_CATALOG)


def test_existing_routes_table_gets_scope_column_with_backfill():
    from sqlalchemy import create_engine, text
    from sqlalchemy.orm import sessionmaker
    from sqlalchemy.pool import StaticPool

    from app import seed
    from app.database import Base

    engine = create_engine("sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    with engine.begin() as conn:
        # Tabla de rutas como estaba antes: sin la columna scope.
        conn.execute(text("DROP TABLE routes"))
        conn.execute(text(
            "CREATE TABLE routes (id INTEGER PRIMARY KEY, origin TEXT, destination TEXT, "
            "fare_usd FLOAT, estimated_minutes INTEGER, popular BOOLEAN, tag TEXT)"
        ))
        conn.execute(text(
            "INSERT INTO routes (origin, destination) VALUES "
            "('UNC','BIBLIOTECA'), ('UNC','RESTO DEL IVIC'), ('UNC','CARACAS')"
        ))
    db = sessionmaker(bind=engine)()
    seed.ensure_columns(db)
    rows = dict(db.execute(text("SELECT destination, scope FROM routes")).all())
    assert rows == {"BIBLIOTECA": "interna", "RESTO DEL IVIC": "interna", "CARACAS": "externa"}
    db.close()


def test_admin_can_set_and_change_scope(client):
    base = {"origin": "Taller", "destination": "Cafetín", "fare_usd": 1}
    default = client.post("/api/admin/routes", json=base, headers=ADMIN)
    assert default.status_code == 201 and default.json()["scope"] == "externa"

    interna = client.post("/api/admin/routes", json={**base, "scope": "interna"}, headers=ADMIN)
    assert interna.json()["scope"] == "interna"
    route_id = interna.json()["id"]

    changed = client.put(f"/api/admin/routes/{route_id}", json={"scope": "externa"}, headers=ADMIN)
    assert changed.status_code == 200 and changed.json()["scope"] == "externa"
    # Editar otro campo no toca el tipo.
    kept = client.put(f"/api/admin/routes/{route_id}", json={"tag": "x"}, headers=ADMIN)
    assert kept.json()["scope"] == "externa"
    assert any(r["id"] == route_id and r["scope"] == "externa" for r in client.get("/api/routes").json())


def test_invalid_scope_is_rejected(client):
    bad = client.post(
        "/api/admin/routes",
        json={"origin": "A1", "destination": "B1", "scope": "lejana"},
        headers=ADMIN,
    )
    assert bad.status_code == 422
