BEGIN;

ALTER TABLE ubicaciones_viaje
  ADD COLUMN IF NOT EXISTS client_location_id UUID;

CREATE UNIQUE INDEX IF NOT EXISTS
  uq_ubicaciones_viaje_viaje_client_location
  ON ubicaciones_viaje (id_viajes, client_location_id)
  WHERE client_location_id IS NOT NULL;

COMMIT;
