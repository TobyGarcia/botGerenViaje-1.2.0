CREATE TABLE IF NOT EXISTS ajustes_odometro_viaje (
  id_viajes INTEGER PRIMARY KEY REFERENCES viajes(id_viajes),
  id_vehiculos INTEGER NOT NULL REFERENCES vehiculos(id_vehiculos),
  id_conductores INTEGER NOT NULL REFERENCES conductores(id_conductores),
  lectura_anterior INTEGER NOT NULL CHECK (lectura_anterior >= 0),
  lectura_nueva INTEGER NOT NULL CHECK (lectura_nueva >= 0 AND lectura_nueva < lectura_anterior),
  motivo TEXT NOT NULL,
  foto BYTEA NOT NULL,
  request_hash TEXT NOT NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  aplicado_en TIMESTAMPTZ,
  telegram_enviado_en TIMESTAMPTZ,
  intentos INTEGER NOT NULL DEFAULT 0,
  siguiente_intento TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ajustes_odometro_pendientes ON ajustes_odometro_viaje(siguiente_intento)
  WHERE aplicado_en IS NOT NULL AND telegram_enviado_en IS NULL;
