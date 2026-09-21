-- Migración 031: Destinos Favoritos / Sugerencias Principales
-- Permite marcar lugares específicos como favoritos desde el panel administrativo
-- para que se muestren prioritariamente en el buscador autocomplete de viajes.

ALTER TABLE lugares
  ADD COLUMN IF NOT EXISTS es_favorito BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_lugares_es_favorito
  ON lugares (es_favorito)
  WHERE activo = TRUE;
