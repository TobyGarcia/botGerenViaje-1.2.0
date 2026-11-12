const labels = { COMPANION_ADDED:'Acompañante agregado',COMPANION_DROPPED_OFF:'Acompañante dejado',TRAILER_ATTACHED:'Remolque enganchado',TRAILER_DETACHED:'Remolque desenganchado' };
const namesLine = names => names.map(name => String(name ?? '').replace(/\s+/g,' ').trim()).filter(Boolean).join(', ');
export function formatTripOperationMessage(event) {
  const p=event.payload;
  const names=Array.isArray(p.names) && p.names.length ? p.names : [p.name];
  const title=event.event_type==='COMPANION_ADDED' && names.length>1 ? 'Acompañantes agregados' : labels[event.event_type];
  const list=namesLine(names);
  return `${title}${p.closure?' (cierre del viaje)':''}\nViaje: ${p.folio}\n${list}\nHora: ${new Date(event.created_at).toLocaleString('es-MX',{timeZone:'America/Mexico_City'})}`;
}

export function formatStopSummary(events) {
  const first=events[0];
  if (first.payload.closure) return formatTripOperationMessage(first);
  events=events.flatMap(event=>Array.isArray(event.payload.actions)?event.payload.actions.map(action=>({...event,event_type:action.type,payload:{...event.payload,names:null,name:action.name}})):event);
  const sections=[['COMPANION_DROPPED_OFF','Se dejó personal:'],['COMPANION_ADDED','Se recogió personal:'],['TRAILER_DETACHED','Se dejó remolque:'],['TRAILER_ATTACHED','Se recogió remolque:']];
  const lines=sections.flatMap(([type,label])=>{
    const matching=events.filter(e=>e.event_type===type);
    if (!matching.length) return [];
    return [`${label} ${namesLine(matching.flatMap(e=>e.payload.names || [e.payload.name]))}`];
  });
  const time=value=>new Date(value).toLocaleTimeString('es-MX',{timeZone:'America/Mexico_City',hour:'2-digit',minute:'2-digit'});
  const end=events[events.length-1];
  const title = `📍 Parada técnica${first.payload.place ? ` en ${first.payload.place.name}` : ''}`;
  const timestamp = `${time(first.created_at)}${time(end.created_at)!==time(first.created_at)?` – ${time(end.created_at)}`:''}`;
  return [title, `Hora: ${timestamp}`, ...lines].join('\n');
}
