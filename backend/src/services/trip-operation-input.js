// Validación compartida para los eventos de acompañantes y remolques.
export function parseTripOperationInput(input = {}) {
  const allowed = new Set(['COMPANION_ADDED', 'COMPANION_DROPPED_OFF', 'TRAILER_ATTACHED', 'TRAILER_DETACHED']);
  if (!allowed.has(input.type)) throw new Error('Evento de viaje inválido.');
  const latitude = input.latitude;
  const longitude = input.longitude;
  if (typeof latitude !== 'number' || !Number.isFinite(latitude) || Math.abs(latitude) > 90 ||
      typeof longitude !== 'number' || !Number.isFinite(longitude) || Math.abs(longitude) > 180) {
    throw new Error('Se requiere una ubicación válida para registrar el evento.');
  }
  const eventKey = typeof input.eventKey === 'string' ? input.eventKey.trim() : '';
  if (!/^[a-zA-Z0-9_-]{16,100}$/.test(eventKey)) throw new Error('Identificador de evento inválido.');
  const result = { type: input.type, latitude, longitude, eventKey };
  if (input.type === 'COMPANION_ADDED') {
    result.name = typeof input.name === 'string' ? input.name.trim() : '';
    if (!result.name || result.name.length > 200) throw new Error('Nombre de acompañante inválido.');
  } else {
    if (!Number.isSafeInteger(input.itemId) || input.itemId <= 0) throw new Error('Elemento inválido.');
    result.itemId = input.itemId;
  }
  return result;
}
