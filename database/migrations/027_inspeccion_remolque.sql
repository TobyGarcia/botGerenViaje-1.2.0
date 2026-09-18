-- 027_inspeccion_remolque.sql
-- Agregar columnas para inspección de remolque

ALTER TABLE inspecciones_vehiculares
  ADD COLUMN IF NOT EXISTS lleva_remolque BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS id_remolque INTEGER REFERENCES vehiculos(id_vehiculos) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS inspeccion_remolque JSONB DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_inspecciones_remolque ON inspecciones_vehiculares(id_remolque) WHERE id_remolque IS NOT NULL;
