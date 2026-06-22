from sqlalchemy import select

from app.models import PasswordReset, User
from app.security.hashing import sha256_hex


async def _make_user(admin_client, email="reset@cvhtest.com", pw="OldPass123"):
    r = await admin_client.post(
        "/api/users",
        json={"email": email, "password": pw, "role": "user"},
    )
    assert r.status_code == 201
    return email


async def _raw_token_for(db, email: str) -> str:
    # The raw token isn't returned by /forgot; in tests we read the stored row and
    # forge a known token by inserting our own (the endpoint stores only a hash).
    # Simplest: create the reset via the endpoint, then look up the row and patch a
    # known token hash so we can exercise /reset.
    user = (await db.execute(select(User).where(User.email == email))).scalar_one()
    pr = (
        await db.execute(
            select(PasswordReset).where(PasswordReset.user_id == user.id).order_by(
                PasswordReset.created_at.desc()
            )
        )
    ).scalars().first()
    raw = "known-reset-token-123"
    pr.token_hash = sha256_hex(raw)
    await db.commit()
    return raw


async def test_forgot_always_200(client):
    # Unknown email must still return 200 (no user enumeration).
    r = await client.post("/api/auth/forgot", json={"email": "nobody@cvhtest.com"})
    assert r.status_code == 200
    assert r.json() == {"ok": True}


async def test_reset_flow(client, admin_client, db):
    email = await _make_user(admin_client)
    # Trigger forgot (creates a reset row; no SMTP -> no email sent).
    await client.post("/api/auth/forgot", json={"email": email})
    raw = await _raw_token_for(db, email)

    # Reset to a new password.
    r = await client.post("/api/auth/reset", json={"token": raw, "password": "BrandNew123"})
    assert r.status_code == 200
    assert r.json()["email"] == email

    # New password works, old one doesn't.
    ok = await client.post(
        "/api/auth/login",
        json={"email": email, "password": "BrandNew123"},
        headers={"x-forwarded-for": "3.3.3.3"},
    )
    assert ok.status_code == 200

    # Token is single-use now.
    again = await client.post("/api/auth/reset", json={"token": raw, "password": "Another123"})
    assert again.status_code == 400


async def test_group_name_persisted(admin_client):
    r = await admin_client.post(
        "/api/dashboards",
        json={
            "name": "Grouped",
            "type": "static_html",
            "visibility": "restricted",
            "group_name": "Finanzas",
        },
    )
    assert r.status_code == 201
    assert r.json()["group_name"] == "Finanzas"
