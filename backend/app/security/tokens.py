import secrets
import uuid
from datetime import datetime, timedelta, timezone

import jwt
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

from ..config import settings

ALGORITHM = "HS256"
_content_serializer = URLSafeTimedSerializer(settings.secret_key, salt="dashboard-content")


def create_access_token(user_id: uuid.UUID, role: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "role": role,
        "iat": now,
        "exp": now + timedelta(minutes=settings.access_token_ttl_min),
        "type": "access",
    }
    return jwt.encode(payload, settings.secret_key, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict:
    return jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])


def generate_opaque_token() -> str:
    """Random token for refresh tokens and invitations (stored hashed)."""
    return secrets.token_urlsafe(48)


def refresh_expiry() -> datetime:
    return datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_ttl_days)


def make_content_token(dashboard_id: uuid.UUID, user_id: uuid.UUID) -> str:
    return _content_serializer.dumps({"d": str(dashboard_id), "u": str(user_id)})


def read_content_token(token: str) -> dict | None:
    try:
        data = _content_serializer.loads(token, max_age=settings.content_token_ttl_sec)
    except (BadSignature, SignatureExpired):
        return None
    return data
