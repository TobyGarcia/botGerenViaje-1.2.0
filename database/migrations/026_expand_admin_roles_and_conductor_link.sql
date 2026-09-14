-- ==========================================================
-- GERENCIAMIENTO DE VIAJES
-- Migración 026: Ampliación de roles administrativos y enlace de conductores
-- ==========================================================

BEGIN;

-- 1. Actualizar restricción chk_usuarios_admin_rol para admitir todos los roles del sistema
ALTER TABLE usuarios_admin
  DROP CONSTRAINT IF EXISTS chk_usuarios_admin_rol;

ALTER TABLE usuarios_admin
  ADD CONSTRAINT chk_usuarios_admin_rol
    CHECK (
      rol IN (
        'ADMINISTRADOR',
        'GERENTE',
        'GERENTE_GENERAL',
        'COORDINADOR',
        'COORDINADOR_AREA',
        'COORDINADOR_QHSE',
        'SUPERVISOR',
        'QHSE',
        'INSTRUCTOR',
        'OPERADOR',
        'CONSULTA'
      )
    );

-- 2. Asegurar índice para búsquedas eficientes por id_conductores
CREATE INDEX IF NOT EXISTS idx_usuarios_admin_id_conductores
  ON usuarios_admin(id_conductores);

COMMIT;
