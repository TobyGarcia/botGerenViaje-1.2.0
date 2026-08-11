BEGIN;

-- Un usuario administrativo puede estar asociado opcionalmente a un conductor.
-- Esto permite que OPERADOR vea únicamente sus propios viajes y ubicaciones.
ALTER TABLE usuarios_admin
  ADD COLUMN IF NOT EXISTS id_conductores INTEGER
    REFERENCES conductores(id_conductores) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS telefono VARCHAR(30),
  ADD COLUMN IF NOT EXISTS contacto_emergencia VARCHAR(200),
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

CREATE INDEX IF NOT EXISTS idx_usuarios_admin_conductor
  ON usuarios_admin(id_conductores);

CREATE INDEX IF NOT EXISTS idx_inspecciones_conductor_fecha
  ON inspecciones_vehiculares(id_conductores, fecha_operativa DESC);

-- Al eliminar un usuario administrativo se conserva la inspección y su historial.
ALTER TABLE inspecciones_vehiculares
  DROP CONSTRAINT IF EXISTS inspecciones_vehiculares_id_usuario_admin_aprobador_fkey;
ALTER TABLE inspecciones_vehiculares
  ADD CONSTRAINT inspecciones_vehiculares_id_usuario_admin_aprobador_fkey
    FOREIGN KEY (id_usuario_admin_aprobador)
    REFERENCES usuarios_admin(id_usuarios_admin) ON DELETE SET NULL;

COMMIT;
