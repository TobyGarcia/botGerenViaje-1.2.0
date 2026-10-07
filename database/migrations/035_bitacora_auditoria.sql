BEGIN;
CREATE TABLE IF NOT EXISTS bitacora_auditoria (
  id_bitacora BIGSERIAL PRIMARY KEY,
  request_id UUID NOT NULL,
  fecha TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  nivel VARCHAR(10) NOT NULL CHECK (nivel IN ('INFO','WARN','ERROR')),
  evento VARCHAR(80) NOT NULL,
  metodo VARCHAR(10) NOT NULL,
  ruta TEXT NOT NULL,
  status_http INTEGER NOT NULL CHECK (status_http BETWEEN 100 AND 599),
  duracion_ms INTEGER NOT NULL CHECK (duracion_ms >= 0),
  actor_tipo VARCHAR(20) NOT NULL CHECK (actor_tipo IN ('ADMIN','CONDUCTOR','ANONIMO')),
  actor_id BIGINT,
  actor_nombre VARCHAR(180),
  actor_email VARCHAR(254),
  origen_autenticacion VARCHAR(30),
  ip TEXT,
  user_agent TEXT,
  detalles JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_bitacora_request_id ON bitacora_auditoria(request_id);
CREATE INDEX IF NOT EXISTS idx_bitacora_fecha ON bitacora_auditoria(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_bitacora_actor ON bitacora_auditoria(actor_tipo, actor_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_bitacora_evento_status ON bitacora_auditoria(evento, status_http, fecha DESC);
COMMIT;
