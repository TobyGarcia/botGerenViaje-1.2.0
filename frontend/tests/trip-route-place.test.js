import test from 'node:test';
import assert from 'node:assert/strict';
import {tripRoutePlace, preserveCreatedTripRoute} from '../src/utils/trip-route-place.js';
test('muestra la ruta al crear, iniciar, recuperar y preparar offline sin renderizar objetos',()=>{
 const places=[{id_lugares:1,nombre:'ASPX - LA PAZ'},{id_lugares:2,nombre:'ASPX - COUNTRY'}];
 for(const trip of [{id_origen:1,id_destino:2},{idOrigen:1,idDestino:2},{origen:{nombre:'ASPX - LA PAZ'},destino:{nombre:'ASPX - COUNTRY'}},{origen:'ASPX - LA PAZ',destino:'ASPX - COUNTRY'}]){
  assert.equal(tripRoutePlace([trip],'origen',places),'ASPX - LA PAZ');
  assert.equal(tripRoutePlace([trip],'destino',places),'ASPX - COUNTRY');
 }
 assert.equal(tripRoutePlace([{origen_texto:'Cliente externo'}],'origen',places),'Cliente externo');
 assert.equal(tripRoutePlace([null,{origen:'Guardado'}],'origen',[]),'Guardado');
 assert.equal(tripRoutePlace([{},null],'destino',[]),'No registrado');
});

test('conserva la ruta seleccionada cuando crear viaje devuelve sólo el folio y el identificador', () => {
 const places=[{id_lugares:1,nombre:'ASPX - COUNTRY'},{id_lugares:2,nombre:'ASPX - LAS PALMAS'}];
 const result=preserveCreatedTripRoute({id_viajes:42,folio:'VJ-42'}, {idOrigen:1,idDestino:2}, places);
 const reopened=JSON.parse(JSON.stringify(result));
 assert.equal(tripRoutePlace([reopened],'origen',[]),'ASPX - COUNTRY');
 assert.equal(tripRoutePlace([reopened],'destino',[]),'ASPX - LAS PALMAS');
 assert.equal(reopened.idOrigen,1);
 assert.equal(reopened.idDestino,2);
 assert.equal(reopened.folio,'VJ-42');
});
test('respeta la ruta devuelta por servidor u offline y conserva los IDs si no hay catálogo', () => {
 const result=preserveCreatedTripRoute({origen:'Origen guardado',destino:{nombre:'Destino guardado'}}, {idOrigen:1,idDestino:2}, []);
 assert.equal(result.origen,'Origen guardado');
 assert.equal(result.destino,'Destino guardado');
 const missing=preserveCreatedTripRoute({}, {idOrigen:1,idDestino:2}, []);
 assert.equal(missing.idOrigen,1);
 assert.equal(tripRoutePlace([missing],'origen',[{id_lugares:1,nombre:'Catálogo recuperado'}]),'Catálogo recuperado');
});
