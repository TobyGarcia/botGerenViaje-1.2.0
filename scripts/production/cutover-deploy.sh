#!/usr/bin/env bash
# Explicitly authorized production launch. Never initializes/recreates PostgreSQL.
set -euo pipefail
umask 077
ready=/home/mblanquet/.gv-production-ready/a43a28413577b3f0605f9e4c776a95a53fd89d5b
out=/home/mblanquet/.gv-cutover-20261114T200209Z
test -s "$out/restored-fingerprints.txt"
cmp "$out/before.txt" "$out/restored-fingerprints.txt"
test "$(docker inspect viajes-backend --format '{{.State.Running}}')" = false
mkdir -p "$out/source"
tar -xf /home/mblanquet/production-migrations-a43.tar -C "$out/source"
compose(){ docker compose --env-file "$ready/empty.env" -p botgerenviaje-120 -f "$ready/compose.candidate.json" "$@"; }
success=false
trap 'if [[ "$success" != true ]]; then echo "Deployment stopped; restoring original app images without restoring database"; docker compose --env-file "$ready/empty.env" -p botgerenviaje-120 -f "$ready/compose.rollback.json" up -d --no-build --no-deps backend frontend panel-admin > "$out/rollback.log" 2>&1; fi' EXIT
for migration in 042_trip_operations 043_trip_stop_description 044_trip_telegram_start_messages 045_viaje_inspeccion_uso 046_approver_notifications 047_cancelled_approval_withdrawals 048_manejo_approval_notifications; do
 file="$out/source/database/migrations/$migration.sql"
 sha256sum "$file" >> "$out/migration-hashes.txt"
 docker exec -i -e "PGOPTIONS=-c lock_timeout=5000 -c statement_timeout=120000" viajes-postgres sh -ec 'test "$POSTGRES_DB" = gerenciamiento_viajes_prod; exec psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < "$file" >> "$out/migrations.log" 2>&1
 echo "MIGRATION_OK $migration"
done
docker exec -i viajes-postgres sh -ec 'exec psql -XAt -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < "$out/fingerprints.sql" > "$out/after-migrations.txt"
cmp "$out/before.txt" "$out/after-migrations.txt"
echo ORIGINAL_DATA_FINGERPRINTS_UNCHANGED
compose up -d --no-build --no-deps backend > "$out/backend-deploy.log" 2>&1
for i in $(seq 1 40); do
 if curl -fsS http://127.0.0.1:3001/health > "$out/health-guarded.json"; then break; fi
 sleep 1
done
curl -fsS http://127.0.0.1:3001/health > "$out/health-guarded.json"
compose up -d --no-build --no-deps frontend panel-admin > "$out/web-deploy.log" 2>&1
for port in 8080 8081; do
 for i in $(seq 1 25); do curl -fsS "http://127.0.0.1:$port/" -o /dev/null && break; sleep 1; done
 curl -fsS "http://127.0.0.1:$port/" -o /dev/null
done
docker inspect viajes-backend viajes-frontend viajes-panel-admin viajes-postgres > "$out/containers-guarded.json"
success=true
echo GUARDED_PRODUCTION_APPS_HEALTHY
