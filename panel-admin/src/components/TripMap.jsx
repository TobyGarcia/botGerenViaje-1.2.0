import {
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";

import L from "leaflet";
import {
  CircleMarker,
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  Tooltip,
  useMap
} from "react-leaflet";

import {
  calculateBearing,
  calculateDistanceMeters,
  fetchSnappedRoadGeometry
} from "../services/osrm-road-matching.js";

function MapBoundsController({ positions }) {
  const map = useMap();

  useEffect(() => {
    if (!positions.length) return;

    if (positions.length === 1) {
      map.setView(positions[0], 16);
      return;
    }

    map.fitBounds(positions, {
      padding: [45, 45]
    });
  }, [map, positions]);

  return null;
}

function VehicleCameraController({ carPosition, followVehicle }) {
  const map = useMap();
  const lastPanRef = useRef(0);

  useEffect(() => {
    if (!followVehicle || !carPosition) return;

    const now = performance.now();
    // Limitar llamadas para no bloquear la cola de animación de Leaflet
    if (now - lastPanRef.current > 120) {
      lastPanRef.current = now;
      map.panTo(carPosition, { animate: true, duration: 0.15 });
    }
  }, [carPosition, followVehicle, map]);

  return null;
}

function formatDateTime(value) {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Fecha no válida";
  return date.toLocaleString("es-MX", {
    dateStyle: "medium",
    timeStyle: "medium"
  });
}

function lerpAngle(current, target, factor) {
  let diff = (target - current) % 360;
  if (diff < -180) diff += 360;
  if (diff > 180) diff -= 360;
  return (current + diff * factor + 360) % 360;
}

function getInterpolatedState(distMeters, roadGeometry, roadDistances) {
  if (!roadGeometry || roadGeometry.length === 0) {
    return { pos: [0, 0], segmentIdx: 0, nextIdx: 0, fraction: 0 };
  }
  if (roadGeometry.length === 1 || distMeters <= 0) {
    return { pos: roadGeometry[0], segmentIdx: 0, nextIdx: 0, fraction: 0 };
  }
  const total = roadDistances[roadDistances.length - 1] || 1;
  if (distMeters >= total) {
    const lastIdx = roadGeometry.length - 1;
    return { pos: roadGeometry[lastIdx], segmentIdx: lastIdx, nextIdx: lastIdx, fraction: 1 };
  }

  let low = 0;
  let high = roadDistances.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (roadDistances[mid] <= distMeters) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  const i = Math.max(1, Math.min(roadGeometry.length - 1, low));
  const segStart = roadDistances[i - 1];
  const segEnd = roadDistances[i];
  const segDist = Math.max(0.0001, segEnd - segStart);
  const fraction = Math.min(1, Math.max(0, (distMeters - segStart) / segDist));

  const lat = roadGeometry[i - 1][0] + (roadGeometry[i][0] - roadGeometry[i - 1][0]) * fraction;
  const lon = roadGeometry[i - 1][1] + (roadGeometry[i][1] - roadGeometry[i - 1][1]) * fraction;

  return {
    pos: [lat, lon],
    segmentIdx: i - 1,
    nextIdx: i,
    fraction
  };
}

// Icono SVG detallado: Camionetita blanca tipo Pickup (top-down)
function createPickupTruckIcon(bearing = 0, speedKmh = 0, deltaSec = 0) {
  const roundedSpeed = Math.round(Number(speedKmh) || 0);
  const deltaBadge = deltaSec > 0 ? `<span class="car-pill-delta">+${deltaSec}s</span>` : "";

  return L.divIcon({
    className: "custom-car-div-icon",
    iconSize: [48, 48],
    iconAnchor: [24, 24],
    html: `
      <div class="car-marker-container">
        <div class="car-chassis" style="transform: rotate(${Math.round(bearing)}deg);">
          <div class="car-glow-beam"></div>
          <svg viewBox="0 0 32 68" class="car-svg">
            <!-- Ruedas negras -->
            <rect x="0.5" y="10" width="3.5" height="12" rx="1.5" fill="#0f172a" />
            <rect x="28" y="10" width="3.5" height="12" rx="1.5" fill="#0f172a" />
            <rect x="0.5" y="44" width="3.5" height="12" rx="1.5" fill="#0f172a" />
            <rect x="28" y="44" width="3.5" height="12" rx="1.5" fill="#0f172a" />

            <!-- Carrocería blanca de la Camionetita -->
            <rect x="3" y="3" width="26" height="62" rx="5" fill="#ffffff" stroke="#94a3b8" stroke-width="1.6" />

            <!-- Capó delantero blanco con líneas aerodinámicas -->
            <path d="M 5 18 L 5 7 Q 5 4 8 4 L 24 4 Q 27 4 27 7 L 27 18 Z" fill="#f8fafc" />
            <line x1="11" y1="6" x2="11" y2="16" stroke="#e2e8f0" stroke-width="1" />
            <line x1="21" y1="6" x2="21" y2="16" stroke="#e2e8f0" stroke-width="1" />

            <!-- Espejos retrovisores laterales blancos -->
            <rect x="0" y="18" width="3" height="5" rx="1.5" fill="#ffffff" stroke="#64748b" stroke-width="0.8" />
            <rect x="29" y="18" width="3" height="5" rx="1.5" fill="#ffffff" stroke="#64748b" stroke-width="0.8" />

            <!-- Parabrisas delantero oscuro -->
            <path d="M 5.5 19 Q 16 16 26.5 19 L 25 26 Q 16 24 7 26 Z" fill="#1e293b" stroke="#334155" stroke-width="0.6" />

            <!-- Techo blanco de la cabina -->
            <rect x="6" y="26" width="20" height="15" rx="2" fill="#ffffff" />
            <line x1="10" y1="28" x2="10" y2="39" stroke="#e2e8f0" stroke-width="1" />
            <line x1="22" y1="28" x2="22" y2="39" stroke="#e2e8f0" stroke-width="1" />

            <!-- Medallón / Cristal trasero -->
            <path d="M 7 41 Q 16 42 25 41 L 24.5 44 Q 16 45 7.5 44 Z" fill="#0f172a" />

            <!-- BATEA / CAJA TRASERA DE PICKUP -->
            <rect x="5.5" y="45.5" width="21" height="17" rx="2" fill="#334155" stroke="#1e293b" stroke-width="1" />
            <line x1="8" y1="49" x2="24" y2="49" stroke="#475569" stroke-width="1" stroke-linecap="round" />
            <line x1="8" y1="53" x2="24" y2="53" stroke="#475569" stroke-width="1" stroke-linecap="round" />
            <line x1="8" y1="57" x2="24" y2="57" stroke="#475569" stroke-width="1" stroke-linecap="round" />

            <!-- Tapa de batea trasera -->
            <rect x="4.5" y="63" width="23" height="2" rx="1" fill="#e2e8f0" />

            <!-- Faros delanteros LED amarillos -->
            <rect x="5" y="3.5" width="4.5" height="2.5" rx="1" fill="#fef08a" />
            <rect x="22.5" y="3.5" width="4.5" height="2.5" rx="1" fill="#fef08a" />

            <!-- Luces traseras de freno rojas -->
            <rect x="3.5" y="62" width="3" height="3" rx="0.8" fill="#ef4444" />
            <rect x="25.5" y="62" width="3" height="3" rx="0.8" fill="#ef4444" />
          </svg>
        </div>
        <div class="car-telemetry-pill">
          <span class="car-pill-speed">${roundedSpeed} km/h</span>
          ${deltaBadge}
        </div>
      </div>
    `
  });
}

function createNumberedStopIcon(index) {
  return L.divIcon({
    className: "custom-stop-div-icon",
    iconSize: [28, 38],
    iconAnchor: [14, 36],
    popupAnchor: [0, -32],
    html: `
      <div class="stop-badge-marker">
        <div class="stop-badge-pin">
          <span class="stop-badge-number">${index}</span>
        </div>
        <div class="stop-badge-point"></div>
      </div>
    `
  });
}

function TripMap({ locations = [] }) {
  // Modos de visualización:
  // "POINTS": Solo puntos de coordenadas
  // "OSRM": Solo trazado de calles OSRM
  // "BOTH": Puntos de coordenadas y OSRM juntos
  // "ANIMATION": Simulación y recorrido animado fluido
  const [mapMode, setMapMode] = useState("BOTH");

  const validLocations = useMemo(
    () =>
      locations.filter(
        (location) =>
          Number.isFinite(Number(location.latitud)) &&
          Number.isFinite(Number(location.longitud))
      ),
    [locations]
  );

  const rawPositions = useMemo(
    () =>
      validLocations.map((location) => [
        Number(location.latitud),
        Number(location.longitud)
      ]),
    [validLocations]
  );

  // Estado del trazado ajustado a calles con OSRM
  const [roadGeometry, setRoadGeometry] = useState(rawPositions);
  const [isSnappingRoad, setIsSnappingRoad] = useState(false);

  // Distancias acumuladas en metros a lo largo de roadGeometry para interpolación fluida uniforme
  const roadDistances = useMemo(() => {
    if (!roadGeometry || roadGeometry.length < 2) return [0];
    const dists = [0];
    let acc = 0;
    for (let i = 1; i < roadGeometry.length; i++) {
      const d = calculateDistanceMeters(
        roadGeometry[i - 1][0],
        roadGeometry[i - 1][1],
        roadGeometry[i][0],
        roadGeometry[i][1]
      );
      acc += d;
      dists.push(acc);
    }
    return dists;
  }, [roadGeometry]);

  const totalRoadDistance = roadDistances[roadDistances.length - 1] || 1;

  // Estado del motor de animación vehicular (en metros recorridos)
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(2); // 1x, 2x, 5x, 10x
  const [currentDistMeters, setCurrentDistMeters] = useState(0);
  const [followVehicle, setFollowVehicle] = useState(false);

  const currentDistRef = useRef(0);
  const bearingRef = useRef(0);
  const animFrameRef = useRef(null);
  const lastTimeRef = useRef(null);

  // Mantener ref sincronizada con el estado de metros
  useEffect(() => {
    currentDistRef.current = currentDistMeters;
  }, [currentDistMeters]);

  // Ajustar ruta a calles reales con OSRM al cargar ubicaciones
  useEffect(() => {
    if (validLocations.length < 2) {
      setRoadGeometry(rawPositions);
      return;
    }

    let isMounted = true;
    setIsSnappingRoad(true);

    fetchSnappedRoadGeometry(validLocations)
      .then((snapped) => {
        if (isMounted && snapped && snapped.length > 0) {
          setRoadGeometry(snapped);
        }
      })
      .catch((err) => {
        console.warn("[TripMap] No fue posible ajustar a calles, usando trazado directo:", err);
      })
      .finally(() => {
        if (isMounted) setIsSnappingRoad(false);
      });

    return () => {
      isMounted = false;
    };
  }, [validLocations, rawPositions]);

  // Si cambia el viaje o las ubicaciones, reiniciar reproducción
  useEffect(() => {
    setCurrentDistMeters(0);
    currentDistRef.current = 0;
    bearingRef.current = 0;
    setIsPlaying(false);
  }, [validLocations.length]);

  // Bucle de animación suave con requestAnimationFrame y avance uniforme por distancia
  useEffect(() => {
    if (!isPlaying) {
      lastTimeRef.current = null;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }

    if (totalRoadDistance <= 1) return;

    function stepAnimation(timestamp) {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const deltaTime = Math.min((timestamp - lastTimeRef.current) / 1000, 0.1);
      lastTimeRef.current = timestamp;

      // Duración base del recorrido total a 1x (~30s base adaptada al kilometraje)
      const baseDurationSec = Math.min(80, Math.max(22, totalRoadDistance / 40));
      const speedMps = (totalRoadDistance / baseDurationSec) * playbackSpeed;
      const nextDist = currentDistRef.current + speedMps * deltaTime;

      if (nextDist >= totalRoadDistance) {
        currentDistRef.current = totalRoadDistance;
        setCurrentDistMeters(totalRoadDistance);
        setIsPlaying(false);
        return;
      }

      currentDistRef.current = nextDist;
      setCurrentDistMeters(nextDist);

      animFrameRef.current = requestAnimationFrame(stepAnimation);
    }

    animFrameRef.current = requestAnimationFrame(stepAnimation);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, playbackSpeed, totalRoadDistance]);

  // Cálculo interpolado de posición actual y orientación
  const carState = useMemo(() => {
    if (!roadGeometry || roadGeometry.length === 0) {
      return { pos: [0, 0], segmentIdx: 0, nextIdx: 0, fraction: 0 };
    }
    return getInterpolatedState(currentDistMeters, roadGeometry, roadDistances);
  }, [currentDistMeters, roadGeometry, roadDistances]);

  // Rumbo y giro suave (smooth bearing) mirando metros hacia adelante
  const carBearing = useMemo(() => {
    if (!roadGeometry || roadGeometry.length < 2) return 0;
    const lookAheadMeters = Math.min(totalRoadDistance, currentDistMeters + 7);
    const aheadState = getInterpolatedState(lookAheadMeters, roadGeometry, roadDistances);
    if (carState.pos && aheadState.pos) {
      const d = calculateDistanceMeters(
        carState.pos[0],
        carState.pos[1],
        aheadState.pos[0],
        aheadState.pos[1]
      );
      if (d > 0.5) {
        const rawBearing = calculateBearing(
          carState.pos[0],
          carState.pos[1],
          aheadState.pos[0],
          aheadState.pos[1]
        );
        bearingRef.current = lerpAngle(bearingRef.current, rawBearing, 0.25);
      }
    }
    return bearingRef.current;
  }, [currentDistMeters, totalRoadDistance, carState.pos, roadGeometry, roadDistances]);

  // Trazado progresivo recorrido (estela azul brillante)
  const traversedPositions = useMemo(() => {
    if (!roadGeometry || roadGeometry.length === 0) return [];
    if (carState.segmentIdx <= 0 && carState.fraction === 0) {
      return [roadGeometry[0]];
    }
    return [...roadGeometry.slice(0, carState.segmentIdx + 1), carState.pos];
  }, [roadGeometry, carState]);

  // Telemetría dinámica y tiempos
  const progressRatio = totalRoadDistance > 0 ? currentDistMeters / totalRoadDistance : 0;
  const nearestLocIdx = Math.min(
    Math.max(0, validLocations.length - 1),
    Math.round(progressRatio * Math.max(0, validLocations.length - 1))
  );
  const currentLoc = validLocations[nearestLocIdx] || validLocations[0] || {};
  const prevLoc = validLocations[Math.max(0, nearestLocIdx - 1)] || currentLoc;

  let deltaSec = 0;
  if (currentLoc && prevLoc && currentLoc !== prevLoc) {
    const tCurrent = new Date(currentLoc.fechaGps ?? currentLoc.fecha_gps ?? 0).getTime();
    const tPrev = new Date(prevLoc.fechaGps ?? prevLoc.fecha_gps ?? 0).getTime();
    deltaSec = Math.max(0, Math.round((tCurrent - tPrev) / 1000));
  }

  const rawDbSpeed = Number(currentLoc?.velocidad);
  let speedKmh = 0;

  if (Number.isFinite(rawDbSpeed) && rawDbSpeed > 0.5) {
    speedKmh = rawDbSpeed;
  } else {
    const refLoc =
      prevLoc && prevLoc !== currentLoc
        ? prevLoc
        : validLocations[Math.min(validLocations.length - 1, nearestLocIdx + 1)];
    if (refLoc && refLoc !== currentLoc) {
      const tCurrent = new Date(currentLoc.fechaGps ?? currentLoc.fecha_gps ?? 0).getTime();
      const tRef = new Date(refLoc.fechaGps ?? refLoc.fecha_gps ?? 0).getTime();
      const dtSec = Math.abs(Math.round((tCurrent - tRef) / 1000));
      const distM = calculateDistanceMeters(
        Number(refLoc.latitud),
        Number(refLoc.longitud),
        Number(currentLoc.latitud),
        Number(currentLoc.longitud)
      );
      if (dtSec > 0 && distM > 1.5) {
        speedKmh = (distM / dtSec) * 3.6;
      }
    }
  }

  // Tiempos formateados (mm:ss)
  const startMs = validLocations[0]
    ? new Date(validLocations[0].fechaGps ?? validLocations[0].fecha_gps ?? 0).getTime()
    : 0;
  const endMs =
    validLocations.length > 0
      ? new Date(
          validLocations[validLocations.length - 1].fechaGps ??
            validLocations[validLocations.length - 1].fecha_gps ??
            0
        ).getTime()
      : 0;
  const totalTripSec = Math.max(0, Math.floor((endMs - startMs) / 1000));
  const currentTripSec = Math.floor(totalTripSec * progressRatio);

  const formatMinSec = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  // Icono de la camionetita blanca tipo pickup
  const carIcon = useMemo(
    () => createPickupTruckIcon(carBearing, speedKmh, deltaSec),
    [carBearing, speedKmh, deltaSec]
  );

  // Filtrar paradas intermedias
  const intermediateStops = validLocations.filter((loc) =>
    Boolean(loc.esPuntoIntermedio || loc.es_punto_intermedio)
  );

  if (!rawPositions.length) {
    return (
      <div className="map-empty-state">
        Este viaje no tiene coordenadas GPS válidas.
      </div>
    );
  }

  const showPoints = mapMode === "POINTS" || mapMode === "BOTH";
  const showOsrm = mapMode === "OSRM" || mapMode === "BOTH" || mapMode === "ANIMATION";
  const isAnimationMode = mapMode === "ANIMATION";

  return (
    <div className="trip-map-wrapper">
      {/* Dock Flotante de Modos de Vista - UI/UX PRO MAX */}
      <div className="map-pro-dock" role="tablist" aria-label="Modos de visualización del mapa">
        <button
          type="button"
          role="tab"
          aria-selected={mapMode === "POINTS"}
          className={`map-pro-btn ${mapMode === "POINTS" ? "active" : ""}`}
          onClick={() => {
            setIsPlaying(false);
            setMapMode("POINTS");
          }}
          title="Ver únicamente los puntos de coordenadas GPS capturados"
        >
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="pro-btn-icon">
            <circle cx="12" cy="12" r="3" />
            <circle cx="12" cy="12" r="8" />
            <line x1="12" y1="2" x2="12" y2="5" />
            <line x1="12" y1="19" x2="12" y2="22" />
            <line x1="2" y1="12" x2="5" y2="12" />
            <line x1="19" y1="12" x2="22" y2="12" />
          </svg>
          <span>Puntos GPS</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={mapMode === "OSRM"}
          className={`map-pro-btn ${mapMode === "OSRM" ? "active" : ""}`}
          onClick={() => {
            setIsPlaying(false);
            setMapMode("OSRM");
          }}
          title="Ver el trazado de la ruta ajustado a calles reales"
        >
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="pro-btn-icon">
            <path d="M4 19L8 5" />
            <path d="M20 19L16 5" />
            <line x1="12" y1="7" x2="12" y2="9" />
            <line x1="12" y1="13" x2="12" y2="15" />
            <line x1="12" y1="19" x2="12" y2="21" />
          </svg>
          <span>Ruta OSRM</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={mapMode === "BOTH"}
          className={`map-pro-btn ${mapMode === "BOTH" ? "active" : ""}`}
          onClick={() => {
            setIsPlaying(false);
            setMapMode("BOTH");
          }}
          title="Ver trazado de calles y coordenadas GPS combinados"
        >
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="pro-btn-icon">
            <polygon points="12 2 2 7 12 12 22 7 12 2" />
            <polyline points="2 17 12 22 22 17" />
            <polyline points="2 12 12 17 22 12" />
          </svg>
          <span>Puntos + OSRM</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={mapMode === "ANIMATION"}
          className={`map-pro-btn ${mapMode === "ANIMATION" ? "active active-anim" : ""}`}
          onClick={() => setMapMode("ANIMATION")}
          title="Iniciar simulación dinámica y animación del vehículo"
        >
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="pro-btn-icon">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
          <span>Animación</span>
          {isAnimationMode && <span className="pro-btn-pulse-dot"></span>}
        </button>
      </div>

      <MapContainer
        center={rawPositions[0]}
        zoom={15}
        scrollWheelZoom
        className="trip-map"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapBoundsController positions={rawPositions} />
        {isAnimationMode && (
          <VehicleCameraController
            carPosition={carState.pos}
            followVehicle={followVehicle}
          />
        )}

        {/* Polilínea directa de puntos cuando solo se ven coordenadas */}
        {mapMode === "POINTS" && rawPositions.length > 1 && (
          <Polyline
            positions={rawPositions}
            pathOptions={{
              color: "#0284c7",
              weight: 3,
              opacity: 0.75,
              dashArray: "6, 8"
            }}
          />
        )}

        {/* Polilínea OSRM ajustada a calles */}
        {showOsrm && roadGeometry.length > 1 && (
          <Polyline
            positions={roadGeometry}
            pathOptions={{
              color: isAnimationMode ? "#475569" : "#0284c7",
              weight: isAnimationMode ? 5 : 5.5,
              opacity: isAnimationMode ? 0.45 : 0.85,
              lineCap: "round",
              lineJoin: "round"
            }}
          />
        )}

        {/* Polilínea recorrida en animación (estela azul brillante) */}
        {isAnimationMode && traversedPositions.length > 1 && (
          <Polyline
            positions={traversedPositions}
            pathOptions={{
              color: "#06b6d4",
              weight: 6,
              opacity: 0.95,
              lineCap: "round",
              lineJoin: "round"
            }}
          />
        )}

        {/* Camionetita blanca animada (solo en modo Animación) */}
        {isAnimationMode && roadGeometry.length > 0 && (
          <Marker position={carState.pos} icon={carIcon} zIndexOffset={1000} />
        )}

        {/* Marcadores de Inicio y Fin (siempre visibles en OSRM o Animación) */}
        {(mapMode === "OSRM" || isAnimationMode) && !showPoints && (
          <>
            {validLocations[0] && (
              <CircleMarker
                center={[Number(validLocations[0].latitud), Number(validLocations[0].longitud)]}
                radius={8}
                pathOptions={{
                  color: "#16a34a",
                  fillColor: "#22c55e",
                  weight: 2.5,
                  fillOpacity: 1
                }}
              >
                <Popup>
                  <div className="map-popup">
                    <strong style={{ color: "#16a34a" }}>Inicio del recorrido</strong>
                    <span>Fecha: {formatDateTime(validLocations[0].fechaGps ?? validLocations[0].fecha_gps)}</span>
                  </div>
                </Popup>
              </CircleMarker>
            )}

            {validLocations.length > 1 && (
              <CircleMarker
                center={[
                  Number(validLocations[validLocations.length - 1].latitud),
                  Number(validLocations[validLocations.length - 1].longitud)
                ]}
                radius={8}
                pathOptions={{
                  color: "#ea580c",
                  fillColor: "#f97316",
                  weight: 2.5,
                  fillOpacity: 1
                }}
              >
                <Popup>
                  <div className="map-popup">
                    <strong style={{ color: "#ea580c" }}>Destino final</strong>
                    <span>
                      Fecha:{" "}
                      {formatDateTime(
                        validLocations[validLocations.length - 1].fechaGps ??
                          validLocations[validLocations.length - 1].fecha_gps
                      )}
                    </span>
                  </div>
                </Popup>
              </CircleMarker>
            )}
          </>
        )}

        {/* Marcadores de Paradas Intermedias */}
        {intermediateStops.map((location, idx) => (
          <Marker
            key={location.idUbicacion ?? `inter-${idx}`}
            position={[Number(location.latitud), Number(location.longitud)]}
            icon={createNumberedStopIcon(idx + 1)}
          >
            <Tooltip permanent direction="top" offset={[0, -32]} className="custom-intermediate-tooltip">
              <span className="intermediate-tooltip-content">
                <strong>{location.nombrePunto || location.nombre_punto || `Parada #${idx + 1}`}</strong>
              </span>
            </Tooltip>
            <Popup>
              <div className="map-popup">
                <strong style={{ color: "#d97706" }}>
                  Parada #{idx + 1}: {location.nombrePunto || location.nombre_punto || "Punto Intermedio"}
                </strong>
                <span>
                  {Number(location.latitud).toFixed(6)}, {Number(location.longitud).toFixed(6)}
                </span>
                <span>Fecha: {formatDateTime(location.fechaGps ?? location.fecha_gps)}</span>
                <a
                  href={`https://www.google.com/maps?q=${location.latitud},${location.longitud}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Abrir en Google Maps
                </a>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Puntos GPS capturados (cuando showPoints está activo) */}
        {showPoints &&
          validLocations.map((location, index) => {
            const isFirst = index === 0;
            const isLast = index === validLocations.length - 1;
            const isIntermediate = Boolean(
              location.esPuntoIntermedio || location.es_punto_intermedio
            );

            if (isIntermediate) return null; // Ya se renderizan arriba

            return (
              <CircleMarker
                key={location.idUbicacion ?? `loc-${index}`}
                center={[Number(location.latitud), Number(location.longitud)]}
                radius={isFirst || isLast ? 8 : 4.5}
                pathOptions={{
                  color: isFirst ? "#16a34a" : isLast ? "#ea580c" : "#0284c7",
                  fillColor: isFirst ? "#22c55e" : isLast ? "#f97316" : "#38bdf8",
                  weight: 2.5,
                  fillOpacity: isFirst || isLast ? 1 : 0.65
                }}
              >
                <Popup>
                  <div className="map-popup">
                    <strong style={{ color: isFirst ? "#16a34a" : isLast ? "#ea580c" : "#0284c7" }}>
                      {isFirst ? "Inicio del recorrido" : isLast ? "Destino final" : `Hito GPS #${index + 1}`}
                    </strong>
                    <span>
                      {Number(location.latitud).toFixed(6)}, {Number(location.longitud).toFixed(6)}
                    </span>
                    <span>Fecha: {formatDateTime(location.fechaGps ?? location.fecha_gps)}</span>
                    {location.precisionMetros && <span>Precisión: {location.precisionMetros} m</span>}
                    {location.velocidad && <span>Velocidad: {location.velocidad} km/h</span>}
                    <a
                      href={`https://www.google.com/maps?q=${location.latitud},${location.longitud}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Abrir en Google Maps
                    </a>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
      </MapContainer>

      {/* Consola Flotante de Control de Reproducción (Solo en Modo Animación) */}
      {isAnimationMode && (
        <div className="playback-hud-panel">
          <div className="playback-hud-top">
            <div className="playback-controls-group">
              {/* Play / Pausa */}
              <button
                type="button"
                className={`playback-btn-primary ${isPlaying ? "playing" : ""}`}
                onClick={() => {
                  if (!isPlaying && currentDistMeters >= totalRoadDistance) {
                    setCurrentDistMeters(0);
                    currentDistRef.current = 0;
                  }
                  setIsPlaying(!isPlaying);
                }}
                title={isPlaying ? "Pausar simulación" : "Reproducir viaje"}
              >
                {isPlaying ? (
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                    <rect x="6" y="4" width="4" height="16" rx="1" />
                    <rect x="14" y="4" width="4" height="16" rx="1" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                    <polygon points="6 4 20 12 6 20 6 4" />
                  </svg>
                )}
              </button>

              {/* Reiniciar */}
              <button
                type="button"
                className="playback-btn-secondary"
                onClick={() => {
                  setIsPlaying(false);
                  setCurrentDistMeters(0);
                  currentDistRef.current = 0;
                }}
                title="Reiniciar al inicio"
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                  <polygon points="11 12 20 5 20 19 11 12" />
                  <polygon points="4 12 13 5 13 19 4 12" />
                </svg>
              </button>

              {/* Selectores de Velocidad */}
              <div className="playback-speed-selector">
                {[1, 2, 5, 10].map((spd) => (
                  <button
                    key={spd}
                    type="button"
                    className={`speed-pill ${playbackSpeed === spd ? "active" : ""}`}
                    onClick={() => setPlaybackSpeed(spd)}
                  >
                    {spd}x
                  </button>
                ))}
              </div>
            </div>

            {/* Telemetría Instantánea */}
            <div className="playback-telemetry-badge">
              <span className="telemetry-speed-indicator">
                <strong>{Math.round(speedKmh)}</strong> km/h
              </span>
              {deltaSec > 0 && (
                <span className="telemetry-delta-indicator">
                  Tramo: +{deltaSec}s
                </span>
              )}
              {isSnappingRoad && (
                <span className="telemetry-snapping-badge" title="Ajustando con OSRM">
                  Ajustando a calles...
                </span>
              )}
            </div>

            {/* Opción Seguir Cámara */}
            <label className="playback-follow-toggle">
              <input
                type="checkbox"
                checked={followVehicle}
                onChange={(e) => setFollowVehicle(e.target.checked)}
              />
              <span>Seguir camioneta</span>
            </label>
          </div>

          {/* Barra Deslizante de Tiempo */}
          <div className="playback-scrubber-row">
            <span className="playback-time-label current">
              {formatMinSec(currentTripSec)}
            </span>
            <input
              type="range"
              min="0"
              max={totalRoadDistance}
              step="0.5"
              value={currentDistMeters}
              onChange={(e) => {
                setIsPlaying(false);
                const val = Number(e.target.value);
                currentDistRef.current = val;
                setCurrentDistMeters(val);
              }}
              className="playback-scrubber-slider"
            />
            <span className="playback-time-label total">
              {formatMinSec(totalTripSec)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default TripMap;