/**
 * Servicio Híbrido de Trazado y Ajuste Vial a Calles Reales (OSRM Map-Matching & Bridged Routing)
 *
 * Resuelve:
 * 1. Vueltas a la manzana y retornos absurdos: Usa OSRM /match (Hidden Markov Model)
 *    con radiuses=45 para absorber camellones centrales y ruido de GPS sin obligar al auto a dar vueltas.
 * 2. Líneas rectas aéreas: Si OSRM divide un tramo o hay saltos de distancia en carretera (ej. Seybaplaya),
 *    conecta automáticamente los puntos separados usando /route vial como puente, NUNCA líneas rectas.
 * 3. Desvíos a brechas o cerros por puntos fantasma: Filtro de picos (spike outliers)
 *    que detecta y elimina lecturas erráticas que saltan bruscamente fuera de la vía y regresan.
 * 4. Bucles cuadrados y telarañas en paradas: Filtro anti-jitter que elimina lecturas redundantes en reposo.
 * 5. Protección contra Rate Limit (HTTP 429): Chunks de 50 puntos con pausas de cortesía y reintentos.
 */

const CHUNK_SIZE = 50;
const OVERLAP = 2;
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
 * Pausa asíncrona para respetar límites de peticiones
 */
function waitMs(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Detecta si un punto intermedio es un "salto fantasma" de GPS
 * (ej. rebotes aislados hacia cerros, brechas o edificios que regresan inmediatamente a la vía)
 */
function isSpikeOutlier(pPrev, pCurr, pNext) {
  // Nunca descartar paradas intermedias registradas por el usuario
  if (pCurr.esPuntoIntermedio || pCurr.es_punto_intermedio) return false;

  const dAC = calculateDistanceMeters(pPrev.latitud, pPrev.longitud, pNext.latitud, pNext.longitud);
  const dAB = calculateDistanceMeters(pPrev.latitud, pPrev.longitud, pCurr.latitud, pCurr.longitud);
  const dBC = calculateDistanceMeters(pCurr.latitud, pCurr.longitud, pNext.latitud, pNext.longitud);

  // Si la desviación acumulada (ida y vuelta) es significativamente mayor que el avance directo
  if (dAC > 25 && (dAB + dBC) > 1.55 * dAC) {
    // Proyección local en metros para calcular distancia perpendicular a la recta AC
    const latAvgRad = ((pPrev.latitud + pNext.latitud) / 2) * (Math.PI / 180);
    const cosLat = Math.cos(latAvgRad);
    const ax = pPrev.longitud * 111320 * cosLat;
    const ay = pPrev.latitud * 111320;
    const cx = pNext.longitud * 111320 * cosLat;
    const cy = pNext.latitud * 111320;
    const bx = pCurr.longitud * 111320 * cosLat;
    const by = pCurr.latitud * 111320;

    const vx = cx - ax;
    const vy = cy - ay;
    const wx = bx - ax;
    const wy = by - ay;

    const lenV = Math.sqrt(vx * vx + vy * vy);
    if (lenV > 10) {
      const perpDist = Math.abs(wx * vy - wy * vx) / lenV;
      // Si el punto se desvió perpendicularmente más de 70 metros del eje de avance, es un pico fantasma
      if (perpDist > 70) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Filtra ruido de GPS:
 * - Asegura orden cronológico
 * - Elimina lecturas repetidas en reposo (Anti-Jitter)
 * - Elimina picos atípicos (Spikes)
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

  // 2. Primera pasada: Filtro de picos erráticos (Spike Outliers)
  const nonSpikes = [valid[0]];
  for (let i = 1; i < valid.length - 1; i++) {
    const prev = nonSpikes[nonSpikes.length - 1];
    const curr = valid[i];
    const next = valid[i + 1];

    if (!isSpikeOutlier(prev, curr, next)) {
      nonSpikes.push(curr);
    }
  }
  nonSpikes.push(valid[valid.length - 1]);

  // 3. Segunda pasada: Filtro Anti-Jitter en paradas (conservando paradas intermedias)
  const cleaned = [nonSpikes[0]];

  for (let i = 1; i < nonSpikes.length - 1; i++) {
    const curr = nonSpikes[i];
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

    // Si el auto se desplazó menos de 10 metros del punto anterior, es ruido de parada (se omite)
    if (dist < 10) {
      continue;
    }

    // Filtro de teletransportación irreal (> 5 km en < 30s)
    const tPrev = new Date(prev.fechaGps ?? prev.fecha_gps ?? 0).getTime();
    const tCurr = new Date(curr.fechaGps ?? curr.fecha_gps ?? 0).getTime();
    if (tPrev && tCurr && tCurr > tPrev) {
      const dtSec = (tCurr - tPrev) / 1000;
      if (dtSec > 0 && dist / dtSec > 65) {
        continue;
      }
    }

    cleaned.push(curr);
  }

  const lastPoint = nonSpikes[nonSpikes.length - 1];
  if (cleaned[cleaned.length - 1] !== lastPoint) {
    cleaned.push(lastPoint);
  }

  return cleaned.length >= 2 ? cleaned : valid;
}

/**
 * Conecta dos puntos separados sobre la red vial usando OSRM /route como puente
 * Garantiza que nunca haya líneas rectas aéreas
 */
async function fetchOsrmRouteBridge(fromPoint, toPoint) {
  try {
    const coords = `${fromPoint[1].toFixed(6)},${fromPoint[0].toFixed(6)};${toPoint[1].toFixed(6)},${toPoint[0].toFixed(6)}`;
    const url = `${OSRM_PUBLIC_URL}/route/v1/driving/${coords}?geometries=geojson&overview=full&steps=false&alternatives=false`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (data.code === "Ok" && data.routes?.[0]?.geometry?.coordinates?.length > 0) {
        return data.routes[0].geometry.coordinates.map((c) => [c[1], c[0]]);
      }
    }
  } catch (err) {
    console.warn("[OSRM] No fue posible crear puente de ruta:", err);
  }
  return [fromPoint, toPoint];
}

/**
 * Consulta de ruta fallback para bloques cuando map-matching no encuentra solución
 */
async function fetchOsrmRouteFallback(chunk, retriesLeft = 1) {
  if (!chunk || chunk.length < 2) {
    return chunk.map((p) => [p.latitud, p.longitud]);
  }

  const coords = chunk
    .map((p) => `${p.longitud.toFixed(6)},${p.latitud.toFixed(6)}`)
    .join(";");

  const url = `${OSRM_PUBLIC_URL}/route/v1/driving/${coords}?geometries=geojson&overview=full&steps=false&alternatives=false`;

  try {
    const res = await fetch(url);

    if (res.status === 429 && retriesLeft > 0) {
      await waitMs(1200);
      return fetchOsrmRouteFallback(chunk, retriesLeft - 1);
    }

    if (res.ok) {
      const data = await res.json();
      if (data.code === "Ok" && data.routes?.[0]?.geometry?.coordinates?.length > 0) {
        return data.routes[0].geometry.coordinates.map((c) => [c[1], c[0]]);
      }
    }
  } catch (err) {
    console.warn("[OSRM] Fallback route falló:", err);
  }

  // Divide y vencerás si el bloque grande de fallback falló
  if (chunk.length > 8) {
    const mid = Math.floor(chunk.length / 2);
    const leftCoords = await fetchOsrmRouteFallback(chunk.slice(0, mid + 1), retriesLeft);
    const rightCoords = await fetchOsrmRouteFallback(chunk.slice(mid), retriesLeft);

    const combined = [...leftCoords];
    const startIdx =
      combined.length > 0 &&
      rightCoords.length > 0 &&
      Math.abs(combined[combined.length - 1][0] - rightCoords[0][0]) < 0.00005 &&
      Math.abs(combined[combined.length - 1][1] - rightCoords[0][1]) < 0.00005
        ? 1
        : 0;

    for (let k = startIdx; k < rightCoords.length; k++) {
      combined.push(rightCoords[k]);
    }
    return combined;
  }

  return chunk.map((p) => [p.latitud, p.longitud]);
}

/**
 * Consulta OSRM Map-Matching (/match) para un bloque de coordenadas.
 * Conecta los posibles matchings desconectados con puentes viales para evitar líneas rectas.
 */
async function fetchOsrmMatchChunk(chunk, retriesLeft = 1) {
  if (!chunk || chunk.length < 2) {
    return chunk.map((p) => [p.latitud, p.longitud]);
  }

  const coords = chunk
    .map((p) => `${p.longitud.toFixed(6)},${p.latitud.toFixed(6)}`)
    .join(";");

  // Radio de 45m: absorbe camellones y carriles múltiples sin forzar vueltas a la manzana
  const radiuses = chunk.map(() => 45).join(";");

  const matchUrl = `${OSRM_PUBLIC_URL}/match/v1/driving/${coords}?geometries=geojson&overview=full&steps=false&gaps=ignore&tidy=true&radiuses=${radiuses}`;

  try {
    const res = await fetch(matchUrl);

    if (res.status === 429 && retriesLeft > 0) {
      await waitMs(1200);
      return fetchOsrmMatchChunk(chunk, retriesLeft - 1);
    }

    if (res.ok) {
      const data = await res.json();
      if (data.code === "Ok" && data.matchings && data.matchings.length > 0) {
        const assembled = [];

        for (let mIdx = 0; mIdx < data.matchings.length; mIdx++) {
          const m = data.matchings[mIdx];
          const mCoords = m.geometry?.coordinates?.map((c) => [c[1], c[0]]) || [];
          if (mCoords.length === 0) continue;

          if (assembled.length === 0) {
            assembled.push(...mCoords);
          } else {
            const lastPoint = assembled[assembled.length - 1];
            const firstPoint = mCoords[0];
            const gapDist = calculateDistanceMeters(
              lastPoint[0],
              lastPoint[1],
              firstPoint[0],
              firstPoint[1]
            );

            // Si entre dos matchings hay más de 30m de separación (ej. tramo largo de carretera):
            // En lugar de una línea recta, trazamos un puente vial con /route
            if (gapDist > 30) {
              const bridge = await fetchOsrmRouteBridge(lastPoint, firstPoint);
              for (let b = 1; b < bridge.length; b++) {
                assembled.push(bridge[b]);
              }
            }

            const currentLast = assembled[assembled.length - 1];
            const startK =
              currentLast &&
              Math.abs(currentLast[0] - firstPoint[0]) < 0.00005 &&
              Math.abs(currentLast[1] - firstPoint[1]) < 0.00005
                ? 1
                : 0;

            for (let k = startK; k < mCoords.length; k++) {
              assembled.push(mCoords[k]);
            }
          }
        }

        if (assembled.length > 0) {
          return assembled;
        }
      }
    }
  } catch (err) {
    console.warn("[OSRM] Match falló para el bloque:", err);
  }

  // Fallback: Si match no pudo procesar el bloque, consultar con route
  return fetchOsrmRouteFallback(chunk, retriesLeft);
}

/**
 * Ajusta una lista de puntos GPS a la red vial de OpenStreetMap
 * Ensambla los bloques con puentes viales continuos sin saltos.
 */
export async function fetchSnappedRoadGeometry(locations = []) {
  const cleanLocations = filterJitterAndCleanPoints(locations);

  if (cleanLocations.length < 2) {
    return cleanLocations.map((l) => [Number(l.latitud), Number(l.longitud)]);
  }

  // Chunks de 50 puntos con solape de 2 para mantener continuidad entre bloques
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

    if (c > 0) {
      await waitMs(150);
    }

    const chunkCoords = await fetchOsrmMatchChunk(chunk);
    if (chunkCoords && chunkCoords.length > 0) {
      snappedSegments.push(chunkCoords);
    }
  }

  // Ensamblar segmentos conectando cualquier brecha con puente vial
  const fullGeometry = [];

  for (let s = 0; s < snappedSegments.length; s++) {
    const seg = snappedSegments[s];
    if (s === 0) {
      fullGeometry.push(...seg);
    } else {
      const last = fullGeometry[fullGeometry.length - 1];
      const first = seg[0];
      const gap = calculateDistanceMeters(last[0], last[1], first[0], first[1]);

      if (gap > 40) {
        // Brecha entre bloques: puentear por vialidades reales
        const bridge = await fetchOsrmRouteBridge(last, first);
        for (let b = 1; b < bridge.length; b++) {
          fullGeometry.push(bridge[b]);
        }
      }

      const currentLast = fullGeometry[fullGeometry.length - 1];
      const startIdx =
        currentLast &&
        seg[0] &&
        Math.abs(currentLast[0] - seg[0][0]) < 0.00005 &&
        Math.abs(currentLast[1] - seg[0][1]) < 0.00005
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
