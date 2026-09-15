import {
  useCallback,
  useEffect,
  useRef,
  useState
} from "react";

import TripMap
  from "../components/TripMap.jsx";

import {
  IconBuscar,
  IconCross,
  IconUbicaciones,
  IconExternalLink
} from "../components/Icons.jsx";

import {
  getAdminUbicacionesViaje,
  getAdminUbicacionesViajeDetalle
} from "../services/api.js";

function formatDateTime(value) {
  if (!value) {
    return "Sin registro";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "Fecha no válida";
  }

  return date.toLocaleString(
    "es-MX",
    {
      dateStyle: "short",
      timeStyle: "short"
    }
  );
}

function UbicacionesPage() {
  const [trips, setTrips] =
    useState([]);

  const [selectedTripId, setSelectedTripId] =
    useState(null);

  const [selectedTrip, setSelectedTrip] =
    useState(null);

  const [locations, setLocations] =
    useState([]);

  const [search, setSearch] =
    useState("");

  const [status, setStatus] =
    useState("TODOS");

  const [loadingTrips, setLoadingTrips] =
    useState(true);

  const [loadingDetail, setLoadingDetail] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const mapPanelRef = useRef(null);

  function handleSelectTrip(idViaje) {
    setSelectedTripId(idViaje);
    if (typeof window !== "undefined" && window.innerWidth <= 1024 && mapPanelRef.current) {
      setTimeout(() => {
        mapPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    }
  }

  const loadTrips = useCallback(async () => {
    setLoadingTrips(true);
    setMessage("");

    try {
      const response =
        await getAdminUbicacionesViaje({
          search,
          status
        });

      const nextTrips =
        response.data ?? [];

      setTrips(nextTrips);

      if (!nextTrips.length) {
        setSelectedTripId(null);
        setSelectedTrip(null);
        setLocations([]);
        return;
      }

      setSelectedTripId((currentId) => {
        const selectedStillExists = nextTrips.some(
          (trip) => trip.idViaje === currentId
        );
        return selectedStillExists ? currentId : nextTrips[0].idViaje;
      });
    } catch (error) {
      setMessage(error.message);
      setTrips([]);
      setSelectedTripId(null);
      setSelectedTrip(null);
      setLocations([]);
    } finally {
      setLoadingTrips(false);
    }
  }, [search, status]);

  async function loadTripDetail(
    idViaje
  ) {
    setLoadingDetail(true);
    setMessage("");

    try {
      const response =
        await getAdminUbicacionesViajeDetalle(
          idViaje
        );

      setSelectedTrip(
        response.data?.trip ?? null
      );

      setLocations(
        response.data?.locations ?? []
      );
    } catch (error) {
      setMessage(error.message);
      setSelectedTrip(null);
      setLocations([]);
    } finally {
      setLoadingDetail(false);
    }
  }

  useEffect(() => {
    const timeoutId =
      window.setTimeout(
        loadTrips,
        300
      );

    return () => {
      window.clearTimeout(
        timeoutId
      );
    };
  }, [loadTrips]);

  useEffect(() => {
    if (!selectedTripId) {
      return;
    }

    loadTripDetail(
      selectedTripId
    );
  }, [selectedTripId]);

  return (
    <div className="locations-page">
      <section className="locations-layout">
        {/* LADO IZQUIERDO: Encabezado + Panel con Buscador + Filtro + Lista de Viajes */}
        <aside className="locations-sidebar-col">
          <header className="locations-sidebar-header">
            <span className="module-label">
              Seguimiento GPS
            </span>

            <h1>Ubicaciones</h1>

            <p>
              Consulta las posiciones y el recorrido registrado de cada viaje en tiempo real.
            </p>
          </header>

          {message && (
            <p
              className="module-message module-message-error"
              role="alert"
            >
              {message}
            </p>
          )}

          <div className="locations-list-panel">
            <div className="locations-panel-heading">
              <div className="locations-heading-title-group">
                <div className="locations-heading-icon-box">
                  <IconUbicaciones size={18} />
                </div>
                <div>
                  <h2>Viajes con GPS</h2>
                  <span className="locations-heading-subtitle">Telemetría en ruta</span>
                </div>
              </div>

              <span className="locations-count-badge" title="Total de viajes con GPS">
                {trips.length}
              </span>
            </div>

          {/* Buscador y Filtro Integrados en la Columna Izquierda */}
          <div className="locations-sidebar-controls">
            <div className="locations-search-box">
              <IconBuscar size={15} className="locations-search-icon" />
              <input
                type="search"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Buscar folio, conductor, unidad..."
                className="locations-search-input"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="locations-search-clear"
                  title="Limpiar búsqueda"
                  aria-label="Limpiar búsqueda"
                >
                  <IconCross size={13} />
                </button>
              )}
            </div>

            <div className="locations-filter-row">
              <label htmlFor="locations-status" className="locations-filter-label">
                Estado:
              </label>
              <select
                id="locations-status"
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value)
                }
                className="locations-status-select"
              >
                <option value="TODOS">
                  Todos los estados
                </option>
                <option value="EN_CURSO">
                  En curso
                </option>
                <option value="FINALIZADO">
                  Finalizado
                </option>
                <option value="PENDIENTE">
                  Pendiente
                </option>
                <option value="CANCELADO">
                  Cancelado
                </option>
              </select>
            </div>
          </div>

          {/* Lista scrolleable de viajes */}
          {loadingTrips ? (
            <div className="locations-loading-state">
              <p>Cargando viajes con GPS...</p>
            </div>
          ) : trips.length === 0 ? (
            <div className="locations-empty">
              <p>No se encontraron viajes con los filtros aplicados.</p>
            </div>
          ) : (
            <div className="trip-location-list">
              {trips.map((trip) => {
                const isSelected = selectedTripId === trip.idViaje;
                return (
                  <button
                    type="button"
                    key={trip.idViaje}
                    className={`trip-location-item ${isSelected ? "trip-location-item-active" : ""}`}
                    onClick={() =>
                      handleSelectTrip(trip.idViaje)
                    }
                  >
                    <div className="trip-location-title">
                      <strong className="trip-folio">{trip.folio}</strong>
                      <span className={`status-badge ${trip.estado === "EN_CURSO" ? "status-warning" : trip.estado === "FINALIZADO" ? "status-active" : "status-neutral"}`}>
                        {trip.estado}
                      </span>
                    </div>

                    <div className="trip-location-details">
                      <span className="trip-driver-name">{trip.conductor?.nombre || "Sin conductor"}</span>
                      <span className="trip-vehicle-name">
                        {trip.vehiculo?.nombre || "Sin unidad"}
                        {trip.vehiculo?.numeroEconomico ? ` · ${trip.vehiculo.numeroEconomico}` : ""}
                      </span>
                    </div>

                    <div className="trip-location-route">
                      <span>{trip.origen?.nombre || "Sin origen"}</span>
                      <span className="route-arrow">→</span>
                      <span>{trip.destino?.nombre || "Sin destino"}</span>
                    </div>

                    <div className="trip-location-footer">
                      <small className="trip-pts-count">{trip.totalUbicaciones} ubicaciones</small>
                      <small className="trip-time-stamp">
                        {formatDateTime(trip.ultimaUbicacionEn)}
                      </small>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </aside>

        {/* LADO DERECHO: Mapa ocupando todo el lado derecho */}
        <section className="locations-map-panel" ref={mapPanelRef}>
          {loadingDetail ? (
            <div className="map-empty-state">
              <p>Cargando recorrido del viaje...</p>
            </div>
          ) : !selectedTrip ? (
            <div className="map-empty-state">
              <IconUbicaciones size={42} style={{ color: "#94a3b8", marginBottom: "12px" }} />
              <strong style={{ fontSize: "1.05rem", color: "#334155" }}>Selecciona un viaje</strong>
              <p style={{ margin: "4px 0 0 0", color: "#64748b", fontSize: "0.88rem" }}>
                Elige un viaje de la lista a la izquierda para visualizar su recorrido GPS en el mapa.
              </p>
            </div>
          ) : (
            <div className="locations-map-inner">
              <header className="selected-trip-header">
                <div className="selected-trip-header-left">
                  <div className="selected-trip-title-line">
                    <span className="selected-trip-tag">Viaje Seleccionado</span>
                    <span className={`status-badge ${selectedTrip.estado === "EN_CURSO" ? "status-warning" : selectedTrip.estado === "FINALIZADO" ? "status-active" : "status-neutral"}`}>
                      {selectedTrip.estado}
                    </span>
                  </div>
                  <h2>{selectedTrip.folio}</h2>
                  <div className="selected-trip-route">
                    <strong>{selectedTrip.origen?.nombre || "Sin origen"}</strong>
                    <span className="route-arrow">→</span>
                    <strong>{selectedTrip.destino?.nombre || "Sin destino"}</strong>
                  </div>
                </div>

                <div className="selected-trip-summary">
                  <div className="selected-trip-meta-item">
                    <span className="meta-item-label">Conductor</span>
                    <strong className="meta-item-value">{selectedTrip.conductor?.nombre || "Sin conductor"}</strong>
                  </div>
                  <div className="selected-trip-meta-item">
                    <span className="meta-item-label">Unidad</span>
                    <strong className="meta-item-value">
                      {selectedTrip.vehiculo?.nombre || "Sin unidad"}
                      {selectedTrip.vehiculo?.numeroEconomico ? ` · ${selectedTrip.vehiculo.numeroEconomico}` : ""}
                    </strong>
                  </div>
                </div>
              </header>

              <div className="locations-map-container">
                <TripMap
                  locations={locations}
                />
              </div>

              <footer className="map-footer">
                <div className="map-footer-left">
                  <span>
                    <strong>{locations.length}</strong> puntos GPS registrados
                    {locations.filter(l => l.es_punto_intermedio || l.esPuntoIntermedio).length > 0 && (
                      <span className="intermediate-badge">
                        ({locations.filter(l => l.es_punto_intermedio || l.esPuntoIntermedio).length} intermedio(s))
                      </span>
                    )}
                  </span>
                </div>

                {locations.length > 0 && (
                  <a
                    href={`https://www.google.com/maps?q=${locations.at(-1).latitud},${locations.at(-1).longitud}`}
                    target="_blank"
                    rel="noreferrer"
                    className="map-maps-link"
                  >
                    <span>Abrir en Google Maps</span>
                    <IconExternalLink size={13} />
                  </a>
                )}
              </footer>

              {locations.filter(l => l.es_punto_intermedio || l.esPuntoIntermedio).length > 0 && (
                <div className="intermediate-points-container" style={{ padding: "14px 18px", background: "#fff5f5", borderTop: "1px solid #fecaca" }}>
                  <h4 style={{ margin: "0 0 10px 0", color: "#991b1b", fontSize: "0.9rem", display: "flex", alignItems: "center", gap: "6px" }}>
                    Puntos Intermedios Registrados ({locations.filter(l => l.es_punto_intermedio || l.esPuntoIntermedio).length})
                  </h4>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "10px" }}>
                    {locations.filter(l => l.es_punto_intermedio || l.esPuntoIntermedio).map((pt, idx) => (
                      <div key={pt.id_ubicaciones_viaje || pt.idUbicacion || idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#ffffff", padding: "8px 12px", borderRadius: "8px", border: "1px solid #fee2e2" }}>
                        <div>
                          <strong style={{ color: "#dc2626", fontSize: "0.85rem", display: "block" }}>
                            {pt.nombre_punto || pt.nombrePunto || `Punto Intermedio ${idx + 1}`}
                          </strong>
                          <small style={{ display: "block", color: "#64748b", marginTop: "2px", fontSize: "0.75rem" }}>
                            {formatDateTime(pt.fecha_gps || pt.fechaGps)}
                          </small>
                        </div>
                        <a
                          href={`https://www.google.com/maps?q=${pt.latitud},${pt.longitud}`}
                          target="_blank"
                          rel="noreferrer"
                          className="secondary-button"
                          style={{ fontSize: "0.75rem", padding: "4px 8px", textDecoration: "none", whiteSpace: "nowrap" }}
                        >
                          Maps
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </section>
    </div>
  );
}

export default UbicacionesPage;