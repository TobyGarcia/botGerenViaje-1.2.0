import {IconUser,IconCar} from './Icons.jsx';
import './ApprovalTripCard.css';

export function approvalVehicleName(record){
 const name=record.vehiculo_nombre||record.vehiculo;
 if(name?.trim())return name.trim();
 const category=String(record.tipo_vehiculo||'').trim();
 return category&&!['auto','automovil','automóvil','vehiculo','vehículo','camioneta','camión','camion'].includes(category.toLowerCase())?category:'Vehículo sin registrar';
}
export default function ApprovalTripCard({record,onReview,local=false,statusBadge}){
 const state=record.approval_available===false&&record.estado==='PENDIENTE'?'Retirado':record.estado==='APROBADO'&&record.inspeccion_estado==='PENDIENTE_APROBACION'?'Inspección por aprobar':({PENDIENTE:'Por aprobar',PENDIENTE_APROBACION:'Por aprobar',APROBADO:'Aprobado',APROBADA:'Aprobada',RECHAZADO:'Rechazado',RECHAZADA:'Rechazada'})[record.estado]||record.estado;
 return <article className="approval-trip-card">
  <header><span className="approval-card-kind">{local?'Viaje local':'Gerenciamiento'}</span>{statusBadge||<span className="approval-card-state" data-state={state==='Inspección por aprobar'?'PENDIENTE':state==='Retirado'?'RETIRED':record.estado}>{state}</span>}</header>
  <div className="approval-card-route" aria-label="Ruta del viaje">
   <div className="approval-route-point is-origin"><span aria-hidden="true"/><div><small>Origen</small><strong>{record.origen_nombre||record.origen_texto||'Origen sin registrar'}</strong></div></div>
   <div className="approval-route-point is-destination"><span aria-hidden="true"/><div><small>Destino</small><strong>{record.destino_nombre||record.destino_texto||'Destino sin registrar'}</strong></div></div>
  </div>
  <div className="approval-card-people"><IconUser size={19}/><div><small>Conductor</small><strong>{record.conductor_nombre||record.nombre_conductor||record.conductor||'Conductor sin registrar'}</strong></div></div>
  <div className="approval-card-people"><IconCar size={20}/><div><small>Vehículo</small><strong>{approvalVehicleName(record)}</strong></div></div>
  {record.nivel_riesgo&&<span className="approval-card-risk" data-risk={record.nivel_riesgo}>Riesgo {String(record.nivel_riesgo).toLowerCase()}</span>}
  <button type="button" className={local?'btn-review':undefined} onClick={onReview}>{local?'Revisar inspección':'Ver revisión'} <span aria-hidden="true">→</span></button>
 </article>;
}
