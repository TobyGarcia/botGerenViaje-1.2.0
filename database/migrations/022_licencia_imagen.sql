-- Migration 022: Añadir campos de licencia frente y reverso a la tabla conductores

ALTER TABLE conductores
  ADD COLUMN IF NOT EXISTS licencia_url TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS licencia_reverso_url TEXT DEFAULT NULL;
