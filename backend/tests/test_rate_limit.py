async def test_login_rate_limited(client):
    last = None
    for _ in range(7):
        last = await client.post(
            "/api/auth/login",
            json={"email": "nobody@cvhtest.com", "password": "x"},
            headers={"x-forwarded-for": "9.9.9.9"},
        )
    assert last.status_code == 429


async def test_login_per_ip(client):
    # A different IP is not penalised by another IP's attempts.
    for _ in range(6):
        await client.post(
            "/api/auth/login",
            json={"email": "nobody@cvhtest.com", "password": "x"},
            headers={"x-forwarded-for": "1.1.1.1"},
        )
    r = await client.post(
        "/api/auth/login",
        json={"email": "nobody@cvhtest.com", "password": "x"},
        headers={"x-forwarded-for": "2.2.2.2"},
    )
    assert r.status_code == 401  # rejected for bad creds, not rate-limited
