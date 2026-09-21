/**
 * Servicio de Trazado y Ajuste Vial a Calles Reales (OSRM Routing Service)
 *
 * Mejoras aplicadas:
 * 1. Filtro Anti-Jitter y Limpieza: Elimina lecturas GPS redundantes mientras el vehículo está detenido
 *    (en gasolineras, semáforos, tiendas) para evitar lazos cuadrados y telarañas de ida y vuelta.
 * 2. Ordenamiento Cronológico: Asegura que los puntos se procesen estrictamente en orden temporal.
 * 3. Chunks de alta capacidad (50 waypoints) con OSRM /route:
 *    Permite conectar waypoints en carretera y ciudad respetando glorietas, sentidos viales y distribuidores,
 *    sin sufrir por límites de muestreo de /match.
 * 4. Eliminación de continue_straight=true:
 *    Permite giros naturales en rotondas, retornos y rampas de incorporación vial.
 * 5. Estrategia Divide y Vencerás con reintentos:
 *    Si un bloque grande falla por un punto inaccesible, se divide en sub-bloques para no arruinar el resto de la ruta.
 * 6. Reducción drástica de llamadas HTTP y protección contra Rate Limit (HTTP 429).
 */

const CHUNK_SIZE = 50;
const OVERLAP = 1;
const OSRM_PUBLIC_URL = "https://router.project-osrm.org";

/**
 * Calcula distancia en metros entre dos puntos geográficos (fórmula de Haversine)
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
 * Pausa asíncrona para respetar rate limits de servidores públicos
 */
function waitMs(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Filtra ruido de GPS (puntos estacionarios repetidos, saltos atípicos y desorden cronológico)
 */
export function filterJitterAndCleanPoints(locations = []) {
  const valid = locations
    .map((l) => ({
      ...l,
      latitud: Number(l.latitud),
      longitud: Number(l.longitud)
    }))
    .filter(
      (l) =>
        Number.isFinite(l.latitud) &&
        Number.isFinite(l.longitud) &&
        !(l.latitud === 0 && l.longitud === 0)
    );

  if (valid.length <= 2) return valid;

  // 1. Orden cronológico garantizado
  valid.sort((a, b) => {
    const tA = new Date(a.fechaGps ?? a.fecha_gps ?? 0).getTime();
    const tB = new Date(b.fechaGps ?? b.fecha_gps ?? 0).getTime();
    if (tA && tB && tA !== tB) return tA - tB;
    return (a.idUbicacion ?? a.id_ubicaciones_viaje ?? 0) - (b.idUbicacion ?? b.id_ubicaciones_viaje ?? 0);
  });

  const cleaned = [];
  cleaned.push(valid[0]); // Siempre conservar inicio

  for (let i = 1; i < valid.length - 1; i++) {
    const curr = valid[i];
    const prev = cleaned[cleaned.length - 1];

    const isIntermediateStop = Boolean(curr.esPuntoIntermedio || curr.es_punto_intermedio);
    if (isIntermediateStop) {
      cleaned.push(curr);
      continue;
    }

    const dist = calculateDistanceMeters(
      prev.latitud,
      prev.longitud,
      curr.latitud,
      curr.longitud
    );

    // Filtrar jitter / rebote estacionario:
    // Si la distancia al punto previo es menor a 12 metros, se descarta para no generar lazos
    if (dist < 12) {
      continue;
    }

    // Filtrar saltos irreales de teletransportación (outliers > 5 km en menos de 30 segundos)
    const tPrev = new Date(prev.fechaGps ?? prev.fecha_gps ?? 0).getTime();
    const tCurr = new Date(curr.fechaGps ?? curr.fecha_gps ?? 0).getTime();
    if (tPrev && tCurr && tCurr > tPrev) {
      const dtSec = (tCurr - tPrev) / 1000;
      if (dtSec > 0 && dist / dtSec > 65) {
        // Velocidad > 234 km/h: posible glitch GPS
        continue;
      }
    }

    cleaned.push(curr);
  }

  // Siempre conservar el último punto (destino final)
  const lastPoint = valid[valid.length - 1];
  if (cleaned[cleaned.length - 1] !== lastPoint) {
    cleaned.push(lastPoint);
  }

  return cleaned.length >= 2 ? cleaned : valid;
}

/**
 * Consulta la geometría vial de un bloque de coordenadas a OSRM /route
 * Si el bloque falla y tiene más de 10 puntos, aplica "divide y vencerás"
 */
async function fetchOsrmRouteChunk(chunk, retriesLeft = 1) {
  if (!chunk || chunk.length < 2) {
    return chunk.map((p) => [p.latitud, p.longitud]);
  }

  const coords = chunk
    .map((p) => `${p.longitud.toFixed(6)},${p.latitud.toFixed(6)}`)
    .join(";");

  // Nota: overview=full y geometries=geojson devuelven la polilínea completa de las calles.
  // No incluimos continue_straight=true para permitir giros naturales en glorietas y retornos.
  const url = `${OSRM_PUBLIC_URL}/route/v1/driving/${coords}?geometries=geojson&overview=full&steps=false&alternatives=false`;

  try {
    const res = await fetch(url);

    if (res.status === 429 && retriesLeft > 0) {
      // Manejar rate limiting con espera y 1 reintento
      await waitMs(1200);
      return fetchOsrmRouteChunk(chunk, retriesLeft - 1);
    }

    if (res.ok) {
      const data = await res.json();
      if (
        data.code === "Ok" &&
        data.routes &&
        data.routes[0]?.geometry?.coordinates?.length > 0
      ) {
        // OSRM responde [longitud, latitud] -> Convertir a [latitud, longitud] para Leaflet
        return data.routes[0].geometry.coordinates.map((c) => [c[1], c[0]]);
      }
    }
  } catch (err) {
    console.warn("[OSRM] Error al consultar ruta para bloque:", err);
  }

  // Si el bloque grande falló (por ejemplo por 1 coordenada en predio cerrado no accesible),
  // dividimos en dos mitades recursivamente para salvar el 90%+ del recorrido
  if (chunk.length > 8) {
    const mid = Math.floor(chunk.length / 2);
    const leftSlice = chunk.slice(0, mid + 1);
    const rightSlice = chunk.slice(mid);

    const [leftCoords, rightCoords] = await Promise.all([
      fetchOsrmRouteChunk(leftSlice, retriesLeft),
      fetchOsrmRouteChunk(rightSlice, retriesLeft)
    ]);

    // Unir ambas mitades evitando duplicar el punto medio
    const combined = [...leftCoords];
    const startIdx =
      combined.length > 0 &&
      rightCoords.length > 0 &&
      Math.abs(combined[combined.length - 1][0] - rightCoords[0][0]) < 0.00002 &&
      Math.abs(combined[combined.length - 1][1] - rightCoords[0][1]) < 0.00002
        ? 1
        : 0;

    for (let k = startIdx; k < rightCoords.length; k++) {
      combined.push(rightCoords[k]);
    }

    return combined;
  }

  // Fallback final para el micro-bloque: coordenadas directas
  return chunk.map((p) => [p.latitud, p.longitud]);
}

/**
 * Ajusta una lista de puntos GPS a la red vial de OpenStreetMap usando OSRM
 * Diseñado para trazas de viajes con puntos espaciados (30s), glorietas y distribuidores viales.
 */
export async function fetchSnappedRoadGeometry(locations = []) {
  const cleanLocations = filterJitterAndCleanPoints(locations);

  if (cleanLocations.length < 2) {
    return cleanLocations.map((l) => [Number(l.latitud), Number(l.longitud)]);
  }

  // Dividir en bloques grandes (CHUNK_SIZE = 50) con solape de 1 punto para continuidad
  const chunks = [];
  const step = CHUNK_SIZE - OVERLAP;
  for (let i = 0; i < cleanLocations.length; i += step) {
    const slice = cleanLocations.slice(i, i + CHUNK_SIZE);
    if (slice.length >= 2) {
      chunks.push(slice);
    } else if (slice.length === 1 && chunks.length > 0) {
      chunks[chunks.length - 1].push(slice[0]);
    }
    if (i + CHUNK_SIZE >= cleanLocations.length) break;
  }

  const snappedSegments = [];

  for (let c = 0; c < chunks.length; c++) {
    const chunk = chunks[c];

    // Pausa preventiva breve entre bloques si hay más de 1 bloque para evitar saturar el servidor público
    if (c > 0) {
      await waitMs(150);
    }

    const chunkCoords = await fetchOsrmRouteChunk(chunk);
    if (chunkCoords && chunkCoords.length > 0) {
      snappedSegments.push(chunkCoords);
    }
  }

  // Ensamblar todos los segmentos sin duplicar puntos de contacto
  const fullGeometry = [];
  for (let s = 0; s < snappedSegments.length; s++) {
    const seg = snappedSegments[s];
    if (s === 0) {
      fullGeometry.push(...seg);
    } else {
      const last = fullGeometry[fullGeometry.length - 1];
      const startIdx =
        last &&
        seg[0] &&
        Math.abs(last[0] - seg[0][0]) < 0.00005 &&
        Math.abs(last[1] - seg[0][1]) < 0.00005
          ? 1
          : 0;

      for (let k = startIdx; k < seg.length; k++) {
        fullGeometry.push(seg[k]);
      }
    }
  }

  return fullGeometry.length > 0
    ? fullGeometry
    : cleanLocations.map((l) => [l.latitud, l.longitud]);
}
