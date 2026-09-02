-- ==========================================================
-- Migración 019: Garantizar columna id_usuario_autorizador en inspecciones_vehiculares
-- ==========================================================

BEGIN;

ALTER TABLE inspecciones_vehiculares
  ADD COLUMN IF NOT EXISTS id_usuario_autorizador BIGINT REFERENCES usuarios_admin(id_usuarios_admin);

COMMIT;
