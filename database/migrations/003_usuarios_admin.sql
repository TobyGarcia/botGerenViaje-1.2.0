BEGIN;

CREATE TABLE IF NOT EXISTS usuarios_admin
(
    id_usuarios_admin BIGSERIAL PRIMARY KEY,

    nombre VARCHAR(150) NOT NULL,

    username VARCHAR(100) NOT NULL,

    correo VARCHAR(200),

    password_hash TEXT NOT NULL,

    rol VARCHAR(30) NOT NULL
        DEFAULT 'OPERADOR',

    activo BOOLEAN NOT NULL
        DEFAULT TRUE,

    intentos_fallidos INTEGER NOT NULL
        DEFAULT 0,

    bloqueado_hasta TIMESTAMPTZ,

    ultimo_acceso_en TIMESTAMPTZ,

    creado_en TIMESTAMPTZ NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    actualizado_en TIMESTAMPTZ NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_usuarios_admin_username
        UNIQUE (username),

    CONSTRAINT uq_usuarios_admin_correo
        UNIQUE (correo),

    CONSTRAINT chk_usuarios_admin_rol
        CHECK (
            rol IN (
                'ADMINISTRADOR',
                'SUPERVISOR',
                'OPERADOR',
                'CONSULTA'
            )
        ),

    CONSTRAINT chk_usuarios_admin_intentos
        CHECK (
            intentos_fallidos >= 0
        )
);

CREATE INDEX IF NOT EXISTS
    idx_usuarios_admin_activo
ON usuarios_admin(activo);

CREATE INDEX IF NOT EXISTS
    idx_usuarios_admin_rol
ON usuarios_admin(rol);

COMMIT;