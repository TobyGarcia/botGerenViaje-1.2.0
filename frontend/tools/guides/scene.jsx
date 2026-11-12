// Capture-only fixture: real production components, isolated local data, no network writes.
import React from 'react';
import {createRoot} from 'react-dom/client';
import TripOperations from '../../src/components/TripOperations.jsx';
import TopBar from '../../src/components/TopBar.jsx';
import OfflineBanner from '../../src/components/OfflineBanner.jsx';
import '../../src/index.css';
import '../../src/App.css';
const stage=new URLSearchParams(location.search).get('stage')||'companions-open';
Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>false});
window.fetch=()=>Promise.reject(new Error('Captura aislada: red deshabilitada'));
const vehicles=[{id_vehiculos:11,nombre:'REMOLQUE PLATAFORMA',numero_economico:'REM-001',tipo_vehiculo:'REMOLQUE',placas:'DEM-001'}];
const places=[{id_lugares:1,nombre:'Base de operaciones'},{id_lugares:2,nombre:'Almacén central'}];
const items=[{id:1,kind:'companion',name:'Ana López',added_at:'2026-11-12T15:00:00Z',removed_at:null},...(stage==='trailer-drop'?[{id:2,kind:'trailer',name:'REMOLQUE PLATAFORMA',trailer_id:11,added_at:'2026-11-12T15:00:00Z',removed_at:null}]:[])];
const pending=stage==='offline-queue'?[{eventKey:'demo-operation',recordedAt:'2026-11-12T16:00:00Z',latitude:0,longitude:0,placeId:1,actions:[{type:'COMPANION_ADDED',name:'Luis Pérez'}]}]:[];
localStorage.setItem('gv_trip_movements_v1:900001',JSON.stringify({'900001':{items,places,vehicles,pending,prepared:true}}));
localStorage.setItem('cached_vehiculos',JSON.stringify(vehicles));localStorage.setItem('cached_lugares',JSON.stringify(places));
createRoot(document.getElementById('root')).render(<div className="app-shell"><TopBar conductor={{nombre:'Conductor de demostración'}} activeTabMode="urban" onTabChange={()=>{}}/><main className="container"><section className="gv-trip-card"><div className="gv-trip-header"><h3 className="gv-trip-title"><span style={{color:'#10b981'}}>● </span>Viaje en curso</h3></div><div style={{padding:'12px 0',color:'#537182',fontSize:13}}>VJ-DEMO · Base → Almacén central</div>{stage.startsWith('offline')&&<div data-capture="offline"><OfflineBanner idViaje={900001}/></div>}<TripOperations tripId={900001} driverId={900001}/></section></main></div>);
