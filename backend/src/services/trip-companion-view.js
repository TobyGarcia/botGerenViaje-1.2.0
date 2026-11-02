export function tripCompanionHistory(trip, items) {
  const result = [...items];
  const keys = new Set(items.map(i => i.initial_key));
  for (const [index, entry] of (Array.isArray(trip.acompanantes) ? trip.acompanantes : []).entries()) {
    const name = typeof entry === 'string' ? entry : entry?.nombre || entry?.name;
    if (name && !keys.has(`companion-${index}`)) result.push({ id: `initial-${index}`, name,
      added_at: trip.hora_salida || trip.creado_en, removed_at: trip.hora_llegada || null });
  }
  return result.sort((a,b) => new Date(a.added_at || 0) - new Date(b.added_at || 0));
}
