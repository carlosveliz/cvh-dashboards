async def test_health(client):
    r = await client.get("/api/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


async def test_admin_login(admin_client):
    r = await admin_client.get("/api/auth/me")
    assert r.status_code == 200
    assert r.json()["role"] == "admin"
