import app from "./app.js";
import { databasePool } from "./database/pool.js";

const port = Number(
  process.env.BACKEND_PORT || 3000
);

async function startServer() {
  try {
    await databasePool.query("SELECT 1");

    console.log(
      "Conexión inicial con PostgreSQL verificada."
    );

    app.listen(port, "0.0.0.0", () => {
      console.log(
        `Backend escuchando en el puerto ${port}.`
      );
    });
  } catch (error) {
    console.error(
      "No fue posible iniciar el backend:",
      error
    );

    process.exit(1);
  }
}

async function shutdown(signal) {
  console.log(
    `Señal ${signal} recibida. Cerrando servidor.`
  );

  try {
    await databasePool.end();
  } catch (error) {
    console.error(
      "Error cerrando PostgreSQL:",
      error
    );
  }

  process.exit(0);
}

process.on("SIGTERM", () => {
  shutdown("SIGTERM");
});

process.on("SIGINT", () => {
  shutdown("SIGINT");
});

startServer();
