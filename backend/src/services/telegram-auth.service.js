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
  tipo_licencia,
  empresa,
  licencia_vigente,
  licencia_vencimiento,
  fecha_manejo_comentado,
  telefono,
  activo
`;

async function getConductorById(client, idConductor) {
  const result = await client.query(
    `SELECT 
       c.id_conductores,
       c.nombre,
       c.licencia_numero,
       c.tipo_licencia,
       c.empresa,
       c.licencia_vigente,
       c.licencia_vencimiento,
       c.fecha_manejo_comentado,
       c.telefono,
       c.activo,
       v.id_vehiculos AS id_vehiculo_asignado,
       v.nombre AS vehiculo_asignado_nombre,
       v.numero_economico AS vehiculo_asignado_numero_economico
     FROM conductores c
     LEFT JOIN vehiculos v ON v.id_conductor_asignado = c.id_conductores
     WHERE c.id_conductores = $1 
     LIMIT 1`,
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
  telegramUserId = null,
  nombre,
  telefono,
  licenciaNumero,
  tipoLicencia,
  empresa,
  licenciaVencimiento,
  fechaManejoComentado = null
}) {
  const client = await databasePool.connect();

  try {
    await client.query("BEGIN");

    let telegramUser = null;
    if (telegramUserId) {
      const telegramUserResult = await client.query(
        `SELECT id_usuario_telegram, telegram_user_id, telegram_username, telegram_first_name, telegram_last_name, id_conductores, rol, estado_registro, activo
         FROM usuarios_telegram WHERE telegram_user_id = $1 FOR UPDATE`,
        [telegramUserId]
      );
      telegramUser = telegramUserResult.rows[0] || null;

      if (telegramUser && !telegramUser.activo) {
        throw new TelegramRegistrationError("Tu acceso está restringido.", 403);
      }

      if (telegramUser && telegramUser.id_conductores && telegramUser.estado_registro === "COMPLETO") {
        const conductor = await getConductorById(client, telegramUser.id_conductores);
        if (conductor) {
          await client.query("COMMIT");
          return { telegramUser, conductor, created: false };
        }
      }
    }

    const licenciaVigente = licenciaVencimiento >= new Date().toISOString().slice(0, 10);
    const conductorResult = await client.query(
      `
        INSERT INTO conductores (
          nombre, telefono, licencia_numero, tipo_licencia, empresa, licencia_vencimiento, licencia_vigente, fecha_manejo_comentado, activo, aprobado_por_admin
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE, FALSE)
        RETURNING ${conductorColumns}
      `,
      [nombre, telefono, licenciaNumero, tipoLicencia, empresa, licenciaVencimiento, licenciaVigente, fechaManejoComentado || null]
    );
    const conductor = conductorResult.rows[0];

    if (telegramUser) {
      await client.query(
        `UPDATE usuarios_telegram SET id_conductores = $1, estado_registro = 'PENDIENTE_APROBACION', actualizado_en = CURRENT_TIMESTAMP WHERE telegram_user_id = $2`,
        [conductor.id_conductores, telegramUserId]
      );
    }

    await client.query("COMMIT");
    return {
      telegramUser: telegramUser ? { ...telegramUser, id_conductores: conductor.id_conductores, estado_registro: "PENDIENTE_APROBACION" } : { estado_registro: "PENDIENTE_APROBACION" },
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
