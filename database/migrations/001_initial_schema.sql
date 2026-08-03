-- ==========================================================
-- GERENCIAMIENTO DE VIAJES
-- Migración 001
-- Creación de tablas principales
-- ==========================================================

BEGIN;

--------------------------------------------------------------
-- CONDUCTORES
--------------------------------------------------------------

CREATE TABLE conductores
(
    id_conductores SERIAL PRIMARY KEY,

    nombre VARCHAR(150) NOT NULL,

    licencia_numero VARCHAR(50),

    licencia_vigente BOOLEAN NOT NULL DEFAULT FALSE,

    licencia_vencimiento DATE,

    telefono VARCHAR(30),

    activo BOOLEAN NOT NULL DEFAULT TRUE,

    creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

--------------------------------------------------------------
-- VEHÍCULOS
--------------------------------------------------------------

CREATE TABLE vehiculos
(
    id_vehiculos SERIAL PRIMARY KEY,

    nombre VARCHAR(100) NOT NULL,

    marca VARCHAR(80),

    modelo VARCHAR(100),

    numero_economico VARCHAR(50) NOT NULL UNIQUE,

    placas VARCHAR(20),

    numero_poliza VARCHAR(100),

    seguro_vencimiento DATE,

    numero_serie VARCHAR(100),

    tipo_vehiculo VARCHAR(80),

    tipo_propiedad VARCHAR(20),

    en_mantenimiento BOOLEAN NOT NULL DEFAULT FALSE,

    kilometraje_actual INTEGER NOT NULL DEFAULT 0,

    activo BOOLEAN NOT NULL DEFAULT TRUE,

    creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_vehiculo_kilometraje
        CHECK (kilometraje_actual >= 0),

    CONSTRAINT chk_vehiculo_tipo_propiedad
        CHECK (
            tipo_propiedad IS NULL
            OR tipo_propiedad IN ('EMPRESARIAL', 'PATRIMONIAL')
        )
);

--------------------------------------------------------------
-- LUGARES
--------------------------------------------------------------

CREATE TABLE lugares
(
    id_lugares SERIAL PRIMARY KEY,

    nombre VARCHAR(150) NOT NULL UNIQUE,

    direccion TEXT,

    latitud DECIMAL(10,7),

    longitud DECIMAL(10,7),

    activo BOOLEAN NOT NULL DEFAULT TRUE,

    creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_lugar_latitud
        CHECK (
            latitud IS NULL
            OR latitud BETWEEN -90 AND 90
        ),

    CONSTRAINT chk_lugar_longitud
        CHECK (
            longitud IS NULL
            OR longitud BETWEEN -180 AND 180
        )
);

--------------------------------------------------------------
-- ESTADOS DEL VIAJE
--------------------------------------------------------------

CREATE TABLE estados_viaje
(
    id_estado_viaje SERIAL PRIMARY KEY,

    nombre VARCHAR(30) NOT NULL UNIQUE,

    descripcion VARCHAR(150),

    activo BOOLEAN NOT NULL DEFAULT TRUE,

    creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

--------------------------------------------------------------
-- VIAJES
--------------------------------------------------------------

CREATE TABLE viajes
(
    id_viajes SERIAL PRIMARY KEY,

    folio VARCHAR(30) NOT NULL UNIQUE,

    id_conductores INTEGER NOT NULL,

    id_vehiculos INTEGER NOT NULL,

    id_origen INTEGER NOT NULL,

    id_destino INTEGER NOT NULL,

    id_estado_viaje INTEGER NOT NULL,

    acompanantes JSONB NOT NULL DEFAULT '[]'::JSONB,

    licencia_vigente BOOLEAN NOT NULL,

    kilometraje_inicial INTEGER NOT NULL,

    kilometraje_final INTEGER,

    kilometros_recorridos INTEGER,

    motivo TEXT NOT NULL,

    fecha DATE NOT NULL DEFAULT CURRENT_DATE,

    hora_salida TIMESTAMP,

    hora_llegada TIMESTAMP,

    creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_viaje_conductor
        FOREIGN KEY (id_conductores)
        REFERENCES conductores(id_conductores),

    CONSTRAINT fk_viaje_vehiculo
        FOREIGN KEY (id_vehiculos)
        REFERENCES vehiculos(id_vehiculos),

    CONSTRAINT fk_viaje_origen
        FOREIGN KEY (id_origen)
        REFERENCES lugares(id_lugares),

    CONSTRAINT fk_viaje_destino
        FOREIGN KEY (id_destino)
        REFERENCES lugares(id_lugares),

    CONSTRAINT fk_viaje_estado
        FOREIGN KEY (id_estado_viaje)
        REFERENCES estados_viaje(id_estado_viaje),

    CONSTRAINT chk_viaje_origen_destino
        CHECK (id_origen <> id_destino),

    CONSTRAINT chk_kilometraje_inicial
        CHECK (kilometraje_inicial >= 0),

    CONSTRAINT chk_kilometraje_final
        CHECK (
            kilometraje_final IS NULL
            OR kilometraje_final >= kilometraje_inicial
        ),

    CONSTRAINT chk_kilometros_recorridos
        CHECK (
            kilometros_recorridos IS NULL
            OR kilometros_recorridos >= 0
        ),

    CONSTRAINT chk_horas_viaje
        CHECK (
            hora_llegada IS NULL
            OR hora_salida IS NULL
            OR hora_llegada >= hora_salida
        ),

    CONSTRAINT chk_acompanantes_json
        CHECK (jsonb_typeof(acompanantes) = 'array')
);

--------------------------------------------------------------
-- UBICACIONES GPS
--------------------------------------------------------------

CREATE TABLE ubicaciones_viaje
(
    id_ubicaciones_viaje BIGSERIAL PRIMARY KEY,

    id_viajes INTEGER NOT NULL,

    latitud DECIMAL(10,7) NOT NULL,

    longitud DECIMAL(10,7) NOT NULL,

    precision_metros DECIMAL(10,2),

    velocidad DECIMAL(10,2),

    direccion DECIMAL(10,2),

    fecha_gps TIMESTAMP NOT NULL,

    creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_ubicacion_viaje
        FOREIGN KEY (id_viajes)
        REFERENCES viajes(id_viajes)
        ON DELETE CASCADE,

    CONSTRAINT chk_ubicacion_latitud
        CHECK (latitud BETWEEN -90 AND 90),

    CONSTRAINT chk_ubicacion_longitud
        CHECK (longitud BETWEEN -180 AND 180),

    CONSTRAINT chk_ubicacion_precision
        CHECK (
            precision_metros IS NULL
            OR precision_metros >= 0
        ),

    CONSTRAINT chk_ubicacion_velocidad
        CHECK (
            velocidad IS NULL
            OR velocidad >= 0
        ),

    CONSTRAINT chk_ubicacion_direccion
        CHECK (
            direccion IS NULL
            OR direccion BETWEEN 0 AND 360
        )
);

--------------------------------------------------------------
-- HISTORIAL DE ESTADOS
--------------------------------------------------------------

CREATE TABLE historial_estados_viaje
(
    id_historial_estado_viaje BIGSERIAL PRIMARY KEY,

    id_viajes INTEGER NOT NULL,

    id_estado_anterior INTEGER,

    id_estado_nuevo INTEGER NOT NULL,

    observaciones TEXT,

    creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_historial_viaje
        FOREIGN KEY (id_viajes)
        REFERENCES viajes(id_viajes)
        ON DELETE CASCADE,

    CONSTRAINT fk_historial_estado_anterior
        FOREIGN KEY (id_estado_anterior)
        REFERENCES estados_viaje(id_estado_viaje),

    CONSTRAINT fk_historial_estado_nuevo
        FOREIGN KEY (id_estado_nuevo)
        REFERENCES estados_viaje(id_estado_viaje),

    CONSTRAINT chk_historial_cambio_estado
        CHECK (
            id_estado_anterior IS NULL
            OR id_estado_anterior <> id_estado_nuevo
        )
);

--------------------------------------------------------------
-- ÍNDICES
--------------------------------------------------------------

CREATE INDEX idx_viajes_conductor
    ON viajes(id_conductores);

CREATE INDEX idx_viajes_vehiculo
    ON viajes(id_vehiculos);

CREATE INDEX idx_viajes_estado
    ON viajes(id_estado_viaje);

CREATE INDEX idx_viajes_fecha
    ON viajes(fecha);

CREATE INDEX idx_ubicaciones_viaje
    ON ubicaciones_viaje(id_viajes);

CREATE INDEX idx_ubicaciones_fecha
    ON ubicaciones_viaje(fecha_gps);

CREATE INDEX idx_historial_viaje
    ON historial_estados_viaje(id_viajes);

COMMIT;
