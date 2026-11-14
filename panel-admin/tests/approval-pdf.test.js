import {listenForModalBack} from '../src/services/modal-navigation.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {approvalPdfPath,loadApprovalPdf} from '../src/services/approval-pdf.js';
import {listenForPdfBack} from '../src/services/pdf-back-navigation.js';
test('el visor solicita el PDF oficial con autenticación y transporte binario',async()=>{
 const previous=globalThis.localStorage;globalThis.localStorage={getItem:()=> 'fake-session'};
 try{for(const kind of ['inspection','management']){
  let called;const bytes=await loadApprovalPdf({kind,id:12},async(url,options)=>{called={url,options};return new Response('%PDF-1.7\nfixture',{headers:{'content-type':'application/pdf'}});});
  assert.match(called.url,new RegExp(kind==='inspection'?'/admin/inspecciones/12/vista-previa-pdf$':'/gerenciamiento-viajes/12/vista-previa-pdf$'));
  assert.equal(called.options.headers.Authorization,'Bearer fake-session');assert.equal(called.options.responseType,'arraybuffer');assert.equal(called.options.cache,'no-store');assert.equal(bytes[0],37);
 }}finally{if(previous===undefined)delete globalThis.localStorage;else globalThis.localStorage=previous;}
});
test('Atrás de Android cierra solo el visor y libera su listener al volver',async()=>{
 let callback,removed=0,closed=0;
 const cleanup=listenForPdfBack(()=>closed++,{native:true,app:{addListener:async(event,handler)=>{assert.equal(event,'backButton');callback=handler;return {remove:()=>removed++};}}});
 await Promise.resolve();callback();assert.equal(closed,1);cleanup();assert.equal(removed,1);callback();assert.equal(closed,1);
});
test('cerrar el visor antes de registrar Atrás no deja un listener activo',async()=>{
 let resolve,removed=0;
 const cleanup=listenForPdfBack(()=>{}, {native:true,app:{addListener:()=>new Promise(r=>{resolve=r;})}});
 cleanup();resolve({remove:()=>removed++});await Promise.resolve();assert.equal(removed,1);
});
test('el visor rechaza HTML, errores HTTP y referencias inválidas sin navegar',async()=>{
 for(const id of ['../2',0,-1,'1?token=x','https://other.example'])assert.throws(()=>approvalPdfPath('inspection',id));
 assert.throws(()=>approvalPdfPath('unknown',1));
 await assert.rejects(loadApprovalPdf({kind:'inspection',id:1},async()=>new Response('<html>login</html>')),/PDF válido/);
 await assert.rejects(loadApprovalPdf({kind:'inspection',id:1},async()=>new Response('denied',{status:403})),/No se pudo cargar/);
 await assert.rejects(loadApprovalPdf({kind:'inspection',id:1},async()=>new Response('expired',{status:401})),/sesión expiró/);
});

test('Atrás atiende solo el modal superior y reutiliza un listener nativo',async()=>{
 let back,registrations=0,removed=0;const calls=[];
 const app={addListener:async(_,callback)=>{registrations++;back=callback;return {remove:()=>removed++};}};
 const root=listenForModalBack(()=>calls.push('root'),{native:true,app,priority:-10});
 const review=listenForModalBack(()=>calls.push('review'),{native:true,app,priority:30});
 const pdf=listenForModalBack(()=>calls.push('pdf'),{native:true,app,priority:80});
 const notice=listenForModalBack(()=>calls.push('notice'),{native:true,app,priority:100});
 await Promise.resolve();back();notice();back();pdf();back();review();back();root();
 assert.deepEqual(calls,['notice','pdf','review','root']);assert.equal(registrations,1);assert.equal(removed,1);
});
