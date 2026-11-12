"""Registro como estudiante o trabajador: listas del servidor y validación cruzada."""
from tests.test_api import VALID_REGISTRATION, client  # noqa: F401  (fixture compartido)

NEW_USER = {"Authorization": "Bearer test-new-user"}
BASE = {k: v for k, v in VALID_REGISTRATION.items() if k not in ("career", "semester")}


def register(client, **fields):
    return client.post("/api/passengers/register", json={**BASE, **fields}, headers=NEW_USER)


def test_options_list_careers_and_areas(client):
    options = client.get("/api/registration/options").json()
    assert options["student"]["institutions"] == ["UNC"]
    assert len(options["student"]["careers"]["UNC"]) == 18
    assert "Personal / Docente" not in options["student"]["semesters"]
    assert options["worker"]["institutions"] == ["UNC", "IVIC"]
    assert "Comedor" in options["worker"]["areas"]["IVIC"]
    assert "Comedor" not in options["worker"]["areas"]["UNC"]


def test_student_registers_with_listed_career(client):
    res = register(client, occupation="estudiante", career="licenciatura en nanotecnología", semester="3")
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["occupation"] == "estudiante"
    assert body["institution"] == "UNC"  # Por ahora todos los estudiantes son de la UNC.
    assert body["career"] == "Licenciatura en Nanotecnología"
    assert body["semester"] == "3"
    assert body["work_area"] is None


def test_student_rejects_unlisted_career_and_staff_semester(client):
    assert register(client, occupation="estudiante", career="Astrología", semester="3").status_code == 422
    listed = "Licenciatura en Física"
    assert register(client, occupation="estudiante", career=listed, semester="Personal / Docente").status_code == 422
    assert register(client, occupation="estudiante", career=listed).status_code == 422


def test_worker_registers_with_institution_and_area(client):
    res = register(client, occupation="trabajador", institution="ivic", work_area="comedor", career="x", semester="1")
    assert res.status_code == 201, res.text
    body = res.json()
    assert (body["occupation"], body["institution"], body["work_area"]) == ("trabajador", "IVIC", "Comedor")
    # Un trabajador no guarda carrera ni semestre aunque la app los envíe.
    assert body["career"] is None and body["semester"] is None


def test_unc_has_no_dining_hall_and_unknown_values_fail(client):
    assert register(client, occupation="trabajador", institution="UNC", work_area="Comedor").status_code == 422
    assert register(client, occupation="trabajador", institution="UCV", work_area="Seguridad").status_code == 422
    assert register(client, occupation="trabajador", institution="IVIC").status_code == 422
    assert register(client, occupation="jefe", institution="IVIC", work_area="Seguridad").status_code == 422


def test_previous_app_version_still_registers(client):
    """Los APK que aún no se actualizan envían carrera libre y semestre, sin 'occupation'."""
    res = client.post("/api/passengers/register", json=VALID_REGISTRATION, headers=NEW_USER)
    assert res.status_code == 201
    assert res.json()["occupation"] is None
