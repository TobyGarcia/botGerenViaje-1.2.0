-- ==========================================================
-- GERENCIAMIENTO DE VIAJE - MIGRACIÓN 026
-- Reestructuración de usuarios_admin y conductores
-- ==========================================================

BEGIN;

-- 1. Agregar columna correo a la tabla conductores si no existe
ALTER TABLE conductores 
ADD COLUMN IF NOT EXISTS correo VARCHAR(200);

-- Crear índice único parcial para correos de conductores
CREATE UNIQUE INDEX IF NOT EXISTS uq_conductores_correo 
ON conductores (LOWER(correo)) 
WHERE correo IS NOT NULL AND correo != '';

-- 2. Migrar/Vincular usuarios_admin existentes a la tabla conductores

-- A) Crear conductores para registros de usuarios_admin sin id_conductores
INSERT INTO conductores (nombre, telefono, correo, activo)
SELECT 
    COALESCE(ua.nombre, ua.username, 'Usuario Admin') AS nombre,
    ua.telefono AS telefono,
    ua.correo AS correo,
    TRUE AS activo
FROM usuarios_admin ua
WHERE ua.id_conductores IS NULL
  AND ua.correo IS NOT NULL 
  AND ua.correo != ''
  AND NOT EXISTS (
      SELECT 1 FROM conductores c 
      WHERE LOWER(c.correo) = LOWER(ua.correo)
  );

-- B) Vincular id_conductores en usuarios_admin por coincidencia de correo
UPDATE usuarios_admin ua
SET id_conductores = c.id_conductores
FROM conductores c
WHERE ua.id_conductores IS NULL
  AND ua.correo IS NOT NULL 
  AND LOWER(ua.correo) = LOWER(c.correo);

-- C) Para cualquier usuarios_admin restante sin id_conductores, crear su conductor base
INSERT INTO conductores (nombre, activo)
SELECT 
    COALESCE(ua.nombre, ua.username, 'Usuario Admin ' || ua.id_usuarios_admin) AS nombre,
    TRUE AS activo
FROM usuarios_admin ua
WHERE ua.id_conductores IS NULL;

UPDATE usuarios_admin ua
SET id_conductores = (
    SELECT c.id_conductores FROM conductores c 
    WHERE c.nombre = COALESCE(ua.nombre, ua.username, 'Usuario Admin ' || ua.id_usuarios_admin)
    ORDER BY c.id_conductores DESC
    LIMIT 1
)
WHERE ua.id_conductores IS NULL;

-- 3. Configurar id_conductores como NOT NULL y agregar llave foránea
ALTER TABLE usuarios_admin 
ALTER COLUMN id_conductores SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_usuarios_admin_conductores' 
          AND table_name = 'usuarios_admin'
    ) THEN
        ALTER TABLE usuarios_admin
        ADD CONSTRAINT fk_usuarios_admin_conductores
        FOREIGN KEY (id_conductores)
        REFERENCES conductores (id_conductores)
        ON DELETE CASCADE;
    END IF;
END $$;

-- 4. Eliminar columnas redundantes de usuarios_admin
ALTER TABLE usuarios_admin
DROP COLUMN IF EXISTS nombre,
DROP COLUMN IF EXISTS username,
DROP COLUMN IF EXISTS correo,
DROP COLUMN IF EXISTS password_hash,
DROP COLUMN IF EXISTS telegram_user_id,
DROP COLUMN IF EXISTS telefono,
DROP COLUMN IF EXISTS correo_confirmado_en,
DROP COLUMN IF EXISTS pin_hash;

-- 5. Crear índice para optimizar JOINs
CREATE INDEX IF NOT EXISTS idx_usuarios_admin_id_conductores 
ON usuarios_admin(id_conductores);

COMMIT;
