import { existsSync } from "node:fs";
import { resolve } from "node:path";

// Cargar variables de entorno desde .env nativamente (Node 20+)
const envFilesToLoad = [
  resolve(process.cwd(), ".env"),
  resolve(process.cwd(), "../.env"),
  resolve(process.cwd(), "backend/.env")
];

for (const envFile of envFilesToLoad) {
  if (existsSync(envFile)) {
    try {
      if (typeof process.loadEnvFile === "function") {
        process.loadEnvFile(envFile);
      }
    } catch {
      // Ignorar si ya se cargaron previamente
    }
  }
}

import app from "./app.js";
import { databasePool } from "./database/pool.js";
import {
  startTelegramBot,
  stopTelegramBot
} from "./bot/bot.js";
import {
  startSupervisorBot,
  stopSupervisorBot
} from "./bot/supervisor-bot.js";

const port = Number(
  process.env.PORT ||
  process.env.BACKEND_PORT ||
  3000
);

let httpServer = null;
let shuttingDown = false;

const configuredDatabaseRetryDelayMs = Number(
  process.env.DATABASE_RETRY_DELAY_MS || 5000
);
const databaseRetryDelayMs =
  Number.isFinite(configuredDatabaseRetryDelayMs) &&
  configuredDatabaseRetryDelayMs > 0
    ? configuredDatabaseRetryDelayMs
    : 5000;

function isTelegramPollingEnabled() {
  // En desarrollo se desactiva por defecto: ejecutar Render y el equipo local
  // con el mismo token provoca el 409 de getUpdates. Actívalo explícitamente
  // solo si el otro proceso está detenido o se usan tokens de desarrollo.
  return process.env.NODE_ENV === "production" || process.env.TELEGRAM_POLLING_ENABLED === "true";
}

async function startBots() {
  try {
    if (
      process.env.TELEGRAM_BOT_TOKEN &&
      process.env.TELEGRAM_SUPERVISOR_BOT_TOKEN &&
      process.env.TELEGRAM_BOT_TOKEN === process.env.TELEGRAM_SUPERVISOR_BOT_TOKEN
    ) {
      console.error(
        "❌ ERROR CRÍTICO: TELEGRAM_BOT_TOKEN y TELEGRAM_SUPERVISOR_BOT_TOKEN son IDÉNTICOS en las variables de entorno. Cada bot DEBE tener su propio Token único generado en BotFather."
      );
    }

    if (isTelegramPollingEnabled()) {
      // No se espera a que un bot termine sus reintentos de 409 antes de
      // crear el otro. Así el supervisor puede enviar alertas aunque el bot
      // de conductores siga recuperándose de un despliegue anterior.
      const results = await Promise.allSettled([
        startTelegramBot(),
        startSupervisorBot()
      ]);
      if (results[0].status === "rejected") {
        console.error("Error al intentar iniciar el bot de conductores:", results[0].reason?.message);
      }
      if (results[1].status === "rejected") {
        console.error("Error al intentar iniciar el bot de supervisores:", results[1].reason?.message);
      }
    } else {
      console.log("Polling de Telegram desactivado en desarrollo. Define TELEGRAM_POLLING_ENABLED=true solo si no hay otra instancia usando esos tokens.");
    }
  } catch (error) {
    console.error("Error iniciando las integraciones del backend:", error);
  }
}

async function initializeDependencies() {
  let attempt = 0;

  while (!shuttingDown) {
    attempt += 1;

    try {
      // Auto-migración 1: Vehículos y Mantenimiento
      try {
        await databasePool.query(`
          ALTER TABLE vehiculos
            ADD COLUMN IF NOT EXISTS en_mantenimiento BOOLEAN NOT NULL DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS fecha_inicio_mantenimiento TIMESTAMPTZ DEFAULT NULL,
            ADD COLUMN IF NOT EXISTS motivo_mantenimiento TEXT DEFAULT NULL,
            ADD COLUMN IF NOT EXISTS color VARCHAR(50),
            ADD COLUMN IF NOT EXISTS id_conductor_asignado INTEGER REFERENCES conductores(id_conductores) ON DELETE SET NULL,
            ADD COLUMN IF NOT EXISTS id_supervisor_asignado INTEGER REFERENCES usuarios_admin(id_usuarios_admin) ON DELETE SET NULL,
            ADD COLUMN IF NOT EXISTS personal_asignado_nombre VARCHAR(150);

          CREATE INDEX IF NOT EXISTS idx_vehiculos_mantenimiento
            ON vehiculos (en_mantenimiento)
            WHERE en_mantenimiento = TRUE;
        `);
      } catch (mErr) {
        console.warn("Aviso en auto-migración de vehiculos/mantenimiento:", mErr.message);
      }

      // Auto-migración 2: Conductores, PIN y Licencias
      try {
        await databasePool.query(`
          ALTER TABLE conductores
            ADD COLUMN IF NOT EXISTS pin_hash VARCHAR(255) DEFAULT NULL,
            ADD COLUMN IF NOT EXISTS aprobado_por_admin BOOLEAN NOT NULL DEFAULT TRUE,
            ADD COLUMN IF NOT EXISTS fecha_aprobacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            ADD COLUMN IF NOT EXISTS licencia_url TEXT DEFAULT NULL,
            ADD COLUMN IF NOT EXISTS licencia_reverso_url TEXT DEFAULT NULL,
            ADD COLUMN IF NOT EXISTS puesto VARCHAR(100) DEFAULT NULL;
        `);
      } catch (mErr) {
        console.warn("Aviso en auto-migración de conductores:", mErr.message);
      }

      // Auto-migración 3: Gerenciamiento y SharePoint
      try {
        await databasePool.query(`
          ALTER TABLE gerenciamiento_viajes
            ADD COLUMN IF NOT EXISTS sharepoint_web_url TEXT,
            ADD COLUMN IF NOT EXISTS sharepoint_item_id VARCHAR(255),
            ADD COLUMN IF NOT EXISTS sharepoint_subido_en TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS pdf_nombre VARCHAR(255),
            ADD COLUMN IF NOT EXISTS pdf_documento BYTEA;
        `);
      } catch (mErr) {
        console.warn("Aviso en auto-migración de gerenciamiento:", mErr.message);
      }

      // Auto-migración 4: Inspección de Remolque
      try {
        await databasePool.query(`
          ALTER TABLE inspecciones_vehiculares
            ADD COLUMN IF NOT EXISTS lleva_remolque BOOLEAN NOT NULL DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS id_remolque INTEGER REFERENCES vehiculos(id_vehiculos) ON DELETE SET NULL,
            ADD COLUMN IF NOT EXISTS inspeccion_remolque JSONB DEFAULT NULL;
        `);
      } catch (mErr) {
        console.warn("Aviso en auto-migración de inspecciones_remolque:", mErr.message);
      }

      // Auto-migración 4: Inspecciones y Usuarios Admin
      try {
        await databasePool.query(`
          ALTER TABLE inspecciones_vehiculares
            ADD COLUMN IF NOT EXISTS id_usuario_autorizador BIGINT REFERENCES usuarios_admin(id_usuarios_admin);

          ALTER TABLE usuarios_admin
            ADD COLUMN IF NOT EXISTS pin_hash TEXT;
        `);
      } catch (mErr) {
        console.warn("Aviso en auto-migración de inspecciones/usuarios:", mErr.message);
      }

      try {
        await databasePool.query(`
          ALTER TABLE usuarios_admin DROP CONSTRAINT IF EXISTS chk_usuarios_admin_rol;
          ALTER TABLE usuarios_admin ADD CONSTRAINT chk_usuarios_admin_rol CHECK (
            rol IN (
              'ADMINISTRADOR', 'SUPERVISOR', 'COORDINADOR', 'GERENTE', 'QHSE',
              'OPERADOR', 'CONSULTA', 'INSTRUCTOR', 'COORDINADOR_AREA',
              'GERENTE_GENERAL', 'COORDINADOR_QHSE'
            )
          );
        `);
      } catch (mErr) {
        console.warn("Aviso en auto-migración de rol usuarios_admin:", mErr.message);
      }

      // Auto-migración 5: Claves foráneas con ON DELETE SET NULL para usuarios_admin
      try {
        await databasePool.query(`
          ALTER TABLE gerenciamiento_viajes
            DROP CONSTRAINT IF EXISTS gerenciamiento_viajes_id_usuario_autorizador_fkey;
          ALTER TABLE gerenciamiento_viajes
            ADD CONSTRAINT gerenciamiento_viajes_id_usuario_autorizador_fkey
              FOREIGN KEY (id_usuario_autorizador)
              REFERENCES usuarios_admin(id_usuarios_admin)
              ON DELETE SET NULL;

          ALTER TABLE inspecciones_vehiculares
            DROP CONSTRAINT IF EXISTS inspecciones_vehiculares_id_usuario_admin_aprobador_fkey;
          ALTER TABLE inspecciones_vehiculares
            ADD CONSTRAINT inspecciones_vehiculares_id_usuario_admin_aprobador_fkey
              FOREIGN KEY (id_usuario_admin_aprobador)
              REFERENCES usuarios_admin(id_usuarios_admin)
              ON DELETE SET NULL;

          ALTER TABLE inspecciones_vehiculares
            DROP CONSTRAINT IF EXISTS inspecciones_vehiculares_id_usuario_autorizador_fkey;
          ALTER TABLE inspecciones_vehiculares
            ADD CONSTRAINT inspecciones_vehiculares_id_usuario_autorizador_fkey
              FOREIGN KEY (id_usuario_autorizador)
              REFERENCES usuarios_admin(id_usuarios_admin)
              ON DELETE SET NULL;
        `);
      } catch (mErr) {
        console.warn("Aviso en auto-migración de claves foráneas usuarios_admin:", mErr.message);
      }

      // Auto-migración 6: Siniestros
      try {
        await databasePool.query(`
          CREATE TABLE IF NOT EXISTS siniestros (
            id_siniestros SERIAL PRIMARY KEY,
            folio VARCHAR(50) NOT NULL UNIQUE,
            id_conductores INTEGER REFERENCES conductores(id_conductores) ON DELETE SET NULL,
            id_vehiculo INTEGER REFERENCES vehiculos(id_vehiculos) ON DELETE SET NULL,
            tipo_siniestro VARCHAR(100) NOT NULL,
            descripcion TEXT,
            latitud NUMERIC(10, 8),
            longitud NUMERIC(11, 8),
            altitud NUMERIC(10, 2),
            fotos JSONB DEFAULT '[]'::jsonb,
            pdf_url TEXT,
            creado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            actualizado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );

          CREATE INDEX IF NOT EXISTS idx_siniestros_conductor ON siniestros(id_conductores);
          CREATE INDEX IF NOT EXISTS idx_siniestros_creado_en ON siniestros(creado_en DESC);

          ALTER TABLE siniestros
            DROP CONSTRAINT IF EXISTS siniestros_id_conductores_fkey;
          ALTER TABLE siniestros
            ADD CONSTRAINT siniestros_id_conductores_fkey
              FOREIGN KEY (id_conductores) REFERENCES conductores(id_conductores) ON DELETE SET NULL;
        `);
      } catch (mErr) {
        console.warn("Aviso en auto-migración de siniestros:", mErr.message);
      }


      // Auto-migración 7: Control de Turnos Vehiculares
      try {
        await databasePool.query(`
          CREATE TABLE IF NOT EXISTS turnos_vehiculo (
            id_turno_vehiculo BIGSERIAL PRIMARY KEY,
            id_vehiculos INTEGER NOT NULL REFERENCES vehiculos(id_vehiculos) ON DELETE CASCADE,
            id_usuarios_admin BIGINT REFERENCES usuarios_admin(id_usuarios_admin) ON DELETE SET NULL,
            id_conductores INTEGER REFERENCES conductores(id_conductores) ON DELETE SET NULL,
            estado VARCHAR(30) NOT NULL CHECK (estado IN ('EN_TURNO', 'EN_TRASLADO_CASA')) DEFAULT 'EN_TURNO',
            odometro_final_turno INTEGER CHECK (odometro_final_turno >= 0),
            fecha_fin_turno TIMESTAMP,
            odometro_inicial_turno INTEGER CHECK (odometro_inicial_turno >= 0),
            fecha_inicio_turno TIMESTAMP,
            km_recorridos_casa INTEGER CHECK (km_recorridos_casa >= 0),
            observaciones_fin TEXT,
            observaciones_inicio TEXT,
            creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
          );

          CREATE INDEX IF NOT EXISTS idx_turnos_vehiculo_vehiculo_estado ON turnos_vehiculo (id_vehiculos, estado);
          CREATE INDEX IF NOT EXISTS idx_turnos_vehiculo_supervisor ON turnos_vehiculo (id_usuarios_admin);

          DO $$
          BEGIN
            IF EXISTS (
              SELECT 1 FROM pg_constraint WHERE conname = 'historial_kilometraje_vehiculos_tipo_registro_check'
            ) THEN
              ALTER TABLE historial_kilometraje_vehiculos
                DROP CONSTRAINT historial_kilometraje_vehiculos_tipo_registro_check;

              ALTER TABLE historial_kilometraje_vehiculos
                ADD CONSTRAINT historial_kilometraje_vehiculos_tipo_registro_check
                CHECK (tipo_registro IN ('INICIAL_VIAJE', 'FINAL_VIAJE', 'AJUSTE_MANUAL', 'CORRECCION', 'MIGRACION', 'FINAL_TURNO', 'INICIAL_TURNO'));
            END IF;
          END $$;
        `);
      } catch (mErr) {
        console.warn("Aviso en auto-migración de turnos vehiculares:", mErr.message);
      }

      // Auto-migración 8: Destinos Favoritos / Sugeridos
      try {
        await databasePool.query(`
          ALTER TABLE lugares
            ADD COLUMN IF NOT EXISTS es_favorito BOOLEAN NOT NULL DEFAULT FALSE;

          CREATE INDEX IF NOT EXISTS idx_lugares_es_favorito
            ON lugares (es_favorito)
            WHERE activo = TRUE;
        `);
      } catch (mErr) {
        console.warn("Aviso en auto-migración de destinos favoritos:", mErr.message);
      }

      console.log("Conexión inicial con PostgreSQL y esquema verificados.");
      await startBots();
      return;
    } catch (error) {
      console.error(
        `PostgreSQL no está disponible (intento ${attempt}). Se reintentará en ${databaseRetryDelayMs} ms:`,
        error.message
      );

      await new Promise((resolve) => {
        setTimeout(resolve, databaseRetryDelayMs);
      });
    }
  }
}

function startServer() {
  httpServer = app.listen(port, "0.0.0.0", () => {
    console.log(`Backend escuchando en el puerto ${port}.`);
    void initializeDependencies();
  });

  httpServer.on("error", (error) => {
    console.error("No fue posible abrir el puerto del backend:", error);
    process.exit(1);
  });
}

async function shutdown(signal) {
  shuttingDown = true;

  console.log(
    `Señal ${signal} recibida. Cerrando servidor.`
  );

  try {
    await stopTelegramBot(signal);
    await stopSupervisorBot(signal);

    if (httpServer){
      httpServer.close();
    }
    await databasePool.end();
  } catch (error) {
    console.error(
      "Error cerrando PostgreSQL:",
      error
    );
  }

  process.exit(0);
}

process.once("SIGTERM", () => {
  shutdown("SIGTERM");
});

process.once("SIGINT", () => {
  shutdown("SIGINT");
});

startServer();
