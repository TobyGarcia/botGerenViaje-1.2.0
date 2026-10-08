BEGIN;
CREATE TABLE IF NOT EXISTS recordatorios_viaje (
  id_recordatorio BIGSERIAL PRIMARY KEY,
  id_viajes INTEGER NOT NULL REFERENCES viajes(id_viajes) ON DELETE CASCADE,
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('24_HORAS')),
  numero INTEGER NOT NULL DEFAULT 1 CHECK (numero > 0),
  estado VARCHAR(15) NOT NULL DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE','ENVIADO','FALLIDO')),
  intentos INTEGER NOT NULL DEFAULT 1 CHECK (intentos BETWEEN 1 AND 3),
  enviado_en TIMESTAMPTZ,
  ultimo_error TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(id_viajes,tipo,numero)
);
CREATE INDEX IF NOT EXISTS idx_recordatorios_viaje_estado ON recordatorios_viaje(estado,actualizado_en);
COMMIT;
