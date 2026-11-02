const labels = { COMPANION_ADDED:'Acompañante agregado',COMPANION_DROPPED_OFF:'Acompañante dejado',TRAILER_ATTACHED:'Remolque enganchado',TRAILER_DETACHED:'Remolque desenganchado' };
export function formatTripOperationMessage(event) {
  const p=event.payload;
  const names=Array.isArray(p.names) && p.names.length ? p.names : [p.name];
  const title=event.event_type==='COMPANION_ADDED' && names.length>1 ? 'Acompañantes agregados' : labels[event.event_type];
  return `${title}${p.closure?' (cierre del viaje)':''}\nViaje: ${p.folio}\n${names.map(name=>`• ${name}`).join('\n')}\nHora: ${new Date(event.created_at).toLocaleString('es-MX',{timeZone:'America/Mexico_City'})}`;
}
