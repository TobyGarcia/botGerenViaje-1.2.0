#!/usr/bin/env bash
# Authorized cutover: stop application writes, snapshot, preserve PostgreSQL.
set -euo pipefail
umask 077
ready=/home/mblanquet/.gv-production-ready/a43a28413577b3f0605f9e4c776a95a53fd89d5b
out="/home/mblanquet/.gv-cutover-$(date -u +%Y%m%dT%H%M%SZ)"
[[ $(docker inspect viajes-postgres --format '{{index .Config.Labels "com.docker.compose.project"}}') == botgerenviaje-120 ]]
mkdir -m 700 "$out"
printf '%s\n' "$out" > "$ready/last-cutover-path"
docker inspect viajes-backend viajes-frontend viajes-panel-admin viajes-postgres > "$out/containers-before.json"
cp "$ready"/compose.{candidate,activate,rollback}.json "$out/"
docker stop -t 30 viajes-backend
success=false
trap 'if [[ "$success" != true ]]; then docker start viajes-backend >/dev/null; fi' EXIT
docker exec viajes-postgres sh -ec 'test "$POSTGRES_DB" = gerenciamiento_viajes_prod; exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc --compress=1 --no-owner --no-privileges' > "$out/database.dump"
docker cp viajes-backend:/app/uploads/. - | gzip -1 > "$out/uploads.tar.gz"
docker exec -i viajes-postgres sh -ec 'exec psql -XAt -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' > "$out/fingerprints.sql" <<'SQL'
SELECT 'SET TIME ZONE ''UTC'';';
SELECT format('SELECT %L,count(*)::text,md5(COALESCE(string_agg(md5(row_to_json(t)::text),'''' ORDER BY md5(row_to_json(t)::text)),'''')) FROM (SELECT %s FROM %I.%I) t;', table_name,
 (SELECT string_agg(quote_ident(column_name),',' ORDER BY ordinal_position) FROM information_schema.columns c WHERE c.table_schema=t.table_schema AND c.table_name=t.table_name),table_schema,table_name)
FROM information_schema.tables t WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name;
SQL
docker exec -i viajes-postgres sh -ec 'exec psql -XAt -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < "$out/fingerprints.sql" > "$out/before.txt"
docker exec -i viajes-postgres pg_restore --list < "$out/database.dump" > "$out/restore-list.txt"
tar -tzf "$out/uploads.tar.gz" > /dev/null
(cd "$out"; sha256sum database.dump uploads.tar.gz containers-before.json compose.candidate.json compose.activate.json compose.rollback.json > SHA256SUMS; sha256sum -c SHA256SUMS)
chmod 600 "$out"/*
chown -R mblanquet:mblanquet "$out"
success=true
printf 'BACKUP_READY %s\nAPPLICATION_WRITES_PAUSED\n' "$out"
