import { databasePool } from '../database/pool.js';
import { getTelegramBot } from '../bot/bot.js';
import { groupStopEvents, formatStopSummary } from './trip-operation-message.js';

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
      const candidates=await client.query(`SELECT * FROM trip_operation_events WHERE sent_at IS NULL AND trip_id=$1
        AND id >= $2 AND next_attempt_at<=CURRENT_TIMESTAMP ORDER BY id LIMIT 20 FOR UPDATE SKIP LOCKED`,[event.trip_id,event.id]);
      const group=groupStopEvents(candidates.rows);
      if (!event.payload.closure && Date.now()-+new Date(group[group.length-1].created_at)<30000) {
        await client.query('COMMIT'); break;
      }
      const ids=group.map(e=>e.id);
      try {
        await getTelegramBot().telegram.sendMessage(process.env.TELEGRAM_GROUP_ID,
          formatStopSummary(group));
        await client.query('UPDATE trip_operation_events SET sent_at=CURRENT_TIMESTAMP,attempts=attempts+1,last_error=NULL WHERE id=ANY($1::bigint[])', [ids]);
      } catch {
        await client.query(`UPDATE trip_operation_events SET attempts=attempts+1,last_error='Entrega Telegram fallida',
          next_attempt_at=CURRENT_TIMESTAMP+INTERVAL '1 minute' * LEAST(60, attempts+1) WHERE id=ANY($1::bigint[])`, [ids]);
      }
      await client.query('COMMIT');
    }
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); running = false; }
}
