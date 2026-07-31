#!/bin/sh
set -eu
[ "${1:-}" ] && [ -f "$1" ] || { echo "Usage: $0 BACKUP_FILE --confirm-restore" >&2; exit 2; }
[ "${2:-}" = "--confirm-restore" ] || { echo "WARNING: current data will be replaced. Add --confirm-restore." >&2; exit 2; }
file=$1
docker compose stop backend
docker compose exec -T db sh -c 'dropdb -U "$POSTGRES_USER" --if-exists "$POSTGRES_DB"; createdb -U "$POSTGRES_USER" "$POSTGRES_DB"; pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists' < "$file"
docker compose start backend
docker compose exec backend alembic upgrade head
echo "Restore complete. Run: curl http://localhost:8080/api/health"
