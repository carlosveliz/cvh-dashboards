"""The core security guarantee: a non-admin user sees and reaches ONLY the
dashboards explicitly granted to them; everything else is 403/absent."""

import io

import pytest
from openpyxl import Workbook


def _xlsx_bytes() -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.title = "Ventas"
    ws.append(["Mes", "Ingresos"])
    for row in [("Enero", 10), ("Febrero", 20)]:
        ws.append(row)
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


async def _new_dashboard(admin_client, name, type_="static_html"):
    r = await admin_client.post(
        "/api/dashboards",
        json={"name": name, "type": type_, "visibility": "restricted"},
    )
    assert r.status_code == 201
    did = r.json()["id"]
    if type_ == "static_html":
        files = {"file": ("r.html", b"<!doctype html><h1>secret</h1>", "text/html")}
    else:
        files = {"file": ("d.xlsx", _xlsx_bytes(), "application/octet-stream")}
    up = await admin_client.post(f"/api/dashboards/{did}/upload", files=files)
    assert up.status_code == 200, up.text
    return did


async def _make_user(admin_client, email, pw="UserPass123"):
    r = await admin_client.post(
        "/api/users", json={"email": email, "password": pw, "role": "user"}
    )
    assert r.status_code == 201
    return r.json()["id"]


@pytest.fixture
async def user_client(client):
    """A second, independent client (separate cookie jar) for a normal user."""
    from httpx import ASGITransport, AsyncClient
    from app.main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


async def _login(c, email, pw, ip):
    r = await c.post(
        "/api/auth/login", json={"email": email, "password": pw}, headers={"x-forwarded-for": ip}
    )
    assert r.status_code == 200, r.text
    c.headers["x-csrf-token"] = c.cookies.get("csrf_token")


async def test_user_sees_only_granted(admin_client, user_client):
    allowed = await _new_dashboard(admin_client, "Allowed HTML")
    denied = await _new_dashboard(admin_client, "Denied HTML")
    uid = await _make_user(admin_client, "matrix1@cvhtest.com")
    # Grant only "allowed".
    await admin_client.put(f"/api/users/{uid}/permissions", json={"ids": [allowed]})

    await _login(user_client, "matrix1@cvhtest.com", "UserPass123", "7.1.1.1")

    listing = await user_client.get("/api/dashboards")
    ids = [d["id"] for d in listing.json()]
    assert ids == [allowed]  # exactly one, the granted one

    # Direct access to the denied dashboard is 403 across every surface.
    assert (await user_client.get(f"/api/dashboards/{denied}")).status_code == 403
    assert (await user_client.get(f"/api/dashboards/{denied}/content-token")).status_code == 403
    # The allowed one is reachable.
    assert (await user_client.get(f"/api/dashboards/{allowed}")).status_code == 200
    assert (await user_client.get(f"/api/dashboards/{allowed}/content-token")).status_code == 200


async def test_excel_data_gated(admin_client, user_client):
    xls = await _new_dashboard(admin_client, "Secret Excel", "excel")
    await _make_user(admin_client, "matrix2@cvhtest.com")
    await _login(user_client, "matrix2@cvhtest.com", "UserPass123", "7.2.2.2")
    # No grant -> excel data is 403.
    assert (await user_client.get(f"/api/dashboards/{xls}/data")).status_code == 403


async def test_user_cannot_reach_admin_endpoints(admin_client, user_client):
    await _make_user(admin_client, "matrix3@cvhtest.com")
    await _login(user_client, "matrix3@cvhtest.com", "UserPass123", "7.3.3.3")
    assert (await user_client.get("/api/users")).status_code == 403
    assert (await user_client.get("/api/audit")).status_code == 403
    create = await user_client.post(
        "/api/dashboards", json={"name": "x", "type": "static_html", "visibility": "restricted"}
    )
    assert create.status_code == 403


async def test_revoking_access_removes_it(admin_client, user_client):
    d = await _new_dashboard(admin_client, "Toggle HTML")
    uid = await _make_user(admin_client, "matrix4@cvhtest.com")
    await admin_client.put(f"/api/users/{uid}/permissions", json={"ids": [d]})
    await _login(user_client, "matrix4@cvhtest.com", "UserPass123", "7.4.4.4")
    assert (await user_client.get(f"/api/dashboards/{d}")).status_code == 200
    # Revoke all grants.
    await admin_client.put(f"/api/users/{uid}/permissions", json={"ids": []})
    assert (await user_client.get(f"/api/dashboards/{d}")).status_code == 403
    assert [x["id"] for x in (await user_client.get("/api/dashboards")).json()] == []
