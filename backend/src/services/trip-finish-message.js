const text = (value, fallback = 'No registrado', limit = 160) => {
  const clean = String(value ?? '').replace(/\s+/g, ' ').trim();
  return clean ? (clean.length > limit ? `${clean.slice(0, limit - 1)}…` : clean) : fallback;
};

function names(items) {
  const unique = [...new Set(items.map(item => text(item.name, '', 50)).filter(Boolean))];
  return unique.length ? `${unique.slice(0, 8).join(', ')}${unique.length > 8 ? ` (+${unique.length - 8} más)` : ''}` : 'Ninguno';
}

function date(value) {
  if (!value || !Number.isFinite(new Date(value).getTime())) return 'No registrada';
  return new Intl.DateTimeFormat('es-MX', {
    timeZone: 'America/Mexico_City', day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  }).format(new Date(value));
}

export function formatFinishedTripLines(trip) {
  const history = Array.isArray(trip.elementosViaje) ? trip.elementosViaje : [];
  const arrived = Array.isArray(trip.elementosAlFinalizar) ? trip.elementosAlFinalizar : [];
  const companions = items => items.filter(item => item.kind === 'companion');
  const trailers = items => items.filter(item => item.kind === 'trailer');
  return [
    '🏁 Viaje FINALIZADO',
    `Folio: ${text(trip.folio)}`,
    `Conductor: ${text(trip.conductor)}`,
    `Unidad: ${text(trip.vehiculo)}${trip.numeroEconomico ? ` · ${text(trip.numeroEconomico)}` : ''}`,
    '',
    `Ruta: ${text(trip.origen)} → ${text(trip.destino)}`,
    `Salida: ${date(trip.horaSalida)}`,
    `Llegada: ${date(trip.horaLlegada)}`,
    `Kilometraje: ${text(trip.kilometrajeInicial)} → ${text(trip.kilometrajeFinal)} km`,
    `Distancia recorrida: ${text(trip.kilometrosRecorridos)} km`,
    '',
    '📋 Resumen del recorrido',
    `Paradas técnicas: ${Array.isArray(trip.paradasTecnicas) ? trip.paradasTecnicas.length : 0}`,
    `Acompañantes del viaje: ${names(companions(history))}`,
    `Remolques utilizados: ${names(trailers(history))}`,
    '',
    '📍 Al llegar al destino',
    `Acompañantes: ${names(companions(arrived))}`,
    `Remolques: ${names(trailers(arrived))}`,
    ...(trip.motivo ? ['', `Motivo: ${text(trip.motivo)}`] : [])
  ];
}
