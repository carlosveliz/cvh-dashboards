# CVH Dashboards — Mejoras (diseño)

**Fecha:** 2026-06-19
**Rama de trabajo:** `claude/dashboard-management-platform-7elwv7` (se apila sobre el PR #1)
**Estado:** aprobado para escribir plan de implementación

## Contexto

La plataforma (PR #1) ya funciona: login único, launcher por usuario, control de
acceso granular por dashboard, HTML estático (iframe sandbox + CSP) y Excel
renderizado, invitaciones, Docker Compose (Postgres + FastAPI + React/nginx).
Verificada de extremo a extremo.

Este documento cubre el siguiente lote de mejoras, llevándola de "funciona" a
"producción tranquila", más una **sección de auditoría de accesos** (prioridad
del usuario).

## Objetivos

1. Endurecer para producción (migraciones, rate-limit, secretos, limpieza, logs).
2. **Auditoría**: ver quién ingresó, qué dashboard abrió y qué acciones de admin
   se hicieron — con una sección dedicada en el panel admin.
3. Durabilidad de datos: historial de versiones de archivos + backups.
4. Producto: agrupación/búsqueda en el launcher y reset de contraseña self-service.
5. Excel con gráfico configurable + suite de tests del control de acceso.

## No-objetivos

- Object storage / S3 (se eligió volumen local + scripts de backup).
- RBAC más allá de `admin`/`user`; multi-tenant; i18n.
- Auditoría a nivel de cada request (se eligió auditoría semántica por evento).

## Decisiones transversales (defaults)

- Historial: se conservan las **últimas 10** versiones por dashboard; las más
  viejas se podan (archivo + fila).
- Rate-limit: **5/min por IP** en `/login`, `/invite/accept`, `/forgot` → 429.
- `SECRET_KEY`: el arranque **falla** si es un valor por defecto conocido o tiene
  <32 caracteres.
- Reset self-service: requiere SMTP; sin SMTP, el admin resetea (flujo actual).
- Logging estructurado a stdout; **Sentry opcional** vía `SENTRY_DSN`.
- Auditoría: los registros **no se borran** automáticamente.

---

## Paquete 1 — Fundaciones de producción

### 1.1 Alembic (migraciones)
- Añadir `alembic` a `requirements.txt`. Crear `backend/alembic.ini` y
  `backend/migrations/` (`env.py` async usando `settings.database_url`,
  `target_metadata = Base.metadata`).
- Migraciones:
  - `0001_baseline` — esquema actual (users, dashboards, dashboard_access,
    invitations, refresh_tokens).
  - `0002_audit` — tabla `audit_log`.
  - `0003_versions` — tabla `dashboard_version`.
  - `0004_dashboard_fields` — columnas `dashboards.group_name`,
    `dashboards.excel_config`.
  - `0005_password_reset` — tabla `password_reset`.
- Quitar `Base.metadata.create_all` del `lifespan` en `main.py`.
- Arranque: `backend/docker-entrypoint.sh` corre `alembic upgrade head` y luego
  `exec uvicorn ...`. Apuntar el `CMD`/`ENTRYPOINT` del Dockerfile a ese script.
- **Riesgo / nota de migración:** una DB existente creada por `create_all` ya
  tiene las tablas base. Antes del primer `upgrade` hay que `alembic stamp
  0001_baseline`. Se documenta en el README y se maneja en la verificación del
  stack local actual.

### 1.2 Rate-limit
- `slowapi` (almacenamiento en memoria). `Limiter` keyed por IP
  (`X-Forwarded-For` → fallback `client.host`). Handler 429.
- Aplicar `5/minute` a `POST /api/auth/login`, `POST /api/auth/invite/accept`,
  `POST /api/auth/forgot`.
- **Limitación documentada:** en memoria = por proceso; correcto con 1 worker.
  Escalar a multi-worker requeriría Redis (futuro).

### 1.3 Guard de `SECRET_KEY`
- En el arranque (lifespan, antes de servir): si `secret_key` ∈ {`change-me`,
  `change-me-to-a-long-random-string`, ""} o `len < 32` → `RuntimeError` con
  mensaje accionable (cómo generar uno).

### 1.4 Healthcheck del backend
- `healthcheck` en el servicio `backend` (python urllib a
  `http://localhost:8000/api/health`). `frontend.depends_on.backend.condition =
  service_healthy`.

### 1.5 Limpieza periódica
- Tarea asíncrona en el `lifespan` (cada 6 h, cancelada en shutdown):
  - borra `refresh_tokens` con `expires_at < now` o (`revoked_at` no nulo y
    `revoked_at < now - 7d`);
  - borra `invitations` vencidas no aceptadas.

### 1.6 Logging
- `logging` configurado a stdout con formato estructurado (JSON simple).
- Middleware (`BaseHTTPMiddleware`): método, ruta, status, duración_ms, user_id
  si está autenticado.
- Sentry opcional: si `settings.sentry_dsn`, init `sentry_sdk` con la
  integración de FastAPI. `sentry-sdk` en requirements; init sólo si hay DSN.

---

## Paquete 2 — Auditoría de accesos ⭐

### 2.1 Modelo `audit_log` (`models/audit.py`)
| Columna | Tipo | Notas |
|---|---|---|
| id | UUID PK | default uuid4 |
| created_at | timestamptz | default now, **index** |
| user_id | UUID FK users.id | nullable, `ON DELETE SET NULL` |
| actor_email | varchar(255) | snapshot (sobrevive al borrado del user) |
| event_type | varchar(40) | **index** |
| target_type | varchar(20) | nullable: `dashboard` \| `user` |
| target_id | UUID | nullable |
| target_label | varchar(255) | snapshot (nombre dashboard / email user) |
| ip | varchar(64) | nullable (de `X-Forwarded-For`) |
| user_agent | varchar(400) | nullable |
| meta | JSONB | nullable (contexto extra) |

### 2.2 Servicio `services/audit.py`
- Constantes de `event_type`: `LOGIN_SUCCESS`, `LOGIN_FAILED`, `LOGOUT`,
  `INVITE_CREATE`, `INVITE_ACCEPT`, `DASHBOARD_VIEW`, `DASHBOARD_CREATE`,
  `DASHBOARD_UPDATE`, `DASHBOARD_DELETE`, `DASHBOARD_UPLOAD`, `ACCESS_SET`,
  `USER_CREATE`, `USER_UPDATE`, `USER_DELETE`.
- `async def record(db, *, event_type, request=None, user=None,
  actor_email=None, target_type=None, target_id=None, target_label=None,
  meta=None)`:
  - extrae `ip` (`request.headers["x-forwarded-for"].split(",")[0]` →
    `request.client.host`) y `user_agent`;
  - inserta la fila y hace commit propio **después** de la acción del handler
    (no interfiere con la transacción principal).

### 2.3 Puntos de registro
- `auth.login`: éxito → `LOGIN_SUCCESS`; credencial inválida o cuenta inactiva →
  `LOGIN_FAILED` (`actor_email` = email intentado, `meta.reason`). Se añade
  `Request` a la firma.
- `auth.logout` → `LOGOUT`. `auth.accept_invite` → `INVITE_ACCEPT`.
- `dashboards.content_token` (HTML) y `dashboards.excel_data` (Excel) →
  `DASHBOARD_VIEW` (target = dashboard). Estos disparan al **abrir** el contenido.
- `dashboards.create/update/delete/upload` → eventos correspondientes.
- `dashboards.set_dashboard_permissions` y `users.set_user_permissions` →
  `ACCESS_SET` (`meta` = subject + ids nuevos).
- `users.create/update/delete` → `USER_*`. `users.invite_user` → `INVITE_CREATE`.

### 2.4 API (admin) `routers/audit.py` (prefix `/api/audit`)
- `GET /api/audit` — filtros: `event_type`, `user_id`, `dashboard_id`
  (= `target_id` con `target_type=dashboard`), `date_from`, `date_to`;
  paginación `limit` (default 50, máx 200), `offset`; orden `created_at` desc.
  Respuesta `{ items: AuditRead[], total: int }`.
- `GET /api/audit/summary` — `{ logins_7d, active_users_7d,
  failed_logins_7d, top_dashboards: [{id,name,views}] }`.
- Schemas: `AuditRead`, `AuditPage`, `AuditSummary`.

### 2.5 UI
- `AdminLayout`: pestaña **"Actividad"** → ruta `/admin/audit`.
- `pages/admin/Audit.tsx`: tarjetas de resumen + filtros (tipo, usuario,
  dashboard, rango fechas) + tabla (fecha, usuario, evento [badge], objetivo,
  IP) + paginación.
- `api/types.ts`: tipo `AuditEvent`.

---

## Paquete 3 — Versiones de archivos + backups

### 3.1 Modelo `dashboard_version` (`models/dashboard_version.py`)
`id` UUID PK, `dashboard_id` FK `ON DELETE CASCADE`, `version_no` int,
`file_path` varchar, `file_name` varchar, `file_size` int, `content_hash`
varchar, `uploaded_at` timestamptz, `uploaded_by` UUID nullable.

### 3.2 Almacenamiento
- Archivos versionados: `{dashboard_id}-v{n}{ext}` en `UPLOAD_DIR`.
- `storage.save_version(dashboard_id, type, data, version_no)`.
- En `upload_content`: calcular `next_version_no`, guardar archivo, insertar
  `DashboardVersion`, actualizar el puntero del `Dashboard` (`file_path`,
  `file_name`, `file_size`, `content_hash`, `uploaded_at`), **podar** versiones
  > 10 (borrar archivo + fila). Registrar `DASHBOARD_UPLOAD` en auditoría.

### 3.3 API (admin)
- `GET /api/dashboards/{id}/versions` → lista (desc por `version_no`).
- `POST /api/dashboards/{id}/versions/{version_id}/restore` → repunta el
  `Dashboard` al archivo de esa versión (sin crear archivo nuevo); audita
  `DASHBOARD_UPDATE` con `meta.restored_from`.

### 3.4 UI
- Admin Dashboards: acción **"Versiones"** por dashboard → panel con historial
  (version_no, file_name, size, uploaded_at) y botón "Restaurar" (salvo la actual).

### 3.5 Backups
- `scripts/backup.sh`: `pg_dump` (vía contenedor `db`) + `tar` del volumen
  `uploads`, ambos con timestamp en `backups/`.
- `scripts/restore.sh`: inverso.
- Documentar en README (uso con cron). Scripts parametrizados por nombre de
  proyecto compose (env `COMPOSE_PROJECT` / `-p`).

---

## Paquete 4 — Launcher / producto

### 4.1 Agrupación + búsqueda
- `dashboards.group_name` varchar(120) nullable. Incluido en
  `DashboardCreate/Update/Read`. Form admin con campo "Grupo".
- `Home`: caja de búsqueda (filtro cliente por nombre/descripción) + dashboards
  agrupados por `group_name` (sin grupo → encabezado "General").

### 4.2 Reset de contraseña self-service
- Modelo `password_reset` (`models/password_reset.py`): `id`, `user_id` FK,
  `token_hash`, `expires_at` (1 h), `used_at` nullable, `created_at`.
- `POST /api/auth/forgot` `{email}` → **siempre 200** (no filtra existencia); si
  el usuario existe y está activo, crea token y envía link si hay SMTP
  (`services/email.send_password_reset_email`). Rate-limited.
- `POST /api/auth/reset` `{token, password(min 8)}` → valida token (no usado, no
  vencido), setea contraseña, marca `used_at`, **revoca refresh tokens** del
  usuario. Devuelve 200 (el usuario inicia sesión).
- UI: link "¿Olvidaste tu contraseña?" en Login → `/forgot` (form email +
  confirmación) y `/reset-password?token=` (nueva contraseña).

---

## Paquete 5 — Excel configurable + tests

### 5.1 Gráfico configurable
- `dashboards.excel_config` JSONB nullable:
  `{ sheet: str, chart_type: 'bar'|'line'|'area'|'pie'|'none', category: str,
  series: str[] }`.
- `excel_renderer.render_excel(data, config=None)`: si hay config, construye el
  gráfico según ella (validando que las columnas existan; si no, cae a la
  heurística). Default = heurística actual.
- `excel_data` lee `d.excel_config` y lo pasa al renderer.
- `excel_config` añadido a `DashboardUpdate` (`PATCH`).
- UI: admin Dashboards, panel **"Configurar gráfico"** para dashboards Excel con
  contenido (selector de hoja, tipo de gráfico, columna categoría, multiselect
  de series — poblados leyendo `/data`). `ExcelView` renderiza el tipo elegido
  con Recharts (Bar/Line/Area/Pie).

### 5.2 Tests (backend, pytest)
- `pytest` + `httpx.AsyncClient` (ASGITransport) contra una **DB Postgres de
  prueba** (`TEST_DATABASE_URL`); esquema creado vía `Base.metadata`/Alembic;
  limpieza entre tests.
- `docker-compose.test.yml` o target make para correr tests en contenedor con DB
  efímera.
- Cobertura objetivo:
  - auth: login ok/credencial mala/cuenta inactiva, CSRF.
  - **matriz de acceso**: admin ve todo; user ve sólo lo concedido; 403 en lo no
    concedido; gating de content-token; token manipulado.
  - uploads: validación de tipo, creación de versión + poda, restore.
  - auditoría: eventos registrados en login/view/acciones admin; filtros de
    `/api/audit`; admin-only.
  - permisos (set), reset de contraseña.

---

## Orden de construcción

1 → 2 → 3 → 4 → 5. Cada paquete en uno o más commits sobre la rama del PR #1,
verificando con la app corriendo (stack `cvh-verify`) entre paquetes. Las
migraciones Alembic acompañan a cada paquete que toca el esquema.

## Resumen de cambios de esquema

- **Tablas nuevas:** `audit_log`, `dashboard_version`, `password_reset`.
- **Columnas nuevas:** `dashboards.group_name`, `dashboards.excel_config`.
- Todo vía migraciones Alembic (Postgres: JSONB requerido).
