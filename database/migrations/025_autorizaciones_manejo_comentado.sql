BEGIN;

CREATE TABLE IF NOT EXISTS autorizaciones_manejo_comentado_viaje (
  id_autorizacion BIGSERIAL PRIMARY KEY,
  id_viajes INTEGER NOT NULL UNIQUE REFERENCES viajes(id_viajes) ON DELETE CASCADE,
  id_conductores INTEGER NOT NULL REFERENCES conductores(id_conductores),
  estado VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE',
  motivo_solicitud TEXT,
  id_usuario_autorizador BIGINT REFERENCES usuarios_admin(id_usuarios_admin),
  comentario_resolucion TEXT,
  firma_autorizador TEXT,
  solicitado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resuelto_en TIMESTAMPTZ,
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_autorizacion_manejo_comentado_estado
    CHECK (estado IN ('PENDIENTE', 'APROBADA', 'RECHAZADA'))
);

CREATE INDEX IF NOT EXISTS idx_autorizaciones_manejo_comentado_pendientes
  ON autorizaciones_manejo_comentado_viaje(estado, solicitado_en DESC);

COMMIT;
