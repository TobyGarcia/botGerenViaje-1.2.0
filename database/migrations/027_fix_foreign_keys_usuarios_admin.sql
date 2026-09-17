-- ==========================================================
-- GERENCIAMIENTO DE VIAJES
-- Migración 027: Claves foráneas ON DELETE SET NULL para usuarios_admin
-- Evita violaciones de integridad al eliminar usuarios administrativos o conductores
-- ==========================================================

BEGIN;

-- 1. gerenciamiento_viajes -> id_usuario_autorizador ON DELETE SET NULL
ALTER TABLE gerenciamiento_viajes
  DROP CONSTRAINT IF EXISTS gerenciamiento_viajes_id_usuario_autorizador_fkey;

ALTER TABLE gerenciamiento_viajes
  ADD CONSTRAINT gerenciamiento_viajes_id_usuario_autorizador_fkey
    FOREIGN KEY (id_usuario_autorizador)
    REFERENCES usuarios_admin(id_usuarios_admin)
    ON DELETE SET NULL;

-- 2. inspecciones_vehiculares -> id_usuario_admin_aprobador ON DELETE SET NULL
ALTER TABLE inspecciones_vehiculares
  DROP CONSTRAINT IF EXISTS inspecciones_vehiculares_id_usuario_admin_aprobador_fkey;

ALTER TABLE inspecciones_vehiculares
  ADD CONSTRAINT inspecciones_vehiculares_id_usuario_admin_aprobador_fkey
    FOREIGN KEY (id_usuario_admin_aprobador)
    REFERENCES usuarios_admin(id_usuarios_admin)
    ON DELETE SET NULL;

-- 3. inspecciones_vehiculares -> id_usuario_autorizador ON DELETE SET NULL
ALTER TABLE inspecciones_vehiculares
  DROP CONSTRAINT IF EXISTS inspecciones_vehiculares_id_usuario_autorizador_fkey;

ALTER TABLE inspecciones_vehiculares
  ADD CONSTRAINT inspecciones_vehiculares_id_usuario_autorizador_fkey
    FOREIGN KEY (id_usuario_autorizador)
    REFERENCES usuarios_admin(id_usuarios_admin)
    ON DELETE SET NULL;

-- 4. autorizaciones_manejo_comentado_viaje -> id_usuario_autorizador ON DELETE SET NULL
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'autorizaciones_manejo_comentado_viaje') THEN
    ALTER TABLE autorizaciones_manejo_comentado_viaje
      DROP CONSTRAINT IF EXISTS autorizaciones_manejo_comentado_viaje_id_usuario_autorizador_fkey;

    ALTER TABLE autorizaciones_manejo_comentado_viaje
      ADD CONSTRAINT autorizaciones_manejo_comentado_viaje_id_usuario_autorizador_fkey
        FOREIGN KEY (id_usuario_autorizador)
        REFERENCES usuarios_admin(id_usuarios_admin)
        ON DELETE SET NULL;
  END IF;
END $$;

COMMIT;
