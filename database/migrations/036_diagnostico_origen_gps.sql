BEGIN;

ALTER TABLE ubicaciones_viaje
  ADD COLUMN IF NOT EXISTS origen VARCHAR(24) NOT NULL DEFAULT 'MINI_APP',
  ADD COLUMN IF NOT EXISTS en_segundo_plano BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS guardado_local_en TIMESTAMP;

ALTER TABLE ubicaciones_viaje DROP CONSTRAINT IF EXISTS chk_ubicacion_origen;
ALTER TABLE ubicaciones_viaje ADD CONSTRAINT chk_ubicacion_origen
  CHECK (origen IN ('MINI_APP','TELEGRAM_LIVE','TELEGRAM_MINI_APP','PWA'));

CREATE INDEX IF NOT EXISTS idx_ubicaciones_viaje_origen
  ON ubicaciones_viaje(id_viajes, origen);

COMMIT;
