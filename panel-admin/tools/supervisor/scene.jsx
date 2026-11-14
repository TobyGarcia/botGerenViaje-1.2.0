// Read-only fixture. Never sends approvals or login requests to the server.
import React from 'react';import{createRoot}from'react-dom/client';import SupervisorApp from '../../src/pages/SupervisorApp.jsx';import '../../src/index.css';import '../../src/App.css';
const role=new URLSearchParams(location.search).get('role')||'SUPERVISOR';
const empty=new URLSearchParams(location.search).has('empty');
const invalid=new URLSearchParams(location.search).has('invalid');
const login=new URLSearchParams(location.search).has('login') || invalid;
const trip={idViaje:41,folio:'VJ-DEMO-0041',fecha:'2026-11-12',conductor:{nombre:'Ana López'},vehiculo:{nombre:'MITSUBISHI L200',numeroEconomico:'AUTO-DEMO',placas:'DEM-001'},origen:{nombre:'Base'},destino:{nombre:'Almacén'},estado:{nombre:'EN_CURSO'},kilometrajeInicial:1200,motivo:'Traslado',acompanantes:[]};
const rows=[{id_inspeccion:1,folio:'PENDIENTE-DEMO',vehiculo:'MITSUBISHI L200',numero_economico:'AUTO-DEMO',conductor:'Ana López',estado:'PENDIENTE_APROBACION',creado_en:'2026-11-12T17:00:00Z'},{id_inspeccion:2,folio:'APROBADA-OCULTA',estado:'APROBADA',creado_en:'2026-11-12T17:00:00Z'}];
const management={id_gerenciamiento:7,folio_documento:'GEREN-DEMO',nombre_conductor:'Ana López',conductor_nombre:'Ana López',tipo_vehiculo:'MITSUBISHI L200',origen_nombre:'ASPX - ORIGEN CON NOMBRE COMPLETO',destino_nombre:'ASPX - DESTINO CON NOMBRE COMPLETO',nivel_riesgo:'BAJO',puntaje_total:10,estado:'PENDIENTE',acompanantes:['Ana','Juan']};
if(new URLSearchParams(location.search).has('inspection-review'))Object.assign(management,{
 nombre_conductor:'Ana López',numero_unidad:'AUTO-010',placa:'DEM-001',hora_salida:'08:30',fecha_emision:'2026-11-14',kilometraje:1200,
 inspeccion_estado:'PENDIENTE_APROBACION',inspeccion_combustible:'F',inspeccion_fecha_operativa:'2026-11-14',
 inspeccion_danos:{frontal:[{x:50,y:50}],pasajero:[{x:80,y:40}]},
 inspeccion_checklist:{'Freno':'B','Vidrios':'R','Extintor':'M','Elemento con un nombre de inspección suficientemente largo para verificar el ajuste en móvil':'B',...Object.fromEntries(Array.from({length:54},(_,i)=>['Punto de inspección '+(i+1),'B']))},
 inspeccion_observaciones:'Revisar extintor antes de salir.',
 inspeccion_firma_conductor:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lXcAAAAASUVORK5CYII=',
 inspeccion_lleva_remolque:true,remolque_nombre:'REMOLQUE DE PRUEBA',inspeccion_remolque:{checklist:{Reflejantes:'B'},danos:{frontal:[{x:30,y:50}]},observaciones:'Revisión completa'},
 pts_distancia:1,pts_clima:2,pts_vehiculos_personas:3,pts_condiciones_via:1,pts_comunicaciones:0,pts_horas_trabajadas:1,pts_hora_traslado:1
});
window.fetch=async(input,options={})=>{const path=new URL(input,location.origin).pathname;if(invalid && path.endsWith('/supervisor-app/start'))return new Response('null',{headers:{'Content-Type':'application/json'}});if((options.method||'GET')!=='GET')throw Error('Mutaciones deshabilitadas en QA');let data=[],status=200;
 if(path.endsWith('/auth/session')){if(login){status=401;data=null;}else data={user:{nombre:'Supervisora Demo',rol:role,idUsuarioAdmin:1}};}
 else if(path.endsWith('/gerenciamiento-viajes'))data=(new URL(input,location.origin).searchParams.get('estado')==='PENDIENTE'&&management.approval_available===false)||(new URL(input,location.origin).searchParams.get('estado')&&new URL(input,location.origin).searchParams.get('estado')!==management.estado)?[]:[management];
 else if(path.endsWith('/gerenciamiento-viajes/7'))data=management;
 else if(path.endsWith('/admin/inspecciones'))data=rows;
 else if(path.endsWith('/admin/inspecciones/1'))data={...rows[0],checklist:{Luces:'B'},danos:{},combustible:'F',approval_context:{management:{id_gerenciamiento:7,nivel_riesgo:'BAJO',estado:management.estado},ambiguous:false}};
 else if(path.endsWith('/admin/viajes'))data=[trip];
 else if(path.endsWith('/admin/viajes/41'))data={trip,locations:[]};
 if(empty&&(path.endsWith('/admin/inspecciones')||path.endsWith('/gerenciamiento-viajes')))data=[];
 return new Response(JSON.stringify({success:status===200,data,message:status===401?'Sesión requerida':undefined}),{status,headers:{'Content-Type':'application/json'}});
};
// Explicit opt-in simulation; intercepted locally, never sent to a real API.
if(new URLSearchParams(location.search).has('decision-test')){
 const readFixture=window.fetch;let approved=false;window.__decisionRequests=0;window.alert=()=>{};
 window.fetch=async(input,options={})=>{
  const path=new URL(input,location.origin).pathname;
  if(options.method==='PATCH'&&path.endsWith('/gerenciamiento-viajes/7/decision')){
   window.__decisionRequests++;if(JSON.parse(options.body).estado!=='APROBADO')throw Error('Unexpected mock decision');
   approved=true;rows[0].estado='APROBADA';return new Response(JSON.stringify({success:true,message:'Aprobados',data:{estado:'APROBADO'}}),{headers:{'Content-Type':'application/json'}});
  }
  if(approved&&path.endsWith('/gerenciamiento-viajes'))return new Response(JSON.stringify({success:true,data:[]}),{headers:{'Content-Type':'application/json'}});
  return readFixture(input,options);
 };
}
// Remote changes update only mock server data; no React events, approvals or pushes are fired.
if(new URLSearchParams(location.search).has('live-test')){
 const readFixture=window.fetch;window.__liveAlerts=0;window.__liveReads=0;window.__liveOffline=false;
 window.alert=()=>{window.__liveAlerts++;};
 window.__simulateCancellation=(shared=false)=>{management.approval_available=false;management.viaje_cancelado=true;rows[0].approval_available=shared;rows[0].approval_folio=shared?'VJ-ACTIVO-COMPARTIDO':null;};
 window.__simulateOtherApprover=state=>{management.estado=state;rows[0].estado=state==='APROBADO'?'APROBADA':'RECHAZADA';};
 window.fetch=async(input,options={})=>{
  const path=new URL(input,location.origin).pathname;
  if(path.includes('/inspecciones')||path.includes('/gerenciamiento-viajes')){window.__liveReads++;if(window.__liveOffline)throw Error('Simulated connection loss');}
  return readFixture(input,options);
 };
}
// Manejo authorizations are mock-only; supports responsive and remote-decision QA.
if(new URLSearchParams(location.search).has('manejo-test')){
 const readFixture=window.fetch;let pending=true;window.__manejoRequests=0;window.__manejoDecisions=[];window.__resolveManejo=()=>{pending=false;};
 window.fetch=async(input,options={})=>{
  const path=new URL(input,location.origin).pathname;
  if(path.includes('/autorizaciones-manejo-comentado')){
   window.__manejoRequests++;
   if(options.method==='PATCH'){const data=JSON.parse(options.body);if(!data.firma.startsWith('data:image/png;base64,'))throw Error('Missing signature');window.__manejoDecisions.push(data);pending=false;}
   return new Response(JSON.stringify({success:true,message:options.method==='PATCH'?'Solicitud atendida':undefined,data:pending?[{id_autorizacion:51,folio:'VJ-MANEJO-DEMO',conductor:'Ana López',vehiculo:'MITSUBISHI L200',numero_economico:'AUTO-010',origen:'ASPX - ORIGEN COMPLETO',destino:'ASPX - DESTINO COMPLETO'}]:[]}),{headers:{'Content-Type':'application/json'}});
  }
  return readFixture(input,options);
 };
}
createRoot(document.getElementById('root')).render(<SupervisorApp/>);
