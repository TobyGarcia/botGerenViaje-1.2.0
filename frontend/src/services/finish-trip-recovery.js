export async function recoverFinishedTrip(idViaje, getTrip) {
  try {
    const response = await getTrip(idViaje);
    const trip = response?.data;
    if (Number(trip?.idViaje ?? trip?.id_viajes) !== Number(idViaje)) return { status: 'UNKNOWN' };
    const status = trip.estado?.nombre ?? trip.estado;
    return { status: status || 'UNKNOWN', trip };
  } catch {
    return { status: 'UNKNOWN' };
  }
}
