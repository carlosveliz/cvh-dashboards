from pydantic import EmailStr, TypeAdapter
from sqlalchemy import select

from .config import settings
from .db import SessionLocal
from .models import User
from .security.hashing import hash_password

_email_adapter = TypeAdapter(EmailStr)


def _ensure_loginable_email(email: str) -> None:
    """The admin is seeded directly (no request validation), but /api/auth/login
    validates with EmailStr, which rejects reserved/special-use domains
    (.local, .test, .example, localhost, ...). Fail fast with a clear message so
    a bad ADMIN_EMAIL can't seed an admin that is then unable to log in."""
    try:
        _email_adapter.validate_python(email)
    except Exception as exc:
        raise RuntimeError(
            f"ADMIN_EMAIL no es válido para iniciar sesión: {email!r}. "
            "Usa un dominio real (evita .local/.test/.example/localhost); de lo "
            "contrario el admin se crea pero no puede autenticarse."
        ) from exc


async def seed_admin() -> None:
    """Create the bootstrap admin from env vars if no admin exists yet."""
    async with SessionLocal() as db:
        existing = await db.execute(select(User.id).where(User.role == "admin"))
        if existing.first():
            return
        email = settings.admin_email.lower().strip()
        _ensure_loginable_email(email)
        admin = User(
            email=email,
            password_hash=hash_password(settings.admin_password),
            role="admin",
            display_name=settings.admin_name,
            is_active=True,
        )
        db.add(admin)
        await db.commit()
