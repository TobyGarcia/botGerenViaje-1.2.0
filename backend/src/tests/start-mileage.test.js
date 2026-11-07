import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { databasePool } from '../database/pool.js';
import { createTrip, startTrip, finishTrip } from '../services/viajes.service.js';

async function fixture() {
  const driver=(await databasePool.query("INSERT INTO conductores(nombre,licencia_vigente,licencia_vencimiento,fecha_manejo_comentado) VALUES('Inicio Prueba',TRUE,CURRENT_DATE+30,CURRENT_DATE) RETURNING id_conductores")).rows[0].id_conductores;
  const vehicle=(await databasePool.query("INSERT INTO vehiculos(nombre,numero_economico,kilometraje_actual,id_conductor_asignado) VALUES('Inicio Unidad',$1,1000,$2) RETURNING id_vehiculos",[randomUUID(),driver])).rows[0].id_vehiculos;
  const places=[];
  for(let i=0;i<2;i++) places.push((await databasePool.query('INSERT INTO lugares(nombre) VALUES($1) RETURNING id_lugares',[randomUUID()])).rows[0].id_lugares);
  const trip=await createTrip({idConductor:driver,idVehiculo:vehicle,idOrigen:places[0],idDestino:places[1],acompanantes:[],kilometrajeInicial:1000,motivo:'Prueba',esGerenciamiento:true});
  await databasePool.query('INSERT INTO gerenciamiento_viajes(id_viaje,kilometraje) VALUES($1,1000)',[trip.id_viajes]);
  return {trip,vehicle};
}
const gps=()=>({clientLocationId:randomUUID(),latitud:19.4,longitud:-99.1,fechaGps:new Date().toISOString()});

test('confirma la lectura al iniciar y la usa en vehículo, documento y distancia final',async()=>{
  const {trip,vehicle}=await fixture();
  const started=await startTrip({idViaje:trip.id_viajes,kilometrajeInicial:1007,initialLocation:gps()});
  assert.equal(Number(started.kilometrajeInicial),1007);
  const history=(await databasePool.query('SELECT kilometraje,tipo_registro,id_registro_corregido FROM historial_kilometraje_vehiculos WHERE id_viajes=$1 ORDER BY id_historial_kilometraje',[trip.id_viajes])).rows;
  assert.deepEqual(history.map(row=>[Number(row.kilometraje),row.tipo_registro]),[[1000,'CORRECCION'],[1007,'INICIAL_VIAJE']]);
  assert.ok(history[1].id_registro_corregido);
  assert.equal(Number((await databasePool.query('SELECT kilometraje_actual FROM vehiculos WHERE id_vehiculos=$1',[vehicle])).rows[0].kilometraje_actual),1007);
  assert.equal((await databasePool.query('SELECT kilometraje FROM gerenciamiento_viajes WHERE id_viaje=$1',[trip.id_viajes])).rows[0].kilometraje,1007);
  assert.equal(Number((await finishTrip({idViaje:trip.id_viajes,kilometrajeFinal:1010})).kilometrosRecorridos),3);
});

test('rechaza lecturas inválidas o menores sin reporte y revierte la lectura si falla el GPS',async()=>{
  const {trip,vehicle}=await fixture();
  for(const kilometrajeInicial of [null,'1001',-1,1.5,2147483648,900]) {
    await assert.rejects(startTrip({idViaje:trip.id_viajes,kilometrajeInicial,initialLocation:gps()}),/lectura|kilometraje/);
  }
  await assert.rejects(startTrip({idViaje:trip.id_viajes,kilometrajeInicial:1007,initialLocation:{...gps(),latitud:999}}));
  assert.equal(Number((await databasePool.query('SELECT kilometraje_actual FROM vehiculos WHERE id_vehiculos=$1',[vehicle])).rows[0].kilometraje_actual),1000);
  assert.equal((await databasePool.query('SELECT kilometraje_inicial,hora_salida FROM viajes WHERE id_viajes=$1',[trip.id_viajes])).rows[0].hora_salida,null);
  assert.equal((await databasePool.query('SELECT kilometraje FROM gerenciamiento_viajes WHERE id_viaje=$1',[trip.id_viajes])).rows[0].kilometraje,1000);
});

test('acepta una corrección nueva al iniciar y conserva el cálculo real del recorrido',async()=>{
  const {trip,vehicle}=await fixture();
  const odometerCorrection={previousReading:1000,reason:'Error en la lectura registrada',photoBase64:'data:image/jpeg;base64,/9j/2Q=='};
  const started=await startTrip({idViaje:trip.id_viajes,kilometrajeInicial:900,odometerCorrection,initialLocation:gps()});
  assert.equal(Number(started.kilometrajeInicial),900);
  assert.equal(Number((await databasePool.query('SELECT kilometraje_actual FROM vehiculos WHERE id_vehiculos=$1',[vehicle])).rows[0].kilometraje_actual),900);
  assert.ok((await databasePool.query('SELECT aplicado_en FROM ajustes_odometro_viaje WHERE id_viajes=$1',[trip.id_viajes])).rows[0].aplicado_en);
  assert.equal(Number((await finishTrip({idViaje:trip.id_viajes,kilometrajeFinal:950})).kilometrosRecorridos),50);
});
