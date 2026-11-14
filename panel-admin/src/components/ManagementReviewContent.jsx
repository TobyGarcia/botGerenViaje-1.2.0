import {approvalVehicleName} from './ApprovalTripCard.jsx';
import DamageViewer from './DamageViewer.jsx';
import TrailerInspectionCards from './TrailerInspectionCards.jsx';
import {IconDestinos,IconShield,IconInspecciones} from './Icons.jsx';
import './ManagementReviewContent.css';

const shown=value=>value===null||value===undefined||value===''?'Sin registrar':String(value);
const date=value=>{if(!value)return 'Sin registrar';const raw=String(value).split('T')[0];return /^\d{4}-\d{2}-\d{2}$/.test(raw)?raw.split('-').reverse().join('/'):raw;};
const states={B:'Bueno',R:'Regular',M:'Malo','N/A':'No aplica',NA:'No aplica'};
const riskFields=[['Distancia','pts_distancia'],['Clima','pts_clima'],['Vehículos y personas','pts_vehiculos_personas'],['Condiciones de la vía','pts_condiciones_via'],['Comunicaciones','pts_comunicaciones'],['Horas trabajadas y viaje','pts_horas_trabajadas'],['Horario de traslado','pts_hora_traslado']];
const riskOptions={
 pts_distancia:{1:'Menos de 50 km',2:'Menos de 100 km',5:'Menos de 200 km',8:'Más de 200 km'},
 pts_clima:{2:'Seco / condiciones normales',4:'Lluvia suave',8:'Lluvia fuerte o niebla',10:'Nieve'},
 pts_vehiculos_personas:{1:'2+ vehículos y 2+ personas',2:'2+ vehículos y 1+ personas',3:'1 vehículo y 2+ personas',6:'1 vehículo y 1 persona'},
 pts_condiciones_via:{1:'Pavimentada',2:'Mixta',4:'No pavimentada'},
 pts_comunicaciones:{0:'Teléfono celular',2:'Sin comunicación, con caravana',4:'Sin comunicación ni caravana'},
 pts_horas_trabajadas:{1:'Hasta 12 horas',3:'Hasta 14 horas',6:'Hasta 16 horas'},
 pts_hora_traslado:{1:'Diurno · 06:00 a 18:00',8:'Nocturno · 18:00 a 06:00'}
};
function Facts({items}){return <dl className="management-facts">{items.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{shown(value)}</dd></div>)}</dl>;}
function Checklist({value={}}){
 const entries=Object.entries(value||{}),issues=entries.filter(([,state])=>state==='M'||state==='R');
 if(!entries.length)return <p className="management-empty">No hay checklist registrado para esta inspección.</p>;
 const rows=items=>items.map(([item,state])=><div className="management-check-row" key={item}><span>{item}</span><strong data-state={state}>{states[state]||shown(state)}</strong></div>);
 return <section className="management-checklist">
  <div className="management-check-counts">{[['B','buenos'],['R','regulares'],['M','malos'],['N/A','no aplican']].map(([state,label])=>{
   const count=entries.filter(([,v])=>v===state||(state==='N/A'&&v==='NA')).length;
   return count>0?<span data-state={state} key={state}>{count} {label}</span>:null;
  })}</div>
  {issues.length>0&&<div className="management-check-issues"><h4>Requieren atención</h4>{rows(issues)}</div>}
  <details className="management-fold"><summary>Ver checklist completo <span>{entries.length} puntos</span></summary><div>{rows(entries)}</div></details>
 </section>;
}
export default function ManagementReviewContent({doc,tab}){
 const checklist=doc.inspeccion_checklist;
 const hasInspection=Boolean(doc.inspeccion_estado||checklist||doc.inspeccion_fecha_operativa||doc.inspeccion_firma_conductor);
 const fuel=doc.inspeccion_combustible??doc.combustible;
 const fuelLabel=String(fuel||'').trim().toUpperCase()==='F'?'Lleno · 100%':String(fuel||'').trim().toUpperCase()==='E'?'Vacío · 0%':fuel;
 const controls=[['Conoce los riesgos locales',doc.conocimiento_riesgos_locales],['Medicamentos que producen somnolencia',doc.medicamentos_somnolencia],['Durmió adecuadamente',doc.dormido_adecuadamente],['Informado sobre transporte de personal',doc.prohibido_personal_ajeno],['Inspección vehicular realizada',doc.inspeccion_vehiculo_realizada],['Reunión pre caravana',doc.reunion_pre_caravana_realizada]];
 return <>
  <section id="management-trip-panel" role="tabpanel" aria-labelledby="management-trip-tab" hidden={tab!=='trip'} className="management-review-panel">
   <div className="management-route"><IconDestinos size={22}/><div><small>Origen</small><strong>{shown(doc.origen_nombre||doc.origen_texto)}</strong><small>Destino</small><strong>{shown(doc.destino_nombre||doc.destino_texto)}</strong></div></div>
   <Facts items={[
    ['Conductor',doc.nombre_conductor||doc.conductor_nombre],['Unidad',approvalVehicleName(doc)],['Número económico',doc.numero_unidad],['Placas',doc.placa],['Salida',doc.hora_salida],['Fecha',date(doc.fecha_emision)],['Kilometraje',doc.kilometraje!=null?`${doc.kilometraje} km`:null],['Duración estimada',doc.tiempo_viaje_horas!=null?`${doc.tiempo_viaje_horas} h`:null]
   ]}/>
   <div className="management-risk" data-risk={doc.nivel_riesgo}><IconShield size={24}/><div><small>Evaluación de riesgo</small><strong>{shown(doc.nivel_riesgo)} · {doc.puntaje_total??'—'} puntos</strong></div></div>
   <details className="management-fold"><summary>Evaluación y controles</summary><div><Facts items={riskFields.map(([name,key])=>[name,doc[key]!=null?`${riskOptions[key]?.[doc[key]]||'Valor registrado'} · ${doc[key]} puntos`:null])}/>{controls.map(([name,value])=><div className="management-check-row" key={name}><span>{name}</span><strong>{value===true?'Sí':value===false?'No':'Sin registrar'}</strong></div>)}</div></details>
   <details className="management-fold"><summary>Más datos del viaje</summary><div><Facts items={[
    ['Departamento',doc.departamento],['Licencia',doc.licencia_numero],['Tipo de licencia',doc.licencia_tipo],['Vencimiento',date(doc.licencia_vencimiento)],['Ruta',Array.isArray(doc.ruta_puntos)?doc.ruta_puntos.join(' → '):doc.ruta_puntos],['Acompañantes',Array.isArray(doc.acompanantes)?doc.acompanantes.join(', ')||'Sin acompañantes':doc.acompanantes]
   ]}/>{doc.sitios_reporte?.length>0&&<Facts items={doc.sitios_reporte.map((p,i)=>[`Reporte ${i+1}`,[p.punto,p.horaReportada].filter(Boolean).join(' · ')])}/>}</div></details>
   {doc.firma_conductor&&<details className="management-fold"><summary>Firma del conductor</summary><img className="management-signature" src={doc.firma_conductor} alt="Firma del conductor del gerenciamiento"/></details>}
  </section>
  <section id="management-inspection-panel" role="tabpanel" aria-labelledby="management-inspection-tab" hidden={tab!=='inspection'} className="management-review-panel">
   <h3 className="management-section-title"><IconInspecciones size={21}/>Inspección vehicular</h3>
   {!hasInspection?<p className="management-empty">No hay una inspección vinculada disponible.</p>:<>
    <Facts items={[[ 'Estado',({PENDIENTE_APROBACION:'Por aprobar',APROBADA:'Aprobada',RECHAZADA:'Rechazada'})[doc.inspeccion_estado]||doc.inspeccion_estado?.replaceAll('_',' ')],['Combustible',fuelLabel],['Fecha operativa',date(doc.inspeccion_fecha_operativa)]]}/>
    {doc.inspeccion_es_dia_siguiente&&<p className="management-note">Inspección programada para el día siguiente.</p>}
    <DamageViewer damages={doc.inspeccion_danos||{}} vehicle={approvalVehicleName(doc)} singleView/>
    <Checklist value={checklist}/>
    <div className="management-note"><h4>Observaciones del conductor</h4><p>{doc.inspeccion_observaciones||'Sin observaciones registradas.'}</p></div>
    {doc.inspeccion_firma_conductor&&<details className="management-fold"><summary>Firma de la inspección</summary><img className="management-signature" src={doc.inspeccion_firma_conductor} alt="Firma de la inspección vehicular"/></details>}
   </>}
   <TrailerInspectionCards items={doc.trailer_inspections||[]} assigned={doc.inspeccion_lleva_remolque?{name:doc.remolque_nombre||'Remolque asignado',numero_economico:doc.remolque_numero_economico,placas:doc.remolque_placas,inspection:doc.inspeccion_remolque}:null}/>
  </section>
 </>;
}
