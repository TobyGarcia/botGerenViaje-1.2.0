const STORAGE_KEY = "gerenciamiento_viajes_tracking_state";
export function saveTrackingState(state) { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
export function getTrackingState() { try { const value = localStorage.getItem(STORAGE_KEY); return value ? JSON.parse(value) : null; } catch { return null; } }
export function clearTrackingState() { localStorage.removeItem(STORAGE_KEY); }
