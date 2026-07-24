BEGIN;

CREATE TABLE usuarios_telegram
(
    id_usuario_telegram BIGSERIAL PRIMARY KEY,

    telegram_user_id BIGINT NOT NULL UNIQUE,

    telegram_username VARCHAR(100),

    telegram_first_name VARCHAR(150),

    telegram_last_name VARCHAR(150),

    id_conductores INTEGER UNIQUE,

    rol VARCHAR(30) NOT NULL DEFAULT 'CONDUCTOR',

    estado_registro VARCHAR(30)
        NOT NULL DEFAULT 'PENDIENTE',

    activo BOOLEAN NOT NULL DEFAULT TRUE,

    ultimo_acceso_en TIMESTAMP,

    creado_en TIMESTAMP
        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    actualizado_en TIMESTAMP
        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_usuario_telegram_conductor
        FOREIGN KEY (id_conductores)
        REFERENCES conductores(id_conductores),

    CONSTRAINT chk_usuario_telegram_rol
        CHECK (
            rol IN (
                'CONDUCTOR',
                'ADMINISTRADOR',
                'SUPERVISOR'
            )
        ),

    CONSTRAINT chk_usuario_telegram_estado
        CHECK (
            estado_registro IN (
                'PENDIENTE',
                'COMPLETO',
                'BLOQUEADO'
            )
        )
);

CREATE INDEX idx_usuarios_telegram_conductor
    ON usuarios_telegram(id_conductores);

CREATE INDEX idx_usuarios_telegram_activo
    ON usuarios_telegram(activo);

COMMIT;