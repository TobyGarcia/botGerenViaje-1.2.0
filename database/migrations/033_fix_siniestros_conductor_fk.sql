-- ==========================================================
-- GERENCIAMIENTO DE VIAJES
-- Migración 032: Clave foránea ON DELETE SET NULL para siniestros y autorizaciones
-- Evita violaciones de integridad referencial al eliminar o modificar conductores
-- ==========================================================

BEGIN;

ALTER TABLE siniestros
  DROP CONSTRAINT IF EXISTS siniestros_id_conductores_fkey;

ALTER TABLE siniestros
  ADD CONSTRAINT siniestros_id_conductores_fkey
    FOREIGN KEY (id_conductores)
    REFERENCES conductores(id_conductores)
    ON DELETE SET NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'autorizaciones_manejo_comentado_viaje') THEN
    ALTER TABLE autorizaciones_manejo_comentado_viaje
      DROP CONSTRAINT IF EXISTS autorizaciones_manejo_comentado_viaje_id_conductores_fkey;

    ALTER TABLE autorizaciones_manejo_comentado_viaje
      ADD CONSTRAINT autorizaciones_manejo_comentado_viaje_id_conductores_fkey
        FOREIGN KEY (id_conductores)
        REFERENCES conductores(id_conductores)
        ON DELETE SET NULL;
  END IF;
END $$;

COMMIT;
