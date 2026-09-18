import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import L from "leaflet";
import {
  MapContainer,
  Marker,
  TileLayer,
  Tooltip,
  useMap
} from "react-leaflet";

import {
  IconCrosshair,
  IconMaximize,
  IconMinimize,
  IconPause,
  IconPlay,
  IconRadar,
  IconRefresh,
  IconBuscar,
  IconCross
} from "../components/Icons.jsx";
import TripDetailModal from "../components/TripDetailModal.jsx";
import { getAdminMonitoreoActivo } from "../services/api.js";

function formatSecondsAgo(seconds) {
  if (seconds === null || seconds === undefined || isNaN(seconds)) {
    return "Sin reporte GPS";
  }
  if (seconds < 60) {
    return `Hace ${Math.max(1, Math.round(seconds))} s`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `Hace ${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  return `Hace ${hours} h ${minutes % 60} min`;
}

/**
 * Clasificación de estado con los colores personalizados:
 * - #10B981: en ruta normal
 * - #F59E0B: retraso / atención
 * - #EF4444: incidente / alerta crítica
 * - #64748B: detenido / fuera de servicio
 */
function getUnitStatus(trip) {
  const hasGps = Boolean(trip.ultimaUbicacion);
  const seconds = trip.segundosDesdeUltimoGps;
  const isPausado = String(trip.estado || "").toUpperCase() === "PAUSADO";

  // 1. Incidente / alerta crítica (#EF4444)
  if (!hasGps || seconds === null || seconds > 600) {
    return {
      key: "CRITICAL",
      className: "status-critical",
      color: "#EF4444",
      label: "incidente / alerta crítica",
      badgeText: !hasGps ? "Sin GPS" : "Alerta crítica"
    };
  }

  // 2. Detenido / fuera de servicio (#64748B) si el viaje está pausado
  if (isPausado) {
    return {
      key: "STOPPED",
      className: "status-stopped",
      color: "#64748B",
      label: "detenido / fuera de servicio",
      badgeText: "Detenido"
    };
  }

  // 3. Retraso / atención (#F59E0B) si la señal tiene retraso entre 2 y 10 minutos
  if (seconds > 120) {
    return {
      key: "WARNING",
      className: "status-warning",
      color: "#F59E0B",
      label: "retraso / atención",
      badgeText: "Retraso"
    };
  }

  // 4. En ruta normal (#10B981)
  return {
    key: "MOVING",
    className: "status-moving",
    color: "#10B981",
    label: "en ruta normal",
    badgeText: "En ruta"
  };
}

function createVehicleIcon(trip, isSelected = false) {
  const status = getUnitStatus(trip);
  const direction = trip.ultimaUbicacion?.direccionGrados || 0;
  const ecoNum = trip.vehiculo?.numeroEconomico || trip.vehiculo?.nombre || "N/A";
  const selectedClass = isSelected ? "unit-marker-selected" : "";

  const html = `
    <div class="custom-unit-marker ${status.className} ${selectedClass}">
      <div class="marker-beacon-pulse" style="background-color: ${status.color};"></div>
      <div class="marker-body" style="background-color: ${status.color};">
        <div class="marker-icon-wrapper" style="transform: rotate(${direction}deg);">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z" />
          </svg>
        </div>
      </div>
      <div class="marker-eco-badge" style="border-color: ${status.color};">${ecoNum}</div>
    </div>
  `;

  return L.divIcon({
    html,
    className: "unit-leaflet-div-icon",
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    popupAnchor: [0, -22]
  });
}

function MapController({ positions, flyTarget, boundsVersion }) {
  const map = useMap();
  const initialFittedRef = useRef(false);

  useEffect(() => {
    map.invalidateSize();
  }, [map]);

  // Centrar en toda la flota cuando cambia boundsVersion o primer load
  useEffect(() => {
    if (!positions || positions.length === 0) return;
    if (flyTarget) return;

    if (!initialFittedRef.current || boundsVersion > 0) {
      initialFittedRef.current = true;
      if (positions.length === 1) {
        map.setView(positions[0], 15, { animate: true });
      } else {
        const isMobile = typeof window !== "undefined" && window.innerWidth <= 768;
        map.fitBounds(positions, {
          padding: isMobile ? [30, 30] : [60, 60],
          maxZoom: 16,
          animate: true
        });
      }
    }
  }, [map, positions, boundsVersion, flyTarget]);

  // Enfocar vehículo específico al hacer clic en lista
  useEffect(() => {
    if (flyTarget) {
      map.flyTo(flyTarget, 16, { duration: 1.2 });
    }
  }, [map, flyTarget]);

  return null;
}

export default function MonitoreoActivoPage() {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

  // Opciones de auto-refresco
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(15);
  const [countdown, setCountdown] = useState(15);

  // Filtros y selección
  const [selectedTripId, setSelectedTripId] = useState(null);
  const [flyTarget, setFlyTarget] = useState(null);
  const [boundsVersion, setBoundsVersion] = useState(0);
  const [search, setSearch] = useState("");
  const [movementFilter, setMovementFilter] = useState("ALL"); // ALL, MOVING, WARNING, CRITICAL, STOPPED
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [detailModalTripId, setDetailModalTripId] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const containerRef = useRef(null);
  const isFetchingRef = useRef(false);

  const fetchLiveTrips = useCallback(async (isManual = false) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    if (isManual) {
      setRefreshing(true);
    }

    try {
      const response = await getAdminMonitoreoActivo();
      if (response && response.data) {
        setTrips(response.data);
        setLastUpdated(new Date());
        setError("");
      }
    } catch (err) {
      console.error("Error en monitoreo activo:", err);
      setError(err.message || "Error al actualizar viajes activos.");
    } finally {
      setLoading(false);
      setRefreshing(false);
      isFetchingRef.current = false;
      setCountdown(refreshInterval);
    }
  }, [refreshInterval]);

  // Carga inicial
  useEffect(() => {
    fetchLiveTrips(true);
  }, [fetchLiveTrips]);

  // Loop de auto-actualización con countdown
  useEffect(() => {
    if (!autoRefresh) return undefined;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          fetchLiveTrips();
          return refreshInterval;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [autoRefresh, fetchLiveTrips, refreshInterval]);

  // Detectar cambios en pantalla completa
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      if (containerRef.current?.requestFullscreen) {
        containerRef.current.requestFullscreen().catch(() => {});
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  };

  const handleRecenterFleet = () => {
    setFlyTarget(null);
    setBoundsVersion((v) => v + 1);
  };

  const handleSelectTrip = (trip) => {
    setSelectedTripId(trip.idViaje);
    if (trip.ultimaUbicacion) {
      setFlyTarget([trip.ultimaUbicacion.latitud, trip.ultimaUbicacion.longitud]);
    }
  };

  // Posiciones con coordenadas válidas para el mapa
  const validGpsTrips = useMemo(() => {
    return trips.filter(
      (t) =>
        t.ultimaUbicacion &&
        !isNaN(t.ultimaUbicacion.latitud) &&
        !isNaN(t.ultimaUbicacion.longitud) &&
        (t.ultimaUbicacion.latitud !== 0 || t.ultimaUbicacion.longitud !== 0)
    );
  }, [trips]);

  const allPositions = useMemo(() => {
    return validGpsTrips.map((t) => [
      t.ultimaUbicacion.latitud,
      t.ultimaUbicacion.longitud
    ]);
  }, [validGpsTrips]);

  // KPIs con los nuevos estados
  const totalActivos = trips.length;
  const countsByStatus = useMemo(() => {
    let moving = 0;
    let warning = 0;
    let critical = 0;
    let stopped = 0;

    trips.forEach((trip) => {
      const st = getUnitStatus(trip);
      if (st.key === "MOVING") moving++;
      else if (st.key === "WARNING") warning++;
      else if (st.key === "CRITICAL") critical++;
      else if (st.key === "STOPPED") stopped++;
    });

    return { moving, warning, critical, stopped };
  }, [trips]);

  // Filtrado de la lista
  const filteredTrips = useMemo(() => {
    return trips.filter((trip) => {
      const matchSearch =
        !search.trim() ||
        trip.conductor?.nombre?.toLowerCase().includes(search.toLowerCase()) ||
        trip.vehiculo?.numeroEconomico?.toLowerCase().includes(search.toLowerCase()) ||
        trip.vehiculo?.placas?.toLowerCase().includes(search.toLowerCase()) ||
        trip.folio?.toLowerCase().includes(search.toLowerCase()) ||
        trip.origen?.nombre?.toLowerCase().includes(search.toLowerCase()) ||
        trip.destino?.nombre?.toLowerCase().includes(search.toLowerCase());

      if (!matchSearch) return false;

      if (movementFilter === "ALL") return true;

      const st = getUnitStatus(trip);
      return st.key === movementFilter;
    });
  }, [trips, search, movementFilter]);

  // Coordenadas por defecto (Centro de México) si no hay viajes activos
  const defaultCenter = [23.6345, -102.5528];
  const mapCenter = allPositions.length > 0 ? allPositions[0] : defaultCenter;
  const defaultZoom = allPositions.length > 0 ? 12 : 5;

  return (
    <div
      ref={containerRef}
      className={`live-monitoring-container ${isFullscreen ? "fullscreen-active" : ""}`}
    >
      {/* Barra de Control y Telemetría Superior */}
      <header className="live-monitoring-header">
        <div className="live-monitoring-title-block">
          <div className="live-radar-badge">
            <IconRadar size={22} className="radar-spin-icon" />
            <span className="radar-live-dot" />
          </div>
          <div>
            <div className="live-header-title-row">
              <h1 className="live-monitoring-title">Monitoreo en Vivo de Flota</h1>
              <span className="live-badge-active">EN TIEMPO REAL</span>
            </div>
            <p className="live-monitoring-subtitle">
              Supervisión de unidades operativas y telemetría de viajes en curso
            </p>
          </div>
        </div>

        {/* KPIs de Flota con Colores Personalizados */}
        <div className="live-kpi-group">
          <div
            className={`live-kpi-pill ${movementFilter === "ALL" ? "active" : ""}`}
            onClick={() => setMovementFilter("ALL")}
            title="Mostrar todos los viajes activos"
          >
            <span className="kpi-number">{totalActivos}</span>
            <span className="kpi-label">Activos</span>
          </div>

          <div
            className={`live-kpi-pill kpi-moving ${movementFilter === "MOVING" ? "active" : ""}`}
            onClick={() => setMovementFilter("MOVING")}
            title="En ruta normal"
          >
            <span className="kpi-indicator" style={{ backgroundColor: "#10B981" }} />
            <span className="kpi-number">{countsByStatus.moving}</span>
            <span className="kpi-label">En ruta</span>
          </div>

          <div
            className={`live-kpi-pill kpi-warning ${movementFilter === "WARNING" ? "active" : ""}`}
            onClick={() => setMovementFilter("WARNING")}
            title="#F59E0B — retraso / atención"
          >
            <span className="kpi-indicator" style={{ backgroundColor: "#F59E0B" }} />
            <span className="kpi-number">{countsByStatus.warning}</span>
            <span className="kpi-label">Retraso</span>
          </div>

          <div
            className={`live-kpi-pill kpi-critical ${movementFilter === "CRITICAL" ? "active" : ""}`}
            onClick={() => setMovementFilter("CRITICAL")}
            title="#EF4444 — incidente / alerta crítica"
          >
            <span className="kpi-indicator" style={{ backgroundColor: "#EF4444" }} />
            <span className="kpi-number">{countsByStatus.critical}</span>
            <span className="kpi-label">Alerta crítica</span>
          </div>

          <div
            className={`live-kpi-pill kpi-stopped ${movementFilter === "STOPPED" ? "active" : ""}`}
            onClick={() => setMovementFilter("STOPPED")}
            title="#64748B — detenido / fuera de servicio"
          >
            <span className="kpi-indicator" style={{ backgroundColor: "#64748B" }} />
            <span className="kpi-number">{countsByStatus.stopped}</span>
            <span className="kpi-label">Detenidos</span>
          </div>
        </div>

        {/* Controles de Refresco y Vista */}
        <div className="live-controls-group">
          <div className="refresh-status-card">
            <button
              type="button"
              className={`btn-pause-toggle ${autoRefresh ? "active" : "paused"}`}
              onClick={() => setAutoRefresh(!autoRefresh)}
              title={autoRefresh ? "Pausar auto-actualización" : "Reanudar auto-actualización"}
            >
              {autoRefresh ? <IconPause size={14} /> : <IconPlay size={14} />}
            </button>

            <div className="countdown-info">
              {autoRefresh ? (
                <span className="countdown-text">
                  Refresco en <strong>{countdown}s</strong>
                </span>
              ) : (
                <span className="countdown-text text-paused">Pausado</span>
              )}
              {lastUpdated && (
                <small className="last-sync-text">
                  {lastUpdated.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </small>
              )}
            </div>

            <select
              className="refresh-interval-select"
              value={refreshInterval}
              onChange={(e) => {
                const val = Number(e.target.value);
                setRefreshInterval(val);
                setCountdown(val);
              }}
              title="Frecuencia de actualización"
            >
              <option value={10}>10s</option>
              <option value={15}>15s</option>
              <option value={30}>30s</option>
              <option value={60}>60s</option>
            </select>

            <button
              type="button"
              className={`btn-icon-action ${refreshing ? "loading-spin" : ""}`}
              onClick={() => fetchLiveTrips(true)}
              disabled={refreshing}
              title="Actualizar ahora"
            >
              <IconRefresh size={16} />
            </button>
          </div>

          <div className="view-actions-card">
            <button
              type="button"
              className="btn-icon-action"
              onClick={handleRecenterFleet}
              title="Centrar toda la flota en el mapa"
            >
              <IconCrosshair size={16} />
            </button>

            <button
              type="button"
              className="btn-icon-action"
              onClick={toggleFullscreen}
              title={isFullscreen ? "Salir de pantalla completa" : "Modo pantalla completa (Torre de Control)"}
            >
              {isFullscreen ? <IconMinimize size={16} /> : <IconMaximize size={16} />}
            </button>
          </div>
        </div>
      </header>

      {error && (
        <div className="live-alert-error">
          <span>⚠️ {error}</span>
          <button type="button" onClick={() => fetchLiveTrips(true)}>Reintentar</button>
        </div>
      )}

      {/* Cuerpo Principal: Mapa + Panel Lateral Desplegable */}
      <div className="live-monitoring-body">
        {/* Mapa Leaflet */}
        <div className="live-map-wrapper">
          <MapContainer
            center={mapCenter}
            zoom={defaultZoom}
            scrollWheelZoom
            className="live-leaflet-container"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <MapController
              positions={allPositions}
              flyTarget={flyTarget}
              boundsVersion={boundsVersion}
            />

            {/* Marcadores de Unidades Activas con Colores Personalizados */}
            {validGpsTrips.map((trip) => {
              const { latitud, longitud, direccionGrados } = trip.ultimaUbicacion;
              const isSelected = trip.idViaje === selectedTripId;
              const status = getUnitStatus(trip);
              const formattedTime = formatSecondsAgo(trip.segundosDesdeUltimoGps);

              return (
                <Marker
                  key={trip.idViaje}
                  position={[latitud, longitud]}
                  icon={createVehicleIcon(trip, isSelected)}
                  eventHandlers={{
                    click: () => {
                      setSelectedTripId(trip.idViaje);
                      setDetailModalTripId(trip.idViaje);
                    }
                  }}
                >
                  {/* Tooltip Hover Nativo de Leaflet */}
                  <Tooltip
                    direction="top"
                    offset={[0, -20]}
                    opacity={1}
                    sticky
                    className="leaflet-live-tooltip"
                  >
                    <div className="live-unit-hover-card" style={{ borderTop: `4px solid ${status.color}` }}>
                      <div className="hover-card-header">
                        <div className="hover-card-title-group">
                          <span className="hover-card-unit-badge">
                            🚗 Eco {trip.vehiculo.numeroEconomico || trip.vehiculo.nombre}
                          </span>
                          <span className="hover-card-plates">{trip.vehiculo.placas || "Sin placas"}</span>
                        </div>
                        <span
                          className="hover-card-speed-badge"
                          style={{
                            backgroundColor: `${status.color}15`,
                            color: status.color,
                            borderColor: `${status.color}40`
                          }}
                        >
                          {status.badgeText}
                        </span>
                      </div>

                      <div className="hover-card-content">
                        <div className="hover-row">
                          <span className="hover-icon">👤</span>
                          <div className="hover-col">
                            <span className="hover-label">Conductor</span>
                            <strong className="hover-val">{trip.conductor.nombre}</strong>
                            {trip.conductor.telefono && (
                              <small className="hover-subtext">Tel: {trip.conductor.telefono}</small>
                            )}
                          </div>
                        </div>

                        <div className="hover-row">
                          <span className="hover-icon">📍</span>
                          <div className="hover-col">
                            <span className="hover-label">Ruta y Folio</span>
                            <span className="hover-route">
                              {trip.origen.nombre} ➔ <strong>{trip.destino.nombre}</strong>
                            </span>
                            <small className="hover-subtext">Folio: #{trip.folio}</small>
                          </div>
                        </div>

                        <div className="hover-row-telemetry">
                          <div className="telemetry-item">
                            <span className="telemetry-label">Salida</span>
                            <span className="telemetry-value">
                              {trip.horaSalida || "N/D"}
                            </span>
                          </div>
                          <div className="telemetry-item">
                            <span className="telemetry-label">Rumbo</span>
                            <span className="telemetry-value">
                              {direccionGrados !== null ? `${Math.round(direccionGrados)}°` : "N/D"}
                            </span>
                          </div>
                          <div className="telemetry-item">
                            <span className="telemetry-label">Puntos GPS</span>
                            <span className="telemetry-value">{trip.totalUbicaciones}</span>
                          </div>
                        </div>
                      </div>

                      <div className="hover-card-footer">
                        <div className="hover-signal-indicator">
                          <span
                            className="signal-dot-pulse"
                            style={{ backgroundColor: status.color }}
                          />
                          <span className="signal-status-text" style={{ color: status.color }}>
                            {status.label} • {formattedTime}
                          </span>
                        </div>
                        <span className="hover-click-hint">Clic para ver detalle ↗</span>
                      </div>
                    </div>
                  </Tooltip>
                </Marker>
              );
            })}
          </MapContainer>

          {/* Simbología de Colores Flotante */}
          <div className="live-map-legend">
            <span className="legend-title">Simbología</span>
            <div className="legend-items">
              <div className="legend-item" title="Unidad en marcha con reporte reciente">
                <span className="legend-dot" style={{ backgroundColor: "#10B981" }} />
                <span>En ruta normal</span>
              </div>
              <div className="legend-item" title="#F59E0B — retraso / atención">
                <span className="legend-dot" style={{ backgroundColor: "#F59E0B" }} />
                <span>#F59E0B — retraso / atención</span>
              </div>
              <div className="legend-item" title="#EF4444 — incidente / alerta crítica">
                <span className="legend-dot" style={{ backgroundColor: "#EF4444" }} />
                <span>#EF4444 — incidente / alerta crítica</span>
              </div>
              <div className="legend-item" title="#64748B — detenido / fuera de servicio">
                <span className="legend-dot" style={{ backgroundColor: "#64748B" }} />
                <span>#64748B — detenido / fuera de servicio</span>
              </div>
            </div>
          </div>

          {/* Botón flotante para alternar panel lateral de unidades */}
          <button
            type="button"
            className="btn-toggle-units-sidebar"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            title={isSidebarOpen ? "Ocultar panel de unidades" : "Mostrar panel de unidades"}
          >
            <span>{isSidebarOpen ? "Ocultar lista" : "Ver unidades"} ({filteredTrips.length})</span>
          </button>
        </div>

        {/* Panel Lateral Desplegable de Unidades */}
        {isSidebarOpen && (
          <aside className="live-units-sidebar">
            <div className="sidebar-search-box">
              <span className="search-icon"><IconBuscar size={15} /></span>
              <input
                type="text"
                placeholder="Buscar por chofer, eco, ruta..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button type="button" className="btn-clear-search" onClick={() => setSearch("")}>
                  <IconCross size={13} />
                </button>
              )}
            </div>

            <div className="sidebar-units-list">
              {loading && trips.length === 0 ? (
                <div className="sidebar-empty-state">
                  <span className="loading-spinner" />
                  <p>Cargando viajes en curso...</p>
                </div>
              ) : filteredTrips.length === 0 ? (
                <div className="sidebar-empty-state">
                  <p>No se encontraron unidades con los filtros aplicados.</p>
                </div>
              ) : (
                filteredTrips.map((trip) => {
                  const hasGps = Boolean(trip.ultimaUbicacion);
                  const isSelected = trip.idViaje === selectedTripId;
                  const status = getUnitStatus(trip);
                  const timeAgo = formatSecondsAgo(trip.segundosDesdeUltimoGps);

                  return (
                    <article
                      key={trip.idViaje}
                      className={`unit-card-item ${isSelected ? "selected" : ""}`}
                      style={isSelected ? { borderColor: status.color } : { borderLeft: `3px solid ${status.color}` }}
                      onClick={() => handleSelectTrip(trip)}
                    >
                      <div className="unit-card-top">
                        <div className="unit-card-main-info">
                          <span className="unit-status-dot" style={{ backgroundColor: status.color }} />
                          <strong className="unit-eco-name">
                            {trip.vehiculo.numeroEconomico || trip.vehiculo.nombre}
                          </strong>
                          <span className="unit-driver-name">{trip.conductor.nombre}</span>
                        </div>
                        <span
                          className="unit-speed-pill"
                          style={{
                            backgroundColor: `${status.color}15`,
                            color: status.color,
                            border: `1px solid ${status.color}40`
                          }}
                        >
                          {status.badgeText}
                        </span>
                      </div>

                      <div className="unit-card-route">
                        <span>{trip.origen.nombre}</span>
                        <span className="route-arrow">➔</span>
                        <strong>{trip.destino.nombre}</strong>
                      </div>

                      <div className="unit-card-bottom">
                        <div className="unit-signal-meta">
                          <span className="signal-dot" style={{ backgroundColor: status.color }} />
                          <small style={{ color: status.color }}>
                            {hasGps ? `${status.label} • ${timeAgo}` : "Esperando primera señal"}
                          </small>
                        </div>
                        <button
                          type="button"
                          className="btn-unit-open-detail"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTripId(trip.idViaje);
                            setDetailModalTripId(trip.idViaje);
                          }}
                          title="Ver detalle del viaje"
                        >
                          Detalle ↗
                        </button>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </aside>
        )}
      </div>

      {/* Modal de Detalle de Viaje */}
      {detailModalTripId && (
        <TripDetailModal
          idViaje={detailModalTripId}
          onClose={() => setDetailModalTripId(null)}
        />
      )}
    </div>
  );
}
