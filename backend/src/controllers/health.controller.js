import { databasePool } from "../database/pool.js";

export async function getHealthStatus(
  request,
  response
) {
  try {
    const result = await databasePool.query(
      `
        SELECT
          CURRENT_TIMESTAMP AS database_time,
          current_database() AS database_name,
          current_user AS database_user
      `
    );

    const databaseStatus = result.rows[0];

    return response.status(200).json({
      success: true,
      status: "ok",
      service: "gerenciamiento-viajes-backend",

      database: {
        connected: true,
        name: databaseStatus.database_name,
        user: databaseStatus.database_user,
        time: databaseStatus.database_time
      },

      serverTime: new Date().toISOString()
    });
  } catch (error) {
    console.error(
      "Error verificando PostgreSQL:",
      error
    );

    return response.status(503).json({
      success: false,
      status: "error",
      service: "gerenciamiento-viajes-backend",

      database: {
        connected: false
      },

      message:
        "El backend está activo, pero no pudo conectarse a PostgreSQL."
    });
  }
}