-- ==========================================================
-- Migración 006
-- Datos ampliados y disponibilidad de vehículos
-- ==========================================================
-- Se conserva `nombre` temporalmente como campo heredado para que la
-- migración sea compatible con los datos y despliegues existentes.

BEGIN;

ALTER TABLE vehiculos
    ADD COLUMN IF NOT EXISTS marca VARCHAR(80),
    ADD COLUMN IF NOT EXISTS modelo VARCHAR(100),
    ADD COLUMN IF NOT EXISTS numero_poliza VARCHAR(100),
    ADD COLUMN IF NOT EXISTS seguro_vencimiento DATE,
    ADD COLUMN IF NOT EXISTS numero_serie VARCHAR(100),
    ADD COLUMN IF NOT EXISTS tipo_vehiculo VARCHAR(80),
    ADD COLUMN IF NOT EXISTS tipo_propiedad VARCHAR(20),
    ADD COLUMN IF NOT EXISTS en_mantenimiento BOOLEAN NOT NULL DEFAULT FALSE;

-- Conserva los registros existentes: el primer término se toma como marca
-- y el resto como modelo. Los datos incompletos pueden corregirse desde el
-- catálogo después de aplicar la actualización.
UPDATE vehiculos
SET
    marca = COALESCE(
        NULLIF(marca, ''),
        NULLIF(split_part(trim(nombre), ' ', 1), '')
    ),
    modelo = COALESCE(
        NULLIF(modelo, ''),
        NULLIF(regexp_replace(trim(nombre), '^\S+\s*', ''), '')
    ),
    tipo_propiedad = COALESCE(tipo_propiedad, 'EMPRESARIAL'),
    en_mantenimiento = COALESCE(en_mantenimiento, FALSE);

ALTER TABLE vehiculos
    DROP CONSTRAINT IF EXISTS chk_vehiculo_tipo_propiedad;

ALTER TABLE vehiculos
    ADD CONSTRAINT chk_vehiculo_tipo_propiedad
    CHECK (tipo_propiedad IN ('EMPRESARIAL', 'PATRIMONIAL'));

CREATE UNIQUE INDEX IF NOT EXISTS uq_vehiculos_numero_serie
    ON vehiculos (numero_serie)
    WHERE numero_serie IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_vehiculos_mantenimiento
    ON vehiculos (en_mantenimiento)
    WHERE en_mantenimiento = TRUE;

COMMIT;
