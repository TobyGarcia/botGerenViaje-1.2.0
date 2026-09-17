-- ==========================================================
-- Migración 030
-- Control de turnos y traslados a casa para vehículos asignados a supervisores
-- ==========================================================

BEGIN;

CREATE TABLE IF NOT EXISTS turnos_vehiculo (
  id_turno_vehiculo BIGSERIAL PRIMARY KEY,
  id_vehiculos INTEGER NOT NULL REFERENCES vehiculos(id_vehiculos) ON DELETE CASCADE,
  id_usuarios_admin BIGINT REFERENCES usuarios_admin(id_usuarios_admin) ON DELETE SET NULL,
  id_conductores INTEGER REFERENCES conductores(id_conductores) ON DELETE SET NULL,
  estado VARCHAR(30) NOT NULL CHECK (estado IN ('EN_TURNO', 'EN_TRASLADO_CASA')) DEFAULT 'EN_TURNO',
  odometro_final_turno INTEGER CHECK (odometro_final_turno >= 0),
  fecha_fin_turno TIMESTAMP,
  odometro_inicial_turno INTEGER CHECK (odometro_inicial_turno >= 0),
  fecha_inicio_turno TIMESTAMP,
  km_recorridos_casa INTEGER CHECK (km_recorridos_casa >= 0),
  observaciones_fin TEXT,
  observaciones_inicio TEXT,
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_turnos_vehiculo_vehiculo_estado
  ON turnos_vehiculo (id_vehiculos, estado);

CREATE INDEX IF NOT EXISTS idx_turnos_vehiculo_supervisor
  ON turnos_vehiculo (id_usuarios_admin);

-- Actualizar restricción CHECK de historial_kilometraje_vehiculos si existe
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'historial_kilometraje_vehiculos_tipo_registro_check'
  ) THEN
    ALTER TABLE historial_kilometraje_vehiculos
      DROP CONSTRAINT historial_kilometraje_vehiculos_tipo_registro_check;

    ALTER TABLE historial_kilometraje_vehiculos
      ADD CONSTRAINT historial_kilometraje_vehiculos_tipo_registro_check
      CHECK (tipo_registro IN ('INICIAL_VIAJE', 'FINAL_VIAJE', 'AJUSTE_MANUAL', 'CORRECCION', 'MIGRACION', 'FINAL_TURNO', 'INICIAL_TURNO'));
  END IF;
END $$;

COMMIT;
