-- ==========================================================
-- Migración 012
-- Agregar campos de color y personal asignado a vehículos
-- ==========================================================

BEGIN;

ALTER TABLE vehiculos
  ADD COLUMN IF NOT EXISTS color VARCHAR(50),
  ADD COLUMN IF NOT EXISTS id_conductor_asignado INTEGER REFERENCES conductores(id_conductores) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS id_supervisor_asignado INTEGER REFERENCES usuarios_admin(id_usuarios_admin) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS personal_asignado_nombre VARCHAR(150);

CREATE INDEX IF NOT EXISTS idx_vehiculos_conductor_asignado
  ON vehiculos(id_conductor_asignado);

CREATE INDEX IF NOT EXISTS idx_vehiculos_supervisor_asignado
  ON vehiculos(id_supervisor_asignado);

COMMIT;
