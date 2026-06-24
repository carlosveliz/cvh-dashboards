async def test_last_login_reported(admin_client):
    # Admin logged in via the admin_client fixture, so it has a last_login_at.
    users = (await admin_client.get("/api/users")).json()
    admin = next(u for u in users if u["role"] == "admin")
    assert admin["last_login_at"] is not None


async def test_never_logged_in_is_null(admin_client):
    # A freshly created user that never logged in has no last_login_at.
    await admin_client.post(
        "/api/users",
        json={"email": "nologin@cvhtest.com", "password": "Passw0rd1", "role": "user"},
    )
    users = (await admin_client.get("/api/users")).json()
    fresh = next(u for u in users if u["email"] == "nologin@cvhtest.com")
    assert fresh["last_login_at"] is None
