export function tripRoutePlace(trips, kind, places = []) {
  for (const trip of trips) {
    if (!trip) continue;
    const value = trip[kind];
    const name = (typeof value === 'string' ? value : value?.nombre) || trip[`${kind}_nombre`] || trip[`${kind}_texto`];
    if (typeof name === 'string' && name.trim()) return name.trim();
    const id = value?.idLugar ?? trip[`id${kind[0].toUpperCase()}${kind.slice(1)}`] ?? trip[`id_${kind}`];
    const place = id != null && places.find(item => String(item.id_lugares) === String(id));
    if (place?.nombre) return place.nombre;
  }
  return 'No registrado';
}

export function preserveCreatedTripRoute(trip, request, places = []) {
  const result = {
    ...trip,
    idOrigen: trip.idOrigen ?? trip.id_origen ?? request.idOrigen,
    idDestino: trip.idDestino ?? trip.id_destino ?? request.idDestino
  };
  for (const kind of ['origen', 'destino']) {
    const name = tripRoutePlace([result], kind, places);
    if (name !== 'No registrado') result[kind] = name;
  }
  return result;
}
