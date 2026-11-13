// Read-only fixture. Never sends approvals or login requests to the server.
import React from 'react';import{createRoot}from'react-dom/client';import SupervisorApp from '../../src/pages/SupervisorApp.jsx';import '../../src/index.css';import '../../src/App.css';
const role=new URLSearchParams(location.search).get('role')||'SUPERVISOR';
const empty=new URLSearchParams(location.search).has('empty');
const invalid=new URLSearchParams(location.search).has('invalid');
const login=new URLSearchParams(location.search).has('login') || invalid;
const trip={idViaje:41,folio:'VJ-DEMO-0041',fecha:'2026-11-12',conductor:{nombre:'Ana López'},vehiculo:{nombre:'MITSUBISHI L200',numeroEconomico:'AUTO-DEMO',placas:'DEM-001'},origen:{nombre:'Base'},destino:{nombre:'Almacén'},estado:{nombre:'EN_CURSO'},kilometrajeInicial:1200,motivo:'Traslado',acompanantes:[]};
const rows=[{id_inspeccion:1,folio:'PENDIENTE-DEMO',vehiculo:'MITSUBISHI L200',numero_economico:'AUTO-DEMO',conductor:'Ana López',estado:'PENDIENTE_APROBACION',creado_en:'2026-11-12T17:00:00Z'},{id_inspeccion:2,folio:'APROBADA-OCULTA',estado:'APROBADA',creado_en:'2026-11-12T17:00:00Z'}];
window.fetch=async(input,options={})=>{const path=new URL(input,location.origin).pathname;if(invalid && path.endsWith('/supervisor-app/start'))return new Response('null',{headers:{'Content-Type':'application/json'}});if((options.method||'GET')!=='GET')throw Error('Mutaciones deshabilitadas en QA');let data=[],status=200;
 if(path.endsWith('/auth/session')){if(login){status=401;data=null;}else data={user:{nombre:'Supervisora Demo',rol:role,idUsuarioAdmin:1}};}
 else if(path.endsWith('/gerenciamiento-viajes'))data=[{id_gerenciamiento:7,folio_documento:'GEREN-DEMO',nombre_conductor:'Ana López',conductor_nombre:'Ana López',tipo_vehiculo:'MITSUBISHI L200',origen_nombre:'ASPX - ORIGEN CON NOMBRE COMPLETO',destino_nombre:'ASPX - DESTINO CON NOMBRE COMPLETO',nivel_riesgo:'BAJO',puntaje_total:10,estado:'PENDIENTE',acompanantes:['Ana','Juan']}];
 else if(path.endsWith('/admin/inspecciones'))data=rows;
 else if(path.endsWith('/admin/inspecciones/1'))data={...rows[0],checklist:{Luces:'B'},danos:{},combustible:'F',approval_context:{management:{id_gerenciamiento:7,nivel_riesgo:'BAJO',estado:'PENDIENTE'},ambiguous:false}};
 else if(path.endsWith('/admin/viajes'))data=[trip];
 else if(path.endsWith('/admin/viajes/41'))data={trip,locations:[]};
 if(empty&&(path.endsWith('/admin/inspecciones')||path.endsWith('/gerenciamiento-viajes')))data=[];
 return new Response(JSON.stringify({success:status===200,data,message:status===401?'Sesión requerida':undefined}),{status,headers:{'Content-Type':'application/json'}});
};createRoot(document.getElementById('root')).render(<SupervisorApp/>);
