-- Ejecutar en Render con psql antes de desplegar backend y frontends:
-- psql "$DATABASE_URL" -f database/scripts/update-render-inspecciones.sql
\set ON_ERROR_STOP on
\ir ../migrations/007_inspecciones_vehiculares.sql
