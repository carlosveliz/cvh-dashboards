from datetime import datetime, timedelta, timezone

from app.models import Invitation, RefreshToken, User
from app.security.hashing import sha256_hex
from app.startup import cleanup_once


async def test_cleanup_removes_expired(db):
    u = User(email="c@cvhtest.com", password_hash="x", role="user", is_active=True)
    db.add(u)
    await db.flush()
    past = datetime.now(timezone.utc) - timedelta(days=1)
    db.add(RefreshToken(user_id=u.id, token_hash=sha256_hex("a"), expires_at=past))
    db.add(
        Invitation(
            email="i@cvhtest.com",
            token_hash=sha256_hex("b"),
            role="user",
            invited_by=u.id,
            expires_at=past,
        )
    )
    await db.commit()

    counts = await cleanup_once(db)
    assert counts["refresh_deleted"] >= 1
    assert counts["invites_deleted"] >= 1


async def test_cleanup_keeps_valid(db):
    u = User(email="d@cvhtest.com", password_hash="x", role="user", is_active=True)
    db.add(u)
    await db.flush()
    future = datetime.now(timezone.utc) + timedelta(days=1)
    db.add(RefreshToken(user_id=u.id, token_hash=sha256_hex("valid"), expires_at=future))
    await db.commit()

    counts = await cleanup_once(db)
    assert counts["refresh_deleted"] == 0
