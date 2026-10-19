BEGIN;

CREATE TABLE IF NOT EXISTS web_push_subscriptions (
  id_subscription BIGSERIAL PRIMARY KEY,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_type VARCHAR(30) NOT NULL DEFAULT 'conductor' CHECK (user_type IN ('conductor', 'supervisor', 'admin', 'evaluador')),
  user_id VARCHAR(100),
  user_name VARCHAR(150),
  user_agent TEXT,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  fallos_consecutivos INTEGER NOT NULL DEFAULT 0,
  ultimo_envio TIMESTAMPTZ,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_web_push_user ON web_push_subscriptions(user_type, user_id, activo);
CREATE INDEX IF NOT EXISTS idx_web_push_endpoint ON web_push_subscriptions(endpoint);

COMMIT;
