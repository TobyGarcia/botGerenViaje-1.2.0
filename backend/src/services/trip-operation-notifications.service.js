import { databasePool } from '../database/pool.js';
import { getTelegramBot } from '../bot/bot.js';

const labels = { COMPANION_ADDED: 'Acompañante agregado', COMPANION_DROPPED_OFF: 'Acompañante dejado', TRAILER_ATTACHED: 'Remolque enganchado', TRAILER_DETACHED: 'Remolque desenganchado' };
let running = false;
export async function deliverTripOperationNotifications() {
  if (running || !process.env.TELEGRAM_GROUP_ID || !process.env.TELEGRAM_BOT_TOKEN) return;
  running = true;
  const client = await databasePool.connect().catch(e => { running = false; throw e; });
  try {
    for (let i = 0; i < 10; i++) {
      await client.query('BEGIN');
      const { rows } = await client.query(`SELECT * FROM trip_operation_events WHERE sent_at IS NULL AND next_attempt_at<=CURRENT_TIMESTAMP
        ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED`);
      const event = rows[0];
      if (!event) { await client.query('COMMIT'); break; }
      try {
        const p = event.payload;
        await getTelegramBot().telegram.sendMessage(process.env.TELEGRAM_GROUP_ID,
          `${labels[event.event_type]}${p.closure ? ' (cierre del viaje)' : ''}\nViaje: ${p.folio}\n${p.name}\nHora: ${new Date(event.created_at).toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })}\n${p.latitude != null && p.longitude != null ? `${p.closure ? 'Último GPS del viaje' : 'Ubicación'}: https://maps.google.com/?q=${p.latitude},${p.longitude}` : 'Ubicación no disponible'}`);
        await client.query('UPDATE trip_operation_events SET sent_at=CURRENT_TIMESTAMP,attempts=attempts+1,last_error=NULL WHERE id=$1', [event.id]);
      } catch {
        await client.query(`UPDATE trip_operation_events SET attempts=attempts+1,last_error='Entrega Telegram fallida',
          next_attempt_at=CURRENT_TIMESTAMP+INTERVAL '1 minute' * LEAST(60, attempts+1) WHERE id=$1`, [event.id]);
      }
      await client.query('COMMIT');
    }
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); running = false; }
}
