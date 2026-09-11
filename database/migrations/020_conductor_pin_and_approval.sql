-- Migration 020: Añadir PIN numérico y campos de aprobación manual a conductores

ALTER TABLE conductores
  ADD COLUMN IF NOT EXISTS pin_hash VARCHAR(255) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS aprobado_por_admin BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS fecha_aprobacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Asegurar que usuarios_telegram admita el estado PENDIENTE_APROBACION
ALTER TABLE usuarios_telegram
  DROP CONSTRAINT IF EXISTS chk_usuario_telegram_estado,
  DROP CONSTRAINT IF EXISTS usuarios_telegram_estado_registro_check;

ALTER TABLE usuarios_telegram
  ADD CONSTRAINT chk_usuario_telegram_estado
  CHECK (estado_registro IN ('PENDIENTE', 'INCOMPLETO', 'PENDIENTE_APROBACION', 'COMPLETO', 'BLOQUEADO', 'RECHAZADO'));
