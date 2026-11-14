// An acknowledgement belongs to the rejection decision, never a PDF/general update.
const event=n=>String(n.rechazo_evento_id||'');
const time=n=>n.rechazado_en||n.aprobado_en||'';
export const rejectionNoticeKey=(driver,n)=>`inspection_rejection_read_v2:${driver}:${n.id_inspeccion}:${event(n)||time(n)||'legacy'}`;
const watermarkKey=driver=>`inspection_rejection_latest_seen:${driver}`;
function atOrBefore(n,seen){
 if(!seen)return false;
 if(/^\d+$/.test(event(n))&&/^\d+$/.test(seen.eventId||''))return BigInt(event(n))<=BigInt(seen.eventId);
 const date=Date.parse(time(n)),previous=Date.parse(seen.decidedAt||'');
 if(Number.isFinite(date)&&Number.isFinite(previous))return date<=previous;
 // An actual new decision on the same inspection must still be shown.
 if(event(n)&&event(n)!==seen.eventId)return false;
 return Number(n.id_inspeccion)<=Number(seen.inspectionId);
}
export function acknowledgeRejection(driver,n,storage){
 storage.setItem(rejectionNoticeKey(driver,n),'1');
 storage.setItem(watermarkKey(driver),JSON.stringify({eventId:event(n),decidedAt:time(n),inspectionId:n.id_inspeccion}));
}
export function latestUnreadRejection(driver,notices,storage){
 // Do not walk back through historical rejections after closing the latest one.
 const n=notices?.[0];if(!n)return null;
 let seen;try{seen=JSON.parse(storage.getItem(watermarkKey(driver))||'null');}catch{seen=null;}
 if(storage.getItem(rejectionNoticeKey(driver,n))||atOrBefore(n,seen))return null;
 const legacy=`inspection_rejection_read:${driver}:${n.id_inspeccion}:${n.actualizado_en}`;
 if(storage.getItem(legacy)){acknowledgeRejection(driver,n,storage);return null;}
 return n;
}
