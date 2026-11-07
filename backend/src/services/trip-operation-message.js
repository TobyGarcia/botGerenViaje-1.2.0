const labels = { COMPANION_ADDED:'Acompañante agregado',COMPANION_DROPPED_OFF:'Acompañante dejado',TRAILER_ATTACHED:'Remolque enganchado',TRAILER_DETACHED:'Remolque desenganchado' };
export function formatTripOperationMessage(event) {
  const p=event.payload;
  const names=Array.isArray(p.names) && p.names.length ? p.names : [p.name];
  const title=event.event_type==='COMPANION_ADDED' && names.length>1 ? 'Acompañantes agregados' : labels[event.event_type];
  return `${title}${p.closure?' (cierre del viaje)':''}\nViaje: ${p.folio}\n${names.map(name=>`• ${name}`).join('\n')}\nHora: ${new Date(event.created_at).toLocaleString('es-MX',{timeZone:'America/Mexico_City'})}`;
}

export function formatStopSummary(events) {
  const first=events[0];
  if (first.payload.closure) return formatTripOperationMessage(first);
  events=events.flatMap(event=>Array.isArray(event.payload.actions)?event.payload.actions.map(action=>({...event,event_type:action.type,payload:{...event.payload,names:null,name:action.name}})):event);
  const sections=[['COMPANION_ADDED','👥 Subieron'],['COMPANION_DROPPED_OFF','👤 Bajaron'],['TRAILER_ATTACHED','🚛 Remolques enganchados'],['TRAILER_DETACHED','🚛 Remolques dejados']];
  const lines=sections.flatMap(([type,label])=>{
    const matching=events.filter(e=>e.event_type===type);
    if (!matching.length) return [];
    return ['',label,...matching.flatMap(e=>(e.payload.names || [e.payload.name]).map(name=>`• ${name}`))];
  });
  const time=value=>new Date(value).toLocaleTimeString('es-MX',{timeZone:'America/Mexico_City',hour:'2-digit',minute:'2-digit'});
  const date=new Date(first.created_at).toLocaleDateString('es-MX',{timeZone:'America/Mexico_City'});
  const end=events[events.length-1];
  const trip = first.payload.trip || {};
  const field = value => String(value || 'No disponible').replace(/\s+/g, ' ').slice(0, 80);
  const identity = [`Viaje: ${field(first.payload.folio || trip.folio)}`, `Conductor: ${field(trip.conductor)}`,
    `Unidad: ${field(trip.vehiculo)}`, `Número económico: ${field(trip.numeroEconomico)}`].join('\n');
  return `📍 Parada ${first.payload.place ? `técnica en ${first.payload.place.name}` : 'del viaje'}\n${identity}\n${date} · ${time(first.created_at)}${time(end.created_at)!==time(first.created_at)?` – ${time(end.created_at)}`:''}${lines.join('\n')}`;
}
