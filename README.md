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
cp .env.example .env        # edita SECRET_KEY, ADMIN_EMAIL, ADMIN_PASSWORD
docker compose up -d --build
```

La app queda en `http://localhost:8080`. El backend crea las tablas y siembra el
admin definido en `.env` en el primer arranque.

## Desarrollo (hot reload)

```bash
cp .env.example .env
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

- Frontend (Vite): `http://localhost:5173`
- Backend (FastAPI docs): `http://localhost:8000/docs`

## Variables de entorno

Ver `.env.example`. Las `SMTP_*` son opcionales: sin ellas, las invitaciones devuelven
un enlace copiable en lugar de enviar correo.

## Estructura

```
backend/    FastAPI app (modelos, routers, servicios, seguridad)
frontend/   SPA React (páginas, componentes, api)
docker-compose.yml / docker-compose.dev.yml
```
