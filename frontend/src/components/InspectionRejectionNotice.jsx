import {useEffect,useState} from 'react';
import {getInspectionRejections} from '../services/api.js';
import {watchRemoteStatus} from '../services/update-checker.js';
import safeStorage from '../utils/safeStorage.js';
import {latestUnreadRejection,acknowledgeRejection} from '../services/inspection-rejection-notice.js';
import TripOperationModal from './TripOperationModal.jsx';
import {IconAlert} from './Icons.jsx';
import './TripOperations.css';
import {Capacitor,registerPlugin} from '@capacitor/core';
const NativeResume=registerPlugin('AndroidVersion');

export default function InspectionRejectionNotice({driverId}){
 const [notice,setNotice]=useState(null);
 useEffect(()=>{
  setNotice(null);
  if(!driverId)return;
  const watcher=watchRemoteStatus({intervalMs:5000,minimumIntervalMs:4000,
   check:signal=>getInspectionRejections(signal),
   subscribeResume:Capacitor.isNativePlatform()?callback=>NativeResume.addListener('appResumed',callback):undefined,
   onResult:result=>setNotice(latestUnreadRejection(driverId,result.data,safeStorage))});
  return ()=>watcher.stop();
 },[driverId]);
 if(!notice)return null;
 const close=()=>{acknowledgeRejection(driverId,notice,safeStorage);setNotice(null);};
 const running=notice.viajes.filter(t=>t.estado==='EN_CURSO');
 const cancelled=notice.viajes.filter(t=>t.estado==='CANCELADO');
 return <TripOperationModal title="Inspección rechazada" headerCaption="AVISO DE INSPECCIÓN" role="alertdialog"
  icon={<IconAlert size={24}/>} onClose={close}
  footer={<button type="button" className="trip-ops-primary" onClick={close}>Entendido</button>}>
  <p style={{overflowWrap:'anywhere'}}><strong>{notice.vehiculo}</strong> · Inspección #{notice.id_inspeccion}</p>
  <p style={{overflowWrap:'anywhere'}}><strong>Motivo:</strong> {notice.motivo||'Sin comentario del aprobador.'}</p>
  {running.length>0&&<p><strong>Puedes terminar tu viaje en curso.</strong><br/>{running.map(t=>t.folio).join(', ')}</p>}
  {cancelled.length>0&&<p><strong>Viajes pendientes cancelados:</strong><br/>{cancelled.map(t=>t.folio).join(', ')}</p>}
  <p><strong>Para tu siguiente viaje debes realizar una inspección nueva.</strong></p>
  <p>Los viajes finalizados conservan su historial.</p>
 </TripOperationModal>;
}
