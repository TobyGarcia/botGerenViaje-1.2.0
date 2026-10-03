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

  max: Number(process.env.DATABASE_POOL_MAX || 25),

  idleTimeoutMillis: 30000,

  connectionTimeoutMillis: 10000
});

databasePool.on("error", (error) => {
  console.error(
    "Error inesperado en el pool de PostgreSQL:",
    error
  );
});