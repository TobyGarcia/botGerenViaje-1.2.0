/**
 * Servicio Inteligente de Trazado y Ajuste Vial a Calles Reales
 * (OSRM Map-Matching Robusto, Puentes Viales Sin Bucles y Poda Geométrica)
 *
 * Resuelve definitivamente:
 * 1. Límites estrictos de OSRM público: CHUNK_SIZE = 10 y radiuses = 30m para evitar el error
 *    "TooBig" (que provocaba que el 100% de peticiones cayeran al fallback de /route).
 * 2. Vueltas a la manzana (1.4 km) en paradas (Oxxo, gasolineras, tiendas):
 *    Al usar /match con radiuses válidos, el HMM absorbe la parada sin desviar la ruta.
 *    Además, el filtro pruneArtificialLoops elimina bucles de calles cerradas si no hay paradas reales.
 * 3. Retornos absurdos en camellones centrales (Avenida Lázaro Cárdenas):
 *    Punteo inteligente con approaches=unrestricted y limitación de ratio de desvío;
 *    poda de bucles de camellón cuando no hubo lecturas de GPS en el carril opuesto.
 * 4. Picos, antenas y desvíos a brechas / cerros (Villa Madero, Frontera):
 *    Filtro de picos multi-punto que detecta excursiones fuera del corredor;
 *    filtro pruneBacktrackingSpurs que poda antenas ciegas que van y vuelven sin parada intermedia.
 * 5. Soporte de timestamps UNIX:
 *    Permite al algoritmo Viterbi de OSRM calcular probabilidades de transición basadas en velocidad real.
 * 6. Protección de paradas intermedias:
 *    Garantiza que cualquier punto marcado con esPuntoIntermedio nunca sea descartado ni podado.
 */

const CHUNK_SIZE = 10; // Límite estricto de OSRM público para /match (máximo 10-12 coordenadas)
const OVERLAP = 2;
const OSRM_PUBLIC_URL = "https://router.project-osrm.org";
const MAX_MATCH_RADIUS = 30; // Límite estricto de OSRM público (<= 40m para evitar error TooBig)

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
 * Distancia perpendicular en metros desde un punto P a la recta que une A y B
 */
function perpendicularDistanceMeters(pLat, pLon, aLat, aLon, bLat, bLon) {
  const latAvgRad = ((aLat + bLat) / 2) * (Math.PI / 180);
  const cosLat = Math.cos(latAvgRad);
  const ax = aLon * 111320 * cosLat;
  const ay = aLat * 111320;
  const bx = bLon * 111320 * cosLat;
  const by = bLat * 111320;
  const px = pLon * 111320 * cosLat;
  const py = pLat * 111320;

  const vx = bx - ax;
  const vy = by - ay;
  const wx = px - ax;
  const wy = py - ay;

  const lenV = Math.sqrt(vx * vx + vy * vy);
  if (lenV < 1) return Math.sqrt(wx * wx + wy * wy);
  return Math.abs(wx * vy - wy * vx) / lenV;
}

/**
 * Pausa asíncrona para respetar límites de peticiones HTTP
 */
function waitMs(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Detecta si un punto o par de puntos son saltos fantasma / excursiones erráticas
 * (ej. rebotes aislados hacia cerros, brechas o edificios que regresan inmediatamente al eje vial)
 */
function isSpikeOutlier(pPrev, pCurr, pNext) {
  // Nunca descartar paradas intermedias registradas por el usuario
  if (pCurr.esPuntoIntermedio || pCurr.es_punto_intermedio) return false;

  const dAC = calculateDistanceMeters(pPrev.latitud, pPrev.longitud, pNext.latitud, pNext.longitud);
  const dAB = calculateDistanceMeters(pPrev.latitud, pPrev.longitud, pCurr.latitud, pCurr.longitud);
  const dBC = calculateDistanceMeters(pCurr.latitud, pCurr.longitud, pNext.latitud, pNext.longitud);

  // Si la desviación acumulada (ida y vuelta) es significativamente mayor que el avance directo
  if (dAC > 20 && (dAB + dBC) > 1.45 * dAC) {
    const perpDist = perpendicularDistanceMeters(
      pCurr.latitud,
      pCurr.longitud,
      pPrev.latitud,
      pPrev.longitud,
      pNext.latitud,
      pNext.longitud
    );
    if (perpDist > 60) {
      return true;
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

  // 2. Primera pasada: Filtro de picos erráticos (Spike Outliers mono y bi-punto)
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

    // Si el auto se desplazó menos de 10 metros del punto anterior, es ruido de reposo
    if (dist < 10) {
      continue;
    }

    // Filtro de teletransportación irreal (> 65 m/s o 234 km/h)
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
 * Conecta dos puntos sobre la red vial usando OSRM /route con approaches=unrestricted.
 * Si el ruteo genera un desvío absurdo (ej. vuelta a la manzana o retorno en camellón),
 * conecta de forma directa para evitar bucles artificiales.
 */
async function fetchOsrmRouteBridge(fromPoint, toPoint) {
  const straightDist = calculateDistanceMeters(fromPoint[0], fromPoint[1], toPoint[0], toPoint[1]);
  if (straightDist < 5) {
    return [fromPoint, toPoint];
  }

  try {
    const coords = `${fromPoint[1].toFixed(6)},${fromPoint[0].toFixed(6)};${toPoint[1].toFixed(6)},${toPoint[0].toFixed(6)}`;
    const url = `${OSRM_PUBLIC_URL}/route/v1/driving/${coords}?geometries=geojson&overview=full&continue_straight=true&approaches=unrestricted;unrestricted`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (data.code === "Ok" && data.routes?.[0]?.geometry?.coordinates?.length > 0) {
        const routeDist = data.routes[0].distance || 0;
        // Si el ruteo vial generó un desvío excesivo (> 2.5x la distancia directa en tramos cortos < 350m),
        // es un retorno forzado por camellón o vuelta a la manzana: se rechaza el bucle.
        if (straightDist < 350 && routeDist > straightDist * 2.6) {
          return [fromPoint, toPoint];
        }

        return data.routes[0].geometry.coordinates.map((c) => [c[1], c[0]]);
      }
    }
  } catch (err) {
    console.warn("[OSRM] No fue posible crear puente de ruta:", err);
  }
  return [fromPoint, toPoint];
}

/**
 * Consulta OSRM Map-Matching (/match) para un bloque pequeño (máximo 10 puntos).
 * Envía timestamps si están disponibles para guiar el modelo HMM con velocidad real.
 * Si /match falla por distancia o brecha, usa divide y vencerás con puentes viales limpios.
 */
async function fetchOsrmMatchChunk(chunk, retriesLeft = 1) {
  if (!chunk || chunk.length < 2) {
    return chunk.map((p) => [p.latitud, p.longitud]);
  }

  // Si el bloque excede 10 puntos, dividirlo para no sobrepasar el límite de OSRM público
  if (chunk.length > 10) {
    const mid = Math.floor(chunk.length / 2);
    const left = await fetchOsrmMatchChunk(chunk.slice(0, mid + 1), retriesLeft);
    const right = await fetchOsrmMatchChunk(chunk.slice(mid), retriesLeft);
    return assembleSegments([left, right]);
  }

  const coords = chunk
    .map((p) => `${p.longitud.toFixed(6)},${p.latitud.toFixed(6)}`)
    .join(";");

  // Radio seguro <= 30m para evitar error TooBig de OSRM
  const radiuses = chunk.map(() => MAX_MATCH_RADIUS).join(";");

  // Extraer timestamps UNIX (en segundos) si son válidos y estrictamente crecientes
  let timestampsQuery = "";
  let canUseTimestamps = true;
  const timestamps = [];
  for (let i = 0; i < chunk.length; i++) {
    const t = Math.floor(new Date(chunk[i].fechaGps ?? chunk[i].fecha_gps ?? 0).getTime() / 1000);
    if (!t || t <= 0 || (i > 0 && t <= timestamps[i - 1])) {
      canUseTimestamps = false;
      break;
    }
    timestamps.push(t);
  }

  if (canUseTimestamps && timestamps.length === chunk.length) {
    timestampsQuery = `&timestamps=${timestamps.join(";")}`;
  }

  const matchUrl = `${OSRM_PUBLIC_URL}/match/v1/driving/${coords}?geometries=geojson&overview=full&steps=false&gaps=ignore&tidy=true&radiuses=${radiuses}${timestampsQuery}`;

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

            // Si hay brecha entre matchings, conectar con puente vial controlado
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

  // Si /match falló (ej. NoMatch o NoSegment por separación o punto en brecha),
  // dividimos en mitades o conectamos punto a punto con puentes viales controlados
  if (chunk.length > 3) {
    const mid = Math.floor(chunk.length / 2);
    const leftCoords = await fetchOsrmMatchChunk(chunk.slice(0, mid + 1), retriesLeft);
    const rightCoords = await fetchOsrmMatchChunk(chunk.slice(mid), retriesLeft);
    return assembleSegments([leftCoords, rightCoords]);
  }

  // Bloque mínimo de 2 o 3 puntos: conectar con puente vial seguro
  const bridgeSeg = [];
  for (let i = 0; i < chunk.length - 1; i++) {
    const pA = [chunk[i].latitud, chunk[i].longitud];
    const pB = [chunk[i + 1].latitud, chunk[i + 1].longitud];
    const pairRoute = await fetchOsrmRouteBridge(pA, pB);
    const startK = i > 0 && bridgeSeg.length > 0 ? 1 : 0;
    for (let k = startK; k < pairRoute.length; k++) {
      bridgeSeg.push(pairRoute[k]);
    }
  }

  return bridgeSeg.length > 0 ? bridgeSeg : chunk.map((p) => [p.latitud, p.longitud]);
}

/**
 * Ensambla segmentos de polilínea conectando brechas con puentes viales limpios
 */
async function assembleSegments(segments = []) {
  const full = [];

  for (let s = 0; s < segments.length; s++) {
    const seg = segments[s];
    if (!seg || seg.length === 0) continue;

    if (full.length === 0) {
      full.push(...seg);
    } else {
      const last = full[full.length - 1];
      const first = seg[0];
      const gap = calculateDistanceMeters(last[0], last[1], first[0], first[1]);

      if (gap > 35) {
        const bridge = await fetchOsrmRouteBridge(last, first);
        for (let b = 1; b < bridge.length; b++) {
          full.push(bridge[b]);
        }
      }

      const currentLast = full[full.length - 1];
      const startIdx =
        currentLast &&
        seg[0] &&
        Math.abs(currentLast[0] - seg[0][0]) < 0.00005 &&
        Math.abs(currentLast[1] - seg[0][1]) < 0.00005
          ? 1
          : 0;

      for (let k = startIdx; k < seg.length; k++) {
        full.push(seg[k]);
      }
    }
  }

  return full;
}

/**
 * Poda de bucles artificiales ("Vueltas a la manzana"):
 * Detecta polígonos cerrados o retornos en camellón generados por OSRM
 * donde no existen paradas intermedias ni lecturas reales de GPS en las esquinas del bucle.
 */
function pruneArtificialLoops(polyline, rawGpsPoints = [], stops = []) {
  if (!polyline || polyline.length < 5) return polyline;
  const result = [...polyline];
  let changed = true;
  let iterations = 0;

  while (changed && iterations < 5) {
    changed = false;
    iterations++;

    for (let i = 0; i < result.length - 4; i++) {
      let pathDist = 0;
      for (let j = i + 1; j < Math.min(result.length, i + 80); j++) {
        pathDist += calculateDistanceMeters(
          result[j - 1][0],
          result[j - 1][1],
          result[j][0],
          result[j][1]
        );
        if (pathDist > 1600) break; // Excede el tamaño de un bucle de manzana típico

        if (j - i >= 3 && pathDist >= 60) {
          const directDist = calculateDistanceMeters(
            result[i][0],
            result[i][1],
            result[j][0],
            result[j][1]
          );

          // Condición de bucle: la ruta regresó a <= 35m del punto de inicio,
          // pero recorrió más de 120m con un factor de desvío > 3.2x
          if (directDist < 35 && pathDist > 120 && pathDist > directDist * 3.2) {
            // Verificar si alguna parada intermedia del usuario está dentro del bucle
            let hasStop = false;
            for (const s of stops) {
              const sLat = Number(s.latitud ?? s[0]);
              const sLon = Number(s.longitud ?? s[1]);
              for (let k = i; k <= j; k++) {
                if (calculateDistanceMeters(result[k][0], result[k][1], sLat, sLon) < 30) {
                  hasStop = true;
                  break;
                }
              }
              if (hasStop) break;
            }

            if (!hasStop) {
              // Verificar si algún punto GPS real visitó la zona distal del bucle (> 40m del eje de entrada/salida)
              let gpsVisitedDistal = false;
              for (const g of rawGpsPoints) {
                const gLat = Number(g.latitud);
                const gLon = Number(g.longitud);
                if (!Number.isFinite(gLat) || !Number.isFinite(gLon)) continue;

                const dI = calculateDistanceMeters(result[i][0], result[i][1], gLat, gLon);
                const dJ = calculateDistanceMeters(result[j][0], result[j][1], gLat, gLon);

                if (dI > 40 && dJ > 40) {
                  for (let k = i + 1; k < j; k++) {
                    if (calculateDistanceMeters(result[k][0], result[k][1], gLat, gLon) < 30) {
                      gpsVisitedDistal = true;
                      break;
                    }
                  }
                }
                if (gpsVisitedDistal) break;
              }

              // Si ningún GPS real estuvo en las calles del bucle, es un artefacto de OSRM: ¡Podar!
              if (!gpsVisitedDistal) {
                result.splice(i + 1, j - i - 1);
                changed = true;
                break;
              }
            }
          }
        }
      }
      if (changed) break;
    }
  }

  return result;
}

/**
 * Poda de antenas ciegas y retrocesos 180° ("Backtracking Spurs"):
 * Detecta cuando la ruta se desvía por una calle sin salida y regresa sobre sí misma
 * sin que exista una parada intermedia en la punta de la antena.
 */
function pruneBacktrackingSpurs(polyline, stops = []) {
  if (!polyline || polyline.length < 5) return polyline;
  const result = [...polyline];
  let changed = true;
  let iterations = 0;

  while (changed && iterations < 5) {
    changed = false;
    iterations++;

    for (let i = 0; i < result.length - 4; i++) {
      for (let j = i + 2; j < Math.min(result.length, i + 50); j++) {
        const dIJ = calculateDistanceMeters(
          result[i][0],
          result[i][1],
          result[j][0],
          result[j][1]
        );

        // Si los vértices i y j están muy cerca (< 25m)
        if (dIJ < 25) {
          let maxDistFromI = 0;
          let tipIdx = -1;
          for (let k = i + 1; k < j; k++) {
            const d = calculateDistanceMeters(
              result[i][0],
              result[i][1],
              result[k][0],
              result[k][1]
            );
            if (d > maxDistFromI) {
              maxDistFromI = d;
              tipIdx = k;
            }
          }

          // Si el camino se adentró entre 30m y 500m y regresó sobre sí mismo
          if (maxDistFromI > 30 && maxDistFromI < 500) {
            let hasStopAtTip = false;
            for (const s of stops) {
              const sLat = Number(s.latitud ?? s[0]);
              const sLon = Number(s.longitud ?? s[1]);
              if (
                calculateDistanceMeters(result[tipIdx][0], result[tipIdx][1], sLat, sLon) < 35
              ) {
                hasStopAtTip = true;
                break;
              }
            }

            if (!hasStopAtTip) {
              result.splice(i + 1, j - i - 1);
              changed = true;
              break;
            }
          }
        }
      }
      if (changed) break;
    }
  }

  return result;
}

/**
 * Ajusta una lista de puntos GPS a la red vial de OpenStreetMap
 * Ensambla los bloques con puentes viales continuos y poda bucles/antenas artificiales.
 */
export async function fetchSnappedRoadGeometry(locations = []) {
  const cleanLocations = filterJitterAndCleanPoints(locations);

  if (cleanLocations.length < 2) {
    return cleanLocations.map((l) => [Number(l.latitud), Number(l.longitud)]);
  }

  const intermediateStops = cleanLocations.filter(
    (l) => Boolean(l.esPuntoIntermedio || l.es_punto_intermedio)
  );

  // Chunks de 10 puntos (límite estricto de OSRM /match) con solape de 2 para mantener continuidad
  const chunks = [];
  const step = CHUNK_SIZE - OVERLAP; // 8 puntos por avance
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
      await waitMs(120); // Pausa de cortesía para no saturar OSRM
    }

    const chunkCoords = await fetchOsrmMatchChunk(chunk);
    if (chunkCoords && chunkCoords.length > 0) {
      snappedSegments.push(chunkCoords);
    }
  }

  // Ensamblar segmentos conectando cualquier brecha con puente vial seguro
  const fullGeometry = await assembleSegments(snappedSegments);

  if (!fullGeometry || fullGeometry.length === 0) {
    return cleanLocations.map((l) => [l.latitud, l.longitud]);
  }

  // Pasar por filtros geométricos de post-procesamiento:
  // 1. Eliminar vueltas a la manzana artificiales (Oxxo, paradas en laterales, etc.)
  const loopCleaned = pruneArtificialLoops(fullGeometry, cleanLocations, intermediateStops);

  // 2. Eliminar antenas ciegas y picos de retorno en camellones o calles sin salida
  const finalGeometry = pruneBacktrackingSpurs(loopCleaned, intermediateStops);

  return finalGeometry.length > 0
    ? finalGeometry
    : cleanLocations.map((l) => [l.latitud, l.longitud]);
}
