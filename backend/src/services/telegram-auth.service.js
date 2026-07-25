import {
  databasePool
} from "../database/pool.js";

export class TelegramRegistrationError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.name = "TelegramRegistrationError";
    this.statusCode = statusCode;
  }
}

const conductorColumns = `
  id_conductores,
  nombre,
  licencia_numero,
  licencia_vigente,
  licencia_vencimiento,
  telefono,
  activo
`;

async function getConductorById(client, idConductor) {
  const result = await client.query(
    `SELECT ${conductorColumns} FROM conductores WHERE id_conductores = $1 LIMIT 1`,
    [idConductor]
  );

  return result.rows[0] ?? null;
}

export async function findOrCreateTelegramUser({
  telegramUser
}) {
  const client =
    await databasePool.connect();

  try {
    await client.query("BEGIN");

    const result =
      await client.query(
        `
          INSERT INTO usuarios_telegram (
            telegram_user_id,
            telegram_username,
            telegram_first_name,
            telegram_last_name,
            ultimo_acceso_en
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            CURRENT_TIMESTAMP
          )

          ON CONFLICT (
            telegram_user_id
          )
          DO UPDATE SET
            telegram_username =
              EXCLUDED.telegram_username,

            telegram_first_name =
              EXCLUDED.telegram_first_name,

            telegram_last_name =
              EXCLUDED.telegram_last_name,

            ultimo_acceso_en =
              CURRENT_TIMESTAMP,

            actualizado_en =
              CURRENT_TIMESTAMP

          RETURNING
            id_usuario_telegram,
            telegram_user_id,
            telegram_username,
            telegram_first_name,
            telegram_last_name,
            id_conductores,
            rol,
            estado_registro,
            activo,
            ultimo_acceso_en
        `,
        [
          telegramUser.id,
          telegramUser.username,
          telegramUser.firstName,
          telegramUser.lastName
        ]
      );

    const telegramDatabaseUser =
      result.rows[0];

    let conductor = null;

    if (
      telegramDatabaseUser.id_conductores
    ) {
      const conductorResult =
        await client.query(
          `SELECT ${conductorColumns} FROM conductores WHERE id_conductores = $1 LIMIT 1`,
          [telegramDatabaseUser.id_conductores]
        );

      conductor = conductorResult.rows[0] ?? null;
    }

    await client.query("COMMIT");

    return {
      telegramUser:
        telegramDatabaseUser,

      conductor
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function registerTelegramDriver({
  telegramUserId,
  nombre,
  telefono,
  licenciaNumero,
  licenciaVencimiento
}) {
  const client = await databasePool.connect();

  try {
    await client.query("BEGIN");

    const telegramUserResult = await client.query(
      `
        SELECT
          id_usuario_telegram,
          telegram_user_id,
          telegram_username,
          telegram_first_name,
          telegram_last_name,
          id_conductores,
          rol,
          estado_registro,
          activo
        FROM usuarios_telegram
        WHERE telegram_user_id = $1
        FOR UPDATE
      `,
      [telegramUserId]
    );

    const telegramUser = telegramUserResult.rows[0];

    if (!telegramUser) {
      throw new TelegramRegistrationError(
        "El usuario de Telegram no ha sido autenticado.",
        409
      );
    }

    if (!telegramUser.activo || telegramUser.estado_registro === "BLOQUEADO") {
      throw new TelegramRegistrationError(
        "Tu acceso está restringido.",
        403
      );
    }

    if (telegramUser.id_conductores && telegramUser.estado_registro === "COMPLETO") {
      const conductor = await getConductorById(client, telegramUser.id_conductores);

      if (!conductor) {
        throw new TelegramRegistrationError(
          "El conductor vinculado no existe.",
          409
        );
      }

      await client.query("COMMIT");
      return { telegramUser, conductor, created: false };
    }

    const licenciaVigente = licenciaVencimiento >= new Date().toISOString().slice(0, 10);
    const conductorResult = await client.query(
      `
        INSERT INTO conductores (
          nombre,
          telefono,
          licencia_numero,
          licencia_vencimiento,
          licencia_vigente,
          activo
        )
        VALUES ($1, $2, $3, $4, $5, TRUE)
        RETURNING ${conductorColumns}
      `,
      [nombre, telefono, licenciaNumero, licenciaVencimiento, licenciaVigente]
    );
    const conductor = conductorResult.rows[0];

    const updateResult = await client.query(
      `
        UPDATE usuarios_telegram
        SET
          id_conductores = $1,
          estado_registro = 'COMPLETO',
          actualizado_en = CURRENT_TIMESTAMP
        WHERE telegram_user_id = $2
      `,
      [conductor.id_conductores, telegramUserId]
    );

    if (updateResult.rowCount !== 1) {
      throw new Error("No fue posible vincular el conductor registrado.");
    }

    await client.query("COMMIT");
    return {
      telegramUser: {
        ...telegramUser,
        id_conductores: conductor.id_conductores,
        estado_registro: "COMPLETO"
      },
      conductor,
      created: true
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
