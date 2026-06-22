from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from . import models  # noqa: F401  (register models on Base.metadata)
from .config import settings
from .observability import RequestLogMiddleware, configure_logging, init_sentry
from .routers import audit, auth, content, dashboards, users
from .seed import seed_admin
from .security.limiter import limiter
from .startup import check_secret_key, start_cleanup_loop
from .services.storage import ensure_upload_dir

configure_logging()
init_sentry()


@asynccontextmanager
async def lifespan(app: FastAPI):
    check_secret_key(settings.secret_key)
    # Schema is managed by Alembic (run in the container entrypoint), not here.
    ensure_upload_dir()
    await seed_admin()
    cleanup_task = start_cleanup_loop()
    yield
    cleanup_task.cancel()


app = FastAPI(title="CVH Dashboards", lifespan=lifespan)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(RequestLogMiddleware)

# CORS only matters in dev where the Vite server is on a different origin.
# In production the frontend proxies /api to the backend (same origin).
_dev_origins = {"http://localhost:5173", "http://127.0.0.1:5173", settings.app_base_url}
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(_dev_origins),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(dashboards.router)
app.include_router(content.router)
app.include_router(audit.router)


@app.get("/api/health")
async def health():
    return {"status": "ok"}
