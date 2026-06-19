from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import models  # noqa: F401  (register models on Base.metadata)
from .config import settings
from .db import Base, engine
from .routers import auth, content, dashboards, users
from .seed import seed_admin
from .services.storage import ensure_upload_dir


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    ensure_upload_dir()
    await seed_admin()
    yield


app = FastAPI(title="CVH Dashboards", lifespan=lifespan)

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


@app.get("/api/health")
async def health():
    return {"status": "ok"}
