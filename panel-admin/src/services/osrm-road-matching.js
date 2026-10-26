import { getRoadGeometry } from "./api.js";

export function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  const rad = Math.PI / 180;
  const a = Math.sin((lat2 - lat1) * rad / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin((lon2 - lon1) * rad / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
}

export function calculateBearing(lat1, lon1, lat2, lon2) {
  const rad = Math.PI / 180;
  const delta = (lon2 - lon1) * rad;
  return (Math.atan2(Math.sin(delta) * Math.cos(lat2 * rad),
    Math.cos(lat1 * rad) * Math.sin(lat2 * rad) -
    Math.sin(lat1 * rad) * Math.cos(lat2 * rad) * Math.cos(delta)) / rad + 360) % 360;
}

export function filterJitterAndCleanPoints(locations = []) {
  const points = locations.filter((p) => p.latitud != null && p.longitud != null)
    .map((p) => ({ ...p, latitud: Number(p.latitud), longitud: Number(p.longitud) }))
    .filter((p) => Number.isFinite(p.latitud) && Number.isFinite(p.longitud) &&
      Math.abs(p.latitud) <= 90 && Math.abs(p.longitud) <= 180 && (p.latitud !== 0 || p.longitud !== 0))
    .sort((a, b) => {
      const delta = new Date(a.fechaGps ?? a.fecha_gps ?? 0) - new Date(b.fechaGps ?? b.fecha_gps ?? 0);
      return (Number.isFinite(delta) && delta !== 0 ? delta :
        (a.idUbicacion ?? a.id_ubicaciones_viaje ?? 0) - (b.idUbicacion ?? b.id_ubicaciones_viaje ?? 0));
    });
  // Conservar cada parada y cada lectura distinta, incluso desvíos y retornos.
  return points.filter((p, i) => i === 0 || i === points.length - 1 ||
    p.esPuntoIntermedio || p.es_punto_intermedio ||
    calculateDistanceMeters(points[i - 1].latitud, points[i - 1].longitud, p.latitud, p.longitud) >= 5);
}

// Todos los GPS válidos participan como waypoints, incluidas las paradas.
// Los bloques comparten un punto; no se podan bucles ni se inventan puentes.
export async function fetchSnappedRoadGeometry(locations = [], { signal } = {}) {
  const points = filterJitterAndCleanPoints(locations);
  if (points.length < 2) return [];
  const geometry = [];
  for (let offset = 0; offset < points.length - 1; offset += 9) {
    signal?.throwIfAborted();
    const chunk = points.slice(offset, offset + 10).map((p) => [p.latitud, p.longitud]);
    const result = await getRoadGeometry(chunk, signal);
    if (!Array.isArray(result.geometry) || result.geometry.length < 2) throw new Error("Ruta vial incompleta.");
    if (geometry.length && calculateDistanceMeters(...geometry[geometry.length - 1], ...result.geometry[0]) > 5) {
      throw new Error("No fue posible unir los tramos por carretera.");
    }
    geometry.push(...result.geometry.slice(geometry.length ? 1 : 0));
  }
  return geometry;
}
