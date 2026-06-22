import asyncio
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from .db import SessionLocal
from .models import Invitation, RefreshToken

log = logging.getLogger("cvh.cleanup")

_WEAK_SECRETS = {"", "change-me", "change-me-to-a-long-random-string"}
_CLEANUP_INTERVAL_SEC = 6 * 3600


def check_secret_key(value: str) -> None:
    """Fail fast on a default or too-short SECRET_KEY.

    The key signs JWTs and content tokens; a weak/default value is a security
    hole and a foot-gun (rotating it invalidates every session)."""
    if value in _WEAK_SECRETS or len(value) < 32:
        raise RuntimeError(
            "SECRET_KEY débil o por defecto. Define uno aleatorio de >=32 chars, "
            'p.ej. `python -c "import secrets; print(secrets.token_urlsafe(48))"`.'
        )


async def cleanup_once(db: AsyncSession) -> dict:
    """Delete expired refresh tokens and expired, never-accepted invitations.

    Refresh tokens are removed once expired, or 7 days after being revoked
    (kept briefly for audit/debug). Returns the deleted row counts."""
    now = datetime.now(timezone.utc)
    grace = now - timedelta(days=7)
    r = await db.execute(
        delete(RefreshToken).where(
            (RefreshToken.expires_at < now) | (RefreshToken.revoked_at < grace)
        )
    )
    i = await db.execute(
        delete(Invitation).where(
            (Invitation.expires_at < now) & (Invitation.accepted_at.is_(None))
        )
    )
    await db.commit()
    return {"refresh_deleted": r.rowcount or 0, "invites_deleted": i.rowcount or 0}


async def _cleanup_loop() -> None:
    while True:
        try:
            async with SessionLocal() as db:
                counts = await cleanup_once(db)
            log.info("cleanup %s", counts)
        except Exception:  # never let the loop die
            log.exception("cleanup failed")
        await asyncio.sleep(_CLEANUP_INTERVAL_SEC)


def start_cleanup_loop() -> asyncio.Task:
    return asyncio.create_task(_cleanup_loop())
