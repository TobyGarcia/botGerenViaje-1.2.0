BEGIN;

ALTER TABLE inspecciones_vehiculares
  ADD COLUMN IF NOT EXISTS es_dia_siguiente BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_inspecciones_es_dia_siguiente
  ON inspecciones_vehiculares(es_dia_siguiente)
  WHERE es_dia_siguiente = TRUE;

COMMIT;
