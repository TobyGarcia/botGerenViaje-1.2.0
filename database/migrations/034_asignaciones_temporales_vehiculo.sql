BEGIN;

CREATE TABLE IF NOT EXISTS asignaciones_temporales_vehiculo (
  id_asignacion_temporal BIGSERIAL PRIMARY KEY,
  id_conductores INTEGER NOT NULL REFERENCES conductores(id_conductores) ON DELETE CASCADE,
  id_vehiculos INTEGER NOT NULL REFERENCES vehiculos(id_vehiculos) ON DELETE CASCADE,
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'ACTIVA',
  origen VARCHAR(30) NOT NULL DEFAULT 'CONDUCTOR',
  creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_asignacion_temporal_fechas CHECK (fecha_fin >= fecha_inicio),
  CONSTRAINT chk_asignacion_temporal_estado CHECK (estado IN ('ACTIVA', 'CANCELADA', 'VENCIDA')),
  CONSTRAINT chk_asignacion_temporal_origen CHECK (origen IN ('CONDUCTOR', 'ADMINISTRACION', 'MIGRACION')),
  CONSTRAINT uq_asignacion_temporal_exacta UNIQUE (id_conductores, id_vehiculos, fecha_inicio, fecha_fin)
);

CREATE INDEX IF NOT EXISTS idx_asignacion_temporal_conductor_fechas
  ON asignaciones_temporales_vehiculo (id_conductores, fecha_inicio, fecha_fin)
  WHERE estado = 'ACTIVA';

CREATE INDEX IF NOT EXISTS idx_asignacion_temporal_vehiculo_fechas
  ON asignaciones_temporales_vehiculo (id_vehiculos, fecha_inicio, fecha_fin)
  WHERE estado = 'ACTIVA';

COMMIT;
