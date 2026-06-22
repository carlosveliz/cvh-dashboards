#!/usr/bin/env sh
set -e

# Apply DB migrations (adopting a pre-Alembic schema if present), then start.
python -m app.migrate

# Honor an explicit compose `command:` (e.g. dev hot-reload); otherwise default.
if [ "$#" -gt 0 ]; then
  exec "$@"
fi
# --proxy-headers + trust all upstreams: we sit behind nginx/Coolify, which set
# X-Forwarded-For; this makes request.client reflect the real client too.
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 \
  --proxy-headers --forwarded-allow-ips='*'
