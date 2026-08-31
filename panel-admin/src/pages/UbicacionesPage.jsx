import {
  useEffect,
  useState
} from "react";

import TripMap
  from "../components/TripMap.jsx";

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

  async function loadTrips() {
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

      const selectedStillExists =
        nextTrips.some(
          (trip) =>
            trip.idViaje ===
            selectedTripId
        );

      if (!selectedStillExists) {
        setSelectedTripId(
          nextTrips[0].idViaje
        );
      }
    } catch (error) {
      setMessage(error.message);
      setTrips([]);
      setSelectedTripId(null);
      setSelectedTrip(null);
      setLocations([]);
    } finally {
      setLoadingTrips(false);
    }
  }

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
  }, [search, status]);

  useEffect(() => {
    if (!selectedTripId) {
      return;
    }

    loadTripDetail(
      selectedTripId
    );
  }, [selectedTripId]);

  return (
    <section className="module-page">
      <header className="module-header">
        <div>
          <span className="module-label">
            Seguimiento GPS
          </span>

          <h1>Ubicaciones</h1>

          <p>
            Consulta las posiciones y el
            recorrido registrado de cada
            viaje.
          </p>
        </div>
      </header>

      <section className="module-toolbar locations-toolbar">
        <label>
          <span>Buscar viaje</span>

          <input
            type="search"
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value
              )
            }
            placeholder="Folio, conductor, unidad o destino"
          />
        </label>

        <label>
          <span>Estado</span>

          <select
            value={status}
            onChange={(event) =>
              setStatus(
                event.target.value
              )
            }
          >
            <option value="TODOS">
              Todos
            </option>

            <option value="PENDIENTE">
              Pendiente
            </option>

            <option value="EN_CURSO">
              En curso
            </option>

            <option value="FINALIZADO">
              Finalizado
            </option>

            <option value="CANCELADO">
              Cancelado
            </option>
          </select>
        </label>
      </section>

      {message && (
        <p
          className="module-message module-message-error"
          role="alert"
        >
          {message}
        </p>
      )}

      <section className="locations-layout">
        <aside className="locations-list-panel">
          <div className="locations-panel-heading">
            <h2>Viajes con GPS</h2>

            <span>
              {trips.length}
            </span>
          </div>

          {loadingTrips ? (
            <p className="locations-empty">
              Cargando viajes...
            </p>
          ) : trips.length === 0 ? (
            <p className="locations-empty">
              No hay viajes con ubicaciones
              GPS registradas.
            </p>
          ) : (
            <div className="trip-location-list">
              {trips.map((trip) => (
                <button
                  type="button"
                  key={trip.idViaje}
                  className={
                    selectedTripId ===
                    trip.idViaje
                      ? "trip-location-item trip-location-item-active"
                      : "trip-location-item"
                  }
                  onClick={() =>
                    setSelectedTripId(
                      trip.idViaje
                    )
                  }
                >
                  <div className="trip-location-title">
                    <strong>
                      {trip.folio}
                    </strong>

                    <span className="status-badge status-active">
                      {trip.estado}
                    </span>
                  </div>

                  <span>
                    {trip.conductor?.nombre ||
                      "Sin conductor"}
                  </span>

                  <span>
                    {trip.vehiculo?.nombre ||
                      "Sin unidad"}
                    {trip.vehiculo
                      ?.numeroEconomico
                      ? ` · ${trip.vehiculo.numeroEconomico}`
                      : ""}
                  </span>

                  <span>
                    {trip.origen?.nombre ||
                      "Sin origen"}
                    {" → "}
                    {trip.destino?.nombre ||
                      "Sin destino"}
                  </span>

                  <small>
                    {trip.totalUbicaciones}{" "}
                    ubicaciones
                  </small>

                  <small>
                    Última señal:{" "}
                    {formatDateTime(
                      trip.ultimaUbicacionEn
                    )}
                  </small>
                </button>
              ))}
            </div>
          )}
        </aside>

        <section className="locations-map-panel">
          {loadingDetail ? (
            <div className="map-empty-state">
              Cargando recorrido...
            </div>
          ) : !selectedTrip ? (
            <div className="map-empty-state">
              Selecciona un viaje para
              visualizar sus ubicaciones.
            </div>
          ) : (
            <>
              <header className="selected-trip-header">
                <div>
                  <span>
                    Viaje seleccionado
                  </span>

                  <h2>
                    {selectedTrip.folio}
                  </h2>
                </div>

                <div className="selected-trip-summary">
                  <span>
                    {
                      selectedTrip
                        .conductor?.nombre
                    }
                  </span>

                  <span>
                    {
                      selectedTrip
                        .vehiculo?.nombre
                    }
                  </span>
                </div>
              </header>

              <div className="selected-trip-route">
                <strong>
                  {selectedTrip.origen
                    ?.nombre ||
                    "Sin origen"}
                </strong>

                <span>→</span>

                <strong>
                  {selectedTrip.destino
                    ?.nombre ||
                    "Sin destino"}
                </strong>
              </div>

              <TripMap
                locations={locations}
              />

              <footer className="map-footer">
                <span>
                  {locations.length} puntos GPS registrados
                  {locations.filter(l => l.es_punto_intermedio).length > 0 && (
                    <strong style={{ color: "#dc2626", marginLeft: "8px" }}>
                      (🔴 {locations.filter(l => l.es_punto_intermedio).length} intermedio(s))
                    </strong>
                  )}
                </span>

                {locations.length > 0 && (
                  <a
                    href={`https://www.google.com/maps?q=${locations.at(-1).latitud},${locations.at(-1).longitud}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Abrir última ubicación
                    en Google Maps
                  </a>
                )}
              </footer>
            </>
          )}
        </section>
      </section>
    </section>
  );
}

export default UbicacionesPage;