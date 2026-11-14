#!/usr/bin/env bash
set -euo pipefail
umask 077
ready=/home/mblanquet/.gv-production-ready/a43a28413577b3f0605f9e4c776a95a53fd89d5b
out=/home/mblanquet/.gv-cutover-20261114T200209Z
cmp "$out/before.txt" "$out/after-migrations.txt"
test -s "$ready/compose.loaded-images.json"
compose(){ docker compose --env-file "$ready/empty.env" -p botgerenviaje-120 -f "$ready/compose.candidate.json" -f "$ready/compose.loaded-images.json" "$@"; }
success=false
trap 'if [[ "$success" != true ]]; then docker compose --env-file "$ready/empty.env" -p botgerenviaje-120 -f "$ready/compose.rollback.json" up -d --no-build --no-deps backend frontend panel-admin > "$out/rollback-retry.log" 2>&1; fi' EXIT
compose up -d --no-build --no-deps backend > "$out/backend-deploy-retry.log" 2>&1
for i in $(seq 1 40); do if curl -fsS http://127.0.0.1:3001/health > "$out/health-guarded.json"; then break; fi; sleep 1; done
curl -fsS http://127.0.0.1:3001/health > "$out/health-guarded.json"
compose up -d --no-build --no-deps frontend panel-admin > "$out/web-deploy.log" 2>&1
for port in 8080 8081; do
 for i in $(seq 1 25); do curl -fsS "http://127.0.0.1:$port/" -o /dev/null && break; sleep 1; done
 curl -fsS "http://127.0.0.1:$port/" -o /dev/null
done
docker inspect viajes-backend viajes-frontend viajes-panel-admin viajes-postgres > "$out/containers-guarded.json"
success=true
echo GUARDED_PRODUCTION_APPS_HEALTHY
