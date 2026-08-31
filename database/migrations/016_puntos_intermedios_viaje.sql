BEGIN;

ALTER TABLE ubicaciones_viaje
  ADD COLUMN IF NOT EXISTS es_punto_intermedio BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS nombre_punto VARCHAR(150);

CREATE INDEX IF NOT EXISTS idx_ubicaciones_viaje_punto_intermedio
  ON ubicaciones_viaje(id_viajes, es_punto_intermedio)
  WHERE es_punto_intermedio = TRUE;

COMMIT;
