import test from 'node:test';
import assert from 'node:assert/strict';
import {tripRoutePlace} from '../src/utils/trip-route-place.js';
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
