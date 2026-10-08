const STORAGE_KEY = "gerenciamiento_viajes_tracking_state";
export function saveTrackingState(state) { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
export function clearTrackingState() { localStorage.removeItem(STORAGE_KEY); }
