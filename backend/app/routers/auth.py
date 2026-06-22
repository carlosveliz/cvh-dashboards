from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..models import Invitation, RefreshToken, User
from ..schemas import AcceptInvite, LoginRequest, MeResponse
from ..security.cookies import clear_auth_cookies, set_auth_cookies
from ..security.deps import REFRESH_COOKIE, get_current_user
from ..security.hashing import hash_password, sha256_hex, verify_password
from ..security.limiter import limiter
from ..security.tokens import (
    create_access_token,
    generate_opaque_token,
    refresh_expiry,
)
from ..services import audit

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _aware(dt: datetime) -> datetime:
    """Normalize to a tz-aware UTC datetime (some drivers return naive values)."""
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)


async def _issue_session(db: AsyncSession, response: Response, user: User) -> None:
    raw_refresh = generate_opaque_token()
    db.add(
        RefreshToken(
            user_id=user.id,
            token_hash=sha256_hex(raw_refresh),
            expires_at=refresh_expiry(),
        )
    )
    await db.commit()
    access = create_access_token(user.id, user.role)
    set_auth_cookies(response, access, raw_refresh)


@router.post("/login", response_model=MeResponse)
@limiter.limit("5/minute")
async def login(
    request: Request,
    payload: LoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    email = payload.email.lower().strip()
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if user is None or not user.password_hash or not verify_password(payload.password, user.password_hash):
        await audit.record(
            event_type=audit.LOGIN_FAILED, request=request,
            actor_email=email, meta={"reason": "bad_credentials"},
        )
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciales inválidas")
    if not user.is_active:
        await audit.record(
            event_type=audit.LOGIN_FAILED, request=request, user=user,
            actor_email=email, meta={"reason": "inactive"},
        )
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cuenta inactiva")
    await _issue_session(db, response, user)
    await audit.record(event_type=audit.LOGIN_SUCCESS, request=request, user=user)
    return MeResponse(id=user.id, email=user.email, role=user.role, display_name=user.display_name)


@router.post("/refresh", response_model=MeResponse)
async def refresh(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    raw = request.cookies.get(REFRESH_COOKIE)
    if not raw:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No refresh token")
    token_hash = sha256_hex(raw)
    result = await db.execute(select(RefreshToken).where(RefreshToken.token_hash == token_hash))
    rt = result.scalar_one_or_none()
    now = datetime.now(timezone.utc)
    if rt is None or rt.revoked_at is not None or _aware(rt.expires_at) <= now:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh inválido")
    user = await db.get(User, rt.user_id)
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario inválido")
    # Rotate: revoke old, issue new.
    rt.revoked_at = now
    await db.flush()
    await _issue_session(db, response, user)
    return MeResponse(id=user.id, email=user.email, role=user.role, display_name=user.display_name)


@router.post("/logout")
async def logout(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    raw = request.cookies.get(REFRESH_COOKIE)
    if raw:
        result = await db.execute(
            select(RefreshToken).where(RefreshToken.token_hash == sha256_hex(raw))
        )
        rt = result.scalar_one_or_none()
        if rt and rt.revoked_at is None:
            rt.revoked_at = datetime.now(timezone.utc)
            await db.commit()
            await audit.record(event_type=audit.LOGOUT, request=request, user=await db.get(User, rt.user_id))
    clear_auth_cookies(response)
    return {"ok": True}


@router.get("/me", response_model=MeResponse)
async def me(user: User = Depends(get_current_user)):
    return MeResponse(id=user.id, email=user.email, role=user.role, display_name=user.display_name)


@router.post("/invite/accept", response_model=MeResponse)
@limiter.limit("5/minute")
async def accept_invite(
    request: Request,
    payload: AcceptInvite,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    token_hash = sha256_hex(payload.token)
    result = await db.execute(select(Invitation).where(Invitation.token_hash == token_hash))
    inv = result.scalar_one_or_none()
    now = datetime.now(timezone.utc)
    if inv is None or inv.accepted_at is not None or _aware(inv.expires_at) <= now:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invitación inválida o expirada")

    email = inv.email.lower().strip()
    existing = await db.execute(select(User).where(User.email == email))
    user = existing.scalar_one_or_none()
    if user is None:
        user = User(email=email, role=inv.role, is_active=True)
        db.add(user)
    user.password_hash = hash_password(payload.password)
    user.is_active = True
    if payload.display_name:
        user.display_name = payload.display_name
    inv.accepted_at = now
    await db.commit()
    await db.refresh(user)
    await _issue_session(db, response, user)
    await audit.record(event_type=audit.INVITE_ACCEPT, request=request, user=user)
    return MeResponse(id=user.id, email=user.email, role=user.role, display_name=user.display_name)
