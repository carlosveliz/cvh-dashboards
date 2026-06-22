# CVH Dashboards

Plataforma para gestionar y compartir múltiples dashboards (reportes HTML o
generados desde Excel) desde una sola URL con login único y control de acceso por
usuario.

## Características

- **Login único** y "launcher" estilo Google: cada usuario ve solo los dashboards a
  los que tiene acceso.
- **Dos tipos de dashboard por proyecto:**
  - `static_html`: subes un HTML autocontenido y se sirve tal cual (aislado en un
    iframe sandbox).
  - `excel`: subes un `.xlsx` y la plataforma lo renderiza como tablas + gráficos.
- **Subir nuevas versiones sin redeploy** (solo se guarda la última versión).
- **Control de acceso granular** por usuario y por dashboard, desde un panel de admin.
- **Alta de usuarios** directa por el admin o por **invitación** (email opcional vía
  SMTP; si no hay SMTP se genera un enlace copiable).

## Stack

- Backend: **FastAPI** (async) + SQLAlchemy 2 + Postgres.
- Frontend: **React + Vite + TypeScript + Tailwind** (estética pastel/minimalista).
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
backend/    FastAPI app (modelos, routers, servicios, seguridad)
frontend/   SPA React (páginas, componentes, api)
docker-compose.yml / docker-compose.dev.yml
```
