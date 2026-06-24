import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import BigInteger, DateTime, ForeignKey, String, Text, Uuid, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..db import Base


class Dashboard(Base):
    __tablename__ = "dashboards"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    slug: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    # 'static_html' | 'excel'
    type: Mapped[str] = mapped_column(String(16), nullable=False)
    # UI hint only: 'restricted' | 'internal' | 'external' | 'personal'
    visibility: Mapped[str] = mapped_column(String(16), default="restricted", nullable=False)
    # Folder shown in the launcher (null -> virtual "General" group).
    folder_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("folder.id", ondelete="SET NULL"), nullable=True, index=True
    )
    # Excel chart config (null -> heuristic): {sheet, chart_type, category, series[]}
    excel_config: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)

    file_path: Mapped[str | None] = mapped_column(String, nullable=True)
    file_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    file_size: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    content_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    uploaded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_by: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    access_grants: Mapped[list["DashboardAccess"]] = relationship(
        back_populates="dashboard", cascade="all, delete-orphan"
    )
    folder: Mapped["Folder | None"] = relationship(back_populates="dashboards")
