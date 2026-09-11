-- ==========================================================
-- Migración 023: Campos de SharePoint y PDF en gerenciamiento_viajes
-- ==========================================================

BEGIN;

ALTER TABLE gerenciamiento_viajes
  ADD COLUMN IF NOT EXISTS sharepoint_web_url TEXT,
  ADD COLUMN IF NOT EXISTS sharepoint_item_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS sharepoint_subido_en TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pdf_nombre VARCHAR(255),
  ADD COLUMN IF NOT EXISTS pdf_documento BYTEA;

COMMIT;
