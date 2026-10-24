BEGIN;
-- One event per row; multiple events may share a request.
ALTER TABLE bitacora_auditoria ADD COLUMN IF NOT EXISTS event_id UUID NOT NULL DEFAULT gen_random_uuid();
DROP INDEX IF EXISTS uq_bitacora_request_id;
CREATE UNIQUE INDEX IF NOT EXISTS uq_bitacora_event_id ON bitacora_auditoria(event_id);
CREATE INDEX IF NOT EXISTS idx_bitacora_request ON bitacora_auditoria(request_id, fecha, id_bitacora);
ALTER TABLE bitacora_auditoria ADD COLUMN IF NOT EXISTS paso VARCHAR(100);
ALTER TABLE bitacora_auditoria ADD COLUMN IF NOT EXISTS resultado VARCHAR(30);
ALTER TABLE bitacora_auditoria ADD COLUMN IF NOT EXISTS version_app VARCHAR(100);
ALTER TABLE bitacora_auditoria ADD COLUMN IF NOT EXISTS id_viaje BIGINT;
ALTER TABLE bitacora_auditoria ADD COLUMN IF NOT EXISTS codigo_error VARCHAR(100);
CREATE INDEX IF NOT EXISTS idx_bitacora_viaje ON bitacora_auditoria(id_viaje, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_bitacora_errores ON bitacora_auditoria(fecha DESC) WHERE nivel='ERROR';
COMMIT;
