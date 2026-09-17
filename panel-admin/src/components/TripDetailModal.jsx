import { useEffect, useState } from "react";
import { getAdminViajeDetalle } from "../services/api.js";
import TripMap from "./TripMap.jsx";

function formatDate(value) {
  if (!value) return "Sin fecha";
  const datePart = String(value).match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (!datePart) return "Fecha no válida";
  const date = new Date(`${datePart}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "Fecha no válida";
  return date.toLocaleDateString("es-MX");
}

function formatDateTime(value) {
  if (!value) return "Sin registro";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Fecha no válida";
  return date.toLocaleString("es-MX", {
    dateStyle: "short",
    timeStyle: "short"
  });
}

function getStatusClass(status) {
  const normalized = String(status || "").toUpperCase();
  if (normalized === "FINALIZADO") return "trip-status trip-status-finished";
  if (normalized === "EN_CURSO") return "trip-status trip-status-progress";
  if (normalized === "CANCELADO") return "trip-status trip-status-cancelled";
  return "trip-status trip-status-pending";
}

function IconClose({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function IconMapPin({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function IconMap({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
      <line x1="8" y1="2" x2="8" y2="18" />
      <line x1="16" y1="6" x2="16" y2="22" />
    </svg>
  );
}

function IconExternal({ size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

export default function TripDetailModal({ idViaje, onClose }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [trip, setTrip] = useState(null);
  const [locations, setLocations] = useState([]);

  useEffect(() => {
    if (!idViaje) return;

    setLoading(true);
    setError("");

    getAdminViajeDetalle(idViaje)
      .then((res) => {
        setTrip(res.data?.trip ?? null);
        setLocations(res.data?.locations ?? []);
      })
      .catch((err) => {
        setError(err.message || "Error al cargar los detalles del viaje.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [idViaje]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  if (!idViaje) return null;

  return (
    <div
      className="modal-overlay"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className="modal-card trip-detail-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dashboard-trip-detail-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="form-panel-header">
          <div>
            <span className="module-label">Información de Viaje</span>
            <h2 id="dashboard-trip-detail-title">
              {trip?.folio ? `Viaje ${trip.folio}` : "Detalle de Viaje"}
            </h2>
          </div>

          <button
            type="button"
            className="close-button"
            onClick={onClose}
            aria-label="Cerrar detalle"
          >
            <IconClose size={18} />
          </button>
        </div>

        {loading ? (
          <div style={{ padding: "40px 20px", textAlign: "center", color: "#64748b" }}>
            <p className="table-status">Cargando información y georreferencia del viaje...</p>
          </div>
        ) : error ? (
          <div style={{ padding: "30px 20px", textAlign: "center" }}>
            <p className="module-message module-message-error">{error}</p>
            <button
              type="button"
              className="secondary-button"
              style={{ marginTop: "12px" }}
              onClick={onClose}
            >
              Cerrar
            </button>
          </div>
        ) : trip ? (
          <div className="trip-detail-content-split">
            {/* Columna Izquierda: Datos del Viaje */}
            <div className="trip-detail-left-col">
              <section className="trip-detail-grid">
                <article>
                  <span>Estado</span>
                  <span className={getStatusClass(trip.estado?.nombre)}>
                    {trip.estado?.nombre || "Sin estado"}
                  </span>
                </article>

                <article>
                  <span>Fecha</span>
                  <strong>{formatDate(trip.fecha)}</strong>
                </article>

                <article>
                  <span>Conductor</span>
                  <strong>{trip.conductor?.nombre || "Sin conductor"}</strong>
                </article>

                <article>
                  <span>Unidad</span>
                  <strong>{trip.vehiculo?.nombre || "Sin unidad"}</strong>
                </article>

                <article>
                  <span>Número económico</span>
                  <strong>{trip.vehiculo?.numeroEconomico || "Sin registro"}</strong>
                </article>

                <article>
                  <span>Placas</span>
                  <strong>{trip.vehiculo?.placas || "Sin registro"}</strong>
                </article>

                <article>
                  <span>Hora de salida</span>
                  <strong>{formatDateTime(trip.horaSalida)}</strong>
                </article>

                <article>
                  <span>Hora de llegada</span>
                  <strong>{formatDateTime(trip.horaLlegada)}</strong>
                </article>

                <article>
                  <span>Kilometraje inicial</span>
                  <strong>{trip.kilometrajeInicial ?? "Sin registro"}</strong>
                </article>

                <article>
                  <span>Kilometraje final</span>
                  <strong>{trip.kilometrajeFinal ?? "Sin registro"}</strong>
                </article>

                <article>
                  <span>Kilómetros recorridos</span>
                  <strong>
                    {trip.kilometrosRecorridos !== null && trip.kilometrosRecorridos !== undefined
                      ? `${trip.kilometrosRecorridos} km`
                      : "Sin registro"}
                  </strong>
                </article>

                <article>
                  <span>Licencia vigente</span>
                  <strong>{trip.licenciaVigente ? "Sí" : "No"}</strong>
                </article>
              </section>

              <section className="trip-route-detail">
                <div>
                  <span>Origen</span>
                  <strong>{trip.origen?.nombre || "Sin origen"}</strong>
                  <small>{trip.origen?.direccion || "Sin dirección"}</small>
                </div>

                <span className="trip-route-arrow">→</span>

                <div>
                  <span>Destino</span>
                  <strong>{trip.destino?.nombre || "Sin destino"}</strong>
                  <small>{trip.destino?.direccion || "Sin dirección"}</small>
                </div>
              </section>

              <section className="trip-text-detail">
                <div>
                  <span>Motivo</span>
                  <p>{trip.motivo || "Sin motivo registrado."}</p>
                </div>

                <div>
                  <span>Acompañantes</span>
                  <p>
                    {trip.acompanantes?.length
                      ? trip.acompanantes
                          .map((a) => (typeof a === "string" ? a : a?.nombre))
                          .filter(Boolean)
                          .join(", ")
                      : "Sin acompañantes"}
                  </p>
                </div>
              </section>

              {locations.filter((l) => l.es_punto_intermedio).length > 0 && (
                <div
                  className="intermediate-points-container"
                  style={{
                    marginTop: "8px",
                    padding: "14px",
                    background: "#f8fafc",
                    borderRadius: "10px",
                    border: "1px solid #e2e8f0"
                  }}
                >
                  <h4
                    style={{
                      margin: "0 0 10px 0",
                      color: "#0f172a",
                      fontSize: "0.88rem",
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      gap: "6px"
                    }}
                  >
                    <IconMapPin size={16} />
                    <span>Puntos Intermedios Registrados ({locations.filter((l) => l.es_punto_intermedio).length})</span>
                  </h4>

                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {locations
                      .filter((l) => l.es_punto_intermedio)
                      .map((pt, idx) => (
                        <div
                          key={pt.id_ubicaciones_viaje || idx}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            background: "#ffffff",
                            padding: "8px 12px",
                            borderRadius: "8px",
                            border: "1px solid #cbd5e1"
                          }}
                        >
                          <div>
                            <strong style={{ color: "#0369a1", fontSize: "0.85rem" }}>
                              {pt.nombre_punto || `Punto Intermedio ${idx + 1}`}
                            </strong>
                            <small style={{ display: "block", color: "#64748b", marginTop: "2px" }}>
                              {formatDate(pt.fecha_gps)} · Lat: {Number(pt.latitud).toFixed(5)}, Lng: {Number(pt.longitud).toFixed(5)}
                            </small>
                          </div>

                          <a
                            href={`https://www.google.com/maps?q=${pt.latitud},${pt.longitud}`}
                            target="_blank"
                            rel="noreferrer"
                            className="secondary-button"
                            style={{
                              fontSize: "0.78rem",
                              padding: "4px 10px",
                              textDecoration: "none",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px"
                            }}
                          >
                            <span>Google Maps</span>
                            <IconExternal size={12} />
                          </a>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>

            {/* Columna Derecha: Mapa Leaflet */}
            <div className="trip-detail-right-col">
              <div
                className="map-column-header"
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "6px"
                }}
              >
                <span style={{ fontWeight: "700", color: "#0f172a", fontSize: "0.92rem", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                  <IconMap size={16} />
                  <span>Trazado de Ruta y Ubicación GPS</span>
                </span>

                <span
                  style={{
                    fontSize: "0.78rem",
                    color: "#0369a1",
                    background: "#e0f2fe",
                    padding: "3px 10px",
                    borderRadius: "12px",
                    fontWeight: "700"
                  }}
                >
                  {locations.length} puntos GPS
                  {locations.filter((l) => l.es_punto_intermedio).length > 0
                    ? ` · ${locations.filter((l) => l.es_punto_intermedio).length} paradas`
                    : ""}
                </span>
              </div>

              <div className="map-container-box">
                <TripMap
                  locations={locations.map((loc) => ({
                    idUbicacion: loc.id_ubicaciones_viaje,
                    latitud: loc.latitud,
                    longitud: loc.longitud,
                    fechaGps: loc.fecha_gps,
                    precisionMetros: loc.precision_metros,
                    velocidad: loc.velocidad,
                    esPuntoIntermedio: loc.es_punto_intermedio,
                    nombrePunto: loc.nombre_punto
                  }))}
                />
              </div>

              <footer className="trip-detail-footer" style={{ marginTop: "12px", display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={onClose}
                >
                  Cerrar
                </button>
              </footer>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
