BEGIN;

CREATE TABLE IF NOT EXISTS historial_kilometraje_vehiculos (
  id_historial_kilometraje BIGSERIAL PRIMARY KEY,
  id_vehiculos INTEGER NOT NULL REFERENCES vehiculos(id_vehiculos),
  id_viajes INTEGER REFERENCES viajes(id_viajes) ON DELETE SET NULL,
  kilometraje INTEGER NOT NULL CHECK (kilometraje >= 0),
  tipo_registro VARCHAR(30) NOT NULL CHECK (
    tipo_registro IN ('INICIAL_VIAJE', 'FINAL_VIAJE', 'AJUSTE_MANUAL', 'CORRECCION', 'MIGRACION')
  ),
  origen VARCHAR(30) NOT NULL CHECK (origen IN ('MINI_APP', 'PANEL_ADMIN', 'MIGRACION')),
  observaciones TEXT,
  id_usuarios_admin BIGINT REFERENCES usuarios_admin(id_usuarios_admin) ON DELETE SET NULL,
  id_registro_corregido BIGINT REFERENCES historial_kilometraje_vehiculos(id_historial_kilometraje) ON DELETE SET NULL,
  fecha_lectura TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_historial_kilometraje_vehiculo_fecha
  ON historial_kilometraje_vehiculos (id_vehiculos, fecha_lectura DESC, id_historial_kilometraje DESC);

CREATE INDEX IF NOT EXISTS idx_historial_kilometraje_viaje
  ON historial_kilometraje_vehiculos (id_viajes);

CREATE UNIQUE INDEX IF NOT EXISTS uq_historial_kilometraje_viaje_inicial
  ON historial_kilometraje_vehiculos (id_viajes)
  WHERE tipo_registro = 'INICIAL_VIAJE' AND id_viajes IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_historial_kilometraje_viaje_final
  ON historial_kilometraje_vehiculos (id_viajes)
  WHERE tipo_registro = 'FINAL_VIAJE' AND id_viajes IS NOT NULL;

WITH inserted AS (
  INSERT INTO historial_kilometraje_vehiculos (
    id_vehiculos, id_viajes, kilometraje, tipo_registro, origen, observaciones, fecha_lectura
  )
  SELECT
    v.id_vehiculos, v.id_viajes, v.kilometraje_inicial,
    'INICIAL_VIAJE', 'MIGRACION', 'Lectura inicial migrada desde viajes.',
    COALESCE(v.hora_salida, v.creado_en)
  FROM viajes v
  WHERE v.kilometraje_inicial IS NOT NULL
  ON CONFLICT DO NOTHING
  RETURNING 1
)
SELECT COUNT(*) AS iniciales_migradas FROM inserted;

WITH inserted AS (
  INSERT INTO historial_kilometraje_vehiculos (
    id_vehiculos, id_viajes, kilometraje, tipo_registro, origen, observaciones, fecha_lectura
  )
  SELECT
    v.id_vehiculos, v.id_viajes, v.kilometraje_final,
    'FINAL_VIAJE', 'MIGRACION', 'Lectura final migrada desde viajes.',
    COALESCE(v.hora_llegada, v.actualizado_en, v.creado_en)
  FROM viajes v
  WHERE v.kilometraje_final IS NOT NULL
  ON CONFLICT DO NOTHING
  RETURNING 1
)
SELECT COUNT(*) AS finales_migradas FROM inserted;

COMMIT;
