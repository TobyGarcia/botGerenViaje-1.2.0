#!/usr/bin/env bash
# Preparation only: read production, restore/migrate a NEW network-isolated clone.
# Never starts the application and never runs SQL migrations against production.
set -euo pipefail
umask 077
root="$(cd "$(dirname "$0")/../.." && pwd)"
source_container=viajes-postgres
run_id="$(date -u +%Y%m%dT%H%M%SZ)-$$"
clone="gv-rehearsal-${run_id,,}"
volume="${clone}-data"
out="${PREPARATION_OUTPUT:?Set a private absolute backup directory outside the repository}/$run_id"
[[ "$out" == /* && "$out" != "$root"/* ]] || { echo 'Backup must be outside checkout'; exit 1; }
[[ "$(docker inspect "$source_container" --format '{{index .Config.Labels "com.docker.compose.project"}}')" == botgerenviaje-120 ]]
docker inspect "$clone" >/dev/null 2>&1 && exit 1
mkdir -p "$out"; chmod 700 "$out"
finish(){ docker stop "$clone" >/dev/null 2>&1 || true; }
trap finish EXIT
printf '%s\n' "$clone" > "$out/clone.txt"
docker inspect viajes-backend viajes-frontend viajes-panel-admin --format '{{.Name}}|{{.Config.Image}}|{{.Image}}' > "$out/application-images.txt"
# Consistent database snapshot. This does not replace the cutover backup.
docker exec "$source_container" sh -ec 'test "$POSTGRES_DB" = gerenciamiento_viajes_prod; exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --compress=1 --no-owner --no-privileges' > "$out/database.dump"
test -s "$out/database.dump"
docker exec viajes-backend tar -C /app/uploads -czf - . > "$out/uploads.tar.gz"
test -s "$out/uploads.tar.gz"
docker run --name "$clone" --network none --memory 256m --cpus 0.5 \
 -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_DB=rehearsal \
 -v "$volume:/var/lib/postgresql/data" -d postgres:16-alpine \
 -c shared_buffers=32MB -c maintenance_work_mem=32MB -c work_mem=2MB > "$out/clone-container.txt"
for attempt in $(seq 1 60); do
 if docker exec "$clone" pg_isready -U postgres -d rehearsal >/dev/null 2>&1; then break; fi
 sleep 1
done
docker exec "$clone" pg_isready -U postgres -d rehearsal >/dev/null
docker exec -i "$clone" pg_restore -U postgres -d rehearsal --exit-on-error --no-owner --no-privileges < "$out/database.dump" 2> "$out/restore.log"
# Record all original columns, then compare exactly those values after migrations.
docker exec -i "$clone" psql -XAt -v ON_ERROR_STOP=1 -U postgres -d rehearsal > "$out/fingerprints.sql" <<'SQL'
SELECT format('SELECT %L,count(*)::text,md5(COALESCE(string_agg(md5(row_to_json(t)::text),'''' ORDER BY md5(row_to_json(t)::text)),'''')) FROM (SELECT %s FROM %I.%I) t;', table_name,
 (SELECT string_agg(quote_ident(column_name),',' ORDER BY ordinal_position) FROM information_schema.columns c WHERE c.table_schema=t.table_schema AND c.table_name=t.table_name),table_schema,table_name)
FROM information_schema.tables t WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name;
SQL
fingerprint(){ docker exec -i "$clone" psql -XAt -v ON_ERROR_STOP=1 -U postgres -d rehearsal < "$out/fingerprints.sql"; }
fingerprint > "$out/before.txt"
for pass in 1 2; do
 for migration in 042_trip_operations 043_trip_stop_description 044_trip_telegram_start_messages 045_viaje_inspeccion_uso 046_approver_notifications 047_cancelled_approval_withdrawals 048_manejo_approval_notifications; do
  file="$root/database/migrations/$migration.sql"
  test -f "$file"
  docker exec -i "$clone" psql -X -v ON_ERROR_STOP=1 -U postgres -d rehearsal < "$file" >> "$out/migrations-$pass.log" 2>&1
 done
 fingerprint > "$out/after-$pass.txt"
 cmp "$out/before.txt" "$out/after-$pass.txt"
done
tar -tzf "$out/uploads.tar.gz" >/dev/null
(cd "$out"; sha256sum database.dump uploads.tar.gz > SHA256SUMS; sha256sum -c SHA256SUMS)
printf 'PASS: restore, migrations twice, original table fingerprints unchanged, uploads archive readable.\nPrivate evidence: %s\n' "$out"
