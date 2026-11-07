import { databasePool } from '../database/pool.js';
import { saveTripLocation } from './ubicaciones.service.js';
import { parseTripOperationInput } from './trip-operation-input.js';
import { formatStopSummary } from './trip-operation-message.js';

function fail(message, statusCode = 400) { throw Object.assign(new Error(message), { statusCode }); }

async function ownedTrip(client, tripId, driverId) {
  if (!Number.isSafeInteger(tripId) || tripId <= 0 || tripId > 2147483647) fail('Sincroniza el viaje local antes de gestionar sus elementos.');
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

export async function closeTripItems(client, tripId, recordedAt = null) {
  const tripResult = await client.query('SELECT * FROM viajes WHERE id_viajes=$1', [tripId]);
  if (!tripResult.rows[0]) return [];
  await seedInitial(client, tripResult.rows[0]);
  const location = await client.query(`SELECT latitud, longitud FROM ubicaciones_viaje WHERE id_viajes=$1
    ORDER BY fecha_gps DESC, id_ubicaciones_viaje DESC LIMIT 1`, [tripId]);
  const point = location.rows[0];
  const items = await client.query(`UPDATE trip_operation_items SET removed_at=COALESCE($4::timestamptz,CURRENT_TIMESTAMP),
    removed_latitude=$2, removed_longitude=$3 WHERE trip_id=$1 AND removed_at IS NULL RETURNING *`,
    [tripId, point?.latitud ?? null, point?.longitud ?? null, recordedAt]);
  // El cierre se informa en el mensaje final; no es una parada ni una baja adicional.
  return items.rows;
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

export async function recordTripOperation(tripId, driverId, body, { client: externalClient = null, collectOnly = false } = {}) {
  const input = parseTripOperationInput(body);
  const client = externalClient || await databasePool.connect();
  try {
    if (!externalClient) await client.query('BEGIN');
    const trip = await ownedTrip(client, tripId, driverId);
    const previous = await client.query('SELECT * FROM trip_operation_events WHERE event_key=$1', [input.eventKey]);
    if (previous.rows[0]) {
      if (previous.rows[0].trip_id !== tripId) fail('Identificador usado en otro viaje.', 409);
      if (!externalClient) await client.query('COMMIT'); return previous.rows[0];
    }
    if (!['PENDIENTE','EN_CURSO'].includes(trip.estado)) fail('El viaje ya está cerrado.', 409);
    await seedInitial(client, trip);
    let item;
    if (input.type === 'COMPANION_ADDED' || input.type === 'TRAILER_ATTACHED') {
      let name = input.name, inspection = null;
      if (input.type === 'COMPANION_ADDED') {
        const onboard = await client.query(`SELECT count(*)::int AS total FROM trip_operation_items
          WHERE trip_id=$1 AND kind='companion' AND removed_at IS NULL`, [tripId]);
        if (onboard.rows[0].total >= 4) fail('El vehículo admite máximo 4 acompañantes a bordo. Debe bajar uno antes de agregar otro.', 409);
      }
      if (input.type === 'TRAILER_ATTACHED') {
        const vehicle = await client.query('SELECT * FROM vehiculos WHERE id_vehiculos=$1 FOR UPDATE', [input.itemId]);
        const v = vehicle.rows[0];
        const kind = String(v?.tipo_vehiculo || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        const description = String(`${v?.nombre || ''} ${v?.marca || ''} ${v?.modelo || ''}`).toLowerCase();
        const trailerPattern = /\b(remolque|semirremolque|semiremolque|trailer|dolly|lowboy|plana|cama baja)\b/;
        if (!v || !(trailerPattern.test(kind) || ((!kind || ['n/a','sin registro','sin tipo'].includes(kind)) && trailerPattern.test(description)))) fail('Selecciona un remolque válido.');
        name = v.nombre;
        if (body.inspectionMode !== 'new') fail('Es obligatorio realizar una inspección nueva en cada enganche.');
        if (body.inspectionMode === 'new') {
          const data = body.inspection;
          if (!data || Number(data.idRemolque) !== input.itemId || !data.checklist || !Object.keys(data.checklist).length) fail('Completa la inspección del remolque.');
          if (typeof data.captureId !== 'string' || !/^[0-9a-f-]{36}$/i.test(data.captureId)) fail('Realiza una inspección nueva para este enganche.');
          const used = await client.query(`SELECT id FROM trip_operation_items WHERE inspection->'data'->>'captureId'=$1 LIMIT 1`, [data.captureId]);
          if (used.rows.length) fail('Esta inspección ya se utilizó. Realiza una nueva después del desenganche.');
          inspection = { source: 'new', estado: 'PENDIENTE_APROBACION', data, captured_at: externalClient && collectOnly && body.operationRecordedAt ? body.operationRecordedAt : new Date().toISOString() };
        }
        if (body.warningConfirmed !== true) fail('Confirma el estado de inspección para continuar.');
        inspection = { ...inspection, warningConfirmed: true, mode: body.inspectionMode };
      }
    const result = await client.query(`INSERT INTO trip_operation_items(trip_id,kind,name,trailer_id,inspection,added_latitude,added_longitude,initial_key,added_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,COALESCE($9::timestamptz,CURRENT_TIMESTAMP)) RETURNING *`, [tripId, input.type === 'COMPANION_ADDED' ? 'companion' : 'trailer',
        name, input.type === 'TRAILER_ATTACHED' ? input.itemId : null, inspection ? JSON.stringify(inspection) : null, input.latitude, input.longitude,
        externalClient && collectOnly ? body.operationItemKey : null, externalClient && collectOnly ? body.operationRecordedAt : null]);
      item = result.rows[0];
    } else {
      const kind = input.type === 'COMPANION_DROPPED_OFF' ? 'companion' : 'trailer';
      const result = await client.query(`UPDATE trip_operation_items SET removed_at=COALESCE($6::timestamptz,CURRENT_TIMESTAMP),removed_latitude=$1,removed_longitude=$2
        WHERE id=$3 AND trip_id=$4 AND kind=$5 AND removed_at IS NULL RETURNING *`, [input.latitude,input.longitude,input.itemId,tripId,kind, externalClient && collectOnly ? body.operationRecordedAt : null]);
      item = result.rows[0];
      if (!item) fail('El elemento ya fue retirado o no pertenece al viaje.', 409);
    }
    if (collectOnly) {
      if (!externalClient) throw new Error('Se requiere una transacción para confirmar acciones.');
      return { type: input.type, itemId: item.id, name: item.name };
    }
    const payload = { folio: trip.folio, name: item.name, latitude: input.latitude, longitude: input.longitude };
    const event = await client.query(`INSERT INTO trip_operation_events(event_key,trip_id,item_id,event_type,payload)
      VALUES($1,$2,$3,$4,$5) RETURNING *`, [input.eventKey,tripId,item.id,input.type,JSON.stringify(payload)]);
    if (trip.estado === 'EN_CURSO') {
      const descriptions = {
        COMPANION_ADDED: 'Se subió acompañante',
        COMPANION_DROPPED_OFF: 'Se dejó acompañante',
        TRAILER_ATTACHED: 'Se enganchó remolque',
        TRAILER_DETACHED: 'Se dejó remolque'
      };
      await saveTripLocation({ idViaje: tripId, latitude: input.latitude, longitude: input.longitude,
        accuracy: null, speed: null, heading: null, gpsTimestamp: event.rows[0].created_at,
        esPuntoIntermedio: true, nombrePunto: `Parada técnica: ${descriptions[input.type]} ${item.name}` }, { client });
    }
    if (!externalClient) await client.query('COMMIT'); return event.rows[0];
  } catch (e) { if (!externalClient) await client.query('ROLLBACK'); throw e; } finally { if (!externalClient) client.release(); }
}

export async function recordCompanionBatch(tripId, driverId, body) {
  if (!Array.isArray(body.names) || !body.names.length || body.names.length > 4) fail('Agrega entre 1 y 4 acompañantes, según los lugares disponibles.');
  const operations = body.names.map(name => parseTripOperationInput({ ...body, type: 'COMPANION_ADDED', name }));
  const client = await databasePool.connect();
  try {
    await client.query('BEGIN');
    const trip = await ownedTrip(client,tripId,driverId);
    const previous = await client.query('SELECT * FROM trip_operation_events WHERE event_key=$1',[body.eventKey]);
    if (previous.rows[0]) {
      if (previous.rows[0].trip_id !== tripId) fail('Identificador usado en otro viaje.',409);
      await client.query('COMMIT'); return previous.rows[0];
    }
    // Reconocer reintentos de grupos enviados antes de esta actualización.
    const legacy = await client.query('SELECT * FROM trip_operation_events WHERE event_key=ANY($1::text[]) ORDER BY id',
      [operations.map((_,index)=>`${body.eventKey}_${index}`)]);
    if (legacy.rows.length) {
      if (legacy.rows.length !== operations.length || legacy.rows.some(e=>e.trip_id !== tripId)) fail('El grupo ya tiene registros. Actualiza el viaje antes de continuar.',409);
      await client.query('COMMIT'); return legacy.rows[0];
    }
    if (!['PENDIENTE','EN_CURSO'].includes(trip.estado)) fail('El viaje ya está cerrado.',409);
    await seedInitial(client,trip);
    const onboard = await client.query("SELECT count(*)::int AS total FROM trip_operation_items WHERE trip_id=$1 AND kind='companion' AND removed_at IS NULL",[tripId]);
    if (onboard.rows[0].total + operations.length > 4) fail('El vehículo admite máximo 4 acompañantes a bordo. No hay lugares suficientes para este grupo.',409);
    const companions=[];
    for (const operation of operations) {
      const item = await client.query(`INSERT INTO trip_operation_items(trip_id,kind,name,added_latitude,added_longitude)
        VALUES($1,'companion',$2,$3,$4) RETURNING *`,[tripId,operation.name,operation.latitude,operation.longitude]);
      companions.push(item.rows[0]);
    }
    const names=companions.map(item=>item.name);
    const first=operations[0];
    const payload={folio:trip.folio,name:names.join(', '),names,companionIds:companions.map(item=>item.id),latitude:first.latitude,longitude:first.longitude};
    const event = await client.query(`INSERT INTO trip_operation_events(event_key,trip_id,item_id,event_type,payload)
      VALUES($1,$2,$3,'COMPANION_ADDED',$4) RETURNING *`,[body.eventKey,tripId,companions[0].id,JSON.stringify(payload)]);
    if (trip.estado === 'EN_CURSO') await saveTripLocation({idViaje:tripId,latitude:first.latitude,longitude:first.longitude,
      accuracy:null,speed:null,heading:null,gpsTimestamp:event.rows[0].created_at,esPuntoIntermedio:true,
      nombrePunto:`Parada técnica: ${names.length>1?'Se subieron acompañantes':'Se subió acompañante'} ${names.join(', ')}`},{client});
    await client.query('COMMIT'); return event.rows[0];
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
}

export async function recordConfirmedActions(tripId,driverId,body) {
  if (!Array.isArray(body.actions) || !body.actions.length || body.actions.length>20) fail('Selecciona las acciones que deseas confirmar.');
  // Validar la clave y el GPS antes de adquirir una conexión.
  parseTripOperationInput({type:'COMPANION_ADDED',name:'validación',latitude:body.latitude,longitude:body.longitude,eventKey:body.eventKey});
  const client=await databasePool.connect();
  try {
    await client.query('BEGIN');
    const trip=await ownedTrip(client,tripId,driverId);
    const prior=await client.query('SELECT * FROM trip_operation_events WHERE event_key=$1',[body.eventKey]);
    if(prior.rows[0]) { if(prior.rows[0].trip_id!==tripId)fail('Identificador usado en otro viaje.',409); await client.query('COMMIT');return prior.rows[0]; }
    if(trip.estado!=='EN_CURSO')fail('Solo se pueden confirmar acciones en un viaje en curso.',409);
    let recordedAt = null;
    if (body.recordedAt !== undefined) {
      const timestamp = typeof body.recordedAt === 'string' ? Date.parse(body.recordedAt) : NaN;
      if (!Number.isFinite(timestamp) || timestamp > Date.now()+600000 || timestamp < Date.now()-30*86400000) fail('La hora del movimiento no es válida. Los datos locales requieren revisión.');
      recordedAt = new Date(timestamp).toISOString();
      const valid = await client.query(`SELECT hora_salida IS NULL OR $2::timestamptz >= (hora_salida AT TIME ZONE 'America/Mexico_City') - INTERVAL '5 minutes' AS valid FROM viajes WHERE id_viajes=$1`, [tripId,recordedAt]);
      if (!valid.rows[0]?.valid) fail('El movimiento es anterior al inicio del viaje.');
    }
    await seedInitial(client,trip);
    const actions=[];
    for (const [index, original] of body.actions.entries()) {
      const action = { ...original };
      if (['COMPANION_DROPPED_OFF','TRAILER_DETACHED'].includes(action.type) && action.itemRef !== undefined) {
        if (typeof action.itemRef !== 'string' || action.itemRef.length>150) fail('Referencia de elemento inválida.');
        const item = await client.query('SELECT id FROM trip_operation_items WHERE trip_id=$1 AND (initial_key=$2 OR id::text=$2)',[tripId,action.itemRef]);
        if (!item.rows[0]) fail('No se encontró el elemento del movimiento. Sincroniza las paradas anteriores.',409);
        action.itemId=Number(item.rows[0].id);
      }
      actions.push({...action,...parseTripOperationInput({...action,latitude:body.latitude,longitude:body.longitude,eventKey:`${body.eventKey}_${index}`}),
        operationItemKey:`movement-${body.eventKey}_${index}`,operationRecordedAt:recordedAt});
    }
    let place = null;
    if (body.placeId !== undefined) {
      if (!Number.isSafeInteger(body.placeId) || body.placeId <= 0 || body.placeId > 2147483647) fail('Selecciona un destino válido para la parada.');
      const result = await client.query('SELECT id_lugares, nombre, activo FROM lugares WHERE id_lugares=$1 FOR SHARE', [body.placeId]);
      if (!result.rows[0] || (!result.rows[0].activo && !recordedAt)) fail('El destino de la parada ya no está disponible. Selecciona otro.');
      if (body.placeName !== undefined && (typeof body.placeName !== 'string' || !body.placeName.trim() || body.placeName.length>200)) fail('Nombre del lugar inválido.');
      place = { id: result.rows[0].id_lugares, name: recordedAt && body.placeName ? body.placeName.trim() : result.rows[0].nombre };
    }
    const removals=new Set(['COMPANION_DROPPED_OFF','TRAILER_DETACHED']);
    actions.sort((a,b)=>Number(removals.has(b.type))-Number(removals.has(a.type)));
    const results=[];
    for(const action of actions)results.push(await recordTripOperation(tripId,driverId,action,{client,collectOnly:true}));
    const payload={folio:trip.folio,name:results.map(r=>r.name).join(', '),actions:results,confirmed:true,latitude:body.latitude,longitude:body.longitude,...(place ? { place } : {})};
    const event=await client.query(`INSERT INTO trip_operation_events(event_key,trip_id,item_id,event_type,payload)
      VALUES($1,$2,$3,$4,$5) RETURNING *`,[body.eventKey,tripId,results[0].itemId,results[0].type,JSON.stringify(payload)]);
    if (recordedAt) {
      const updated = await client.query('UPDATE trip_operation_events SET created_at=$2 WHERE id=$1 RETURNING *',[event.rows[0].id,recordedAt]);
      event.rows[0] = updated.rows[0];
    }
    if(formatStopSummary([event.rows[0]]).length>3500)fail('Confirma menos acciones para mantener el resumen legible.');
    const description = [
      ['COMPANION_DROPPED_OFF', 'Se dejó personal'], ['COMPANION_ADDED', 'Se subió personal'],
      ['TRAILER_DETACHED', 'Se dejó remolque'], ['TRAILER_ATTACHED', 'Se enganchó remolque']
    ].flatMap(([type, label]) => {
      const names = results.filter(result => result.type === type).map(result => result.name);
      return names.length ? [`${label}: ${names.join(', ')}`] : [];
    }).join('; ');
    await saveTripLocation({idViaje:tripId,latitude:body.latitude,longitude:body.longitude,accuracy:null,speed:null,heading:null,
      gpsTimestamp:event.rows[0].created_at,esPuntoIntermedio:true,nombrePunto:`Parada técnica${place ? ` en ${place.name}` : ''}: ${description}`},{client});
    await client.query('COMMIT');return event.rows[0];
  } catch(e) {await client.query('ROLLBACK');throw e;} finally {client.release();}
}
