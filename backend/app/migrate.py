"""Run DB migrations on startup, adopting a pre-Alembic schema if needed.

If the database already has the app's tables but no `alembic_version` (it was
created by an older `create_all` build), we stamp the baseline as applied so
Alembic won't try to re-create existing tables, then upgrade to head. A fresh
or already-managed database just upgrades to head normally."""

import asyncio
import logging

from alembic import command
from alembic.config import Config
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from .config import settings

log = logging.getLogger("cvh.migrate")

BASELINE_REVISION = "3a87edb88fd7"


async def _schema_state() -> tuple[bool, bool]:
    """Return (has_app_tables, alembic_initialised)."""
    engine = create_async_engine(settings.db_url)
    try:
        async with engine.connect() as conn:
            has_alembic = await conn.scalar(
                text(
                    "select exists (select from information_schema.tables "
                    "where table_name = 'alembic_version')"
                )
            )
            has_tables = await conn.scalar(
                text(
                    "select exists (select from information_schema.tables "
                    "where table_name = 'dashboards')"
                )
            )
        return bool(has_tables), bool(has_alembic)
    finally:
        await engine.dispose()


def main() -> None:
    cfg = Config("alembic.ini")
    has_tables, alembic_ready = asyncio.run(_schema_state())
    if has_tables and not alembic_ready:
        log.info("Adopting existing pre-Alembic schema: stamping baseline %s", BASELINE_REVISION)
        command.stamp(cfg, BASELINE_REVISION)
    command.upgrade(cfg, "head")


if __name__ == "__main__":
    main()
