# Package 2 — Audit Log Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Record who logged in, which dashboards they opened, and every admin action — and expose it in an "Actividad" admin section.

**Architecture:** A single `audit_log` table written by a decoupled `services/audit.record()` that uses its OWN DB session (so it survives handler rollbacks like failed logins and never interferes with the request transaction). Snapshot columns (`actor_email`, `target_label`) keep records meaningful after the referenced user/dashboard is deleted. Admin-only read API + a React page with filters and a summary.

**Tech Stack:** FastAPI, SQLAlchemy 2 async, Alembic, React + TS.

## Global Constraints

- Same as Package 1 (see `2026-06-19-pkg1-foundations.md`). Postgres-only (JSONB), async, no Co-Authored-By, branch `claude/dashboard-management-platform-7elwv7`.
- `record()` must NEVER raise into a handler: wrap its body so audit failures only log.

---

### Task 1: AuditLog model + migration

**Files:** Create `backend/app/models/audit.py`; Modify `backend/app/models/__init__.py`; Create migration.

- [ ] Model `AuditLog` (table `audit_log`): id UUID PK; created_at tz index; user_id UUID FK users.id `ON DELETE SET NULL` nullable; actor_email String(255) nullable; event_type String(40) index; target_type String(20) nullable; target_id UUID nullable; target_label String(255) nullable; ip String(64) nullable; user_agent String(400) nullable; meta JSONB nullable.
- [ ] Register in `models/__init__.py` (`AuditLog`).
- [ ] `alembic revision --autogenerate -m audit`, review, `upgrade head` on test-db.
- [ ] Commit `feat: audit_log model + migration`.

### Task 2: audit service

**Files:** Create `backend/app/services/audit.py`.

- [ ] Event-type constants + `async def record(*, event_type, request=None, user=None, actor_email=None, target_type=None, target_id=None, target_label=None, meta=None)` using its own `SessionLocal()`, extracting ip/user_agent from request, wrapped in try/except that logs on failure.
- [ ] `async def query(db, *, filters, limit, offset) -> (items,total)` and `async def summary(db) -> dict`.
- [ ] Commit `feat: audit recording + query service`.

### Task 3: schemas + admin router

**Files:** Create `backend/app/schemas/audit.py`, `backend/app/routers/audit.py`; Modify `schemas/__init__.py`, `main.py`.

- [ ] Schemas `AuditRead`, `AuditPage{items,total}`, `AuditSummary`.
- [ ] Router `/api/audit` (admin): `GET ""` with filters+pagination; `GET "/summary"`.
- [ ] Include router in `main.py`.
- [ ] Commit `feat: audit admin API`.

### Task 4: wire recording into handlers

**Files:** Modify `routers/auth.py`, `routers/dashboards.py`, `routers/users.py`.

- [ ] auth: login success/failed, logout, invite_accept.
- [ ] dashboards: content_token & excel_data → DASHBOARD_VIEW; create/update/delete/upload; set permissions → ACCESS_SET.
- [ ] users: create/update/delete, invite_create, set permissions → ACCESS_SET.
- [ ] Commit `feat: emit audit events from handlers`.

### Task 5: backend tests

**Files:** Create `backend/tests/test_audit.py`.

- [ ] login_success/login_failed recorded; dashboard_view recorded on content-token; admin-only on `/api/audit`; filter by event_type; summary shape.
- [ ] Commit `test: audit events and API`.

### Task 6: frontend Actividad section

**Files:** Modify `api/types.ts`, `pages/admin/AdminLayout.tsx`, `App.tsx`; Create `pages/admin/Audit.tsx`.

- [ ] Types; nav tab + route `/admin/audit`; page with summary cards, filters (type/user/dashboard/date), table, pagination.
- [ ] Verify in browser (screenshot).
- [ ] Commit `feat: Actividad (audit) admin section`.
