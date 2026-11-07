import { databasePool } from '../database/pool.js';

const botId = () => process.env.TELEGRAM_BOT_TOKEN?.split(':')[0] || '';
const tripId = trip => Number(trip?.idViaje ?? trip?.id_viajes);

export async function rememberTripStartMessage(trip, message) {
  const id = tripId(trip);
  if (!Number.isSafeInteger(id) || id <= 0 || !Number.isSafeInteger(message?.message_id) || message.message_id <= 0) return;
  await databasePool.query(`INSERT INTO trip_telegram_start_messages(trip_id,chat_id,bot_id,message_id,thread_id)
    VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,
    [id, String(process.env.TELEGRAM_GROUP_ID), botId(), message.message_id, message.message_thread_id ?? null]);
}

export async function getTripTelegramContext(trip, { client = databasePool } = {}) {
  const id = tripId(trip);
  if (!Number.isSafeInteger(id) || id <= 0) return trip || {};
  const result = await client.query(`SELECT v.folio,c.nombre AS conductor,vh.nombre AS vehiculo,
      vh.numero_economico AS "numeroEconomico",m.message_id AS "telegramMessageId",m.thread_id AS "telegramThreadId"
    FROM viajes v JOIN conductores c USING(id_conductores) JOIN vehiculos vh USING(id_vehiculos)
    LEFT JOIN trip_telegram_start_messages m ON m.trip_id=v.id_viajes AND m.chat_id=$2 AND m.bot_id=$3
    WHERE v.id_viajes=$1`, [id, String(process.env.TELEGRAM_GROUP_ID), botId()]);
  return result.rows[0] || trip || {};
}

export function tripReplyOptions(context) {
  const id = Number(context?.telegramMessageId);
  if (!Number.isSafeInteger(id) || id <= 0) return {};
  const threadId = Number(context.telegramThreadId);
  return {
    reply_parameters: { message_id: id, allow_sending_without_reply: true },
    ...(Number.isSafeInteger(threadId) && threadId > 0 ? { message_thread_id: threadId } : {})
  };
}
