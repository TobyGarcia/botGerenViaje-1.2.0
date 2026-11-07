const text = (value, fallback = 'No registrado', limit = 160) => {
  const clean = String(value ?? '').replace(/\s+/g, ' ').trim();
  return clean ? (clean.length > limit ? `${clean.slice(0, limit - 1)}…` : clean) : fallback;
};

function names(items) {
  return items.map(item => text(item.name, '')).filter(Boolean).join(', ');
}

function stopDescription(stop) {
  return String(stop.nombre_punto ?? stop.nombrePunto ?? '').replace(/\s+/g, ' ').trim()
    .replace(/^Parada técnica(?: en)?(?=\s|:|$)\s*:?\s*/iu, '') || 'Lugar no registrado';
}

function date(value, timeOnly = false) {
  if (!value || !Number.isFinite(new Date(value).getTime())) return 'No registrada';
  return new Intl.DateTimeFormat('es-MX', {
    timeZone: 'America/Mexico_City',
    ...(timeOnly ? {} : { day: '2-digit', month: '2-digit', year: 'numeric' }),
    hour: '2-digit', minute: '2-digit'
  }).format(new Date(value));
}

export function formatFinishedTripLines(trip) {
  const arrived = Array.isArray(trip.elementosAlFinalizar) ? trip.elementosAlFinalizar : [];
  const stops = Array.isArray(trip.paradasTecnicas) ? trip.paradasTecnicas : [];
  const days = new Set([trip.horaSalida, trip.horaLlegada, ...stops.map(stop => stop.fecha_gps ?? stop.gpsTimestamp)]
    .filter(value => value && Number.isFinite(new Date(value).getTime()))
    .map(value => new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(new Date(value))));
  const sameDay = days.size === 1;
  const companions = items => items.filter(item => item.kind === 'companion');
  const trailers = items => items.filter(item => item.kind === 'trailer');
  const arrival = [
    ...(companions(arrived).length ? [`Acompañantes: ${names(companions(arrived))}`] : []),
    ...(trailers(arrived).length ? [`Remolques: ${names(trailers(arrived))}`] : [])
  ];
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
    ...(stops.length ? ['', '📍 Paradas técnicas', ...stops.map((stop, index) =>
      `${index + 1}. ${date(stop.fecha_gps ?? stop.gpsTimestamp, sameDay)} — ${stopDescription(stop)}`
    )] : []),
    ...(arrival.length ? ['', ...arrival] : []),
    ...(trip.motivo ? ['', `Motivo: ${text(trip.motivo)}`] : [])
  ];
}

// Conservar todas las paradas: los recorridos largos se envían en partes,
// cada una respondiendo al mismo mensaje de inicio del viaje.
export function formatFinishedTripMessages(trip) {
  const parts = [];
  let current = '';
  for (const line of formatFinishedTripLines(trip)) {
    if (line.length < 4000 && current && current.length + line.length + 1 > 4000) {
      parts.push(current.trimEnd()); current = '';
    }
    for (const character of `${line}\n`) {
      if (current.length + character.length > 4000) { parts.push(current.trimEnd()); current = ''; }
      current += character;
    }
  }
  if (current.trim()) parts.push(current.trimEnd());
  return parts;
}
