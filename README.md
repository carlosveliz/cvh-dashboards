# CVH Dashboards

Plataforma para gestionar y compartir múltiples dashboards (reportes HTML o
generados desde Excel) desde una sola URL con login único y control de acceso por
usuario. Identidad corporativa **BioNet**.

## Características

- **Login único** y "launcher" estilo Google: cada usuario ve solo los dashboards a
  los que tiene acceso, agrupados por **carpetas**.
- **Dos tipos de dashboard:**
  - `static_html`: subes un HTML autocontenido y se sirve tal cual (aislado en un
    iframe sandbox con CSP estricta y token de acceso de vida corta).
  - `excel`: subes un `.xlsx` y la plataforma lo renderiza como tablas + gráficos
    (tipo de gráfico, categoría y series **configurables**).
- **Carpetas** de primera clase: crear / renombrar / eliminar / reordenar, y
  **arrastrar** dashboards entre carpetas.
- **Versiones de archivo:** cada subida queda versionada (se conservan las últimas
  10); puedes **restaurar** una versión anterior sin redeploy.
- **Control de acceso granular** por usuario y por dashboard (vista por dashboard o
  por usuario), desde el panel de admin.
- **Gestión de usuarios:** alta directa o por **invitación** (email vía SMTP; sin
  SMTP se genera un enlace copiable), roles, activar/desactivar, **último acceso**,
  y **reset de contraseña** self-service.
- **Auditoría de accesos:** registro de logins, vistas de dashboards y acciones de
  admin, con IP y filtros (sección "Actividad").
- **Producción:** migraciones Alembic, rate-limiting, logging estructurado,
  healthcheck, limpieza periódica y scripts de backup/restore.

## Stack

- Backend: **FastAPI** (async) + SQLAlchemy 2 + Alembic + Postgres.
- Frontend: **React + Vite + TypeScript + Tailwind** (marca BioNet: Montserrat,
  shell oscuro institucional + paneles de datos claros).
- Orquestación: **Docker Compose** (db + backend + frontend).

## Arranque rápido (producción local)

```bash
cp .env.example .env
# Genera un SECRET_KEY fuerte (obligatorio: el backend NO arranca con uno débil):
python -c "import secrets; print('SECRET_KEY=' + secrets.token_urlsafe(48))"
# Pega el valor en .env y ajusta ADMIN_EMAIL / ADMIN_PASSWORD.
docker compose up -d --build
```

La app queda en `http://localhost:8180`. En el primer arranque el backend aplica
las **migraciones de base de datos** (Alembic) y siembra el admin definido en
`.env`.

> **SECRET_KEY:** debe tener ≥32 caracteres y no ser un valor por defecto. Si es
> débil, el backend falla al arrancar con un mensaje claro (es intencional:
> firma los tokens de sesión).

> **ADMIN_EMAIL:** usa un dominio real. Dominios reservados (`.local`, `.test`,
> `.example`, `localhost`) se rechazan al arrancar, porque el login los
> invalidaría y el admin no podría entrar.

### Migraciones de base de datos

El esquema se gestiona con **Alembic** y se aplica solo (`alembic upgrade head`)
al iniciar el contenedor `backend`.

Si vienes de una versión anterior cuyo esquema fue creado automáticamente (antes
de Alembic), marca la línea base una vez para no recrear tablas existentes:

```bash
docker compose exec backend alembic stamp 3a87edb88fd7
docker compose exec backend alembic upgrade head
```

## Desarrollo (hot reload)

```bash
cp .env.example .env
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

- Frontend (Vite): `http://localhost:5173`
- Backend (FastAPI docs): `http://localhost:8000/docs`

## Tests

La suite corre contra un Postgres efímero (el compose de test levanta su propia DB):

```bash
docker compose -p cvh-test -f docker-compose.test.yml run --rm --build tests
```

Cubre auth/CSRF, la **matriz de control de acceso** (lo más crítico), uploads y
versiones, auditoría, carpetas y reset de contraseña.

## Panel de administración

Disponible para usuarios `admin` (ícono de engranaje en la barra):

- **Dashboards:** crear, subir archivo, configurar gráfico (Excel), ver versiones,
  y **arrastrar** entre carpetas.
- **Carpetas:** crear (incluso vacías), renombrar, eliminar (sus dashboards pasan a
  "General") y reordenar.
- **Usuarios:** alta, invitación, rol, activar/desactivar, último acceso.
- **Permisos:** asignar acceso por dashboard o por usuario.
- **Actividad:** auditoría de logins, vistas y acciones de admin.

## Versiones de archivos

Cada vez que subes un nuevo HTML/Excel a un dashboard se guarda como una **versión**.
Se conservan las **últimas 10**; las más antiguas se eliminan automáticamente. Desde
el panel de administración puedes ver el historial y **restaurar** una versión anterior
(el dashboard vuelve a servir ese archivo, sin redeploy).

## Backups

`scripts/backup.sh` respalda la base de datos (`pg_dump`) y los archivos subidos
(volumen `uploads`) en `./backups/`:

```bash
# Usa el nombre de proyecto de compose (por defecto "cvh-dashboards")
COMPOSE_PROJECT=cvh-dashboards ./scripts/backup.sh
```

Programar con cron (diario a las 03:00):

```bash
0 3 * * * cd /ruta/cvh-dashboards && ./scripts/backup.sh >> backups/backup.log 2>&1
```

Restaurar (sobrescribe los datos actuales; detén el tráfico antes):

```bash
./scripts/restore.sh backups/db-AAAAMMDD-HHMMSS.sql.gz backups/uploads-AAAAMMDD-HHMMSS.tar.gz
```

## Variables de entorno

Ver `.env.example`. Las `SMTP_*` son opcionales: sin ellas, las invitaciones devuelven
un enlace copiable en lugar de enviar correo.

## Estructura

```
backend/    FastAPI (app/: models, routers, schemas, services, security; migrations/)
frontend/   SPA React (src/: pages, components, api; public/ logo)
scripts/    backup.sh / restore.sh
docs/       specs y planes de diseño
docker-compose.yml          # producción local
docker-compose.dev.yml      # override hot-reload
docker-compose.test.yml     # Postgres efímero + runner de tests
```

Detalles de arquitectura, comandos y convenciones para desarrollo: ver
[`CLAUDE.md`](CLAUDE.md).
