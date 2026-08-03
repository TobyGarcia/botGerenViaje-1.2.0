-- Ejecutar en la base de datos de Render con psql:
-- psql "$DATABASE_URL" -f database/scripts/update-render-vehiculos.sql
\set ON_ERROR_STOP on
\ir ../migrations/006_datos_y_disponibilidad_vehiculos.sql
