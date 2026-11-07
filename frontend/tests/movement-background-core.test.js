import test from 'node:test';
import assert from 'node:assert/strict';
await import('../public/movement-sync-core.js');
const run=globalThis.GvMovementSync.run;
function fixture() {
 const job={serverId:123,operations:[{eventKey:'first',inspection:{captureId:'new'}},{eventKey:'second'}],completion:{clientId:'close',action:'finalizado'}};
 const order=[],saved=new Set(),closed=new Set();let points=[{clientLocationId:'gps1'},{clientLocationId:'gps2'}],rejected=0;
 const io={post:async(path,body)=>{
  if(path.endsWith('/elementos/eventos')){order.push(body.eventKey);saved.add(body.eventKey);return {success:true};}
  if(path.endsWith('/ubicaciones/lote')){order.push('gps');return {success:true,data:{insertadas:body.ubicaciones.length,duplicadas:0,rechazadas:0,idsRechazados:[]}};}
  order.push('close');closed.add(body.clientId);return {success:true};
 },mapped:async()=>{},ackMovement:async key=>{job.operations=job.operations.filter(op=>op.eventKey!==key);},pendingMovements:async()=>job.operations.length,
 gps:async()=>({points,rejected}),ackGps:async(accepted,invalid)=>{points=points.filter(point=>!accepted.includes(point.clientLocationId) && !invalid.includes(point.clientLocationId));rejected+=invalid.length;}};
 return {job,io,order,saved,closed};
}
test('sin ventana abierta reintenta respuestas perdidas con las mismas claves antes de enviar el cierre',async()=>{
 const {job,io,order,saved,closed}=fixture();const post=io.post;let lose=true;
 io.post=async(path,body)=>{const result=await post(path,body);if(body.eventKey==='first' && lose){lose=false;throw new Error('Respuesta perdida');}return result;};
 await assert.rejects(run(job,io));assert.equal(job.operations.length,2);
 await run(job,io);await run(job,io);
 assert.equal(saved.size,2);assert.equal(closed.size,1);
 assert.deepEqual(order,['first','first','second','gps','close','close']);
});
test('un viaje local se abre y mapea antes de movimientos y se finaliza después del GPS',async()=>{
 const {job,io,order}=fixture();job.serverId=0;job.completion=null;
 job.bootstrap={clientId:'local',permit:'signed-permit',startedAt:'start',finishedAt:'finish',kilometrajeFinal:105,trip:{idConductor:7}};
 const post=io.post;io.post=async(path,body)=>{
  if(path.endsWith('/offline/sincronizar')){order.push(body.finishedAt?'finish':'start');if(!body.finishedAt)assert.equal(Object.hasOwn(body,'kilometrajeFinal'),false);return {data:{idViaje:123}};}
  return post(path,body);
 };
 io.mapped=async id=>{assert.equal(id,123);order.push('mapped');};
 await run(job,io);assert.deepEqual(order,['start','mapped','first','second','gps','finish']);
});
test('un error de autenticación conserva los movimientos y no adelanta GPS ni cierre',async()=>{
 const {job,io,order}=fixture();io.post=async()=>{throw new Error('401');};
 await assert.rejects(run(job,io),/401/);assert.equal(job.operations.length,2);assert.deepEqual(order,[]);
});
test('un lote GPS incompleto o rechazado conserva el cierre pendiente',async()=>{
 const {job,io,order}=fixture();const post=io.post;
 io.post=async(path,body)=>path.endsWith('/ubicaciones/lote')?{data:{insertadas:0,duplicadas:0,rechazadas:0,idsRechazados:[]}}:post(path,body);
 await assert.rejects(run(job,io),/confirmación/);assert.ok(!order.includes('close'));
 const second=fixture();second.io.gps=async()=>({points:[],rejected:1});
 await assert.rejects(run(second.job,second.io),/revisión/);assert.ok(!second.order.includes('close'));
});
test('los movimientos nuevos impiden finalizar con una instantánea antigua',async()=>{
 const {job,io,order}=fixture();let checks=0;
 io.pendingMovements=async()=>++checks>1?1:0;
 await assert.rejects(run(job,io),/antes del cierre/);assert.ok(!order.includes('close'));
});
