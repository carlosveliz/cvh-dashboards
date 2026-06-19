import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

DashboardType = Literal["static_html", "excel"]
Visibility = Literal["restricted", "internal", "external", "personal"]


class DashboardRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    slug: str
    name: str
    description: str | None = None
    type: str
    visibility: str
    file_name: str | None = None
    has_content: bool = False
    uploaded_at: datetime | None = None
    updated_at: datetime


class DashboardCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None
    type: DashboardType
    visibility: Visibility = "restricted"


class DashboardUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=255)
    description: str | None = None
    visibility: Visibility | None = None


class PermissionSet(BaseModel):
    # Generic list of ids: dashboard ids when setting a user's grants,
    # or user ids when setting a dashboard's grants.
    ids: list[uuid.UUID]


class ExcelSheet(BaseModel):
    name: str
    columns: list[str]
    rows: list[list[Any]]
    chart: dict[str, Any] | None = None


class ExcelData(BaseModel):
    sheets: list[ExcelSheet]
