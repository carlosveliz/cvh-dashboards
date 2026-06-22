#!/usr/bin/env sh
set -e

# Apply pending DB migrations, then start the API.
alembic upgrade head
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
