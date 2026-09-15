-- Migration 028: Añadir columna puesto a la tabla conductores
ALTER TABLE conductores
  ADD COLUMN IF NOT EXISTS puesto VARCHAR(100) DEFAULT NULL;
