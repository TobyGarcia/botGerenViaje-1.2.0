import { databasePool } from "../database/pool.js";
import { sendActiveTripReminder } from "../bot/bot.js";

function mexicoParts(date) {
  return Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23"
  }).formatToParts(date).map(part => [part.type, part.value]));
}

export function dueTripReminderSlots(startedAt, now = new Date()) {
  const elapsedMs = +now - +new Date(startedAt);
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return [];
  const startParts = mexicoParts(new Date(startedAt));
  const nowParts = mexicoParts(now);
  const startDay = `${startParts.year}-${startParts.month}-${startParts.day}`;
  const nowDay = `${nowParts.year}-${nowParts.month}-${nowParts.day}`;
  if (Number(nowParts.hour) >= 18 && startDay <= nowDay) {
    return [{ tipo: "CIERRE_OPERATIVO", numero: Number(nowDay.replaceAll("-", "")) }];
  }
  const sixHourBlocks = Math.floor(elapsedMs / (6 * 60 * 60000));
  if (sixHourBlocks >= 1) return [{ tipo: "6_HORAS", numero: sixHourBlocks }];
  if (elapsedMs >= 60 * 60000) return [{ tipo: "1_HORA", numero: 1 }];
  if (elapsedMs >= 45 * 60000) return [{ tipo: "45_MIN", numero: 1 }];
  return [];
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
