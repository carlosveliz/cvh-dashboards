"""Audit recording and querying.

`record()` writes through its OWN session so it is independent of the caller's
transaction (it must work even when the handler raises, e.g. a failed login)
and can never break a request: any failure is logged and swallowed."""

import ipaddress
import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.requests import Request

from ..db import SessionLocal
from ..models import AuditLog, Dashboard, User

log = logging.getLogger("cvh.audit")

# Auth
LOGIN_SUCCESS = "login_success"
LOGIN_FAILED = "login_failed"
LOGOUT = "logout"
INVITE_ACCEPT = "invite_accept"
# Views
DASHBOARD_VIEW = "dashboard_view"
# Admin — dashboards
DASHBOARD_CREATE = "dashboard_create"
DASHBOARD_UPDATE = "dashboard_update"
DASHBOARD_DELETE = "dashboard_delete"
DASHBOARD_UPLOAD = "dashboard_upload"
# Admin — access & users
ACCESS_SET = "access_set"
USER_CREATE = "user_create"
USER_UPDATE = "user_update"
USER_DELETE = "user_delete"
INVITE_CREATE = "invite_create"


def _is_public(ip: str) -> bool:
    try:
        addr = ipaddress.ip_address(ip)
    except ValueError:
        return False
    return not (addr.is_private or addr.is_loopback or addr.is_link_local)


def _client_ip(request: Request | None) -> str | None:
    """Best-effort real client IP behind one or more proxies.

    X-Forwarded-For is a chain "client, proxy1, proxy2, ...". We return the
    first PUBLIC address in it (the real client when proxies append correctly),
    falling back to the leftmost entry, then X-Real-IP, then the direct peer.
    If everything is internal (e.g. accessed from the same network), an internal
    IP is the correct answer."""
    if request is None:
        return None
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        parts = [p.strip() for p in fwd.split(",") if p.strip()]
        for ip in parts:
            if _is_public(ip):
                return ip
        if parts:
            return parts[0]
    real = request.headers.get("x-real-ip")
    if real:
        return real.strip()
    return request.client.host if request.client else None


def _user_agent(request: Request | None) -> str | None:
    if request is None:
        return None
    ua = request.headers.get("user-agent")
    return ua[:400] if ua else None


async def record(
    *,
    event_type: str,
    request: Request | None = None,
    user: User | None = None,
    actor_email: str | None = None,
    target_type: str | None = None,
    target_id: uuid.UUID | None = None,
    target_label: str | None = None,
    meta: dict[str, Any] | None = None,
) -> None:
    try:
        async with SessionLocal() as db:
            db.add(
                AuditLog(
                    event_type=event_type,
                    user_id=user.id if user else None,
                    actor_email=actor_email or (user.email if user else None),
                    target_type=target_type,
                    target_id=target_id,
                    target_label=target_label,
                    ip=_client_ip(request),
                    user_agent=_user_agent(request),
                    meta=meta,
                )
            )
            await db.commit()
    except Exception:  # auditing must never break the request
        log.exception("audit record failed (%s)", event_type)


async def query(
    db: AsyncSession,
    *,
    event_type: str | None = None,
    user_id: uuid.UUID | None = None,
    dashboard_id: uuid.UUID | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[AuditLog], int]:
    conds = []
    if event_type:
        conds.append(AuditLog.event_type == event_type)
    if user_id:
        conds.append(AuditLog.user_id == user_id)
    if dashboard_id:
        conds.append(AuditLog.target_type == "dashboard")
        conds.append(AuditLog.target_id == dashboard_id)
    if date_from:
        conds.append(AuditLog.created_at >= date_from)
    if date_to:
        conds.append(AuditLog.created_at <= date_to)

    total = await db.scalar(select(func.count()).select_from(AuditLog).where(*conds))
    rows = await db.execute(
        select(AuditLog)
        .where(*conds)
        .order_by(AuditLog.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    return list(rows.scalars().all()), int(total or 0)


async def summary(db: AsyncSession) -> dict:
    since = datetime.now(timezone.utc) - timedelta(days=7)

    async def _count(*conds) -> int:
        return int(
            await db.scalar(select(func.count()).select_from(AuditLog).where(*conds)) or 0
        )

    logins_7d = await _count(
        AuditLog.event_type == LOGIN_SUCCESS, AuditLog.created_at >= since
    )
    failed_7d = await _count(
        AuditLog.event_type == LOGIN_FAILED, AuditLog.created_at >= since
    )
    active_users_7d = int(
        await db.scalar(
            select(func.count(func.distinct(AuditLog.user_id))).where(
                AuditLog.event_type == LOGIN_SUCCESS, AuditLog.created_at >= since
            )
        )
        or 0
    )
    top_rows = await db.execute(
        select(
            AuditLog.target_id,
            func.max(AuditLog.target_label),
            func.count().label("views"),
        )
        .where(AuditLog.event_type == DASHBOARD_VIEW, AuditLog.created_at >= since)
        .group_by(AuditLog.target_id)
        .order_by(func.count().desc())
        .limit(5)
    )
    top_dashboards = [
        {"id": str(tid), "name": label or "—", "views": int(views)}
        for tid, label, views in top_rows.all()
    ]
    return {
        "logins_7d": logins_7d,
        "failed_logins_7d": failed_7d,
        "active_users_7d": active_users_7d,
        "top_dashboards": top_dashboards,
    }
