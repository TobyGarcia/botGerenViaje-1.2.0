-- Read-only inventory, not a migration or initialization script.
\set ON_ERROR_STOP on
BEGIN READ ONLY;
SELECT current_database(), version();
SELECT e.nombre,count(*) FROM viajes v JOIN estados_viaje e USING(id_estado_viaje) GROUP BY e.nombre ORDER BY e.nombre;
SELECT 'viajes' AS tabla,count(*) FROM viajes UNION ALL SELECT 'inspecciones',count(*) FROM inspecciones_vehiculares UNION ALL SELECT 'conductores',count(*) FROM conductores UNION ALL SELECT 'vehiculos',count(*) FROM vehiculos;
SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename;
SELECT column_name,data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='ubicaciones_viaje' AND column_name='nombre_punto';
COMMIT;
