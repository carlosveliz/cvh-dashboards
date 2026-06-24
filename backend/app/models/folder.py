import uuid
from datetime import datetime

from sqlalchemy import DateTime, Integer, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..db import Base


class Folder(Base):
    """A first-class folder for organising dashboards in the launcher.

    Dashboards with no folder fall into a virtual "General" group. `position`
    drives display order."""

    __tablename__ = "folder"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_by: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    dashboards: Mapped[list["Dashboard"]] = relationship(back_populates="folder")
