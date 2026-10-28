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
  return points;
}

// Solo estos puntos son restricciones de OSRM. Las lecturas GPS normales se
// conservan para la vista y validación, pero no deben obligar al vehículo a
// regresar o desviarse para visitarlas exactamente.
export function getMandatoryRoutePoints(locations = []) {
  const points = filterJitterAndCleanPoints(locations);
  if (points.length < 2) return points;

  return points.filter((point, index) =>
    index === 0 ||
    index === points.length - 1 ||
    Boolean(point.esPuntoIntermedio || point.es_punto_intermedio)
  );
}

export async function fetchSnappedRoadGeometry(locations = [], { signal } = {}) {
  const readings = filterJitterAndCleanPoints(locations);
  const points = getMandatoryRoutePoints(locations);
  if (points.length < 2) return [];
  const geometry = [];
  let cursor = 0;
  for (let offset = 0; offset < points.length - 1; offset += 1) {
    signal?.throwIfAborted();
    const start = cursor;
    const end = readings.findIndex((p, i) => i > start && p.latitud === points[offset + 1].latitud && p.longitud === points[offset + 1].longitud);
    const references = readings.slice(start + 1, end).map((p) => [p.latitud, p.longitud]);
    cursor = end;
    const chunk = points.slice(offset, offset + 2).map((p) => [p.latitud, p.longitud]);
    const result = await getRoadGeometry(chunk, signal, references);
    if (!Array.isArray(result.geometry) || result.geometry.length < 2) throw new Error("Ruta vial incompleta.");
    if (geometry.length && calculateDistanceMeters(...geometry[geometry.length - 1], ...result.geometry[0]) > 5) {
      throw new Error("No fue posible unir los tramos por carretera.");
    }
    geometry.push(...result.geometry.slice(geometry.length ? 1 : 0));
  }
  return geometry;
}
