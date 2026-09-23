import bcrypt from "bcryptjs";
import {
  databasePool
} from "../database/pool.js";
import { generateUniqueDriverPin } from "./driver-auth.service.js";

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
  puesto,
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
          LIMIT 1
        `,
        [telegramUser.id]
      );

    let row = result.rows[0];

    if (!row) {
      const insertResult =
        await client.query(
          `
            INSERT INTO usuarios_telegram (
              telegram_user_id,
              telegram_username,
              telegram_first_name,
              telegram_last_name,
              rol,
              estado_registro,
              activo
            )
            VALUES ($1, $2, $3, $4, 'CONDUCTOR', 'PENDIENTE', TRUE)
            RETURNING
              id_usuario_telegram,
              telegram_user_id,
              telegram_username,
              telegram_first_name,
              telegram_last_name,
              id_conductores,
              rol,
              estado_registro,
              activo
          `,
          [
            telegramUser.id,
            telegramUser.username ||
              null,
            telegramUser.first_name ||
              null,
            telegramUser.last_name ||
              null
          ]
        );

      row = insertResult.rows[0];
    } else {
      const updateResult =
        await client.query(
          `
            UPDATE usuarios_telegram
            SET telegram_username = $1,
                telegram_first_name = $2,
                telegram_last_name = $3,
                actualizado_en = CURRENT_TIMESTAMP
            WHERE telegram_user_id = $4
            RETURNING
              id_usuario_telegram,
              telegram_user_id,
              telegram_username,
              telegram_first_name,
              telegram_last_name,
              id_conductores,
              rol,
              estado_registro,
              activo
          `,
          [
            telegramUser.username ||
              null,
            telegramUser.first_name ||
              null,
            telegramUser.last_name ||
              null,
            telegramUser.id
          ]
        );

      row = updateResult.rows[0];
    }

    let conductor = null;

    if (row.id_conductores) {
      const conductorResult =
        await client.query(
          `
            SELECT
              ${conductorColumns}
            FROM conductores
            WHERE id_conductores = $1
            LIMIT 1
          `,
          [row.id_conductores]
        );

      conductor =
        conductorResult.rows[0] ||
        null;
    }

    await client.query("COMMIT");

    return {
      telegramUser: row,
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
  tipoLicencia,
  empresa,
  puesto,
  licenciaVencimiento,
  fechaManejoComentado,
  licenciaUrl,
  licenciaReversoUrl
}) {
  const client = await databasePool.connect();

  try {
    await client.query("BEGIN");

    let telegramUser = null;
    let targetConductorId = null;

    if (telegramUserId) {
      const userResult = await client.query(
        `SELECT id_usuario_telegram, id_conductores, estado_registro FROM usuarios_telegram WHERE telegram_user_id = $1 LIMIT 1`,
        [telegramUserId]
      );
      telegramUser = userResult.rows[0] || null;
      if (telegramUser?.id_conductores) {
        targetConductorId = telegramUser.id_conductores;
      }
    }

    if (!targetConductorId && licenciaNumero) {
      const existingLicense = await client.query(
        `SELECT id_conductores FROM conductores WHERE licencia_numero = $1 LIMIT 1`,
        [licenciaNumero]
      );
      if (existingLicense.rows[0]) {
        targetConductorId = existingLicense.rows[0].id_conductores;
      }
    }

    const parsedDate = new Date(`${licenciaVencimiento}T00:00:00Z`);
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const licenciaVigente = parsedDate >= today;

    const generatedPin = await generateUniqueDriverPin(targetConductorId, client);
    const pinHash = await bcrypt.hash(generatedPin, 10);

    let conductor = null;
    if (targetConductorId) {
      // Actualizar conductor existente con nuevos datos y asegurarle el PIN generado
      const updateResult = await client.query(
        `UPDATE conductores
         SET nombre = $1,
             telefono = $2,
             tipo_licencia = $3,
             empresa = $4,
             puesto = COALESCE($5, puesto),
             licencia_vencimiento = $6,
             licencia_vigente = $7,
             fecha_manejo_comentado = COALESCE($8, fecha_manejo_comentado),
             licencia_url = COALESCE($9, licencia_url),
             licencia_reverso_url = COALESCE($10, licencia_reverso_url),
             pin_hash = $11,
             actualizado_en = CURRENT_TIMESTAMP
         WHERE id_conductores = $12
         RETURNING ${conductorColumns}`,
        [nombre, telefono, tipoLicencia, empresa, puesto || null, licenciaVencimiento, licenciaVigente, fechaManejoComentado || null, licenciaUrl || null, licenciaReversoUrl || null, pinHash, targetConductorId]
      );
      conductor = updateResult.rows[0];
    } else {
      // Insertar nuevo conductor con su PIN
      const conductorResult = await client.query(
        `
          INSERT INTO conductores (
            nombre, telefono, licencia_numero, tipo_licencia, empresa, puesto, licencia_vencimiento, licencia_vigente, fecha_manejo_comentado, licencia_url, licencia_reverso_url, activo, aprobado_por_admin, pin_hash
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, TRUE, FALSE, $12)
          RETURNING ${conductorColumns}
        `,
        [nombre, telefono, licenciaNumero, tipoLicencia, empresa, puesto || null, licenciaVencimiento, licenciaVigente, fechaManejoComentado || null, licenciaUrl || null, licenciaReversoUrl || null, pinHash]
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
