BEGIN;

ALTER TABLE usuarios_telegram
  DROP CONSTRAINT IF EXISTS chk_usuario_telegram_estado;

ALTER TABLE usuarios_telegram
  ADD CONSTRAINT chk_usuario_telegram_estado
  CHECK (
    estado_registro IN (
      'PENDIENTE',
      'PENDIENTE_APROBACION',
      'COMPLETO',
      'BLOQUEADO',
      'RECHAZADO'
    )
  );

COMMIT;
