# Package 1 — Production Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the backend production-safe: real DB migrations (Alembic), a pytest harness, login rate-limiting, a SECRET_KEY guard, backend healthcheck, periodic cleanup, and structured logging.

**Architecture:** FastAPI app keeps its current structure. Schema management moves from `Base.metadata.create_all` to Alembic, run by a container entrypoint before uvicorn. Cross-cutting concerns (rate-limit, logging, cleanup, secret guard) are wired in `main.py`/`lifespan`. A pytest harness runs against a disposable Postgres so all later packages are test-first.

**Tech Stack:** FastAPI, SQLAlchemy 2 async, asyncpg, Alembic, slowapi, sentry-sdk (optional), pytest + pytest-asyncio + httpx.

## Global Constraints

- Python deps pinned in `backend/requirements.txt` (match existing pin style `pkg==x.y.z`).
- DB is Postgres only (JSONB/ARRAY used later); tests run against Postgres, not SQLite.
- Async everywhere (SQLAlchemy async sessions, httpx AsyncClient).
- Commits: no `Co-Authored-By` line.
- Work on branch `claude/dashboard-management-platform-7elwv7` (stacked on PR #1).
- Verify against the isolated stack: `docker compose -p cvh-verify -f docker-compose.verify.yml ...` (frontend 8099, backend 18000).

## File Structure

- `backend/requirements.txt` — add alembic, slowapi, sentry-sdk; test deps.
- `backend/alembic.ini` — Alembic config (script location `migrations`).
- `backend/migrations/env.py` — async Alembic env, `target_metadata = Base.metadata`.
- `backend/migrations/script.py.mako` — migration template.
- `backend/migrations/versions/*.py` — generated migrations.
- `backend/docker-entrypoint.sh` — `alembic upgrade head` then exec uvicorn.
- `backend/Dockerfile` — copy entrypoint, set ENTRYPOINT.
- `backend/app/config.py` — add `sentry_dsn`, `app_env`.
- `backend/app/main.py` — remove create_all; wire limiter, logging, cleanup, guard, sentry.
- `backend/app/observability.py` — logging config + request middleware + sentry init.
- `backend/app/security/limiter.py` — slowapi `Limiter` + key func.
- `backend/app/startup.py` — `check_secret_key()`, cleanup loop.
- `backend/tests/conftest.py` — app + DB fixtures, AsyncClient, auth helpers.
- `backend/tests/test_smoke.py`, `backend/tests/test_secret_guard.py`, `backend/tests/test_rate_limit.py`, `backend/tests/test_cleanup.py`.
- `backend/pytest.ini` — pytest/asyncio config.
- `docker-compose.yml`, `docker-compose.dev.yml` — backend healthcheck, frontend depends_on healthy, test DB note.
- `docker-compose.test.yml` — ephemeral Postgres + test runner.

---

### Task 1: Pytest harness against Postgres

**Files:**
- Create: `backend/pytest.ini`, `backend/tests/__init__.py`, `backend/tests/conftest.py`, `backend/tests/test_smoke.py`
- Create: `docker-compose.test.yml`
- Modify: `backend/requirements.txt`

**Interfaces:**
- Produces: pytest fixtures `db` (AsyncSession), `client` (httpx.AsyncClient bound to the app), `admin_client` (logged-in admin with CSRF header set). Env `TEST_DATABASE_URL` selects the test DB. Helper `login(client, email, password) -> csrf`.

- [ ] **Step 1: Add test deps to `backend/requirements.txt`**

```
pytest==8.3.4
pytest-asyncio==0.25.2
httpx==0.28.1
aiosqlite==0.20.0
```
(httpx for AsyncClient; aiosqlite NOT used — Postgres only — remove if unused after.)

- [ ] **Step 2: `backend/pytest.ini`**

```ini
[pytest]
asyncio_mode = auto
testpaths = tests
addopts = -q
```

- [ ] **Step 3: `backend/tests/conftest.py`** — create the app against `TEST_DATABASE_URL`, build/drop schema per session via `Base.metadata`, truncate tables between tests, expose `client`/`admin_client`.

```python
import os
import uuid
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

os.environ.setdefault("SECRET_KEY", "x" * 40)  # pass the secret guard in tests
os.environ.setdefault("DATABASE_URL", os.environ.get("TEST_DATABASE_URL",
    "postgresql+asyncpg://cvh:cvh_password@localhost:5432/cvh_test"))
os.environ.setdefault("ADMIN_EMAIL", "admin@cvhtest.com")
os.environ.setdefault("ADMIN_PASSWORD", "Admin12345!")

from app.db import Base  # noqa: E402
from app import models  # noqa: E402,F401
from app.main import app  # noqa: E402

ENGINE = create_async_engine(os.environ["DATABASE_URL"], future=True)

@pytest_asyncio.fixture(scope="session", autouse=True)
async def _schema():
    async with ENGINE.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield

@pytest_asyncio.fixture(autouse=True)
async def _clean():
    yield
    async with ENGINE.begin() as conn:
        for t in reversed(Base.metadata.sorted_tables):
            await conn.execute(t.delete())

@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c

async def _seed_admin_via_app(c):
    # app lifespan seeds admin on startup; ASGITransport triggers lifespan.
    r = await c.post("/api/auth/login",
                     json={"email": os.environ["ADMIN_EMAIL"],
                           "password": os.environ["ADMIN_PASSWORD"]})
    return r

@pytest_asyncio.fixture
async def admin_client(client):
    r = await _seed_admin_via_app(client)
    assert r.status_code == 200, r.text
    csrf = client.cookies.get("csrf_token")
    client.headers["x-csrf-token"] = csrf
    yield client
```

- [ ] **Step 4: `backend/tests/test_smoke.py`**

```python
async def test_health(client):
    r = await client.get("/api/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}

async def test_admin_login(admin_client):
    r = await admin_client.get("/api/auth/me")
    assert r.status_code == 200
    assert r.json()["role"] == "admin"
```

- [ ] **Step 5: `docker-compose.test.yml`** — ephemeral Postgres + one-shot test runner.

```yaml
services:
  test-db:
    image: postgres:16
    environment:
      POSTGRES_USER: cvh
      POSTGRES_PASSWORD: cvh_password
      POSTGRES_DB: cvh_test
    tmpfs: [/var/lib/postgresql/data]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U cvh -d cvh_test"]
      interval: 3s
      timeout: 3s
      retries: 20
  tests:
    build: ./backend
    depends_on:
      test-db:
        condition: service_healthy
    environment:
      TEST_DATABASE_URL: postgresql+asyncpg://cvh:cvh_password@test-db:5432/cvh_test
      DATABASE_URL: postgresql+asyncpg://cvh:cvh_password@test-db:5432/cvh_test
      SECRET_KEY: "test-secret-test-secret-test-secret-xx"
      ADMIN_EMAIL: admin@cvhtest.com
      ADMIN_PASSWORD: Admin12345!
    command: ["pytest", "-q"]
    working_dir: /app
```

- [ ] **Step 6: Run tests**

Run: `docker compose -p cvh-test -f docker-compose.test.yml run --rm --build tests`
Expected: `test_health` and `test_admin_login` PASS (lifespan seeds admin).

- [ ] **Step 7: Commit**

```bash
git add backend/requirements.txt backend/pytest.ini backend/tests docker-compose.test.yml
git commit -m "test: pytest harness against ephemeral Postgres"
```

---

### Task 2: Alembic migrations replace create_all

**Files:**
- Create: `backend/alembic.ini`, `backend/migrations/env.py`, `backend/migrations/script.py.mako`, `backend/migrations/versions/` (+ generated baseline)
- Create: `backend/docker-entrypoint.sh`
- Modify: `backend/Dockerfile`, `backend/app/main.py`, `backend/requirements.txt`

**Interfaces:**
- Produces: `alembic upgrade head` builds the full schema. `lifespan` no longer calls `create_all`. Entrypoint runs migrations before uvicorn.

- [ ] **Step 1: Add `alembic==1.14.0` to `backend/requirements.txt`.**

- [ ] **Step 2: `backend/alembic.ini`** (minimal; URL comes from env in env.py)

```ini
[alembic]
script_location = migrations
prepend_sys_path = .
[loggers]
keys = root
[handlers]
keys = console
[formatters]
keys = generic
[logger_root]
level = WARN
handlers = console
qualname =
[handler_console]
class = StreamHandler
args = (sys.stderr,)
level = NOTSET
formatter = generic
[formatter_generic]
format = %(levelname)-5.5s [%(name)s] %(message)s
```

- [ ] **Step 3: `backend/migrations/env.py`** (async)

```python
import asyncio
from logging.config import fileConfig
from alembic import context
from sqlalchemy.ext.asyncio import create_async_engine
from app.config import settings
from app.db import Base
from app import models  # noqa: F401  register tables

config = context.config
if config.config_file_name:
    fileConfig(config.config_file_name)
target_metadata = Base.metadata

def run_migrations_offline():
    context.configure(url=settings.database_url, target_metadata=target_metadata,
                      literal_binds=True, dialect_opts={"paramstyle": "named"})
    with context.begin_transaction():
        context.run_migrations()

def _do(conn):
    context.configure(connection=conn, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()

async def run_migrations_online():
    engine = create_async_engine(settings.database_url)
    async with engine.connect() as conn:
        await conn.run_sync(_do)
    await engine.dispose()

if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
```

- [ ] **Step 4: `backend/migrations/script.py.mako`** (standard Alembic template)

```mako
"""${message}

Revision ID: ${up_revision}
Revises: ${down_revision | comma,n}
Create Date: ${create_date}
"""
from alembic import op
import sqlalchemy as sa
${imports if imports else ""}
revision = ${repr(up_revision)}
down_revision = ${repr(down_revision)}
branch_labels = ${repr(branch_labels)}
depends_on = ${repr(depends_on)}

def upgrade():
    ${upgrades if upgrades else "pass"}

def downgrade():
    ${downgrades if downgrades else "pass"}
```

- [ ] **Step 5: Autogenerate the baseline** against an empty DB (so it captures current models exactly).

Run (inside backend container with a fresh DB):
`alembic revision --autogenerate -m baseline`
Then open the generated file and confirm it creates: users, dashboards, dashboard_access, invitations, refresh_tokens. Rename to `0001_baseline.py` if desired.

- [ ] **Step 6: Remove `create_all` from `backend/app/main.py` lifespan.**

Replace:
```python
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    ensure_upload_dir()
    await seed_admin()
```
with:
```python
    ensure_upload_dir()
    await seed_admin()
```
(Tests still build schema via `Base.metadata` in conftest; production builds it via Alembic in the entrypoint.)

- [ ] **Step 7: `backend/docker-entrypoint.sh`**

```bash
#!/usr/bin/env sh
set -e
alembic upgrade head
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
```

- [ ] **Step 8: `backend/Dockerfile`** — make it executable + use as entrypoint. Replace the final `CMD` with:

```dockerfile
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh
ENTRYPOINT ["docker-entrypoint.sh"]
```

- [ ] **Step 9: Handle the existing `cvh-verify` DB (already create_all'd).**

Run once: `docker compose -p cvh-verify -f docker-compose.verify.yml exec -T backend alembic stamp 0001_baseline`
(or recreate with `down -v`). Document this in README.

- [ ] **Step 10: Verify migrations build the schema from scratch.**

Run: `docker compose -p cvh-test -f docker-compose.test.yml run --rm --build tests sh -c "alembic upgrade head && alembic current"`
Expected: upgrade runs, `alembic current` shows the baseline head.

- [ ] **Step 11: Commit**

```bash
git add backend/alembic.ini backend/migrations backend/docker-entrypoint.sh backend/Dockerfile backend/app/main.py backend/requirements.txt
git commit -m "feat: Alembic migrations replace create_all; run on container start"
```

---

### Task 3: SECRET_KEY guard

**Files:**
- Create: `backend/app/startup.py`
- Modify: `backend/app/main.py`, `backend/app/config.py`
- Test: `backend/tests/test_secret_guard.py`

**Interfaces:**
- Produces: `check_secret_key()` raises `RuntimeError` on default/short keys; called in `lifespan` before serving.

- [ ] **Step 1: Failing test `backend/tests/test_secret_guard.py`**

```python
import pytest
from app.startup import check_secret_key

def test_rejects_default():
    with pytest.raises(RuntimeError):
        check_secret_key("change-me")

def test_rejects_short():
    with pytest.raises(RuntimeError):
        check_secret_key("short")

def test_accepts_strong():
    check_secret_key("x" * 40)  # no raise
```

- [ ] **Step 2: Run → FAIL** (`app.startup` missing).
Run: `docker compose -p cvh-test -f docker-compose.test.yml run --rm tests pytest tests/test_secret_guard.py -q`

- [ ] **Step 3: `backend/app/startup.py`**

```python
_WEAK = {"", "change-me", "change-me-to-a-long-random-string"}

def check_secret_key(value: str) -> None:
    if value in _WEAK or len(value) < 32:
        raise RuntimeError(
            "SECRET_KEY débil o por defecto. Define uno aleatorio de >=32 chars, "
            "p.ej. `python -c \"import secrets;print(secrets.token_urlsafe(48))\"`."
        )
```

- [ ] **Step 4: Wire into `backend/app/main.py` lifespan (first line):**

```python
from .startup import check_secret_key
...
async def lifespan(app: FastAPI):
    check_secret_key(settings.secret_key)
    ensure_upload_dir()
    await seed_admin()
    yield
```

- [ ] **Step 5: Run → PASS.** Commit.

```bash
git add backend/app/startup.py backend/app/main.py backend/tests/test_secret_guard.py
git commit -m "feat: fail fast on weak/default SECRET_KEY"
```

---

### Task 4: Login rate-limiting

**Files:**
- Create: `backend/app/security/limiter.py`
- Modify: `backend/app/main.py`, `backend/app/routers/auth.py`, `backend/requirements.txt`
- Test: `backend/tests/test_rate_limit.py`

**Interfaces:**
- Produces: `limiter` (slowapi Limiter, key=client IP via X-Forwarded-For). `@limiter.limit("5/minute")` on `login`. 429 handler registered on app.

- [ ] **Step 1: Add `slowapi==0.1.9` to requirements.**

- [ ] **Step 2: `backend/app/security/limiter.py`**

```python
from slowapi import Limiter
from slowapi.util import get_remote_address
from starlette.requests import Request

def _key(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    return fwd.split(",")[0].strip() if fwd else get_remote_address(request)

limiter = Limiter(key_func=_key, default_limits=[])
```

- [ ] **Step 3: Wire in `main.py`:**

```python
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from .security.limiter import limiter
...
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
```

- [ ] **Step 4: Decorate `login` in `routers/auth.py`** (slowapi needs `request: Request` in signature):

```python
from ..security.limiter import limiter
@router.post("/login", response_model=MeResponse)
@limiter.limit("5/minute")
async def login(request: Request, payload: LoginRequest, response: Response, db: AsyncSession = Depends(get_db)):
    ...
```
(Apply the same `@limiter.limit("5/minute")` + `request: Request` to `accept_invite`; `forgot` arrives in Package 4.)

- [ ] **Step 5: Failing test `backend/tests/test_rate_limit.py`**

```python
async def test_login_rate_limited(client):
    last = None
    for _ in range(7):
        last = await client.post("/api/auth/login",
            json={"email": "nobody@cvhtest.com", "password": "x"},
            headers={"x-forwarded-for": "9.9.9.9"})
    assert last.status_code == 429
```

- [ ] **Step 6: Run → PASS** (first 5 are 401, then 429). Commit.

```bash
git add backend/app/security/limiter.py backend/app/main.py backend/app/routers/auth.py backend/requirements.txt backend/tests/test_rate_limit.py
git commit -m "feat: rate-limit auth endpoints (5/min per IP)"
```

---

### Task 5: Periodic cleanup of expired tokens/invitations

**Files:**
- Modify: `backend/app/startup.py`, `backend/app/main.py`
- Test: `backend/tests/test_cleanup.py`

**Interfaces:**
- Produces: `async def cleanup_once(db) -> dict` returns counts `{refresh_deleted, invites_deleted}`; `start_cleanup_loop(app)` schedules it every 6h.

- [ ] **Step 1: Failing test `backend/tests/test_cleanup.py`** — insert an expired refresh token + expired invitation, assert `cleanup_once` removes them.

```python
import uuid
from datetime import datetime, timedelta, timezone
from app.startup import cleanup_once
from app.models import RefreshToken, Invitation, User
from app.security.hashing import sha256_hex

async def test_cleanup_removes_expired(db):
    u = User(email="c@cvhtest.com", password_hash="x", role="user", is_active=True)
    db.add(u); await db.flush()
    past = datetime.now(timezone.utc) - timedelta(days=1)
    db.add(RefreshToken(user_id=u.id, token_hash=sha256_hex("a"), expires_at=past))
    db.add(Invitation(email="i@cvhtest.com", token_hash=sha256_hex("b"),
                      role="user", invited_by=u.id, expires_at=past))
    await db.commit()
    counts = await cleanup_once(db)
    assert counts["refresh_deleted"] >= 1
    assert counts["invites_deleted"] >= 1
```
(Add a `db` fixture to conftest that yields an AsyncSession from the app's `SessionLocal`.)

- [ ] **Step 2: Implement in `startup.py`:**

```python
import asyncio, logging
from datetime import datetime, timedelta, timezone
from sqlalchemy import delete
from .db import SessionLocal
from .models import RefreshToken, Invitation

log = logging.getLogger("cvh.cleanup")

async def cleanup_once(db) -> dict:
    now = datetime.now(timezone.utc)
    grace = now - timedelta(days=7)
    r = await db.execute(delete(RefreshToken).where(
        (RefreshToken.expires_at < now) | (RefreshToken.revoked_at < grace)))
    i = await db.execute(delete(Invitation).where(
        (Invitation.expires_at < now) & (Invitation.accepted_at.is_(None))))
    await db.commit()
    return {"refresh_deleted": r.rowcount or 0, "invites_deleted": i.rowcount or 0}

async def _loop():
    while True:
        try:
            async with SessionLocal() as db:
                counts = await cleanup_once(db)
            log.info("cleanup %s", counts)
        except Exception:
            log.exception("cleanup failed")
        await asyncio.sleep(6 * 3600)

def start_cleanup_loop() -> asyncio.Task:
    return asyncio.create_task(_loop())
```

- [ ] **Step 3: Wire into `main.py` lifespan:**

```python
    task = start_cleanup_loop()
    yield
    task.cancel()
```

- [ ] **Step 4: Run → PASS.** Commit.

```bash
git add backend/app/startup.py backend/app/main.py backend/tests/test_cleanup.py backend/tests/conftest.py
git commit -m "feat: periodic cleanup of expired refresh tokens and invitations"
```

---

### Task 6: Structured logging, request middleware, optional Sentry

**Files:**
- Create: `backend/app/observability.py`
- Modify: `backend/app/main.py`, `backend/app/config.py`, `backend/requirements.txt`

**Interfaces:**
- Produces: `configure_logging()`, `RequestLogMiddleware`, `init_sentry()` (no-op without `SENTRY_DSN`).

- [ ] **Step 1: `config.py`** add fields: `app_env: str = "production"`, `sentry_dsn: str = ""`.

- [ ] **Step 2: Add `sentry-sdk==2.19.2` to requirements.**

- [ ] **Step 3: `backend/app/observability.py`**

```python
import json, logging, time
from starlette.middleware.base import BaseHTTPMiddleware
from .config import settings

class _JsonFormatter(logging.Formatter):
    def format(self, r):
        d = {"lvl": r.levelname, "logger": r.name, "msg": r.getMessage()}
        if r.exc_info:
            d["exc"] = self.formatException(r.exc_info)
        return json.dumps(d, ensure_ascii=False)

def configure_logging():
    h = logging.StreamHandler()
    h.setFormatter(_JsonFormatter())
    root = logging.getLogger()
    root.handlers[:] = [h]
    root.setLevel(logging.INFO)

class RequestLogMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        t = time.perf_counter()
        resp = await call_next(request)
        ms = round((time.perf_counter() - t) * 1000, 1)
        logging.getLogger("cvh.req").info(
            "%s %s -> %s (%sms)", request.method, request.url.path, resp.status_code, ms)
        return resp

def init_sentry():
    if not settings.sentry_dsn:
        return
    import sentry_sdk
    sentry_sdk.init(dsn=settings.sentry_dsn, environment=settings.app_env,
                    traces_sample_rate=0.0)
```

- [ ] **Step 4: Wire in `main.py`** (top of module / before app use):

```python
from .observability import configure_logging, RequestLogMiddleware, init_sentry
configure_logging()
init_sentry()
...
app.add_middleware(RequestLogMiddleware)
```

- [ ] **Step 5: Verify** by running the verify stack and watching JSON logs.

Run: `docker compose -p cvh-verify -f docker-compose.verify.yml up -d --build backend && docker compose -p cvh-verify -f docker-compose.verify.yml logs --tail 5 backend`
Expected: JSON log lines like `{"lvl":"INFO","logger":"cvh.req","msg":"GET /api/health -> 200 (1.2ms)"}`.

- [ ] **Step 6: Commit**

```bash
git add backend/app/observability.py backend/app/main.py backend/app/config.py backend/requirements.txt
git commit -m "feat: structured logging, request middleware, optional Sentry"
```

---

### Task 7: Backend healthcheck in compose

**Files:**
- Modify: `docker-compose.yml`, `docker-compose.verify.yml`

- [ ] **Step 1: Add to the `backend` service:**

```yaml
    healthcheck:
      test: ["CMD-SHELL", "python -c \"import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://localhost:8000/api/health').status==200 else 1)\""]
      interval: 10s
      timeout: 5s
      retries: 6
```

- [ ] **Step 2: Make frontend wait for healthy backend:**

```yaml
  frontend:
    depends_on:
      backend:
        condition: service_healthy
```

- [ ] **Step 3: Verify**: `docker compose -p cvh-verify -f docker-compose.verify.yml up -d --build` → `docker compose -p cvh-verify ... ps` shows backend `(healthy)`.

- [ ] **Step 4: Commit**

```bash
git add docker-compose.yml docker-compose.verify.yml
git commit -m "feat: backend healthcheck; frontend waits for healthy backend"
```

---

## Self-Review

**Spec coverage (Package 1):** Alembic ✅T2 · rate-limit ✅T4 · SECRET_KEY guard ✅T3 · backend healthcheck ✅T7 · cleanup ✅T5 · logging+Sentry ✅T6 · (pytest harness pulled forward ✅T1). All Package-1 spec items mapped.

**Placeholder scan:** No TBD/TODO; code shown for every code step. Baseline migration is autogenerated (Task 2 Step 5) rather than hand-written — intentional and more reliable.

**Type consistency:** `cleanup_once(db) -> dict` keys (`refresh_deleted`, `invites_deleted`) match test. `limiter` key func name consistent. `check_secret_key(value)` signature matches test. `configure_logging/RequestLogMiddleware/init_sentry` names consistent between observability.py and main.py.
