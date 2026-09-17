CREATE TABLE IF NOT EXISTS siniestros (
  id_siniestros SERIAL PRIMARY KEY,
  folio VARCHAR(50) NOT NULL UNIQUE,
  id_conductores INTEGER REFERENCES conductores(id_conductores),
  id_vehiculo INTEGER REFERENCES vehiculos(id_vehiculos) ON DELETE SET NULL,
  tipo_siniestro VARCHAR(100) NOT NULL,
  descripcion TEXT,
  latitud NUMERIC(10, 8),
  longitud NUMERIC(11, 8),
  altitud NUMERIC(10, 2),
  fotos JSONB DEFAULT '[]'::jsonb,
  pdf_url TEXT,
  creado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_siniestros_conductor ON siniestros(id_conductores);
CREATE INDEX IF NOT EXISTS idx_siniestros_creado_en ON siniestros(creado_en DESC);
