// Run INSIDE the existing staging backend only. All fixture rows are rolled back.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
process.env.AUDIT_PERSISTENCE='false';process.env.AUDIT_STDOUT='false';
const {databasePool:db}=await import('/app/src/database/pool.js');
const {finishTrip,getTripById}=await import('/app/src/services/viajes.service.js');
const {saveTripLocationBatch}=await import('/app/src/services/ubicaciones.service.js');
const {listTripItems,recordConfirmedActions}=await import('/app/src/services/trip-operations.service.js');
const {getTripInspectionAnnexes}=await import('/app/src/services/trip-inspection-annexes.service.js');
const {completeNativeTrip}=await import('/app/src/services/native-completion.service.js');
const realConnect=db.connect.bind(db), realQuery=db.query.bind(db);
const client=await realConnect();let level=0;const checks=[];
try {
 assert.equal((await client.query('SELECT current_database() name')).rows[0].name,'gerenciamiento_viajes_stg','Never run against production');
 await client.query('BEGIN');await client.query("SET LOCAL TIME ZONE 'America/Mexico_City'");
 // Translate service transactions into savepoints so workers cannot see fixtures.
 const query=async(sql,args)=>{
  const t=typeof sql==='string'?sql.trim().toUpperCase():'';
  if(t==='BEGIN')return client.query(`SAVEPOINT compat_${++level}`);
  if(t==='COMMIT')return client.query(`RELEASE SAVEPOINT compat_${level--}`);
  if(t==='ROLLBACK'){await client.query(`ROLLBACK TO SAVEPOINT compat_${level}`);return client.query(`RELEASE SAVEPOINT compat_${level--}`);}
  return client.query(sql,args);
 };
 db.query=query;db.connect=async()=>({query,release(){}});
 const suffix=randomUUID().slice(0,8), tag=`COMPAT-${suffix}`;
 const driver=(await query('INSERT INTO conductores(nombre) VALUES($1) RETURNING id_conductores',[tag])).rows[0].id_conductores;
 const car=(await query('INSERT INTO vehiculos(nombre,numero_economico,kilometraje_actual) VALUES($1,$2,100) RETURNING id_vehiculos',[tag,tag])).rows[0].id_vehiculos;
 const trailer=(await query("INSERT INTO vehiculos(nombre,numero_economico,tipo_vehiculo) VALUES($1,$2,'Remolque') RETURNING id_vehiculos",[tag+' trailer',tag+'R'])).rows[0].id_vehiculos;
 const place=(await query('INSERT INTO lugares(nombre) VALUES($1) RETURNING id_lugares',[tag])).rows[0].id_lugares;
 const destination=(await query('INSERT INTO lugares(nombre) VALUES($1) RETURNING id_lugares',[tag+' destino'])).rows[0].id_lugares;
 async function trip(kind){return (await query(`INSERT INTO viajes(folio,id_conductores,id_vehiculos,id_origen,id_destino,id_estado_viaje,kilometraje_inicial,hora_salida,licencia_vigente,motivo,acompanantes)
 VALUES($1,$2,$3,$4,$5,(SELECT id_estado_viaje FROM estados_viaje WHERE nombre='EN_CURSO' LIMIT 1),100,(CURRENT_TIMESTAMP AT TIME ZONE 'America/Mexico_City')-INTERVAL '20 minutes',TRUE,'Compatibility rollback-only','["Inicial"]') RETURNING id_viajes`,[tag+kind,driver,car,place,destination])).rows[0].id_viajes;}
 const id=await trip('LEGACY');
 const before=await getTripById({idViaje:id});assert.equal(before.estado,'EN_CURSO');
 const point={clientLocationId:randomUUID(),latitud:19.4,longitud:-99.1,fechaGps:new Date(Date.now()-120000),precisionMetros:4,esPuntoIntermedio:true,nombrePunto:'Parada guardada antes del corte'};
 await saveTripLocationBatch({idViaje:id,idConductor:driver,locations:[point]});
 await saveTripLocationBatch({idViaje:id,idConductor:driver,locations:[point]});
 assert.equal((await query('SELECT count(*)::int n FROM ubicaciones_viaje WHERE id_viajes=$1',[id])).rows[0].n,1);
 checks.push('legacy queued GPS/technical stop replay: no duplicates');
 const done=await finishTrip({idViaje:id,kilometrajeFinal:110});assert.equal(done.estado,'FINALIZADO');assert.equal(Number(done.kilometrajeFinal),110);
 assert.equal(Number((await getTripById({idViaje:id})).kilometraje_inicial),100);
 await saveTripLocationBatch({idViaje:id,idConductor:driver,locations:[{...point,clientLocationId:randomUUID(),esPuntoIntermedio:false}]});
 assert.equal((await query('SELECT count(*)::int n FROM ubicaciones_viaje WHERE id_viajes=$1',[id])).rows[0].n,2);
 checks.push('legacy finish request preserves trip and accepts delayed GPS after finish');
 // Additional coverage for newer already-distributed offline movement clients.
 const second=await trip('MOVES'), captured=new Date(Date.now()-120000).toISOString();
 const inspection={idRemolque:trailer,captureId:randomUUID(),checklist:{luces:'B'},danos:{frente:[{x:1,y:2}]}};
 const body={eventKey:randomUUID(),recordedAt:captured,latitude:19.4,longitude:-99.1,placeId:place,placeName:tag,actions:[{type:'COMPANION_ADDED',name:'Pendiente'},{type:'TRAILER_ATTACHED',itemId:trailer,inspectionMode:'new',warningConfirmed:true,inspection}]};
 await recordConfirmedActions(second,driver,body);await recordConfirmedActions(second,driver,JSON.parse(JSON.stringify(body)));
 assert.equal((await query('SELECT count(*)::int n FROM trip_operation_events WHERE trip_id=$1',[second])).rows[0].n,1);
 assert.equal((await query('SELECT count(*)::int n FROM ubicaciones_viaje WHERE id_viajes=$1',[second])).rows[0].n,1);
 const item=(await listTripItems(second,driver)).find(x=>x.kind==='trailer');assert.deepEqual(item.inspection.data,inspection);assert.equal(item.inspection.captured_at,captured);
 assert.equal((await getTripInspectionAnnexes(second)).length,1);
 const close={clientId:randomUUID(),action:'finalizado',recordedAt:new Date().toISOString(),kilometrajeFinal:120};
 assert.equal((await completeNativeTrip(second,driver,close)).notify,true);assert.equal((await completeNativeTrip(second,driver,close)).notify,false);
 assert.deepEqual((await getTripInspectionAnnexes(second))[0].inspection.data,inspection);
 assert.equal((await query('SELECT count(*)::int n FROM cierres_nativos WHERE id_viajes=$1',[second])).rows[0].n,1);
 checks.push('offline movements, original time/GPS/inspection and PDF annex preserved; one stop/outbox event and one native closure on replay');
 console.log(JSON.stringify({status:'PASS',database:'gerenciamiento_viajes_stg',scope:'service/database integration; not an Android device or HTTP authentication test',checks,notificationsSent:false,fixturesCommitted:false}));
} finally {db.query=realQuery;db.connect=realConnect;await client.query('ROLLBACK');client.release();await db.end();}
