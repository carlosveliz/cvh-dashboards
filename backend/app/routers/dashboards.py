import re
import uuid

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    Request,
    UploadFile,
    status,
)
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..db import get_db
from ..models import Dashboard, DashboardAccess, User
from ..schemas import (
    DashboardCreate,
    DashboardRead,
    DashboardUpdate,
    PermissionSet,
)
from ..schemas.dashboard import ExcelData
from ..security.deps import get_current_user, require_admin, user_has_access, verify_csrf
from ..security.tokens import make_content_token
from ..services import audit, storage
from ..services.excel_renderer import render_excel

router = APIRouter(prefix="/api/dashboards", tags=["dashboards"])


def _slugify(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return slug or "dashboard"


def _to_read(d: Dashboard) -> DashboardRead:
    return DashboardRead(
        id=d.id,
        slug=d.slug,
        name=d.name,
        description=d.description,
        type=d.type,
        visibility=d.visibility,
        file_name=d.file_name,
        has_content=bool(d.file_path),
        uploaded_at=d.uploaded_at,
        updated_at=d.updated_at,
    )


async def _get_or_404(db: AsyncSession, dashboard_id: uuid.UUID) -> Dashboard:
    d = await db.get(Dashboard, dashboard_id)
    if d is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No encontrado")
    return d


# ---------- Listing / viewing ----------

@router.get("", response_model=list[DashboardRead])
async def list_dashboards(
    db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)
):
    if user.is_admin:
        result = await db.execute(select(Dashboard).order_by(Dashboard.name))
        return [_to_read(d) for d in result.scalars().all()]
    result = await db.execute(
        select(Dashboard)
        .join(DashboardAccess, DashboardAccess.dashboard_id == Dashboard.id)
        .where(DashboardAccess.user_id == user.id)
        .order_by(Dashboard.name)
    )
    return [_to_read(d) for d in result.scalars().all()]


@router.get("/{dashboard_id}", response_model=DashboardRead)
async def get_dashboard(
    dashboard_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    d = await _get_or_404(db, dashboard_id)
    if not await user_has_access(db, user, d.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Sin acceso")
    return _to_read(d)


@router.get("/{dashboard_id}/content-token")
async def content_token(
    dashboard_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    d = await _get_or_404(db, dashboard_id)
    if d.type != "static_html":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No es HTML estático")
    if not await user_has_access(db, user, d.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Sin acceso")
    if not d.file_path:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sin contenido")
    token = make_content_token(d.id, user.id)
    await audit.record(
        event_type=audit.DASHBOARD_VIEW, request=request, user=user,
        target_type="dashboard", target_id=d.id, target_label=d.name,
    )
    return {"token": token, "src": f"/dash/{d.slug}?t={token}"}


@router.get("/{dashboard_id}/data", response_model=ExcelData)
async def excel_data(
    dashboard_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    d = await _get_or_404(db, dashboard_id)
    if d.type != "excel":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No es un dashboard de Excel")
    if not await user_has_access(db, user, d.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Sin acceso")
    if not d.file_path:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sin contenido")
    raw = storage.read_file(d.file_path)
    await audit.record(
        event_type=audit.DASHBOARD_VIEW, request=request, user=user,
        target_type="dashboard", target_id=d.id, target_label=d.name,
    )
    return render_excel(raw)


# ---------- Admin CRUD ----------

@router.post(
    "",
    response_model=DashboardRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(verify_csrf)],
)
async def create_dashboard(
    payload: DashboardCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    base = _slugify(payload.name)
    slug = base
    suffix = 1
    while (await db.execute(select(Dashboard.id).where(Dashboard.slug == slug))).first():
        suffix += 1
        slug = f"{base}-{suffix}"
    d = Dashboard(
        slug=slug,
        name=payload.name,
        description=payload.description,
        type=payload.type,
        visibility=payload.visibility,
        created_by=admin.id,
    )
    db.add(d)
    await db.commit()
    await db.refresh(d)
    await audit.record(
        event_type=audit.DASHBOARD_CREATE, request=request, user=admin,
        target_type="dashboard", target_id=d.id, target_label=d.name,
        meta={"type": d.type},
    )
    return _to_read(d)


@router.patch("/{dashboard_id}", response_model=DashboardRead, dependencies=[Depends(verify_csrf)])
async def update_dashboard(
    dashboard_id: uuid.UUID,
    payload: DashboardUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    d = await _get_or_404(db, dashboard_id)
    if payload.name is not None:
        d.name = payload.name
    if payload.description is not None:
        d.description = payload.description
    if payload.visibility is not None:
        d.visibility = payload.visibility
    await db.commit()
    await db.refresh(d)
    await audit.record(
        event_type=audit.DASHBOARD_UPDATE, request=request, user=admin,
        target_type="dashboard", target_id=d.id, target_label=d.name,
    )
    return _to_read(d)


@router.delete(
    "/{dashboard_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(verify_csrf)],
)
async def delete_dashboard(
    dashboard_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    d = await _get_or_404(db, dashboard_id)
    label = d.name
    storage.delete_file(d.file_path)
    await db.delete(d)
    await db.commit()
    await audit.record(
        event_type=audit.DASHBOARD_DELETE, request=request, user=admin,
        target_type="dashboard", target_id=dashboard_id, target_label=label,
    )


@router.post("/{dashboard_id}/upload", response_model=DashboardRead, dependencies=[Depends(verify_csrf)])
async def upload_content(
    dashboard_id: uuid.UUID,
    request: Request,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    d = await _get_or_404(db, dashboard_id)
    raw = await file.read()
    max_bytes = settings.max_upload_mb * 1024 * 1024
    if len(raw) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"El archivo supera {settings.max_upload_mb} MB",
        )

    name = (file.filename or "").lower()
    if d.type == "static_html" and not name.endswith((".html", ".htm")):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Se espera un archivo .html")
    if d.type == "excel" and not name.endswith(".xlsx"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Se espera un archivo .xlsx")

    if d.type == "excel":
        try:
            render_excel(raw)  # validate it parses before storing
        except Exception:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No se pudo leer el Excel")

    rel_path, size, digest = storage.save_upload(d.id, d.type, raw)
    from datetime import datetime, timezone

    d.file_path = rel_path
    d.file_name = file.filename
    d.file_size = size
    d.content_hash = digest
    d.uploaded_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(d)
    await audit.record(
        event_type=audit.DASHBOARD_UPLOAD, request=request, user=admin,
        target_type="dashboard", target_id=d.id, target_label=d.name,
        meta={"file_name": d.file_name, "size": size},
    )
    return _to_read(d)


# ---------- Permissions (admin) ----------

@router.get("/{dashboard_id}/permissions", response_model=list[uuid.UUID])
async def get_dashboard_permissions(
    dashboard_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    result = await db.execute(
        select(DashboardAccess.user_id).where(DashboardAccess.dashboard_id == dashboard_id)
    )
    return [row[0] for row in result.all()]


@router.put("/{dashboard_id}/permissions", response_model=list[uuid.UUID], dependencies=[Depends(verify_csrf)])
async def set_dashboard_permissions(
    dashboard_id: uuid.UUID,
    payload: PermissionSet,
    request: Request,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    d = await _get_or_404(db, dashboard_id)
    await db.execute(delete(DashboardAccess).where(DashboardAccess.dashboard_id == dashboard_id))
    for user_id in set(payload.ids):
        db.add(DashboardAccess(user_id=user_id, dashboard_id=dashboard_id, granted_by=admin.id))
    await db.commit()
    result = await db.execute(
        select(DashboardAccess.user_id).where(DashboardAccess.dashboard_id == dashboard_id)
    )
    user_ids = [row[0] for row in result.all()]
    await audit.record(
        event_type=audit.ACCESS_SET, request=request, user=admin,
        target_type="dashboard", target_id=dashboard_id, target_label=d.name,
        meta={"subject": "dashboard", "user_ids": [str(u) for u in user_ids]},
    )
    return user_ids
