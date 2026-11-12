// Ambas pestañas comparten un solo borrador; cambiar de pestaña no confirma.
export function buildStopDraft({ stagedActions = [], companionDraft = [], trailerId = '', inspection, warningConfirmed = false, vehicles = [] }) {
  const actions = [...stagedActions, ...companionDraft.map(name => name.trim()).filter(Boolean).map(name => ({ type: 'COMPANION_ADDED', name }))];
  if (!trailerId) return { actions, error: '' };
  const vehicle = vehicles.find(item => Number(item.id_vehiculos) === Number(trailerId));
  if (!vehicle) return { actions, error: 'Selecciona un remolque del catálogo.' };
  if (!inspection?.captureId || Number(inspection.idRemolque) !== Number(trailerId) || !Object.keys(inspection.checklist || {}).length || !warningConfirmed) {
    return { actions, error: 'Completa y confirma la inspección nueva en Remolques antes de confirmar la parada.' };
  }
  if (actions.some(action => action.type === 'TRAILER_ATTACHED' && action.itemId === Number(trailerId))) {
    return { actions, error: 'El remolque ya está seleccionado en esta parada.' };
  }
  actions.push({ type: 'TRAILER_ATTACHED', itemId: Number(trailerId), name: vehicle.nombre, inspectionMode: 'new', inspection, warningConfirmed: true });
  return { actions, error: '' };
}
