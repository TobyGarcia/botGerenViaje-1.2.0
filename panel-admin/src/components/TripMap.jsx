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

  useEffect(() => {
    if (followVehicle && carPosition) {
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

function createCarIcon(bearing = 0, speedKmh = 0, deltaSec = 0) {
  const roundedSpeed = Math.round(Number(speedKmh) || 0);
  const deltaBadge = deltaSec > 0 ? `<span class="car-pill-delta">+${deltaSec}s</span>` : "";

  return L.divIcon({
    className: "custom-car-div-icon",
    iconSize: [46, 46],
    iconAnchor: [23, 23],
    html: `
      <div class="car-marker-container">
        <div class="car-chassis" style="transform: rotate(${Math.round(bearing)}deg);">
          <div class="car-glow-beam"></div>
          <svg viewBox="0 0 28 54" class="car-svg">
            <!-- Ruedas -->
            <rect x="0" y="7" width="4" height="10" rx="2" fill="#090d16" />
            <rect x="24" y="7" width="4" height="10" rx="2" fill="#090d16" />
            <rect x="0" y="37" width="4" height="10" rx="2" fill="#090d16" />
            <rect x="24" y="37" width="4" height="10" rx="2" fill="#090d16" />
            <!-- Chasis -->
            <rect x="3" y="3" width="22" height="48" rx="6" fill="#0284c7" stroke="#38bdf8" stroke-width="1.8" />
            <!-- Parabrisas delantero -->
            <path d="M 5 16 Q 14 13 23 16 L 21 23 Q 14 20 7 23 Z" fill="#0f172a" />
            <!-- Techo -->
            <rect x="6.5" y="23" width="15" height="15" rx="3" fill="#0369a1" />
            <!-- Cristal trasero -->
            <path d="M 7 39 Q 14 41 21 39 L 20 44 Q 14 46 8 44 Z" fill="#0f172a" />
            <!-- Luces delanteras (faros) -->
            <circle cx="6" cy="5" r="2.2" fill="#fef08a" />
            <circle cx="22" cy="5" r="2.2" fill="#fef08a" />
            <!-- Luces traseras de freno -->
            <circle cx="6.5" cy="49" r="1.6" fill="#ef4444" />
            <circle cx="21.5" cy="49" r="1.6" fill="#ef4444" />
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

  // Estado del motor de animación vehicular
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(2); // 1x, 2x, 5x, 10x
  const [progressIndex, setProgressIndex] = useState(0); // Posición fraccional a lo largo de roadGeometry
  const [followVehicle, setFollowVehicle] = useState(false);
  const animFrameRef = useRef(null);
  const lastTimeRef = useRef(null);

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

  // Si cambia el total de puntos o el viaje, reiniciar posición de reproducción
  useEffect(() => {
    setProgressIndex(0);
    setIsPlaying(false);
  }, [validLocations.length]);

  // Loop de animación con requestAnimationFrame
  useEffect(() => {
    if (!isPlaying) {
      lastTimeRef.current = null;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }

    const maxIndex = Math.max(0, roadGeometry.length - 1);
    if (maxIndex === 0) return;

    function stepAnimation(timestamp) {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const deltaTime = (timestamp - lastTimeRef.current) / 1000;
      lastTimeRef.current = timestamp;

      // Velocidad base de avance: ~1.8 puntos por segundo a 1x
      const pointsPerSecond = 2.2 * playbackSpeed;
      const deltaIndex = pointsPerSecond * deltaTime;

      setProgressIndex((prev) => {
        const next = prev + deltaIndex;
        if (next >= maxIndex) {
          setIsPlaying(false);
          return maxIndex;
        }
        return next;
      });

      animFrameRef.current = requestAnimationFrame(stepAnimation);
    }

    animFrameRef.current = requestAnimationFrame(stepAnimation);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, playbackSpeed, roadGeometry.length]);

  // Coordenadas actuales del vehículo animado (interpolación lineal entre puntos)
  const maxRoadIdx = Math.max(0, roadGeometry.length - 1);
  const clampedProgress = Math.min(Math.max(0, progressIndex), maxRoadIdx);
  const baseIdx = Math.floor(clampedProgress);
  const nextIdx = Math.min(baseIdx + 1, maxRoadIdx);
  const fraction = clampedProgress - baseIdx;

  const currentLat =
    roadGeometry[baseIdx] && roadGeometry[nextIdx]
      ? roadGeometry[baseIdx][0] + (roadGeometry[nextIdx][0] - roadGeometry[baseIdx][0]) * fraction
      : rawPositions[0]?.[0] || 0;
  const currentLon =
    roadGeometry[baseIdx] && roadGeometry[nextIdx]
      ? roadGeometry[baseIdx][1] + (roadGeometry[nextIdx][1] - roadGeometry[baseIdx][1]) * fraction
      : rawPositions[0]?.[1] || 0;
  const currentCarPos = [currentLat, currentLon];

  // Cálculo de orientación (bearing)
  const bearing =
    roadGeometry[baseIdx] && roadGeometry[nextIdx]
      ? calculateBearing(
          roadGeometry[baseIdx][0],
          roadGeometry[baseIdx][1],
          roadGeometry[nextIdx][0],
          roadGeometry[nextIdx][1]
        )
      : 0;

  // Trazado progresivo recorrido (estela brillante)
  const traversedPositions =
    roadGeometry.length > 0
      ? (baseIdx === 0 && fraction === 0
          ? [roadGeometry[0]]
          : [...roadGeometry.slice(0, baseIdx + 1), currentCarPos])
      : [];

  // Telemetría dinámica y tiempos
  const progressRatio = maxRoadIdx > 0 ? clampedProgress / maxRoadIdx : 0;
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

  const speedKmh = Number(currentLoc?.velocidad) || 0;

  // Tiempos formateados (mm:ss)
  const startMs = validLocations[0]
    ? new Date(validLocations[0].fechaGps ?? validLocations[0].fecha_gps ?? 0).getTime()
    : 0;
  const endMs = validLocations.length > 0
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

  const carIcon = createCarIcon(bearing, speedKmh, deltaSec);

  // Filtrar paradas intermedias
  const intermediateStops = validLocations.filter(
    (loc) => Boolean(loc.esPuntoIntermedio || loc.es_punto_intermedio)
  );

  if (!rawPositions.length) {
    return (
      <div className="map-empty-state">
        Este viaje no tiene coordenadas GPS válidas.
      </div>
    );
  }

  return (
    <div className="trip-map-wrapper">
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
        <VehicleCameraController carPosition={currentCarPos} followVehicle={followVehicle} />

        {/* Polilínea base de la calle completa (calle real OSRM) */}
        {roadGeometry.length > 1 && (
          <Polyline
            positions={roadGeometry}
            pathOptions={{
              color: "#475569",
              weight: 5,
              opacity: 0.45,
              lineCap: "round",
              lineJoin: "round"
            }}
          />
        )}

        {/* Polilínea progresiva recorrida (azul brillante con estela) */}
        {traversedPositions.length > 1 && (
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

        {/* Marcador animado del vehículo interactivo */}
        {roadGeometry.length > 0 && (
          <Marker position={currentCarPos} icon={carIcon} zIndexOffset={1000} />
        )}

        {/* Puntos GPS capturados */}
        {validLocations.map((location, index) => {
          const isFirst = index === 0;
          const isLast = index === validLocations.length - 1;
          const isIntermediate = Boolean(
            location.esPuntoIntermedio || location.es_punto_intermedio
          );

          // Si es punto intermedio, se muestra con marcador dorado numerado
          if (isIntermediate) {
            const stopIndex = intermediateStops.indexOf(location) + 1;
            return (
              <Marker
                key={location.idUbicacion ?? `stop-${index}`}
                position={[Number(location.latitud), Number(location.longitud)]}
                icon={createNumberedStopIcon(stopIndex)}
              >
                <Tooltip permanent direction="top" offset={[0, -32]} className="custom-intermediate-tooltip">
                  <span className="intermediate-tooltip-content">
                    <span className="dot-red-icon">🛑</span>
                    <strong>{location.nombrePunto || location.nombre_punto || `Parada #${stopIndex}`}</strong>
                  </span>
                </Tooltip>
                <Popup>
                  <div className="map-popup">
                    <strong style={{ color: "#d97706" }}>
                      🛑 Parada #{stopIndex}: {location.nombrePunto || location.nombre_punto || "Punto Intermedio"}
                    </strong>
                    <span>
                      {Number(location.latitud).toFixed(6)}, {Number(location.longitud).toFixed(6)}
                    </span>
                    <span>Fecha: {formatDateTime(location.fechaGps ?? location.fecha_gps)}</span>
                    {location.velocidad !== null && location.velocidad !== undefined && (
                      <span>Velocidad al parar: {location.velocidad} km/h</span>
                    )}
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
            );
          }

          // Puntos regulares de paso, inicio y fin
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
                    {isFirst ? "🏁 Inicio del recorrido" : isLast ? "📍 Destino final" : `Hito GPS #${index + 1}`}
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

      {/* Consola Flotante de Control de Reproducción y Telemetría */}
      <div className="playback-hud-panel">
        <div className="playback-hud-top">
          <div className="playback-controls-group">
            {/* Play / Pausa */}
            <button
              type="button"
              className={`playback-btn-primary ${isPlaying ? "playing" : ""}`}
              onClick={() => {
                if (!isPlaying && clampedProgress >= maxRoadIdx) {
                  setProgressIndex(0);
                }
                setIsPlaying(!isPlaying);
              }}
              title={isPlaying ? "Pausar simulación" : "Reproducir viaje"}
            >
              {isPlaying ? "⏸" : "▶"}
            </button>

            {/* Reiniciar */}
            <button
              type="button"
              className="playback-btn-secondary"
              onClick={() => {
                setIsPlaying(false);
                setProgressIndex(0);
              }}
              title="Reiniciar al inicio"
            >
              ⏮
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

          {/* Telemetría Instantánea del Tramo */}
          <div className="playback-telemetry-badge">
            <span className="telemetry-speed-indicator">
              ⚡ <strong>{Math.round(speedKmh)}</strong> km/h
            </span>
            {deltaSec > 0 && (
              <span className="telemetry-delta-indicator">
                ⏱ Tramo: +{deltaSec}s
              </span>
            )}
            {isSnappingRoad && (
              <span className="telemetry-snapping-badge" title="Ajustando con OSRM">
                🛣 Ajustando a calles...
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
            <span>Seguir vehículo</span>
          </label>
        </div>

        {/* Barra Scrubber y Contador de Tiempo */}
        <div className="playback-scrubber-row">
          <span className="playback-time-label current">
            {formatMinSec(currentTripSec)}
          </span>
          <input
            type="range"
            min="0"
            max={maxRoadIdx}
            step="0.1"
            value={clampedProgress}
            onChange={(e) => {
              setIsPlaying(false);
              setProgressIndex(Number(e.target.value));
            }}
            className="playback-scrubber-slider"
          />
          <span className="playback-time-label total">
            {formatMinSec(totalTripSec)}
          </span>
        </div>
      </div>
    </div>
  );
}

export default TripMap;