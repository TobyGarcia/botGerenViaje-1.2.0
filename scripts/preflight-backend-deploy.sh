#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_root/backend"

echo "Verificando sintaxis e imports locales..."
npm run verify:imports
node --check src/services/viajes.service.js
node --check src/services/offline-viajes.service.js

echo "Ejecutando pruebas sin dependencia de PostgreSQL..."
node --test \
  src/tests/nested-transaction.test.js \
  src/tests/security-and-offline-rules.test.js \
  src/tests/trip-idempotency.test.js \
  src/tests/vehicle-assignments.test.js

echo "Preflight del backend completado."
