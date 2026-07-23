import pg from "pg";

const { Pool } = pg;

export const databasePool = new Pool({
  connectionString: process.env.DATABASE_URL,

  max: 10,

  idleTimeoutMillis: 30000,

  connectionTimeoutMillis: 5000
});

databasePool.on("connect", () => {
  console.log("Nueva conexión establecida con PostgreSQL.");
});

databasePool.on("error", (error) => {
  console.error(
    "Error inesperado en el pool de PostgreSQL:",
    error
  );
});