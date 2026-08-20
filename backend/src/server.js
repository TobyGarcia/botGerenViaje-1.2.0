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
      await databasePool.query("SELECT 1");
      console.log("Conexión inicial con PostgreSQL verificada.");
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
