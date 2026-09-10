import {
  useEffect,
  useState
} from "react";

import {
  deleteAdminViaje,
  getAdminViajeDetalle,
  getAdminViajes
} from "../services/api.js";
import TripMap from "../components/TripMap.jsx";

function formatDate(value) {
  if (!value) {
    return "Sin fecha";
  }

  const datePart =
    String(value).match(
      /^\d{4}-\d{2}-\d{2}/
    )?.[0];

  if (!datePart) {
    return "Fecha no válida";
  }

  const date =
    new Date(
      `${datePart}T00:00:00`
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "Fecha no válida";
  }

  return date.toLocaleDateString(
    "es-MX"
  );
}

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

function getStatusClass(
  status
) {
  const normalized =
    String(status || "")
      .toUpperCase();

  if (
    normalized === "FINALIZADO"
  ) {
    return "trip-status trip-status-finished";
  }

  if (
    normalized === "EN_CURSO"
  ) {
    return "trip-status trip-status-progress";
  }

  if (
    normalized === "CANCELADO"
  ) {
    return "trip-status trip-status-cancelled";
  }

  return "trip-status trip-status-pending";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function ViajesPage({ user }) {
  const canDelete = user?.rol === "ADMINISTRADOR";
  const [viajes, setViajes] =
    useState([]);

  const [search, setSearch] =
    useState("");

  const [status, setStatus] =
    useState("TODOS");

  const [dateFrom, setDateFrom] =
    useState("");

  const [dateTo, setDateTo] =
    useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const [loading, setLoading] =
    useState(true);

  const [message, setMessage] =
    useState("");

  const [messageType, setMessageType] =
    useState("success");

  const [selectedTrip, setSelectedTrip] =
    useState(null);

  const [selectedLocations, setSelectedLocations] =
    useState([]);

  const [showDetail, setShowDetail] =
    useState(false);

  const [loadingDetail, setLoadingDetail] =
    useState(false);

  const [tripToDelete, setTripToDelete] =
    useState(null);

  const [deleteConfirmation, setDeleteConfirmation] =
    useState("");

  const [deleting, setDeleting] =
    useState(false);

  async function loadViajes() {
    setLoading(true);
    setMessage("");

    try {
      const response =
        await getAdminViajes({
          search,
          status,
          dateFrom,
          dateTo
        });

      setViajes(
        response.data ?? []
      );
      setCurrentPage(1);
    } catch (error) {
      setMessage(error.message);
      setMessageType("error");
      setViajes([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeoutId =
      window.setTimeout(() => {
        loadViajes();
      }, 300);

    return () => {
      window.clearTimeout(
        timeoutId
      );
    };
  }, [
    search,
    status,
    dateFrom,
    dateTo
  ]);

  useEffect(() => {
    const modalOpen =
      showDetail ||
      Boolean(tripToDelete);

    if (!modalOpen) {
      return undefined;
    }

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow =
      "hidden";

    function handleKeyDown(event) {
      if (
        event.key !== "Escape"
      ) {
        return;
      }

      if (
        tripToDelete &&
        !deleting
      ) {
        closeDeleteModal();
        return;
      }

      if (
        showDetail &&
        !loadingDetail
      ) {
        closeDetailModal();
      }
    }

    window.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown
      );

      document.body.style.overflow =
        previousOverflow;
    };
  }, [
    showDetail,
    tripToDelete,
    deleting,
    loadingDetail
  ]);

  async function openTripDetail(
    idViaje
  ) {
    setLoadingDetail(true);
    setMessage("");
    setShowDetail(true);

    try {
      const response =
        await getAdminViajeDetalle(
          idViaje
        );

      setSelectedTrip(
        response.data?.trip ?? null
      );

      setSelectedLocations(
        response.data?.locations ?? []
      );
    } catch (error) {
      setMessage(error.message);
      setMessageType("error");
      setSelectedTrip(null);
      setSelectedLocations([]);
      setShowDetail(false);
    } finally {
      setLoadingDetail(false);
    }
  }

  function closeDetailModal() {
    if (loadingDetail) {
      return;
    }

    setShowDetail(false);
    setSelectedTrip(null);
    setSelectedLocations([]);
  }

  function openDeleteModal(
    trip
  ) {
    setTripToDelete(trip);
    setDeleteConfirmation("");
    setMessage("");
  }

  function closeDeleteModal() {
    if (deleting) {
      return;
    }

    setTripToDelete(null);
    setDeleteConfirmation("");
  }

  async function handleDeleteTrip() {
    if (!tripToDelete) {
      return;
    }

    if (
      deleteConfirmation !==
      tripToDelete.folio
    ) {
      setMessage(
        "Escribe el folio exactamente para confirmar la eliminación."
      );
      setMessageType("error");
      return;
    }

    setDeleting(true);
    setMessage("");

    try {
      const response =
        await deleteAdminViaje(
          tripToDelete.idViaje
        );

      setMessage(
        response.message ||
        "Viaje eliminado correctamente."
      );

      setMessageType("success");
      closeDeleteModal();

      await loadViajes();
    } catch (error) {
      setMessage(error.message);
      setMessageType("error");
    } finally {
      setDeleting(false);
    }
  }

  function clearFilters() {
    setSearch("");
    setStatus("TODOS");
    setDateFrom("");
    setDateTo("");
    setCurrentPage(1);
  }

  async function exportTripsPdf() {
    const printWindow = window.open("", "_blank");

    if (!printWindow) {
      setMessage("Permite las ventanas emergentes para exportar el PDF.");
      setMessageType("error");
      return;
    }

    try {
      const activeFilters = { search, status, dateFrom, dateTo };
      const response = await getAdminViajes(activeFilters);
      const trips = response.data ?? [];
      const filterSummary = [
        search.trim() ? `Búsqueda: ${search.trim()}` : null,
        status !== "TODOS" ? `Estado: ${status.replaceAll("_", " ")}` : null,
        dateFrom ? `Desde: ${formatDate(dateFrom)}` : null,
        dateTo ? `Hasta: ${formatDate(dateTo)}` : null
      ].filter(Boolean).join(" · ") || "Sin filtros aplicados";
      const rows = trips.map((trip) => `
        <tr>
          <td>${escapeHtml(trip.folio)}</td>
          <td>${escapeHtml(formatDate(trip.fecha))}</td>
          <td>${escapeHtml(trip.conductor?.nombre || "Sin conductor")}</td>
          <td>${escapeHtml(trip.vehiculo?.nombre || "Sin unidad")}</td>
          <td>${escapeHtml(trip.vehiculo?.numeroEconomico || "")}</td>
          <td>${escapeHtml(trip.origen?.nombre || "")}</td>
          <td>${escapeHtml(trip.destino?.nombre || "")}</td>
          <td>${escapeHtml(trip.estado?.nombre || "")}</td>
        </tr>
      `).join("");

      printWindow.document.write(`
        <!doctype html>
        <html lang="es">
          <head>
            <title>Histórico de viajes</title>
            <style>
              body { font-family: Arial, sans-serif; color: #172f3b; margin: 28px; }
              h1 { margin: 0 0 6px; font-size: 22px; }
              p { margin: 0 0 20px; color: #526b78; }
              table { width: 100%; border-collapse: collapse; font-size: 10px; }
              th, td { padding: 7px; border: 1px solid #cfdde3; text-align: left; }
              th { background: #e9f4f8; }
              @page { size: landscape; margin: 14mm; }
            </style>
          </head>
          <body>
            <h1>Histórico de viajes</h1>
            <p>Generado el ${escapeHtml(new Date().toLocaleString("es-MX"))}. Total: ${trips.length} viajes.</p>
            <p>Filtros: ${escapeHtml(filterSummary)}</p>
            <table>
              <thead><tr><th>Folio</th><th>Fecha</th><th>Conductor</th><th>Unidad</th><th>Núm. económico</th><th>Origen</th><th>Destino</th><th>Estado</th></tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
      setMessage("El histórico está listo para guardarse como PDF.");
      setMessageType("success");
    } catch (error) {
      printWindow.close();
      setMessage(error.message);
      setMessageType("error");
    }
  }

  async function exportTripsCsv() {
    try {
      const response = await getAdminViajes({ search, status, dateFrom, dateTo });
      const trips = response.data ?? [];
      const escapeCsv = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
      const rows = trips.map((trip) => [
        trip.folio,
        formatDate(trip.fecha),
        trip.conductor?.nombre || "",
        trip.vehiculo?.nombre || "",
        trip.vehiculo?.numeroEconomico || "",
        trip.origen?.nombre || "",
        trip.destino?.nombre || "",
        trip.estado?.nombre || "",
        trip.totalUbicaciones ?? 0
      ].map(escapeCsv).join(";"));
      const csv = [
        [
          "Folio",
          "Fecha",
          "Conductor",
          "Unidad",
          "Número económico",
          "Origen",
          "Destino",
          "Estado",
          "Ubicaciones GPS"
        ].map(escapeCsv).join(";"),
        ...rows
      ].join("\r\n");
      const blob = new Blob(["\uFEFF", csv], {
        type: "text/csv;charset=utf-8"
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `historico-viajes-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      setMessage("El archivo CSV para Excel se descargó correctamente.");
      setMessageType("success");
    } catch (error) {
      setMessage(error.message);
      setMessageType("error");
    }
  }

  const totalFiltered = viajes.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / itemsPerPage));
  const paginatedViajes = viajes.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <section className="module-page">
      <header className="module-header">
        <div>
          <span className="module-label">
            Administración
          </span>

          <h1>Viajes</h1>

          <p>
            Consulta el historial,
            revisa detalles y elimina
            viajes de prueba.
          </p>
        </div>
      </header>

      <section className="trips-toolbar">
        <label>
          <span>Buscar</span>

          <input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setCurrentPage(1);
            }}
            placeholder="Folio, conductor, unidad, origen o destino"
          />
        </label>

        <label>
          <span>Estado</span>

          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setCurrentPage(1);
            }}
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

        <label>
          <span>Desde</span>

          <div className="date-input-wrapper">
            <input
              type="date"
              value={dateFrom}
              onChange={(event) => {
                setDateFrom(event.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
        </label>

        <label>
          <span>Hasta</span>

          <div className="date-input-wrapper">
            <input
              type="date"
              value={dateTo}
              onChange={(event) => {
                setDateTo(event.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
        </label>

        <button
          type="button"
          className="secondary-button"
          onClick={clearFilters}
        >
          Limpiar filtros
        </button>

        <button
          type="button"
          className="primary-button"
          onClick={exportTripsPdf}
        >
          Exportar PDF
        </button>

        <button
          type="button"
          className="secondary-button"
          onClick={exportTripsCsv}
        >
          Exportar CSV
        </button>
      </section>

      {message && (
        <p
          className={`module-message module-message-${messageType}`}
          role={
            messageType === "error"
              ? "alert"
              : "status"
          }
        >
          {message}
        </p>
      )}

      <section className="table-panel">
        {loading ? (
          <p className="table-status">
            Cargando viajes...
          </p>
        ) : viajes.length === 0 ? (
          <p className="table-status">
            No se encontraron viajes.
          </p>
        ) : (
          <>
            <div className="table-wrapper">
              <table className="admin-table trips-table">
                <thead>
                  <tr>
                    <th>Folio</th>
                    <th>Fecha</th>
                    <th>Conductor</th>
                    <th>Unidad</th>
                    <th>Ruta</th>
                    <th>Estado</th>
                    <th>GPS</th>
                    <th>Acciones</th>
                  </tr>
                </thead>

                <tbody>
                  {paginatedViajes.map(
                    (trip) => (
                    <tr
                      key={trip.idViaje}
                    >
                      <td>
                        <strong>
                          {trip.folio}
                        </strong>
                      </td>

                      <td>
                        {formatDate(
                          trip.fecha
                        )}
                      </td>

                      <td>
                        {trip.conductor
                          ?.nombre ||
                          "Sin conductor"}
                      </td>

                      <td>
                        <strong>
                          {trip.vehiculo
                            ?.nombre ||
                            "Sin unidad"}
                        </strong>

                        <small>
                          {trip.vehiculo
                            ?.numeroEconomico ||
                            "Sin número económico"}
                        </small>
                      </td>

                      <td>
                        <span>
                          {trip.origen
                            ?.nombre ||
                            "Sin origen"}
                        </span>

                        <small>
                          {"→ "}
                          {trip.destino
                            ?.nombre ||
                            "Sin destino"}
                        </small>
                      </td>

                      <td>
                        <span
                          className={
                            getStatusClass(
                              trip.estado
                                ?.nombre
                            )
                          }
                        >
                          {trip.estado
                            ?.nombre ||
                            "Sin estado"}
                        </span>
                      </td>

                      <td>
                        {trip.totalUbicaciones ??
                          0}
                      </td>

                      <td>
                        <div className="table-actions">
                          <button
                            type="button"
                            className="edit-button"
                            onClick={() =>
                              openTripDetail(
                                trip.idViaje
                              )
                            }
                          >
                            Ver detalle
                          </button>

                          {canDelete && <button
                            type="button"
                            className="danger-button"
                            onClick={() =>
                              openDeleteModal(
                                trip
                              )
                            }
                          >
                            Eliminar
                          </button>}
                        </div>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
            </div>

            {totalFiltered > 0 && (
              <div className="table-pagination">
                <span className="pagination-info">
                  Mostrando {Math.min((currentPage - 1) * itemsPerPage + 1, totalFiltered)} - {Math.min(currentPage * itemsPerPage, totalFiltered)} de {totalFiltered} viajes
                </span>
                <div className="pagination-controls">
                  <button
                    type="button"
                    className="pagination-btn"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    ← Anterior
                  </button>
                  <span className="pagination-page-indicator">
                    Página {currentPage} de {totalPages}
                  </span>
                  <button
                    type="button"
                    className="pagination-btn"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Siguiente →
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {showDetail && (
        <div
          className="modal-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeDetailModal();
            }
          }}
        >
          <section
            className="modal-card trip-detail-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="trip-detail-title"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >
            <div className="form-panel-header">
              <div>
                <span className="module-label">
                  Detalle del viaje
                </span>

                <h2 id="trip-detail-title">
                  {selectedTrip?.folio ||
                    "Cargando..."}
                </h2>
              </div>

              <button
                type="button"
                className="close-button"
                onClick={closeDetailModal}
                disabled={loadingDetail}
                aria-label="Cerrar detalle"
              >
                ×
              </button>
            </div>

            {loadingDetail ? (
              <p className="table-status">
                Cargando detalle...
              </p>
            ) : selectedTrip ? (
              <div className="trip-detail-content-split">
                {/* Columna Izquierda: Datos Completos del Viaje */}
                <div className="trip-detail-left-col">
                  <section className="trip-detail-grid">
                    <article>
                      <span>Estado</span>
                      <strong>
                        {selectedTrip.estado?.nombre || "Sin estado"}
                      </strong>
                    </article>

                    <article>
                      <span>Fecha</span>
                      <strong>
                        {formatDate(selectedTrip.fecha)}
                      </strong>
                    </article>

                    <article>
                      <span>Conductor</span>
                      <strong>
                        {selectedTrip.conductor?.nombre || "Sin conductor"}
                      </strong>
                    </article>

                    <article>
                      <span>Unidad</span>
                      <strong>
                        {selectedTrip.vehiculo?.nombre || "Sin unidad"}
                      </strong>
                    </article>

                    <article>
                      <span>Número económico</span>
                      <strong>
                        {selectedTrip.vehiculo?.numeroEconomico || "Sin registro"}
                      </strong>
                    </article>

                    <article>
                      <span>Placas</span>
                      <strong>
                        {selectedTrip.vehiculo?.placas || "Sin registro"}
                      </strong>
                    </article>

                    <article>
                      <span>Hora de salida</span>
                      <strong>
                        {formatDateTime(selectedTrip.horaSalida)}
                      </strong>
                    </article>

                    <article>
                      <span>Hora de llegada</span>
                      <strong>
                        {formatDateTime(selectedTrip.horaLlegada)}
                      </strong>
                    </article>

                    <article>
                      <span>Kilometraje inicial</span>
                      <strong>
                        {selectedTrip.kilometrajeInicial ?? "Sin registro"}
                      </strong>
                    </article>

                    <article>
                      <span>Kilometraje final</span>
                      <strong>
                        {selectedTrip.kilometrajeFinal ?? "Sin registro"}
                      </strong>
                    </article>

                    <article>
                      <span>Kilómetros recorridos</span>
                      <strong>
                        {selectedTrip.kilometrosRecorridos ?? "Sin registro"}
                      </strong>
                    </article>

                    <article>
                      <span>Licencia vigente</span>
                      <strong>
                        {selectedTrip.licenciaVigente ? "Sí" : "No"}
                      </strong>
                    </article>
                  </section>

                  <section className="trip-route-detail">
                    <div>
                      <span>Origen</span>
                      <strong>
                        {selectedTrip.origen?.nombre || "Sin origen"}
                      </strong>
                      <small>
                        {selectedTrip.origen?.direccion || "Sin dirección"}
                      </small>
                    </div>

                    <span className="trip-route-arrow">→</span>

                    <div>
                      <span>Destino</span>
                      <strong>
                        {selectedTrip.destino?.nombre || "Sin destino"}
                      </strong>
                      <small>
                        {selectedTrip.destino?.direccion || "Sin dirección"}
                      </small>
                    </div>
                  </section>

                  <section className="trip-text-detail">
                    <div>
                      <span>Motivo</span>
                      <p>
                        {selectedTrip.motivo || "Sin motivo registrado."}
                      </p>
                    </div>

                    <div>
                      <span>Acompañantes</span>
                      <p>
                        {selectedTrip.acompanantes?.length
                          ? selectedTrip.acompanantes
                              .map((acompanante) =>
                                typeof acompanante === "string"
                                  ? acompanante
                                  : acompanante?.nombre
                              )
                              .filter(Boolean)
                              .join(", ")
                          : "Sin acompañantes"}
                      </p>
                    </div>
                  </section>

                  {selectedLocations.filter(l => l.es_punto_intermedio).length > 0 && (
                    <div className="intermediate-points-container" style={{ marginTop: "8px", padding: "14px", background: "#fff5f5", borderRadius: "8px", border: "1px solid #fecaca" }}>
                      <h4 style={{ margin: "0 0 10px 0", color: "#991b1b", fontSize: "0.9rem", display: "flex", alignItems: "center", gap: "6px" }}>
                        🔴 Puntos Intermedios Registrados ({selectedLocations.filter(l => l.es_punto_intermedio).length})
                      </h4>
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        {selectedLocations.filter(l => l.es_punto_intermedio).map((pt, idx) => (
                          <div key={pt.id_ubicaciones_viaje || idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#ffffff", padding: "8px 12px", borderRadius: "6px", border: "1px solid #fee2e2" }}>
                            <div>
                              <strong style={{ color: "#dc2626", fontSize: "0.85rem" }}>
                                🔴 {pt.nombre_punto || `Punto Intermedio ${idx + 1}`}
                              </strong>
                              <small style={{ display: "block", color: "#64748b", marginTop: "2px" }}>
                                {formatDate(pt.fecha_gps)} · Lat: {Number(pt.latitud).toFixed(6)}, Lng: {Number(pt.longitud).toFixed(6)}
                              </small>
                            </div>
                            <a
                              href={`https://www.google.com/maps?q=${pt.latitud},${pt.longitud}`}
                              target="_blank"
                              rel="noreferrer"
                              className="secondary-button"
                              style={{ fontSize: "0.8rem", padding: "4px 10px", textDecoration: "none", whiteSpace: "nowrap" }}
                            >
                              🗺️ Google Maps
                            </a>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Columna Derecha: Mapa Leaflet y Recreación de Ruta A Todo lo Ancho */}
                <div className="trip-detail-right-col">
                  <div className="map-column-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                    <span style={{ fontWeight: "700", color: "#0f172a", fontSize: "0.95rem" }}>
                      🗺️ Trazado de Ruta y Ubicación GPS
                    </span>
                    <span style={{ fontSize: "0.82rem", color: "#475569", background: "#e2e8f0", padding: "3px 10px", borderRadius: "12px", fontWeight: "600" }}>
                      {selectedLocations.length} puntos GPS {selectedLocations.filter(l => l.es_punto_intermedio).length > 0 ? `· ${selectedLocations.filter(l => l.es_punto_intermedio).length} paradas` : ""}
                    </span>
                  </div>

                  <div className="map-container-box">
                    <TripMap locations={selectedLocations.map((location) => ({
                      idUbicacion: location.id_ubicaciones_viaje,
                      latitud: location.latitud,
                      longitud: location.longitud,
                      fechaGps: location.fecha_gps,
                      precisionMetros: location.precision_metros,
                      velocidad: location.velocidad,
                      esPuntoIntermedio: location.es_punto_intermedio,
                      nombrePunto: location.nombre_punto
                    }))} />
                  </div>

                  <footer className="trip-detail-footer">
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={closeDetailModal}
                    >
                      Cerrar Detalle
                    </button>
                  </footer>
                </div>
              </div>
            ) : (
              <p className="table-status">
                No fue posible cargar el viaje.
              </p>
            )}
          </section>
        </div>
      )}

      {tripToDelete && (
        <div
          className="modal-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeDeleteModal();
            }
          }}
        >
          <section
            className="modal-card delete-trip-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-trip-title"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >
            <div className="form-panel-header">
              <div>
                <span className="danger-label">
                  Acción irreversible
                </span>

                <h2 id="delete-trip-title">
                  Eliminar viaje
                </h2>
              </div>

              <button
                type="button"
                className="close-button"
                onClick={closeDeleteModal}
                disabled={deleting}
                aria-label="Cerrar confirmación"
              >
                ×
              </button>
            </div>

            <div className="delete-trip-warning">
              <p>
                Se eliminará permanentemente
                el viaje y sus ubicaciones GPS.
              </p>

              <strong>
                {tripToDelete.folio}
              </strong>
            </div>

            <label className="delete-confirmation-field">
              Escribe el folio para confirmar

              <input
                value={deleteConfirmation}
                onChange={(event) =>
                  setDeleteConfirmation(
                    event.target.value
                  )
                }
                placeholder={
                  tripToDelete.folio
                }
                disabled={deleting}
                autoFocus
              />
            </label>

            <div className="form-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={closeDeleteModal}
                disabled={deleting}
              >
                Cancelar
              </button>

              <button
                type="button"
                className="danger-solid-button"
                onClick={handleDeleteTrip}
                disabled={
                  deleting ||
                  deleteConfirmation !==
                    tripToDelete.folio
                }
              >
                {deleting
                  ? "Eliminando..."
                  : "Eliminar definitivamente"}
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

export default ViajesPage;
