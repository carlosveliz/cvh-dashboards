import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..models import Dashboard, Folder, User
from ..schemas import FolderCreate, FolderRead, FolderReorder, FolderUpdate
from ..security.deps import require_admin, verify_csrf

router = APIRouter(
    prefix="/api/folders",
    tags=["folders"],
    dependencies=[Depends(verify_csrf), Depends(require_admin)],
)


async def _list_with_counts(db: AsyncSession) -> list[FolderRead]:
    rows = await db.execute(
        select(Folder, func.count(Dashboard.id))
        .outerjoin(Dashboard, Dashboard.folder_id == Folder.id)
        .group_by(Folder.id)
        .order_by(Folder.position, Folder.name)
    )
    return [
        FolderRead(id=f.id, name=f.name, position=f.position, dashboard_count=int(n))
        for f, n in rows.all()
    ]


@router.get("", response_model=list[FolderRead])
async def list_folders(db: AsyncSession = Depends(get_db)):
    return await _list_with_counts(db)


@router.post("", response_model=FolderRead, status_code=status.HTTP_201_CREATED)
async def create_folder(
    payload: FolderCreate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    name = payload.name.strip()
    next_pos = (await db.scalar(select(func.coalesce(func.max(Folder.position), -1)))) + 1
    folder = Folder(name=name, position=next_pos, created_by=admin.id)
    db.add(folder)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Ya existe una carpeta con ese nombre")
    await db.refresh(folder)
    return FolderRead(id=folder.id, name=folder.name, position=folder.position, dashboard_count=0)


@router.patch("/{folder_id}", response_model=FolderRead)
async def rename_folder(
    folder_id: uuid.UUID,
    payload: FolderUpdate,
    db: AsyncSession = Depends(get_db),
):
    folder = await db.get(Folder, folder_id)
    if folder is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Carpeta no encontrada")
    folder.name = payload.name.strip()
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Ya existe una carpeta con ese nombre")
    count = await db.scalar(
        select(func.count(Dashboard.id)).where(Dashboard.folder_id == folder_id)
    )
    return FolderRead(id=folder.id, name=folder.name, position=folder.position, dashboard_count=int(count or 0))


@router.delete("/{folder_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_folder(folder_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    folder = await db.get(Folder, folder_id)
    if folder is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Carpeta no encontrada")
    # Dashboards in this folder fall back to "General" (folder_id -> NULL).
    await db.execute(
        update(Dashboard).where(Dashboard.folder_id == folder_id).values(folder_id=None)
    )
    await db.execute(delete(Folder).where(Folder.id == folder_id))
    await db.commit()


@router.put("/reorder", response_model=list[FolderRead])
async def reorder_folders(
    payload: FolderReorder,
    db: AsyncSession = Depends(get_db),
):
    for position, folder_id in enumerate(payload.ids):
        await db.execute(
            update(Folder).where(Folder.id == folder_id).values(position=position)
        )
    await db.commit()
    return await _list_with_counts(db)
