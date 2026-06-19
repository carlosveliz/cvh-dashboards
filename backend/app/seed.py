from sqlalchemy import select

from .config import settings
from .db import SessionLocal
from .models import User
from .security.hashing import hash_password


async def seed_admin() -> None:
    """Create the bootstrap admin from env vars if no admin exists yet."""
    async with SessionLocal() as db:
        existing = await db.execute(select(User.id).where(User.role == "admin"))
        if existing.first():
            return
        admin = User(
            email=settings.admin_email.lower().strip(),
            password_hash=hash_password(settings.admin_password),
            role="admin",
            display_name=settings.admin_name,
            is_active=True,
        )
        db.add(admin)
        await db.commit()
