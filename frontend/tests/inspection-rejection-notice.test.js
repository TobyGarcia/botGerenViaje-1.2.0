import test from 'node:test';import assert from 'node:assert/strict';
import {latestUnreadRejection,acknowledgeRejection} from '../src/services/inspection-rejection-notice.js';
function storage(){const map=new Map();return {getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)};}
const notice={id_inspeccion:150,rechazo_evento_id:'90071992547409930',rechazado_en:'2026-11-14T12:00:00Z',actualizado_en:'2026-11-14T12:00:00Z'};
test('cerrar el rechazo impide repetirlo aunque cambien PDF, estado del viaje o fecha de actualización',()=>{
 const s=storage();assert.equal(latestUnreadRejection(27,[notice],s),notice);acknowledgeRejection(27,notice,s);
 assert.equal(latestUnreadRejection(27,[{...notice,actualizado_en:'2026-11-15T12:00:00Z',viajes:[]}],s),null);
 assert.equal(latestUnreadRejection(27,[notice],s),null);
 assert.equal(latestUnreadRejection(28,[notice],s),notice);
});
test('no muestra una cadena de rechazos históricos y respeta el último aviso ya atendido',()=>{
 const s=storage(),old={...notice,id_inspeccion:149,rechazo_evento_id:'90071992547409929'};
 acknowledgeRejection(27,notice,s);assert.equal(latestUnreadRejection(27,[notice,old],s),null);
 assert.equal(latestUnreadRejection(27,[old],s),null);
 const newer={...notice,rechazo_evento_id:'90071992547409931'};assert.equal(latestUnreadRejection(27,[newer],s),newer);
});
test('conserva el acuse de la versión anterior y no depende de actualizado_en en servidores antiguos',()=>{
 const s=storage();s.setItem(`inspection_rejection_read:27:150:${notice.actualizado_en}`,'1');
 assert.equal(latestUnreadRejection(27,[notice],s),null);
 assert.equal(latestUnreadRejection(27,[{...notice,actualizado_en:'changed'}],s),null);
 const legacy={id_inspeccion:200,actualizado_en:'old'};acknowledgeRejection(27,legacy,s);
 assert.equal(latestUnreadRejection(27,[{...legacy,actualizado_en:'new'}],s),null);
});
