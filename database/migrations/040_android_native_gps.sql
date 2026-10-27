BEGIN;
ALTER TABLE ubicaciones_viaje DROP CONSTRAINT IF EXISTS chk_ubicacion_origen;
ALTER TABLE ubicaciones_viaje ADD CONSTRAINT chk_ubicacion_origen
 CHECK (origen IN ('MINI_APP','TELEGRAM_LIVE','TELEGRAM_MINI_APP','PWA','ANDROID_NATIVE'));
CREATE TABLE IF NOT EXISTS cierres_nativos (
 client_id UUID PRIMARY KEY,
 id_conductores INTEGER NOT NULL REFERENCES conductores(id_conductores),
 id_viajes INTEGER NOT NULL REFERENCES viajes(id_viajes),
 request_hash TEXT NOT NULL,
 resultado JSONB NOT NULL,
 creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
COMMIT;
