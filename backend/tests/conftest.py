import asyncio
import os

# Settings are read at import time (lru_cache). Set env BEFORE importing app.*
os.environ.setdefault("TESTING", "1")
os.environ.setdefault("SECRET_KEY", "x" * 40)
os.environ.setdefault(
    "DATABASE_URL",
    os.environ.get(
        "TEST_DATABASE_URL",
        "postgresql+asyncpg://cvh:cvh_password@localhost:5432/cvh_test",
    ),
)
os.environ.setdefault("ADMIN_EMAIL", "admin@cvhtest.com")
os.environ.setdefault("ADMIN_PASSWORD", "Admin12345!")

import pytest_asyncio  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402

from app import models  # noqa: E402,F401  (register tables on Base.metadata)
from app.db import Base, SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.seed import seed_admin  # noqa: E402
from app.security.limiter import limiter  # noqa: E402


async def _create_schema():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)


# Build the schema once, in an isolated loop. NullPool (TESTING=1) means no
# connection lingers past this call, so per-test loops never touch it.
asyncio.run(_create_schema())


@pytest_asyncio.fixture(autouse=True)
async def _clean():
    """Truncate everything after each test so tests are independent."""
    # The rate limiter is in-memory and shared across the session; reset it so
    # accumulated logins from earlier tests don't trip the 5/min cap.
    try:
        limiter.reset()
    except Exception:
        pass
    yield
    async with engine.begin() as conn:
        for table in reversed(Base.metadata.sorted_tables):
            await conn.execute(table.delete())


@pytest_asyncio.fixture
async def db():
    async with SessionLocal() as session:
        yield session


@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest_asyncio.fixture
async def admin_client(client):
    # Lifespan does not run under ASGITransport, so seed explicitly.
    await seed_admin()
    r = await client.post(
        "/api/auth/login",
        json={
            "email": os.environ["ADMIN_EMAIL"],
            "password": os.environ["ADMIN_PASSWORD"],
        },
    )
    assert r.status_code == 200, r.text
    client.headers["x-csrf-token"] = client.cookies.get("csrf_token")
    yield client
