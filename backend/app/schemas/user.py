import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

Role = Literal["admin", "user"]


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: EmailStr
    role: str
    is_active: bool
    display_name: str | None = None
    created_at: datetime


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    role: Role = "user"
    display_name: str | None = None


class UserUpdate(BaseModel):
    role: Role | None = None
    is_active: bool | None = None
    display_name: str | None = None
    password: str | None = Field(default=None, min_length=8)


class InvitationCreate(BaseModel):
    email: EmailStr
    role: Role = "user"


class InvitationResult(BaseModel):
    email: EmailStr
    invite_url: str
    emailed: bool
