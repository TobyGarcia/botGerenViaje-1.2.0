const labels = { COMPANION_ADDED:'Acompañante agregado',COMPANION_DROPPED_OFF:'Acompañante dejado',TRAILER_ATTACHED:'Remolque enganchado',TRAILER_DETACHED:'Remolque desenganchado' };
export function formatTripOperationMessage(event) {
  const p=event.payload;
  const names=Array.isArray(p.names) && p.names.length ? p.names : [p.name];
  const title=event.event_type==='COMPANION_ADDED' && names.length>1 ? 'Acompañantes agregados' : labels[event.event_type];
  return `${title}${p.closure?' (cierre del viaje)':''}\nViaje: ${p.folio}\n${names.map(name=>`• ${name}`).join('\n')}\nHora: ${new Date(event.created_at).toLocaleString('es-MX',{timeZone:'America/Mexico_City'})}`;
}

function nearby(a,b) {
  if (a.latitude == null || a.longitude == null || b.latitude == null || b.longitude == null) return false;
  const values=[a.latitude,a.longitude,b.latitude,b.longitude].map(Number);
  if (!values.every(Number.isFinite)) return false;
  const [lat1,lng1,lat2,lng2]=values.map(n=>n*Math.PI/180);
  const h=Math.sin((lat2-lat1)/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin((lng2-lng1)/2)**2;
  return 6371000*2*Math.asin(Math.sqrt(Math.min(1,h)))<=80;
}

export function groupStopEvents(events) {
  const first=events[0];
  if (!first) return [];
  const group=[first];
  if (first.payload.closure) return group;
  for (const event of events.slice(1)) {
    if (event.trip_id!==first.trip_id || event.payload.closure ||
        +new Date(event.created_at)-+new Date(first.created_at)>120000 ||
        !nearby(first.payload,event.payload) || formatStopSummary([...group,event]).length>3500) break;
    group.push(event);
  }
  return group;
}

export function formatStopSummary(events) {
  const first=events[0];
  if (first.payload.closure) return formatTripOperationMessage(first);
  const sections=[['COMPANION_ADDED','👥 Subieron'],['COMPANION_DROPPED_OFF','👤 Bajaron'],['TRAILER_ATTACHED','🚛 Remolques enganchados'],['TRAILER_DETACHED','🚛 Remolques dejados']];
  const lines=sections.flatMap(([type,label])=>{
    const matching=events.filter(e=>e.event_type===type);
    if (!matching.length) return [];
    return ['',label,...matching.flatMap(e=>(e.payload.names || [e.payload.name]).map(name=>`• ${name}`))];
  });
  const time=value=>new Date(value).toLocaleTimeString('es-MX',{timeZone:'America/Mexico_City',hour:'2-digit',minute:'2-digit'});
  const date=new Date(first.created_at).toLocaleDateString('es-MX',{timeZone:'America/Mexico_City'});
  const end=events[events.length-1];
  return `📍 Parada del viaje\n${first.payload.folio}\n${date} · ${time(first.created_at)}${time(end.created_at)!==time(first.created_at)?` – ${time(end.created_at)}`:''}${lines.join('\n')}`;
}
