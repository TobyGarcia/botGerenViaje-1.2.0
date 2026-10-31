import { databasePool } from '../database/pool.js';
import { parseTripOperationInput } from './trip-operation-input.js';

function fail(message, statusCode = 400) { throw Object.assign(new Error(message), { statusCode }); }

async function ownedTrip(client, tripId, driverId) {
  const { rows } = await client.query(`SELECT v.*, e.nombre AS estado FROM viajes v
    JOIN estados_viaje e USING(id_estado_viaje)
    WHERE v.id_viajes=$1 AND v.id_conductores=$2 FOR UPDATE OF v`, [tripId, driverId]);
  if (!rows[0]) fail('No se encontró el viaje del conductor.', 404);
  return rows[0];
}

// Importa los elementos iniciales una sola vez; retirarlos no los vuelve a activar.
async function seedInitial(client, trip) {
  const names = Array.isArray(trip.acompanantes) ? trip.acompanantes : [];
  for (const [index, value] of names.entries()) {
    const name = typeof value === 'string' ? value : value?.nombre || value?.name;
    if (name) await client.query(`INSERT INTO trip_operation_items(trip_id,kind,name,initial_key,added_at)
      VALUES($1,'companion',$2,$3,COALESCE($4,CURRENT_TIMESTAMP)) ON CONFLICT DO NOTHING`,
      [trip.id_viajes, name, `companion-${index}`, trip.hora_salida || trip.creado_en]);
  }
  const { rows } = await client.query(`SELECT i.id_inspeccion, i.id_remolque, i.inspeccion_remolque, i.estado,
    v.nombre FROM inspecciones_vehiculares i JOIN vehiculos v ON v.id_vehiculos=i.id_remolque
    WHERE i.id_viajes=$1 AND i.lleva_remolque=TRUE ORDER BY i.id_inspeccion DESC LIMIT 1`, [trip.id_viajes]);
  if (rows[0]) {
    const i = rows[0];
    await client.query(`INSERT INTO trip_operation_items(trip_id,kind,name,trailer_id,inspection,initial_key,added_at)
      VALUES($1,'trailer',$2,$3,$4,'initial-trailer',COALESCE($5,CURRENT_TIMESTAMP)) ON CONFLICT DO NOTHING`,
      [trip.id_viajes, i.nombre, i.id_remolque, JSON.stringify(i), trip.hora_salida || trip.creado_en]);
  }
}

export async function closeTripItems(client, tripId) {
  const tripResult = await client.query('SELECT * FROM viajes WHERE id_viajes=$1', [tripId]);
  if (!tripResult.rows[0]) return;
  await seedInitial(client, tripResult.rows[0]);
  const location = await client.query(`SELECT latitud, longitud FROM ubicaciones_viaje WHERE id_viajes=$1
    ORDER BY fecha_gps DESC, id_ubicaciones_viaje DESC LIMIT 1`, [tripId]);
  const point = location.rows[0];
  const items = await client.query(`UPDATE trip_operation_items SET removed_at=CURRENT_TIMESTAMP,
    removed_latitude=$2, removed_longitude=$3 WHERE trip_id=$1 AND removed_at IS NULL RETURNING *`,
    [tripId, point?.latitud ?? null, point?.longitud ?? null]);
  for (const item of items.rows) {
    const type = item.kind === 'companion' ? 'COMPANION_DROPPED_OFF' : 'TRAILER_DETACHED';
    await client.query(`INSERT INTO trip_operation_events(event_key,trip_id,item_id,event_type,payload)
      VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`, [`finish-${tripId}-${item.id}`,tripId,item.id,type,
      JSON.stringify({ folio: tripResult.rows[0].folio, name: item.name, latitude: point?.latitud ?? null,
        longitude: point?.longitud ?? null, closure: true, locationSource: 'last_trip_gps' })]);
  }
}

export async function listTripItems(tripId, driverId) {
  const client = await databasePool.connect();
  try {
    await client.query('BEGIN');
    const trip = await ownedTrip(client, tripId, driverId);
    await seedInitial(client, trip);
    const result = await client.query('SELECT * FROM trip_operation_items WHERE trip_id=$1 ORDER BY id', [tripId]);
    await client.query('COMMIT');
    return result.rows;
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
}

export async function trailerInspection(trailerId, driverId, queryClient = databasePool) {
  const { rows } = await queryClient.query(`SELECT id_inspeccion, estado, fecha_operativa, inspeccion_remolque
    FROM inspecciones_vehiculares WHERE id_remolque=$1 AND id_conductores=$2
    AND inspeccion_remolque IS NOT NULL ORDER BY id_inspeccion DESC LIMIT 1`, [trailerId, driverId]);
  if (rows[0]) return rows[0];
  const saved = await queryClient.query(`SELECT inspection FROM trip_operation_items t JOIN viajes v ON v.id_viajes=t.trip_id
    WHERE t.trailer_id=$1 AND v.id_conductores=$2 AND t.inspection IS NOT NULL ORDER BY t.id DESC LIMIT 1`, [trailerId, driverId]);
  return saved.rows[0]?.inspection || null;
}

export async function recordTripOperation(tripId, driverId, body) {
  const input = parseTripOperationInput(body);
  const client = await databasePool.connect();
  try {
    await client.query('BEGIN');
    const trip = await ownedTrip(client, tripId, driverId);
    const previous = await client.query('SELECT * FROM trip_operation_events WHERE event_key=$1', [input.eventKey]);
    if (previous.rows[0]) {
      if (previous.rows[0].trip_id !== tripId) fail('Identificador usado en otro viaje.', 409);
      await client.query('COMMIT'); return previous.rows[0];
    }
    if (!['PENDIENTE','EN_CURSO'].includes(trip.estado)) fail('El viaje ya está cerrado.', 409);
    await seedInitial(client, trip);
    let item;
    if (input.type === 'COMPANION_ADDED' || input.type === 'TRAILER_ATTACHED') {
      let name = input.name, inspection = null;
      if (input.type === 'TRAILER_ATTACHED') {
        const vehicle = await client.query('SELECT * FROM vehiculos WHERE id_vehiculos=$1', [input.itemId]);
        const v = vehicle.rows[0];
        const kind = String(v?.tipo_vehiculo || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        const description = String(`${v?.nombre || ''} ${v?.marca || ''} ${v?.modelo || ''}`).toLowerCase();
        const trailerPattern = /\b(remolque|semirremolque|semiremolque|trailer|dolly|lowboy|plana|cama baja)\b/;
        if (!v || !(trailerPattern.test(kind) || ((!kind || ['n/a','sin registro','sin tipo'].includes(kind)) && trailerPattern.test(description)))) fail('Selecciona un remolque válido.');
        name = v.nombre;
        if (body.inspectionMode === 'new') {
          const data = body.inspection;
          if (!data || Number(data.idRemolque) !== input.itemId || !data.checklist || !Object.keys(data.checklist).length) fail('Completa la inspección del remolque.');
          inspection = { source: 'new', estado: 'PENDIENTE_APROBACION', data, captured_at: new Date().toISOString() };
        } else if (body.inspectionMode === 'existing') {
          inspection = await trailerInspection(input.itemId, driverId, client);
          if (!inspection) fail('No hay inspección existente. Realízala ahora o continúa con advertencia.');
        } else if (body.inspectionMode !== 'none') fail('Selecciona cómo registrar la inspección.');
        if (body.warningConfirmed !== true) fail('Confirma el estado de inspección para continuar.');
        inspection = { ...inspection, warningConfirmed: true, mode: body.inspectionMode };
      }
      const result = await client.query(`INSERT INTO trip_operation_items(trip_id,kind,name,trailer_id,inspection,added_latitude,added_longitude)
        VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`, [tripId, input.type === 'COMPANION_ADDED' ? 'companion' : 'trailer',
        name, input.type === 'TRAILER_ATTACHED' ? input.itemId : null, inspection ? JSON.stringify(inspection) : null, input.latitude, input.longitude]);
      item = result.rows[0];
    } else {
      const kind = input.type === 'COMPANION_DROPPED_OFF' ? 'companion' : 'trailer';
      const result = await client.query(`UPDATE trip_operation_items SET removed_at=CURRENT_TIMESTAMP,removed_latitude=$1,removed_longitude=$2
        WHERE id=$3 AND trip_id=$4 AND kind=$5 AND removed_at IS NULL RETURNING *`, [input.latitude,input.longitude,input.itemId,tripId,kind]);
      item = result.rows[0];
      if (!item) fail('El elemento ya fue retirado o no pertenece al viaje.', 409);
    }
    const payload = { folio: trip.folio, name: item.name, latitude: input.latitude, longitude: input.longitude };
    const event = await client.query(`INSERT INTO trip_operation_events(event_key,trip_id,item_id,event_type,payload)
      VALUES($1,$2,$3,$4,$5) RETURNING *`, [input.eventKey,tripId,item.id,input.type,JSON.stringify(payload)]);
    await client.query('COMMIT'); return event.rows[0];
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
}
