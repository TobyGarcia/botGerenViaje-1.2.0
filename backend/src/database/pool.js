import pg from "pg";

const { Pool } = pg;

const isSslEnabled =
  process.env.DATABASE_SSL === "true" ||
  process.env.DATABASE_URL?.includes("sslmode=require");

export const databasePool = new Pool({
  connectionString: process.env.DATABASE_URL,

  ...(isSslEnabled
    ? {
        ssl: {
          rejectUnauthorized: false
        }
      }
    : {}),

  max: 10,

  idleTimeoutMillis: 30000,

  connectionTimeoutMillis: 5000
});

databasePool.on("connect", (client) => {
  console.log("Nueva conexión establecida con PostgreSQL.");
  const tz = process.env.TZ || "America/Mexico_City";
  client.query(`SET timezone = '${tz}'`).catch((err) => {
    console.warn("Aviso al configurar timezone en PostgreSQL:", err.message);
  });
});

databasePool.on("error", (error) => {
  console.error(
    "Error inesperado en el pool de PostgreSQL:",
    error
  );
});