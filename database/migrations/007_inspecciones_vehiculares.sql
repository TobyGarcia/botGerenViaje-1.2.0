BEGIN;

ALTER TABLE conductores
  ADD COLUMN IF NOT EXISTS tipo_licencia VARCHAR(50);

CREATE TABLE IF NOT EXISTS inspecciones_vehiculares (
  id_inspeccion BIGSERIAL PRIMARY KEY,
  id_viajes INTEGER NOT NULL UNIQUE REFERENCES viajes(id_viajes) ON DELETE CASCADE,
  id_vehiculos INTEGER NOT NULL REFERENCES vehiculos(id_vehiculos),
  id_conductores INTEGER NOT NULL REFERENCES conductores(id_conductores),
  fecha_operativa DATE NOT NULL,
  combustible VARCHAR(10) NOT NULL,
  tipo_asignacion VARCHAR(20) NOT NULL,
  asignacion_inicio DATE,
  asignacion_fin DATE,
  danos JSONB NOT NULL DEFAULT '{}'::JSONB,
  checklist JSONB NOT NULL DEFAULT '{}'::JSONB,
  observaciones_conductor TEXT,
  firma_conductor TEXT NOT NULL,
  estado VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE_APROBACION',
  requiere_autorizacion_fuera_horario BOOLEAN NOT NULL DEFAULT FALSE,
  id_usuario_admin_aprobador BIGINT REFERENCES usuarios_admin(id_usuarios_admin),
  comentario_aprobacion TEXT,
  aprobado_en TIMESTAMPTZ,
  pdf_generado_en TIMESTAMPTZ,
  pdf_nombre VARCHAR(180),
  pdf_documento BYTEA,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_inspeccion_combustible CHECK (combustible IN ('E', '1/4', '1/2', '3/4', 'F')),
  CONSTRAINT chk_inspeccion_asignacion CHECK (tipo_asignacion IN ('PERMANENTE', 'TEMPORAL')),
  CONSTRAINT chk_inspeccion_estado CHECK (estado IN ('BORRADOR', 'PENDIENTE_APROBACION', 'APROBADA', 'RECHAZADA')),
  CONSTRAINT chk_inspeccion_fechas_asignacion CHECK (
    (tipo_asignacion = 'PERMANENTE' AND asignacion_inicio IS NULL AND asignacion_fin IS NULL)
    OR (tipo_asignacion = 'TEMPORAL' AND asignacion_inicio IS NOT NULL AND asignacion_fin IS NOT NULL AND asignacion_fin >= asignacion_inicio)
  )
);

CREATE INDEX IF NOT EXISTS idx_inspecciones_vehiculo_fecha
  ON inspecciones_vehiculares(id_vehiculos, fecha_operativa DESC);
CREATE INDEX IF NOT EXISTS idx_inspecciones_estado
  ON inspecciones_vehiculares(estado, creado_en DESC);

COMMIT;
