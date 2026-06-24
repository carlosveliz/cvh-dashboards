import os


async def _create_html_dashboard(admin_client):
    r = await admin_client.post(
        "/api/dashboards",
        json={"name": "Audit Dash", "type": "static_html", "visibility": "restricted"},
    )
    assert r.status_code == 201, r.text
    did = r.json()["id"]
    files = {"file": ("r.html", b"<!doctype html><h1>hi</h1>", "text/html")}
    up = await admin_client.post(f"/api/dashboards/{did}/upload", files=files)
    assert up.status_code == 200, up.text
    return did


async def test_login_success_recorded(admin_client):
    r = await admin_client.get("/api/audit", params={"event_type": "login_success"})
    assert r.status_code == 200
    body = r.json()
    assert body["total"] >= 1
    assert body["items"][0]["actor_email"] == os.environ["ADMIN_EMAIL"]


async def test_login_failed_recorded(client, admin_client):
    await client.post(
        "/api/auth/login",
        json={"email": "ghost@cvhtest.com", "password": "nope"},
        headers={"x-forwarded-for": "5.5.5.5"},
    )
    r = await admin_client.get("/api/audit", params={"event_type": "login_failed"})
    assert r.status_code == 200
    items = r.json()["items"]
    assert any(i["actor_email"] == "ghost@cvhtest.com" and i["ip"] == "5.5.5.5" for i in items)


async def test_dashboard_view_recorded(admin_client):
    did = await _create_html_dashboard(admin_client)
    tok = await admin_client.get(f"/api/dashboards/{did}/content-token")
    assert tok.status_code == 200
    r = await admin_client.get(
        "/api/audit", params={"event_type": "dashboard_view", "dashboard_id": did}
    )
    body = r.json()
    assert body["total"] >= 1
    assert body["items"][0]["target_id"] == did
    assert body["items"][0]["target_label"] == "Audit Dash"


async def test_audit_requires_admin(client):
    r = await client.get("/api/audit")
    assert r.status_code == 401  # not authenticated


async def test_summary_shape(admin_client):
    r = await admin_client.get("/api/audit/summary")
    assert r.status_code == 200
    body = r.json()
    assert set(body) == {"logins_7d", "failed_logins_7d", "active_users_7d", "top_dashboards"}
    assert body["logins_7d"] >= 1
