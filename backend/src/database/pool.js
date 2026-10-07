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

  application_name: process.env.DATABASE_APPLICATION_NAME || "gv-backend",

  statement_timeout: Number(process.env.DATABASE_STATEMENT_TIMEOUT_MS || 30000),

  query_timeout: Number(process.env.DATABASE_QUERY_TIMEOUT_MS || 35000),

  idle_in_transaction_session_timeout: Number(
    process.env.DATABASE_IDLE_TRANSACTION_TIMEOUT_MS || 60000
  ),

  idleTimeoutMillis: 30000,

  connectionTimeoutMillis: 10000
});

databasePool.on("error", (error) => {
  console.error(
    "Error inesperado en el pool de PostgreSQL:",
    error
  );
});
