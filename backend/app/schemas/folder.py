import uuid

from pydantic import BaseModel, Field


class FolderCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class FolderUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class FolderRead(BaseModel):
    id: uuid.UUID
    name: str
    position: int
    dashboard_count: int = 0


class FolderReorder(BaseModel):
    # Folder ids in the desired display order.
    ids: list[uuid.UUID]
