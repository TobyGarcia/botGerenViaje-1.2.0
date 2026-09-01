-- ==========================================================
-- GERENCIAMIENTO DE VIAJES FUERA DE LA CIUDAD O ESTADO
-- Migración 018: Formato de Gerenciamiento de Viajes (SII-MX-23-LOG-003 v3.0)
-- ==========================================================

BEGIN;

--------------------------------------------------------------
-- 1. ACTUALIZAR ROLES DE USUARIOS ADMINISTRATIVOS SI APLICA
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
        'CONSULTA',
        'COORDINADOR_AREA',
        'GERENTE_GENERAL',
        'COORDINADOR_QHSE'
      )
    );

--------------------------------------------------------------
-- 2. TABLA PRINCIPAL DE GERENCIAMIENTO DE VIAJES
--------------------------------------------------------------

CREATE TABLE IF NOT EXISTS gerenciamiento_viajes (
  id_gerenciamiento SERIAL PRIMARY KEY,
  id_viaje INTEGER REFERENCES viajes(id_viajes) ON DELETE SET NULL,
  folio_documento VARCHAR(50) NOT NULL DEFAULT 'SII-MX-23-LOG-003',
  version_documento VARCHAR(20) NOT NULL DEFAULT '3.0',
  area_responsable VARCHAR(100) NOT NULL DEFAULT 'Logística',
  departamento VARCHAR(100),
  fecha_emision DATE NOT NULL DEFAULT CURRENT_DATE,
  hora_salida TIME,
  id_origen INTEGER REFERENCES lugares(id_lugares),
  id_destino INTEGER REFERENCES lugares(id_lugares),
  origen_texto VARCHAR(200),
  destino_texto VARCHAR(200),
  kilometraje INTEGER NOT NULL DEFAULT 0,

  -- 1. Valoración Médica Pre-viaje
  presion_arterial VARCHAR(50),
  examen_visual VARCHAR(100),
  glucosa VARCHAR(50),
  alcoholimetro BOOLEAN NOT NULL DEFAULT FALSE,
  frecuencia_cardiaca VARCHAR(50),
  frecuencia_respiratoria VARCHAR(50),

  -- 2. Información General
  tipo_vehiculo VARCHAR(100),
  placa VARCHAR(50),
  modelo VARCHAR(100),
  color VARCHAR(50),
  vehiculo_empresa BOOLEAN NOT NULL DEFAULT TRUE,
  nombre_contratista VARCHAR(150),
  numero_unidad VARCHAR(50),
  id_conductor INTEGER REFERENCES conductores(id_conductores) ON DELETE CASCADE,
  nombre_conductor VARCHAR(200),
  licencia_numero VARCHAR(50),
  licencia_tipo VARCHAR(50),
  licencia_vencimiento DATE,
  telefono_conductor VARCHAR(50),
  ruta_puntos JSONB DEFAULT '[]'::jsonb, -- Hasta 4 puntos
  tiempo_viaje_horas NUMERIC(5,2) DEFAULT 0,
  acompanantes JSONB DEFAULT '[]'::jsonb,
  sitios_reporte JSONB DEFAULT '[]'::jsonb, -- Array de { punto, hora }

  -- 3. Lista de Verificación Previaje (Control SI / NO)
  conocimiento_riesgos_locales BOOLEAN NOT NULL DEFAULT TRUE,
  prohibido_personal_ajeno BOOLEAN NOT NULL DEFAULT TRUE,
  inspeccion_vehiculo_realizada BOOLEAN NOT NULL DEFAULT TRUE,
  reunion_pre_caravana_realizada BOOLEAN NOT NULL DEFAULT FALSE,

  -- 4. Análisis de Riesgos (Tabuladores A-G)
  pts_distancia INTEGER NOT NULL DEFAULT 1,
  pts_clima INTEGER NOT NULL DEFAULT 2,
  pts_vehiculos_personas INTEGER NOT NULL DEFAULT 1,
  pts_condiciones_via INTEGER NOT NULL DEFAULT 1,
  pts_comunicaciones INTEGER NOT NULL DEFAULT 0,
  pts_horas_trabajadas INTEGER NOT NULL DEFAULT 1,
  pts_hora_traslado INTEGER NOT NULL DEFAULT 1,
  puntaje_total INTEGER NOT NULL DEFAULT 8,
  nivel_riesgo VARCHAR(20) NOT NULL DEFAULT 'BAJO', -- 'BAJO' (0-15), 'MEDIO' (16-23), 'ALTO' (>23)
  autorizacion_requerida VARCHAR(150) NOT NULL DEFAULT 'SUPERVISOR DIRECTO O QHSE',
  es_bloqueante_horas BOOLEAN NOT NULL DEFAULT FALSE,
  requiere_aprobacion_nocturna BOOLEAN NOT NULL DEFAULT FALSE,

  -- 5. Firmas y Autorización
  firma_conductor TEXT,
  nombre_conductor_firma VARCHAR(200),
  firma_autorizador TEXT,
  nombre_autorizador_firma VARCHAR(200),
  id_usuario_autorizador BIGINT REFERENCES usuarios_admin(id_usuarios_admin),
  fecha_firma_autorizador TIMESTAMPTZ,
  observaciones TEXT,

  estado VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE', -- 'PENDIENTE', 'APROBADO', 'RECHAZADO'

  creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_gerenciamiento_conductor
  ON gerenciamiento_viajes(id_conductor, fecha_emision);

CREATE INDEX IF NOT EXISTS idx_gerenciamiento_viaje
  ON gerenciamiento_viajes(id_viaje);

CREATE INDEX IF NOT EXISTS idx_gerenciamiento_estado
  ON gerenciamiento_viajes(estado, nivel_riesgo);

COMMIT;
