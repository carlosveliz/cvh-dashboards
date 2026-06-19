import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..db import get_db
from ..models import DashboardAccess, Invitation, User
from ..schemas import (
    InvitationCreate,
    InvitationResult,
    PermissionSet,
    UserCreate,
    UserRead,
    UserUpdate,
)
from ..security.deps import require_admin, verify_csrf
from ..security.hashing import hash_password, sha256_hex
from ..security.tokens import generate_opaque_token
from ..services.email import send_invitation_email

router = APIRouter(
    prefix="/api/users",
    tags=["users"],
    dependencies=[Depends(verify_csrf), Depends(require_admin)],
)


@router.get("", response_model=list[UserRead])
async def list_users(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).order_by(User.created_at))
    return result.scalars().all()


@router.post("", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def create_user(payload: UserCreate, db: AsyncSession = Depends(get_db)):
    email = payload.email.lower().strip()
    existing = await db.execute(select(User.id).where(User.email == email))
    if existing.first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="El email ya existe")
    user = User(
        email=email,
        password_hash=hash_password(payload.password),
        role=payload.role,
        display_name=payload.display_name,
        is_active=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.patch("/{user_id}", response_model=UserRead)
async def update_user(user_id: uuid.UUID, payload: UserUpdate, db: AsyncSession = Depends(get_db)):
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No encontrado")
    if payload.role is not None:
        user.role = payload.role
    if payload.is_active is not None:
        user.is_active = payload.is_active
    if payload.display_name is not None:
        user.display_name = payload.display_name
    if payload.password is not None:
        user.password_hash = hash_password(payload.password)
    await db.commit()
    await db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: uuid.UUID, db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)
):
    if user_id == admin.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No puedes eliminarte a ti mismo")
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No encontrado")
    await db.delete(user)
    await db.commit()


@router.post("/invite", response_model=InvitationResult)
async def invite_user(
    payload: InvitationCreate, db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)
):
    email = payload.email.lower().strip()
    raw_token = generate_opaque_token()
    inv = Invitation(
        email=email,
        token_hash=sha256_hex(raw_token),
        role=payload.role,
        invited_by=admin.id,
        expires_at=datetime.now(timezone.utc) + timedelta(days=7),
    )
    db.add(inv)
    await db.commit()
    invite_url = f"{settings.app_base_url}/accept-invite?token={raw_token}"
    emailed = False
    try:
        emailed = send_invitation_email(email, invite_url)
    except Exception:
        emailed = False
    return InvitationResult(email=email, invite_url=invite_url, emailed=emailed)


@router.get("/{user_id}/permissions", response_model=list[uuid.UUID])
async def get_user_permissions(user_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(DashboardAccess.dashboard_id).where(DashboardAccess.user_id == user_id)
    )
    return [row[0] for row in result.all()]


@router.put("/{user_id}/permissions", response_model=list[uuid.UUID])
async def set_user_permissions(
    user_id: uuid.UUID,
    payload: PermissionSet,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No encontrado")
    await db.execute(delete(DashboardAccess).where(DashboardAccess.user_id == user_id))
    for dashboard_id in set(payload.ids):
        db.add(DashboardAccess(user_id=user_id, dashboard_id=dashboard_id, granted_by=admin.id))
    await db.commit()
    result = await db.execute(
        select(DashboardAccess.dashboard_id).where(DashboardAccess.user_id == user_id)
    )
    return [row[0] for row in result.all()]
