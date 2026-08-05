BEGIN;

ALTER TABLE usuarios_admin
  ADD COLUMN IF NOT EXISTS telegram_user_id BIGINT UNIQUE,
  ADD COLUMN IF NOT EXISTS telefono VARCHAR(30),
  ADD COLUMN IF NOT EXISTS correo_confirmado_en TIMESTAMPTZ;

ALTER TABLE inspecciones_vehiculares
  ADD COLUMN IF NOT EXISTS firma_supervisor TEXT;

CREATE TABLE IF NOT EXISTS accesos_supervisor_telegram (
  telegram_user_id BIGINT PRIMARY KEY,
  telegram_username VARCHAR(100),
  telegram_first_name VARCHAR(150),
  telegram_last_name VARCHAR(150),
  telegram_group_id BIGINT NOT NULL,
  habilitado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS confirmaciones_correo_supervisor (
  id_confirmacion BIGSERIAL PRIMARY KEY,
  id_usuarios_admin BIGINT NOT NULL REFERENCES usuarios_admin(id_usuarios_admin) ON DELETE CASCADE,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expira_en TIMESTAMPTZ NOT NULL,
  confirmado_en TIMESTAMPTZ,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_confirmaciones_supervisor_pendientes
  ON confirmaciones_correo_supervisor(id_usuarios_admin, expira_en)
  WHERE confirmado_en IS NULL;

COMMIT;
