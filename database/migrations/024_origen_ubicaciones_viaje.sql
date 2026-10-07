BEGIN;

-- Distingue de dónde provino cada punto GPS.
--   MINI_APP        muestreo del navegador dentro de la Mini App de Telegram
--   TELEGRAM_LIVE   ubicación en vivo compartida desde la app nativa de Telegram
-- Los registros previos son todos de la Mini App, que era la única fuente.
ALTER TABLE ubicaciones_viaje
  ADD COLUMN IF NOT EXISTS origen VARCHAR(20) NOT NULL DEFAULT 'MINI_APP';

ALTER TABLE ubicaciones_viaje
  DROP CONSTRAINT IF EXISTS chk_ubicacion_origen;

ALTER TABLE ubicaciones_viaje
  ADD CONSTRAINT chk_ubicacion_origen
  CHECK (origen IN ('MINI_APP', 'TELEGRAM_LIVE'));

-- La ubicación en vivo llega por lotes del bot y se consulta por viaje y origen
-- al reconstruir la traza.
CREATE INDEX IF NOT EXISTS idx_ubicaciones_viaje_origen
  ON ubicaciones_viaje(id_viajes, origen);

COMMIT;
