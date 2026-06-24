#!/usr/bin/env bash
# Back up the CVH Dashboards database and uploaded files.
#
#   ./scripts/backup.sh                 # uses compose project "cvh-dashboards"
#   COMPOSE_PROJECT=myproj ./scripts/backup.sh
#
# Produces, under ./backups/:
#   db-<timestamp>.sql.gz       (pg_dump of the database)
#   uploads-<timestamp>.tar.gz  (the uploads volume contents)
#
# Schedule with cron, e.g. daily at 03:00:
#   0 3 * * * cd /path/to/cvh-dashboards && ./scripts/backup.sh >> backups/backup.log 2>&1
set -euo pipefail

PROJECT="${COMPOSE_PROJECT:-cvh-dashboards}"
COMPOSE="docker compose -p ${PROJECT}"
PG_USER="${POSTGRES_USER:-cvh}"
PG_DB="${POSTGRES_DB:-cvh_dashboards}"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT_DIR="$(cd "$(dirname "$0")/.." && pwd)/backups"
mkdir -p "${OUT_DIR}"

echo "[backup] project=${PROJECT} db=${PG_DB} -> ${OUT_DIR}"

# 1) Database
${COMPOSE} exec -T db pg_dump -U "${PG_USER}" "${PG_DB}" | gzip > "${OUT_DIR}/db-${STAMP}.sql.gz"
echo "[backup] db    -> db-${STAMP}.sql.gz"

# 2) Uploaded files (read straight from the backend's mounted volume)
${COMPOSE} exec -T backend tar -czf - -C /data uploads > "${OUT_DIR}/uploads-${STAMP}.tar.gz"
echo "[backup] files -> uploads-${STAMP}.tar.gz"

echo "[backup] done."
