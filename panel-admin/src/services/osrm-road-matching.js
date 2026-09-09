/**
 * Servicio de Segmentación y Ajuste de Ruta a Calles Reales (OSRM Map Matching)
 * Divide listas de puntos GPS en chunks de 8 puntos con solape de 1 punto para respetar
 * los límites de tamaño de consulta de los servidores públicos de OSRM (evita error TooBig).
 */

const CHUNK_SIZE = 8;
const OVERLAP = 1;

/**
 * Calcula distancia euclidiana en metros entre dos puntos geográficos (fórmula de Haversine)
 */
export function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Calcula el rumbo trigonométrico esférico (bearing) en grados (0° a 360°)
 */
export function calculateBearing(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const toDeg = (rad) => (rad * 180) / Math.PI;

  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δλ = toRad(lon2 - lon1);

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

  const θ = toDeg(Math.atan2(y, x));
  return (θ + 360) % 360;
}

/**
 * Ajusta una lista de puntos GPS a la red vial de OpenStreetMap usando OSRM Map Matching
 * en bloques pequeños de 8 con overlap de 1.
 * Si falla un bloque, aplica fallback de ruta suave o coordenadas originales.
 */
export async function fetchSnappedRoadGeometry(locations = []) {
  const valid = locations.filter(
    (l) => Number.isFinite(Number(l.latitud)) && Number.isFinite(Number(l.longitud))
  );

  if (valid.length < 2) {
    return valid.map((l) => [Number(l.latitud), Number(l.longitud)]);
  }

  // Dividir en bloques de CHUNK_SIZE con OVERLAP
  const chunks = [];
  const step = CHUNK_SIZE - OVERLAP;
  for (let i = 0; i < valid.length; i += step) {
    const slice = valid.slice(i, i + CHUNK_SIZE);
    if (slice.length >= 2) {
      chunks.push(slice);
    } else if (slice.length === 1 && chunks.length > 0) {
      // Añadir al último bloque si quedó un punto suelto
      chunks[chunks.length - 1].push(slice[0]);
    }
    if (i + CHUNK_SIZE >= valid.length) break;
  }

  const snappedSegments = [];

  for (const chunk of chunks) {
    try {
      const coords = chunk
        .map((p) => `${Number(p.longitud).toFixed(6)},${Number(p.latitud).toFixed(6)}`)
        .join(";");

      const radiuses = chunk
        .map((p) => {
          const acc = Number(p.precisionMetros ?? p.precision_metros ?? 15);
          return Math.round(Math.max(18, Math.min(35, acc * 1.5)));
        })
        .join(";");

      // Validar timestamps monótonos para OSRM
      let validTimestamps = true;
      const tsArray = [];
      for (let j = 0; j < chunk.length; j++) {
        const timeVal = Math.floor(
          new Date(chunk[j].fechaGps ?? chunk[j].fecha_gps ?? 0).getTime() / 1000
        );
        if (j > 0 && timeVal <= tsArray[j - 1]) {
          validTimestamps = false;
          break;
        }
        tsArray.push(timeVal);
      }

      const tsQuery =
        validTimestamps && tsArray[0] > 0 ? `&timestamps=${tsArray.join(";")}` : "";
      const matchUrl = `https://router.project-osrm.org/match/v1/driving/${coords}?geometries=geojson&overview=full&radiuses=${radiuses}${tsQuery}`;

      const res = await fetch(matchUrl);
      if (res.ok) {
        const data = await res.json();
        if (data.code === "Ok" && data.matchings && data.matchings.length > 0) {
          const chunkCoords = [];
          for (const m of data.matchings) {
            if (m.geometry?.coordinates) {
              for (const c of m.geometry.coordinates) {
                chunkCoords.push([c[1], c[0]]); // [lat, lon]
              }
            }
          }
          if (chunkCoords.length > 0) {
            snappedSegments.push(chunkCoords);
            continue;
          }
        }
      }
    } catch (err) {
      console.warn("[OSRM] Falló matching para bloque, aplicando fallback:", err);
    }

    // Fallback: consulta route con continue_straight=true
    try {
      const coords = chunk
        .map((p) => `${Number(p.longitud).toFixed(6)},${Number(p.latitud).toFixed(6)}`)
        .join(";");
      const routeUrl = `https://router.project-osrm.org/route/v1/driving/${coords}?geometries=geojson&overview=full&continue_straight=true`;
      const resRoute = await fetch(routeUrl);
      if (resRoute.ok) {
        const dataRoute = await resRoute.json();
        if (
          dataRoute.code === "Ok" &&
          dataRoute.routes &&
          dataRoute.routes[0]?.geometry?.coordinates
        ) {
          const chunkCoords = dataRoute.routes[0].geometry.coordinates.map((c) => [
            c[1],
            c[0]
          ]);
          snappedSegments.push(chunkCoords);
          continue;
        }
      }
    } catch {
      // Ignorar fallo de ruta fallback
    }

    // Fallback final: coordenadas directas en línea recta
    snappedSegments.push(chunk.map((p) => [Number(p.latitud), Number(p.longitud)]));
  }

  // Ensamblar segmentos evitando duplicar puntos de contacto
  const fullGeometry = [];
  for (let s = 0; s < snappedSegments.length; s++) {
    const seg = snappedSegments[s];
    if (s === 0) {
      fullGeometry.push(...seg);
    } else {
      const last = fullGeometry[fullGeometry.length - 1];
      const startIdx =
        last && seg[0] && Math.abs(last[0] - seg[0][0]) < 0.00001 && Math.abs(last[1] - seg[0][1]) < 0.00001
          ? 1
          : 0;
      for (let k = startIdx; k < seg.length; k++) {
        fullGeometry.push(seg[k]);
      }
    }
  }

  return fullGeometry.length > 0
    ? fullGeometry
    : valid.map((l) => [Number(l.latitud), Number(l.longitud)]);
}
