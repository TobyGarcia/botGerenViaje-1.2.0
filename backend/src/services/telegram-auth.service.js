import bcrypt from "bcryptjs";
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
  activo,
  aprobado_por_admin,
  licencia_url,
  licencia_reverso_url
`;


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
  fechaManejoComentado = null,
  licenciaUrl = null,
  licenciaReversoUrl = null
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
    }

    const licenciaVigente = licenciaVencimiento >= new Date().toISOString().slice(0, 10);
    const generatedPin = String(Math.floor(1000 + Math.random() * 9000));
    const pinHash = await bcrypt.hash(generatedPin, 10);

    // 1. Verificar si ya existe el conductor vinculado a este usuario de Telegram o por número de licencia
    let targetConductorId = telegramUser?.id_conductores || null;
    if (!targetConductorId && licenciaNumero) {
      const existingLicense = await client.query(
        `SELECT id_conductores FROM conductores WHERE LOWER(licencia_numero) = LOWER($1) LIMIT 1`,
        [licenciaNumero]
      );
      if (existingLicense.rows[0]) {
        targetConductorId = existingLicense.rows[0].id_conductores;
      }
    }

    let conductor = null;
    if (targetConductorId) {
      // Actualizar conductor existente con nuevos datos y asegurarle el PIN generado
      const updateResult = await client.query(
        `UPDATE conductores
         SET nombre = $1,
             telefono = $2,
             tipo_licencia = $3,
             empresa = $4,
             licencia_vencimiento = $5,
             licencia_vigente = $6,
             fecha_manejo_comentado = COALESCE($7, fecha_manejo_comentado),
             licencia_url = COALESCE($8, licencia_url),
             licencia_reverso_url = COALESCE($9, licencia_reverso_url),
             pin_hash = $10,
             actualizado_en = CURRENT_TIMESTAMP
         WHERE id_conductores = $11
         RETURNING ${conductorColumns}`,
        [nombre, telefono, tipoLicencia, empresa, licenciaVencimiento, licenciaVigente, fechaManejoComentado || null, licenciaUrl || null, licenciaReversoUrl || null, pinHash, targetConductorId]
      );
      conductor = updateResult.rows[0];
    } else {
      // Insertar nuevo conductor con su PIN
      const conductorResult = await client.query(
        `
          INSERT INTO conductores (
            nombre, telefono, licencia_numero, tipo_licencia, empresa, licencia_vencimiento, licencia_vigente, fecha_manejo_comentado, licencia_url, licencia_reverso_url, activo, aprobado_por_admin, pin_hash
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, TRUE, FALSE, $11)
          RETURNING ${conductorColumns}
        `,
        [nombre, telefono, licenciaNumero, tipoLicencia, empresa, licenciaVencimiento, licenciaVigente, fechaManejoComentado || null, licenciaUrl || null, licenciaReversoUrl || null, pinHash]
      );
      conductor = conductorResult.rows[0];
    }

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
      pinGenerado: generatedPin,
      created: true
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
