import test from 'node:test';
import assert from 'node:assert/strict';
import { databasePool } from '../database/pool.js';
import { updateDriverSelfProfile } from '../services/driver-auth.service.js';
import { updateDriverProfileController } from '../controllers/driver-auth.controller.js';

test('actualiza el nombre del conductor autenticado con consulta parametrizada', async t => {
 const calls=[];
 t.mock.method(databasePool,'query', async (sql,params) => { calls.push({sql,params});return {rows:[{id_conductores:27,nombre:params[1]}]}; });
 const updated=await updateDriverSelfProfile(27,{nombre:'  María López Pérez  ',telefono:'5550000027'});
 assert.equal(updated.nombre,'María López Pérez');
 assert.equal(calls[0].params[0],27);
 assert.match(calls[0].sql,/nombre = \$2/);
 assert.match(calls[0].sql,/WHERE id_conductores = \$1/);
 assert.ok(!calls[0].sql.includes('María'));
});
test('rechaza nombre vacío, excesivo o de tipo incorrecto sin consultar la base', async t => {
 let calls=0;t.mock.method(databasePool,'query',async()=>{calls++;});
 for(const nombre of ['   ','x'.repeat(151),{}]) {
  await assert.rejects(updateDriverSelfProfile(27,{nombre}));
  const response={status(code){this.code=code;return this;},json(body){this.body=body;return this;}};
  await updateDriverProfileController({driverUser:{id_conductores:27},body:{nombre}},response);
  assert.equal(response.code,400);
 }
 assert.equal(calls,0);
});
test('las versiones anteriores pueden actualizar teléfono sin sobrescribir el nombre', async t => {
 t.mock.method(databasePool,'query',async(sql,params)=>{assert.ok(!sql.includes('nombre ='));assert.equal(params[1],'5550000027');return {rows:[{nombre:'Sin cambios'}]};});
 assert.equal((await updateDriverSelfProfile(27,{telefono:'5550000027'})).nombre,'Sin cambios');
});
