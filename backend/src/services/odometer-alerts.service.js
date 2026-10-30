import { databasePool } from "../database/pool.js";
import { getTelegramBot } from "../bot/bot.js";

export function odometerCaption(report) {
  return ["📟 CORRECCIÓN DE ODÓMETRO", `Folio: ${report.folio}`, `Conductor: ${report.conductor}`,
    `Unidad: ${report.vehiculo}`, `Número económico: ${report.numero_economico || "Sin registro"}`,
    `Lectura anterior: ${report.lectura_anterior} km`, `Lectura corregida: ${report.lectura_nueva} km`,
    `Motivo: ${report.motivo}`, "Aplicada desde este viaje. La diferencia no cuenta como recorrido."].join("\n").slice(0, 1000);
}
let busy = false;
export async function processOdometerAlerts({ pool = databasePool, sendPhoto } = {}) {
  if (busy || (!sendPhoto && !process.env.TELEGRAM_GROUP_ID)) return 0;
  busy = true;
  let sent = 0;
  try {
    for (let i = 0; i < 5; i++) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const report = (await client.query(`SELECT a.*,v.folio,c.nombre AS conductor,vh.nombre AS vehiculo,vh.numero_economico
          FROM ajustes_odometro_viaje a JOIN viajes v USING(id_viajes)
          JOIN conductores c ON c.id_conductores=a.id_conductores
          JOIN vehiculos vh ON vh.id_vehiculos=a.id_vehiculos
          WHERE a.aplicado_en IS NOT NULL AND a.telegram_enviado_en IS NULL AND a.siguiente_intento<=CURRENT_TIMESTAMP
          ORDER BY a.siguiente_intento LIMIT 1 FOR UPDATE OF a SKIP LOCKED`)).rows[0];
        if (!report) { await client.query("COMMIT"); break; }
        try {
          const deliver = sendPhoto || ((photo, caption) => getTelegramBot().telegram.sendPhoto(process.env.TELEGRAM_GROUP_ID,
            { source: photo, filename: `odometro-${report.folio}.jpg` }, { caption }));
          await deliver(report.foto, odometerCaption(report));
          await client.query("UPDATE ajustes_odometro_viaje SET telegram_enviado_en=CURRENT_TIMESTAMP WHERE id_viajes=$1", [report.id_viajes]);
          sent++;
        } catch {
          await client.query(`UPDATE ajustes_odometro_viaje SET intentos=intentos+1,
            siguiente_intento=CURRENT_TIMESTAMP+INTERVAL '1 minute' * LEAST(60,POWER(2,LEAST(intentos,6))) WHERE id_viajes=$1`, [report.id_viajes]);
        }
        await client.query("COMMIT");
      } catch (error) { await client.query("ROLLBACK"); throw error; }
      finally { client.release(); }
    }
  } finally { busy = false; }
  return sent;
}
