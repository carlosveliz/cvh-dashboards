#!/usr/bin/env bash
# Restore the CVH Dashboards database and uploaded files from a backup.
#
#   ./scripts/restore.sh backups/db-20260101-030000.sql.gz backups/uploads-20260101-030000.tar.gz
#
# WARNING: this overwrites the current database and uploaded files. Stop traffic
# first. Intended for disaster recovery.
set -euo pipefail

if [ "$#" -ne 2 ]; then
  echo "usage: $0 <db-dump.sql.gz> <uploads.tar.gz>" >&2
  exit 1
fi
DB_DUMP="$1"
UPLOADS_TAR="$2"
PROJECT="${COMPOSE_PROJECT:-cvh-dashboards}"
COMPOSE="docker compose -p ${PROJECT}"
PG_USER="${POSTGRES_USER:-cvh}"
PG_DB="${POSTGRES_DB:-cvh_dashboards}"

echo "[restore] project=${PROJECT} db=${PG_DB}"
echo "[restore] WARNING: overwriting current data in 5s (Ctrl-C to abort)…"
sleep 5

# 1) Database: drop & recreate the public schema, then load the dump.
${COMPOSE} exec -T db psql -U "${PG_USER}" -d "${PG_DB}" \
  -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
gunzip -c "${DB_DUMP}" | ${COMPOSE} exec -T db psql -U "${PG_USER}" -d "${PG_DB}"
echo "[restore] db restored from ${DB_DUMP}"

# 2) Uploaded files: wipe and extract.
${COMPOSE} exec -T backend sh -c "rm -rf /data/uploads && mkdir -p /data/uploads"
${COMPOSE} exec -T backend tar -xzf - -C /data < "${UPLOADS_TAR}"
echo "[restore] files restored from ${UPLOADS_TAR}"

echo "[restore] done. Restart the stack: ${COMPOSE} restart backend"
