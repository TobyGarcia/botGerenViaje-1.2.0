BEGIN;

ALTER TABLE inspecciones_vehiculares
  ADD COLUMN IF NOT EXISTS sharepoint_web_url TEXT,
  ADD COLUMN IF NOT EXISTS sharepoint_item_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS sharepoint_subido_en TIMESTAMPTZ;

COMMIT;
