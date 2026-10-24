BEGIN;
CREATE INDEX IF NOT EXISTS idx_bitacora_error_recientes
  ON bitacora_auditoria(id_bitacora DESC) WHERE nivel='ERROR';
DELETE FROM bitacora_auditoria WHERE nivel <> 'ERROR';
DELETE FROM bitacora_auditoria
WHERE nivel='ERROR' AND id_bitacora < COALESCE((
  SELECT MIN(id_bitacora) FROM (
    SELECT id_bitacora FROM bitacora_auditoria
    WHERE nivel='ERROR' ORDER BY id_bitacora DESC LIMIT 100
  ) recientes
), 0);
COMMIT;
