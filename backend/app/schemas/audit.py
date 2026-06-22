import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict


class AuditRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime
    user_id: uuid.UUID | None = None
    actor_email: str | None = None
    event_type: str
    target_type: str | None = None
    target_id: uuid.UUID | None = None
    target_label: str | None = None
    ip: str | None = None
    user_agent: str | None = None
    meta: dict[str, Any] | None = None


class AuditPage(BaseModel):
    items: list[AuditRead]
    total: int


class TopDashboard(BaseModel):
    id: str
    name: str
    views: int


class AuditSummary(BaseModel):
    logins_7d: int
    failed_logins_7d: int
    active_users_7d: int
    top_dashboards: list[TopDashboard]
