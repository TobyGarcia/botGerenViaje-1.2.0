-- Apply before deploying the offline-trip endpoints. No production data is changed.
CREATE TABLE IF NOT EXISTS viajes_offline (
  client_id UUID PRIMARY KEY,
  id_conductores INTEGER NOT NULL REFERENCES conductores(id_conductores),
  id_viajes INTEGER NOT NULL UNIQUE REFERENCES viajes(id_viajes),
  id_inspeccion BIGINT NOT NULL REFERENCES inspecciones_vehiculares(id_inspeccion),
  request_hash TEXT NOT NULL,
  inicio_dispositivo TIMESTAMPTZ NOT NULL,
  fin_dispositivo TIMESTAMPTZ,
  kilometraje_final INTEGER,
  sincronizado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
