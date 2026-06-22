#!/usr/bin/env sh
set -e

# Apply DB migrations (adopting a pre-Alembic schema if present), then start.
python -m app.migrate

# Honor an explicit compose `command:` (e.g. dev hot-reload); otherwise default.
if [ "$#" -gt 0 ]; then
  exec "$@"
fi
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
