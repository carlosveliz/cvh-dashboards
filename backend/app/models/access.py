import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, UniqueConstraint, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..db import Base


class DashboardAccess(Base):
    __tablename__ = "dashboard_access"
    __table_args__ = (UniqueConstraint("user_id", "dashboard_id", name="uq_user_dashboard"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    dashboard_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("dashboards.id", ondelete="CASCADE"), nullable=False, index=True
    )
    granted_by: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    granted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    user: Mapped["User"] = relationship(back_populates="access_grants")
    dashboard: Mapped["Dashboard"] = relationship(back_populates="access_grants")
