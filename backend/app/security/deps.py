import uuid

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..models import DashboardAccess, User
from .tokens import decode_access_token

ACCESS_COOKIE = "access_token"
REFRESH_COOKIE = "refresh_token"
CSRF_COOKIE = "csrf_token"
CSRF_HEADER = "x-csrf-token"
UNSAFE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


async def get_current_user(
    request: Request, db: AsyncSession = Depends(get_db)
) -> User:
    token = request.cookies.get(ACCESS_COOKIE)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    try:
        payload = decode_access_token(token)
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    user_id = payload.get("sub")
    user = await db.get(User, uuid.UUID(user_id)) if user_id else None
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Inactive or unknown user")
    return user


async def require_admin(user: User = Depends(get_current_user)) -> User:
    if not user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")
    return user


def verify_csrf(request: Request) -> None:
    """Double-submit cookie CSRF check for state-changing requests."""
    if request.method not in UNSAFE_METHODS:
        return
    cookie = request.cookies.get(CSRF_COOKIE)
    header = request.headers.get(CSRF_HEADER)
    if not cookie or not header or cookie != header:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="CSRF check failed")


async def user_has_access(db: AsyncSession, user: User, dashboard_id: uuid.UUID) -> bool:
    if user.is_admin:
        return True
    result = await db.execute(
        select(DashboardAccess.id).where(
            DashboardAccess.user_id == user.id,
            DashboardAccess.dashboard_id == dashboard_id,
        )
    )
    return result.first() is not None
