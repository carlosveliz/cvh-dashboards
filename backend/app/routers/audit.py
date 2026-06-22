import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..models import User
from ..schemas.audit import AuditPage, AuditSummary
from ..security.deps import require_admin
from ..services import audit

router = APIRouter(
    prefix="/api/audit",
    tags=["audit"],
    dependencies=[Depends(require_admin)],
)


@router.get("", response_model=AuditPage)
async def list_audit(
    db: AsyncSession = Depends(get_db),
    event_type: str | None = None,
    user_id: uuid.UUID | None = None,
    dashboard_id: uuid.UUID | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    items, total = await audit.query(
        db,
        event_type=event_type,
        user_id=user_id,
        dashboard_id=dashboard_id,
        date_from=date_from,
        date_to=date_to,
        limit=limit,
        offset=offset,
    )
    return AuditPage(items=items, total=total)


@router.get("/summary", response_model=AuditSummary)
async def audit_summary(db: AsyncSession = Depends(get_db)):
    return await audit.summary(db)
