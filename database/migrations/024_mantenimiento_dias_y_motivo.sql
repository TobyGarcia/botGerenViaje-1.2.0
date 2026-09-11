-- ==========================================================
-- Migración 024: Mantenimiento de vehículos con fecha y motivo
-- ==========================================================

BEGIN;

ALTER TABLE vehiculos
  ADD COLUMN IF NOT EXISTS fecha_inicio_mantenimiento TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS motivo_mantenimiento TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_vehiculos_mantenimiento_fecha
  ON vehiculos (en_mantenimiento, fecha_inicio_mantenimiento)
  WHERE en_mantenimiento = TRUE;

COMMIT;