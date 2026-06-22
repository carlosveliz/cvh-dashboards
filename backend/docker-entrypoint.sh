#!/usr/bin/env sh
set -e

# Apply pending DB migrations, then start the app.
alembic upgrade head

# Honor an explicit compose `command:` (e.g. dev hot-reload); otherwise default.
if [ "$#" -gt 0 ]; then
  exec "$@"
fi
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
