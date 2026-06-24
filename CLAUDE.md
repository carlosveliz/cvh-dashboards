# CLAUDE.md

Guía para trabajar en este repo. Léela antes de tocar código.

## Qué es

Plataforma para publicar y compartir múltiples dashboards (HTML autocontenido o
`.xlsx` renderizado) desde una sola URL, con login único, control de acceso por
usuario y panel de administración. Marca corporativa **BioNet**.

## Stack

- **Backend:** FastAPI (async) + SQLAlchemy 2 (async) + Postgres + Alembic.
- **Frontend:** React + Vite + TypeScript + Tailwind. React Router, TanStack Query, Recharts.
- **Orquestación:** Docker Compose (`db` + `backend` + `frontend`).
- El frontend (nginx) sirve la SPA y hace proxy de `/api` y `/dash` al backend
  → **mismo origen** en producción (las cookies funcionan sin CORS).

## Comandos

```bash
# App (producción local) — queda en http://localhost:8180
docker compose up -d --build

# Desarrollo con hot-reload — frontend :5173, backend :8000/docs
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build

# Tests (Postgres efímero, levanta su propia DB)
docker compose -p cvh-test -f docker-compose.test.yml run --rm --build tests

# Typecheck + build del frontend
cd frontend && npm run build        # tsc && vite build

# Backups
COMPOSE_PROJECT=cvh-dashboards ./scripts/backup.sh
```

**Verificar un cambio = correr la app y observarlo** (no basta con que compile o
pasen los tests). El backend tiene healthcheck en `/api/health`.

## Estructura

```
backend/app/
  main.py            # FastAPI: lifespan (guards, seed, cleanup), routers, middleware
  config.py          # Settings (env). db_url se ARMA desde POSTGRES_* (no string)
  db.py              # engine async (NullPool bajo TESTING=1)
  migrate.py         # se ejecuta al arrancar: adopta esquema pre-Alembic y upgrade head
  startup.py         # check_secret_key, cleanup_once (limpieza periódica)
  observability.py   # logging JSON, request middleware, Sentry opcional
  models/            # SQLAlchemy: user, dashboard, folder, dashboard_version,
                     #   access, invitation, refresh_token, password_reset, audit
  routers/           # auth, users, dashboards, folders, content, audit
  schemas/           # Pydantic
  security/          # tokens (JWT + itsdangerous), cookies, deps (auth/CSRF), limiter, hashing
  services/          # audit, email, excel_renderer, storage
  migrations/        # Alembic (versions/ encadenadas)
frontend/src/
  pages/             # Login, Home (launcher), DashboardViewer, AcceptInvite, Forgot/Reset,
                     #   admin/{Dashboards,Folders,Users,Permissions,Audit,AdminLayout}
  components/        # Layout (barra oscura), AuthShell (hero auth), ExcelView, ui
  api/{client,types} # axios baseURL "/" + interceptor CSRF; tipos del API
  index.css          # design tokens (variables HSL) + utilidades .glass / .bg-institutional
scripts/             # backup.sh / restore.sh
docs/superpowers/    # specs y planes de diseño (referencia histórica)
```

## Convenciones / cosas que es fácil romper

- **Esquema de DB = solo Alembic.** No hay `create_all` en producción. El esquema
  se aplica al arrancar el contenedor vía `python -m app.migrate` (entrypoint).
  Para un cambio de modelo: `docker compose exec backend alembic revision --autogenerate -m "msg"`,
  revisa el archivo generado (las **migraciones de datos** se escriben a mano) y
  commitéalo. `migrate.py` adopta una DB pre-Alembic (stampea baseline si hay
  tablas pero no `alembic_version`).
- **DATABASE_URL se arma desde partes** (`POSTGRES_USER/PASSWORD/HOST/PORT/DB`)
  con `sqlalchemy.URL.create()`. NUNCA construir la URL pegando strings: un
  password con `@ / : #` (típico de Coolify) corrompe el host. `DATABASE_URL`
  explícito solo como override.
- **Guards de arranque (fail-fast):** `SECRET_KEY` debe ser ≥32 chars y no un
  valor por defecto; `ADMIN_EMAIL` debe ser un dominio real (los reservados
  `.local/.test/.example/localhost` se rechazan porque el login los invalida).
  Si la app no levanta, mira los logs del backend.
- **Auth:** cookies httpOnly `access_token` (15 min) + `refresh_token` (rotativo);
  CSRF **double-submit**: en POST/PUT/PATCH/DELETE el header `x-csrf-token` debe
  igualar la cookie `csrf_token` (el cliente axios lo hace solo).
- **Contenido protegido:** el HTML se sirve en `/dash/{slug}?t=<token>` con un
  token firmado de vida corta (5 min) ligado a dashboard+usuario; el iframe usa
  `sandbox` SIN `allow-same-origin` + CSP estricta. Excel: `/api/dashboards/{id}/data`.
- **Carpetas:** entidad `Folder` de primera clase; `dashboards.folder_id` (null =
  "General"). El launcher agrupa por carpeta ordenada por `position`. CRUD +
  reorder en `/api/folders` (admin). Drag&drop mueve dashboards (PATCH `folder_id`).
- **Auditoría:** `services/audit.record()` usa su **propia sesión** (sobrevive a
  rollbacks del handler, p.ej. login fallido) y **nunca** lanza excepción. IP real
  vía `_client_ip` (primera IP pública del `X-Forwarded-For`).
- **Versiones:** cada upload crea un `DashboardVersion`; se podan a 10; restaurar
  reapunta el dashboard al archivo de esa versión (sin redeploy).
- **Tests:** `tests/conftest.py` arma el esquema con `Base.metadata.create_all`
  (no Alembic), `TESTING=1` → NullPool, y resetea el rate-limiter entre tests.
  Cubre la **matriz de acceso** (lo más crítico de seguridad).
- **Frontend:** tema vía tokens en `index.css` (variables HSL) — **shell oscuro**
  institucional (login/launcher/barra, glassmorphism) y **paneles claros** para
  datos (admin/tablas/Excel). Paleta BioNet: calipso `#007cb7`, azul `#002440`,
  celeste `#45c7ff`, naranjo `#f58220`, amarillo `#fdb515`. Fuente Montserrat.
- **Commits:** sin línea `Co-Authored-By` (preferencia del usuario).
