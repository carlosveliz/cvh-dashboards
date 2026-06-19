import uuid

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..models import Dashboard, DashboardAccess, User
from ..security.tokens import read_content_token
from ..services import storage

router = APIRouter(prefix="/dash", tags=["content"])

# Strict CSP: the uploaded HTML is self-contained. It may inline its own JS/CSS,
# but cannot reach back to the app. frame-ancestors restricts who can embed it.
CONTENT_SECURITY_POLICY = (
    "default-src 'self' data: blob: https:; "
    "img-src 'self' data: blob: https:; "
    "style-src 'self' 'unsafe-inline' https:; "
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; "
    "font-src 'self' data: https:; "
    "connect-src 'self' https:; "
    "frame-ancestors 'self';"
)


async def _user_can_view(db: AsyncSession, user_id: uuid.UUID, dashboard_id: uuid.UUID) -> bool:
    user = await db.get(User, user_id)
    if user is None or not user.is_active:
        return False
    if user.role == "admin":
        return True
    result = await db.execute(
        select(DashboardAccess.id).where(
            DashboardAccess.user_id == user_id,
            DashboardAccess.dashboard_id == dashboard_id,
        )
    )
    return result.first() is not None


@router.get("/{slug}")
async def serve_content(slug: str, t: str = "", db: AsyncSession = Depends(get_db)):
    data = read_content_token(t) if t else None
    if not data:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Token inválido o expirado")

    result = await db.execute(select(Dashboard).where(Dashboard.slug == slug))
    dashboard = result.scalar_one_or_none()
    if dashboard is None or dashboard.type != "static_html" or not dashboard.file_path:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No encontrado")

    # Token must be bound to THIS dashboard, and the user must still have access.
    if data.get("d") != str(dashboard.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Token no corresponde")
    user_id = uuid.UUID(data["u"])
    if not await _user_can_view(db, user_id, dashboard.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Sin acceso")

    html = storage.read_file(dashboard.file_path)
    return Response(
        content=html,
        media_type="text/html; charset=utf-8",
        headers={
            "Content-Security-Policy": CONTENT_SECURITY_POLICY,
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "no-store",
        },
    )
