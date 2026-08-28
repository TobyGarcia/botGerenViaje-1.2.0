-- ==========================================================
-- GERENCIAMIENTO DE VIAJES
-- Migración 014: Manejo Comentado y Rol Instructor
-- ==========================================================

BEGIN;

--------------------------------------------------------------
-- 1. CAMPO MANEJO COMENTADO EN CONDUCTORES
--------------------------------------------------------------

ALTER TABLE conductores
  ADD COLUMN IF NOT EXISTS fecha_manejo_comentado DATE;

CREATE INDEX IF NOT EXISTS idx_conductores_fecha_manejo_comentado
  ON conductores(fecha_manejo_comentado);

--------------------------------------------------------------
-- 2. ROL INSTRUCTOR EN USUARIOS ADMIN
--------------------------------------------------------------

ALTER TABLE usuarios_admin
  DROP CONSTRAINT IF EXISTS chk_usuarios_admin_rol;

ALTER TABLE usuarios_admin
  ADD CONSTRAINT chk_usuarios_admin_rol
    CHECK (
      rol IN (
        'ADMINISTRADOR',
        'SUPERVISOR',
        'INSTRUCTOR',
        'OPERADOR',
        'CONSULTA'
      )
    );

--------------------------------------------------------------
-- 3. TABLA PROGRAMACIÓN DE CURSOS DE MANEJO COMENTADO
--------------------------------------------------------------

CREATE TABLE IF NOT EXISTS programacion_cursos_manejo_comentado (
  id_curso SERIAL PRIMARY KEY,
  titulo VARCHAR(200) NOT NULL,
  fecha_curso_oral DATE NOT NULL,
  fecha_evaluacion_inicio DATE NOT NULL,
  fecha_evaluacion_fin DATE NOT NULL,
  id_usuario_instructor BIGINT REFERENCES usuarios_admin(id_usuarios_admin) ON DELETE SET NULL,
  id_usuario_programador BIGINT REFERENCES usuarios_admin(id_usuarios_admin) ON DELETE SET NULL,
  estado VARCHAR(30) NOT NULL DEFAULT 'PROGRAMADO', -- PROGRAMADO, EN_PROCESO, COMPLETADO, CANCELADO
  notas TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_curso_fechas CHECK (fecha_evaluacion_fin >= fecha_evaluacion_inicio)
);

CREATE INDEX IF NOT EXISTS idx_cursos_fechas
  ON programacion_cursos_manejo_comentado(fecha_curso_oral, estado);

--------------------------------------------------------------
-- 4. TABLA EVALUACIONES DE MANEJO COMENTADO
--------------------------------------------------------------

CREATE TABLE IF NOT EXISTS evaluaciones_manejo_comentado (
  id_evaluacion SERIAL PRIMARY KEY,
  id_curso INTEGER REFERENCES programacion_cursos_manejo_comentado(id_curso) ON DELETE CASCADE,
  id_conductores INTEGER NOT NULL REFERENCES conductores(id_conductores) ON DELETE CASCADE,
  id_usuario_evaluador BIGINT REFERENCES usuarios_admin(id_usuarios_admin) ON DELETE SET NULL,
  fecha_evaluacion TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  calificacion DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  estado_evaluacion VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE', -- PENDIENTE, APROBADO, REPROBADO
  comentarios TEXT,
  rubrica JSONB DEFAULT '{}'::jsonb,
  documento_url TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_evaluaciones_conductor
  ON evaluaciones_manejo_comentado(id_conductores, estado_evaluacion);

COMMIT;
