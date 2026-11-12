// Read-only fixture. Never sends approvals or login requests to the server.
import React from 'react';import{createRoot}from'react-dom/client';import SupervisorApp from '../../src/pages/SupervisorApp.jsx';import '../../src/index.css';import '../../src/App.css';
const login=new URLSearchParams(location.search).has('login');
const trip={idViaje:41,folio:'VJ-DEMO-0041',fecha:'2026-11-12',conductor:{nombre:'Ana López'},vehiculo:{nombre:'MITSUBISHI L200',numeroEconomico:'AUTO-DEMO',placas:'DEM-001'},origen:{nombre:'Base'},destino:{nombre:'Almacén'},estado:{nombre:'EN_CURSO'},kilometrajeInicial:1200,motivo:'Traslado',acompanantes:[]};
const rows=[{id_inspeccion:1,folio:'PENDIENTE-DEMO',vehiculo:'MITSUBISHI L200',numero_economico:'AUTO-DEMO',conductor:'Ana López',estado:'PENDIENTE_APROBACION',creado_en:'2026-11-12T17:00:00Z'},{id_inspeccion:2,folio:'APROBADA-OCULTA',estado:'APROBADA',creado_en:'2026-11-12T17:00:00Z'}];
window.fetch=async(input,options={})=>{const path=new URL(input,location.origin).pathname;if((options.method||'GET')!=='GET')throw Error('Mutaciones deshabilitadas en QA');let data=[],status=200;
 if(path.endsWith('/auth/session')){if(login){status=401;data=null;}else data={user:{nombre:'Supervisora Demo',rol:'SUPERVISOR',idUsuarioAdmin:1}};}
 else if(path.endsWith('/admin/inspecciones'))data=rows;
 else if(path.endsWith('/admin/inspecciones/1'))data={...rows[0],checklist:{Luces:'B'},danos:{},combustible:'F'};
 else if(path.endsWith('/admin/viajes'))data=[trip];
 else if(path.endsWith('/admin/viajes/41'))data={trip,locations:[]};
 return new Response(JSON.stringify({success:status===200,data,message:status===401?'Sesión requerida':undefined}),{status,headers:{'Content-Type':'application/json'}});
};createRoot(document.getElementById('root')).render(<SupervisorApp/>);
