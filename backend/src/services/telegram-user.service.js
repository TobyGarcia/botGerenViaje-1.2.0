import {
  databasePool
} from "../database/pool.js";

export async function findTelegramUserById(
  telegramUserId
) {
  const result =
    await databasePool.query(
      `
        SELECT
          ut.id_usuario_telegram,
          ut.telegram_user_id,
          ut.id_conductores,
          ut.rol,
          ut.estado_registro,
          ut.activo,

          c.nombre AS conductor_nombre,
          c.licencia_vigente,
          c.activo AS conductor_activo

        FROM usuarios_telegram ut

        LEFT JOIN conductores c
          ON c.id_conductores =
             ut.id_conductores

        WHERE ut.telegram_user_id = $1
        LIMIT 1
      `,
      [
        String(telegramUserId)
      ]
    );

  return result.rows[0] ?? null;
}

export async function findTelegramUserByConductorId(idConductor) {
  const result = await databasePool.query(
    `
      SELECT telegram_user_id, id_conductores
      FROM usuarios_telegram
      WHERE id_conductores = $1
        AND activo = TRUE
      ORDER BY id_usuario_telegram DESC
      LIMIT 1
    `,
    [idConductor]
  );

  return result.rows[0] ?? null;
}
