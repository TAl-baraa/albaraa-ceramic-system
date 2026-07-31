#!/bin/sh
set -eu
mkdir -p backups/postgres
docker compose ps --status running db | grep -q db || { echo "Database container is not running." >&2; exit 1; }
file="backups/postgres/ceramic-$(date +%Y%m%d-%H%M%S).dump"
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$file"
echo "Backup created: $file"
