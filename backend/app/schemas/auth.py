import uuid

from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class MeResponse(BaseModel):
    id: uuid.UUID
    email: EmailStr
    role: str
    display_name: str | None = None


class AcceptInvite(BaseModel):
    token: str
    password: str = Field(min_length=8)
    display_name: str | None = None
