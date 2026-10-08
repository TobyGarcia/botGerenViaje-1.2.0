import { databasePool } from "../database/pool.js";
import { sendActiveTripReminder } from "../bot/bot.js";

export function dueTripReminderSlots(startedAt, now = new Date()) {
  const elapsedMs = +now - +new Date(startedAt);
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return [];
  return elapsedMs >= 24 * 60 * 60000 ? [{ tipo: "24_HORAS", numero: 1 }] : [];
}

async function claimReminder(client, idViaje, slot) {
  return (await client.query(`INSERT INTO recordatorios_viaje (id_viajes,tipo,numero)
    VALUES ($1,$2,$3)
    ON CONFLICT (id_viajes,tipo,numero) DO UPDATE SET
      estado='PENDIENTE',intentos=recordatorios_viaje.intentos+1,actualizado_en=CURRENT_TIMESTAMP
    WHERE recordatorios_viaje.estado='FALLIDO' AND recordatorios_viaje.intentos<3
      AND recordatorios_viaje.actualizado_en < CURRENT_TIMESTAMP-INTERVAL '15 minutes'
    RETURNING id_recordatorio`, [idViaje, slot.tipo, slot.numero])).rows[0];
}

export async function processActiveTripReminders(now = new Date()) {
  const { rows } = await databasePool.query(`SELECT v.id_viajes,v.folio,v.hora_salida,ut.telegram_user_id
    FROM viajes v JOIN estados_viaje e USING(id_estado_viaje)
    LEFT JOIN usuarios_telegram ut ON ut.id_conductores=v.id_conductores AND ut.activo=TRUE
    WHERE e.nombre='EN_CURSO' AND v.hora_salida IS NOT NULL`);
  let sent = 0;
  for (const trip of rows) {
    if (!trip.telegram_user_id) continue;
    for (const slot of dueTripReminderSlots(trip.hora_salida, now)) {
      const claim = await claimReminder(databasePool, trip.id_viajes, slot);
      if (!claim) continue;
      try {
        await sendActiveTripReminder({ telegramUserId: trip.telegram_user_id, folio: trip.folio, horaSalida: trip.hora_salida });
        await databasePool.query("UPDATE recordatorios_viaje SET estado='ENVIADO',enviado_en=$2,actualizado_en=CURRENT_TIMESTAMP,ultimo_error=NULL WHERE id_recordatorio=$1", [claim.id_recordatorio, now]);
        sent += 1;
      } catch (error) {
        await databasePool.query("UPDATE recordatorios_viaje SET estado='FALLIDO',ultimo_error=$2,actualizado_en=CURRENT_TIMESTAMP WHERE id_recordatorio=$1", [claim.id_recordatorio, String(error.message || error).slice(0, 1000)]);
      }
    }
  }
  return sent;
}
