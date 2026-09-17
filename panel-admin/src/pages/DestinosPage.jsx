import {
  useEffect,
  useRef,
  useState
} from "react";
import * as XLSX from "xlsx";

import {
  createAdminDestino,
  deleteAdminDestino,
  getAdminDestinos,
  importAdminDestinos,
  updateAdminDestino,
  updateAdminDestinoStatus
} from "../services/api.js";

const initialForm = {
  idDestino: null,
  nombre: "",
  direccion: "",
  latitud: "",
  longitud: ""
};

function DestinosPage({ user }) {
  const canEdit = user?.rol === "ADMINISTRADOR";
  const canCreate = [
    "ADMINISTRADOR",
    "GERENTE",
    "GERENTE_GENERAL",
    "COORDINADOR",
    "COORDINADOR_AREA",
    "COORDINADOR_QHSE",
    "SUPERVISOR",
    "QHSE",
    "INSTRUCTOR"
  ].includes(user?.rol);

  const [destinos, setDestinos] = useState([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("TODOS");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");

  // Modal Crear / Editar
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(initialForm);
  const isEditing = Boolean(form.idDestino);
  const [saving, setSaving] = useState(false);
  const submittingRef = useRef(false);

  // Modal Ver Detalle
  const [detailDestino, setDetailDestino] = useState(null);

  // Modal Confirmación (Baja / Reactivación / Eliminación)
  const [confirmAction, setConfirmAction] = useState(null); // { type: 'status'|'delete', destino, nextStatus }
  const [updatingId, setUpdatingId] = useState(null);

  // Modal Importación Excel / CSV
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importRows, setImportRows] = useState([]);
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState(null);
  const fileInputRef = useRef(null);

  async function loadDestinos() {
    setLoading(true);

    try {
      const response = await getAdminDestinos({
        search,
        status
      });

      setDestinos(response.data ?? []);
      setCurrentPage(1);
    } catch (error) {
      setMessage(error.message);
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadDestinos();
    }, 300);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [search, status]);

  // Manejo de tecla Escape para cerrar modales activos
  useEffect(() => {
    const anyModalOpen = showForm || Boolean(detailDestino) || Boolean(confirmAction) || showImportModal;
    if (!anyModalOpen) return undefined;

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        if (showForm && !saving) closeForm();
        if (detailDestino) setDetailDestino(null);
        if (confirmAction && !updatingId) setConfirmAction(null);
        if (showImportModal && !importing) closeImportModal();
      }
    }

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [showForm, saving, detailDestino, confirmAction, updatingId, showImportModal, importing]);

  // Funciones Modal Formulario
  function openCreateForm() {
    setForm(initialForm);
    setMessage("");
    setShowForm(true);
  }

  function openEditForm(destino) {
    setForm({
      idDestino: destino.id_lugares,
      nombre: destino.nombre || "",
      direccion: destino.direccion || "",
      latitud: destino.latitud !== null && destino.latitud !== undefined ? String(destino.latitud) : "",
      longitud: destino.longitud !== null && destino.longitud !== undefined ? String(destino.longitud) : ""
    });
    setMessage("");
    setShowForm(true);
  }

  function closeForm() {
    if (saving) return;
    setShowForm(false);
    setForm(initialForm);
  }

  function handleFormChange(event) {
    const { name, value } = event.target;
    setForm((curr) => ({
      ...curr,
      [name]: value
    }));
    setMessage("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (submittingRef.current) return;

    const nombre = form.nombre.replace(/\s+/g, " ").trim();
    const direccion = form.direccion.replace(/\s+/g, " ").trim();
    const latStr = String(form.latitud || "").trim();
    const lngStr = String(form.longitud || "").trim();

    if (nombre.length < 2) {
      setMessage("El nombre del destino debe tener al menos 2 caracteres.");
      setMessageType("error");
      return;
    }

    let latitud = null;
    if (latStr) {
      const latNum = Number(latStr);
      if (isNaN(latNum) || latNum < -90 || latNum > 90) {
        setMessage("La latitud debe ser un número válido entre -90 y 90.");
        setMessageType("error");
        return;
      }
      latitud = latNum;
    }

    let longitud = null;
    if (lngStr) {
      const lngNum = Number(lngStr);
      if (isNaN(lngNum) || lngNum < -180 || lngNum > 180) {
        setMessage("La longitud debe ser un número válido entre -180 y 180.");
        setMessageType("error");
        return;
      }
      longitud = lngNum;
    }

    submittingRef.current = true;
    setSaving(true);
    setMessage("");

    try {
      const payload = {
        nombre,
        direccion: direccion || null,
        latitud,
        longitud
      };

      const response = isEditing
        ? await updateAdminDestino(form.idDestino, payload)
        : await createAdminDestino(payload);

      setMessage(
        response.message ||
          (isEditing
            ? "Destino actualizado correctamente."
            : "Destino creado correctamente.")
      );
      setMessageType("success");
      setShowForm(false);
      setForm(initialForm);

      await loadDestinos();
    } catch (error) {
      setMessage(error.message);
      setMessageType("error");
    } finally {
      submittingRef.current = false;
      setSaving(false);
    }
  }

  // Funciones Modal Confirmación
  function requestStatusChange(destino) {
    setConfirmAction({
      type: "status",
      destino,
      nextStatus: !destino.activo
    });
  }

  function requestDelete(destino) {
    setConfirmAction({
      type: "delete",
      destino
    });
  }

  async function executeConfirmAction() {
    if (!confirmAction || updatingId) return;

    const { type, destino, nextStatus } = confirmAction;
    setUpdatingId(destino.id_lugares);
    setMessage("");

    try {
      if (type === "status") {
        const response = await updateAdminDestinoStatus(destino.id_lugares, nextStatus);
        setDestinos((curr) =>
          curr.map((item) =>
            item.id_lugares === destino.id_lugares
              ? { ...item, ...response.data }
              : item
          )
        );
        setMessage(response.message || (nextStatus ? "Destino reactivado." : "Destino dado de baja."));
        setMessageType("success");

        if ((status === "ACTIVOS" && !nextStatus) || (status === "INACTIVOS" && nextStatus)) {
          await loadDestinos();
        }
      } else if (type === "delete") {
        const response = await deleteAdminDestino(destino.id_lugares);
        setDestinos((curr) => curr.filter((item) => item.id_lugares !== destino.id_lugares));
        setMessage(response.message || `Destino "${destino.nombre}" eliminado correctamente.`);
        setMessageType("success");
      }

      setConfirmAction(null);
    } catch (error) {
      setMessage(error.message);
      setMessageType("error");
    } finally {
      setUpdatingId(null);
    }
  }

  // Funciones de Importación Excel / CSV
  function openImportModal() {
    setImportFile(null);
    setImportRows([]);
    setImportSummary(null);
    setShowImportModal(true);
  }

  function closeImportModal() {
    if (importing) return;
    setShowImportModal(false);
    setImportFile(null);
    setImportRows([]);
    setImportSummary(null);
  }

  function handleFileSelected(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportFile(file);
    setImportSummary(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawJson = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });

        if (!rawJson || rawJson.length <= 1) {
          setMessage("El archivo seleccionado no contiene filas de datos.");
          setMessageType("error");
          setImportRows([]);
          return;
        }

        const header = rawJson[0].map((h) => String(h || "").toLowerCase().trim());
        const idxNombre = header.findIndex((h) => h.includes("nombre"));
        const idxDireccion = header.findIndex((h) => h.includes("direccion") || h.includes("dirección"));
        const idxLatitud = header.findIndex((h) => h.includes("latitud") || h.includes("lat"));
        const idxLongitud = header.findIndex((h) => h.includes("longitud") || h.includes("lon") || h.includes("lng"));

        const parsed = rawJson.slice(1).map((r) => {
          const rawNombre = String(idxNombre !== -1 ? r[idxNombre] : r[0] || "").trim();
          const rawDir = String(idxDireccion !== -1 ? r[idxDireccion] : r[1] || "").trim();
          const rawLat = idxLatitud !== -1 ? r[idxLatitud] : r[2];
          const rawLng = idxLongitud !== -1 ? r[idxLongitud] : r[3];

          const latNum = parseFloat(rawLat);
          const lngNum = parseFloat(rawLng);

          return {
            nombre: rawNombre,
            direccion: rawDir || null,
            latitud: !isNaN(latNum) && latNum >= -90 && latNum <= 90 ? latNum : null,
            longitud: !isNaN(lngNum) && lngNum >= -180 && lngNum <= 180 ? lngNum : null
          };
        }).filter((r) => r.nombre.length >= 2);

        setImportRows(parsed);
      } catch (err) {
        console.error("Error leyendo archivo:", err);
        setMessage("No se pudo procesar el archivo. Verifica que sea un formato válido (.xlsx, .xls o .csv).");
        setMessageType("error");
      }
    };

    reader.readAsArrayBuffer(file);
  }

  async function handleConfirmImport() {
    if (importRows.length === 0 || importing) return;

    setImporting(true);
    try {
      const response = await importAdminDestinos(importRows);
      setImportSummary(response.data);
      setMessage(response.message || "Importación completada con éxito.");
      setMessageType("success");
      await loadDestinos();
    } catch (error) {
      setMessage(error.message);
      setMessageType("error");
    } finally {
      setImporting(false);
    }
  }

  // Descarga de Plantillas
  function downloadTemplateExcel() {
    const wsData = [
      ["Nombre", "Direccion", "Latitud", "Longitud"],
      ["Base Principal Campeche", "Av. Gobernadores 100, Barrio de Sta Ana, 24050 San Francisco de Campeche, Camp.", 19.83589, -90.52257],
      ["Casa Uayamón", "Carretera Uayamón s/n, Campeche", 19.85, -90.65],
      ["Tienda Six (Jardines)", "Orquídeas 21, Jardines, 24060 San Francisco de Campeche, Camp.", 19.83267, -90.51675]
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Destinos");
    XLSX.writeFile(wb, "plantilla_destinos.xlsx");
  }

  function downloadTemplateCsv() {
    const csvContent =
      "\uFEFF" +
      "Nombre,Direccion,Latitud,Longitud\r\n" +
      '"Base Principal Campeche","Av. Gobernadores 100, Barrio de Sta Ana, 24050 San Francisco de Campeche, Camp.",19.83589,-90.52257\r\n' +
      '"Casa Uayamón","Carretera Uayamón s/n, Campeche",19.85000,-90.65000\r\n' +
      '"Tienda Six (Jardines)","Orquídeas 21, Jardines, 24060 San Francisco de Campeche, Camp.",19.83267,-90.51675\r\n';

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "plantilla_destinos.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // Paginación
  const totalFiltered = destinos.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / itemsPerPage));
  const paginatedDestinos = destinos.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <section className="module-page">
      <header className="module-header">
        <div>
          <span className="module-label">Administración</span>
          <h1>Destinos</h1>
          <p>
            Consulta, administra e importa los lugares y destinos disponibles para la flota.
          </p>
        </div>

        <div className="destinos-header-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={downloadTemplateExcel}
            title="Descargar plantilla Excel para importación"
          >
            📥 Plantilla Excel
          </button>

          {canCreate && (
            <button
              type="button"
              className="secondary-button"
              onClick={openImportModal}
              title="Importar archivo Excel o CSV con destinos"
            >
              📄 Importar Excel / CSV
            </button>
          )}

          {canCreate && (
            <button
              type="button"
              className="primary-button"
              onClick={openCreateForm}
            >
              + Nuevo destino
            </button>
          )}
        </div>
      </header>

      <section className="module-toolbar">
        <label className="search-field">
          <span>Buscar</span>
          <input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setCurrentPage(1);
            }}
            placeholder="Buscar por nombre o dirección"
          />
        </label>

        <label className="status-filter">
          <span>Estado</span>
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="TODOS">Todos</option>
            <option value="ACTIVOS">Activos</option>
            <option value="INACTIVOS">Inactivos</option>
          </select>
        </label>
      </section>

      {message && (
        <p
          className={`module-message module-message-${messageType}`}
          role={messageType === "error" ? "alert" : "status"}
        >
          {message}
        </p>
      )}

      <section className="table-panel">
        {loading ? (
          <p className="table-status">Cargando destinos...</p>
        ) : destinos.length === 0 ? (
          <p className="table-status">No se encontraron destinos.</p>
        ) : (
          <>
            <div className="table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Destino</th>
                    <th>Dirección</th>
                    <th>Coordenadas GPS</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>

                <tbody>
                  {paginatedDestinos.map((destino) => {
                    const hasCoords =
                      destino.latitud !== null &&
                      destino.longitud !== null &&
                      destino.latitud !== undefined &&
                      destino.longitud !== undefined;

                    return (
                      <tr key={destino.id_lugares}>
                        <td>
                          <strong>{destino.nombre}</strong>
                        </td>

                        <td>
                          {destino.direccion || (
                            <span style={{ color: "#94a3b8", fontStyle: "italic" }}>
                              Sin dirección registrada
                            </span>
                          )}
                        </td>

                        <td>
                          {hasCoords ? (
                            <a
                              href={`https://www.google.com/maps?q=${destino.latitud},${destino.longitud}`}
                              target="_blank"
                              rel="noreferrer"
                              className="destinos-coords-badge"
                              title="Abrir ubicación en Google Maps"
                            >
                              📍 {Number(destino.latitud).toFixed(4)}, {Number(destino.longitud).toFixed(4)} ↗
                            </a>
                          ) : (
                            <span className="destinos-no-coords">Sin GPS</span>
                          )}
                        </td>

                        <td>
                          <span
                            className={
                              destino.activo
                                ? "status-badge status-active"
                                : "status-badge status-inactive"
                            }
                          >
                            {destino.activo ? "Activo" : "Inactivo"}
                          </span>
                        </td>

                        <td className="table-actions">
                          <button
                            type="button"
                            className="view-detail-button"
                            onClick={() => setDetailDestino(destino)}
                            title="Ver detalles completos del destino"
                          >
                            Ver detalle
                          </button>

                          {canEdit && (
                            <button
                              type="button"
                              className="edit-button"
                              onClick={() => openEditForm(destino)}
                              title="Editar nombre, dirección o coordenadas"
                            >
                              Editar
                            </button>
                          )}

                          {canEdit && (
                            <button
                              type="button"
                              className={destino.activo ? "danger-button" : "reactivate-button"}
                              onClick={() => requestStatusChange(destino)}
                              title={destino.activo ? "Dar de baja el destino" : "Reactivar el destino"}
                            >
                              {destino.activo ? "Dar de baja" : "Reactivar"}
                            </button>
                          )}

                          {canEdit && (
                            <button
                              type="button"
                              className="delete-destino-button"
                              onClick={() => requestDelete(destino)}
                              title="Eliminar destino permanentemente"
                            >
                              Eliminar
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {totalFiltered > 0 && (
              <div className="table-pagination">
                <span className="pagination-info">
                  Mostrando {Math.min((currentPage - 1) * itemsPerPage + 1, totalFiltered)} -{" "}
                  {Math.min(currentPage * itemsPerPage, totalFiltered)} de {totalFiltered} destinos
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

      {/* =========================================================
          MODAL 1: CREAR / EDITAR DESTINO
          ========================================================= */}
      {showForm && (
        <div
          className="modal-overlay"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeForm();
          }}
        >
          <section
            className="modal-card destination-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="form-destination-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="form-panel-header">
              <div>
                <h2 id="form-destination-title">
                  {isEditing ? "Editar destino" : "Nuevo destino"}
                </h2>
                <p>
                  {isEditing
                    ? "Modifica los datos del lugar o sus coordenadas de geolocalización."
                    : "Registra un lugar que podrá utilizarse como origen o destino de los viajes."}
                </p>
              </div>

              <button
                type="button"
                className="close-button"
                onClick={closeForm}
                aria-label="Cerrar formulario"
                disabled={saving}
              >
                ×
              </button>
            </div>

            <form className="destination-form" onSubmit={handleSubmit}>
              <label>
                Nombre del destino *
                <input
                  name="nombre"
                  value={form.nombre}
                  onChange={handleFormChange}
                  placeholder="Ej. Casa Uayamón o Tienda Six (Jardines)"
                  minLength="2"
                  maxLength="150"
                  autoFocus
                  required
                  disabled={saving}
                />
              </label>

              <label>
                Dirección completa
                <textarea
                  name="direccion"
                  value={form.direccion}
                  onChange={handleFormChange}
                  placeholder="Calle, número, colonia, ciudad y código postal"
                  rows="3"
                  maxLength="500"
                  disabled={saving}
                />
              </label>

              <div className="destinos-coords-grid">
                <label>
                  Latitud (GPS)
                  <input
                    type="number"
                    step="any"
                    name="latitud"
                    value={form.latitud}
                    onChange={handleFormChange}
                    placeholder="Ej. 19.818500"
                    disabled={saving}
                  />
                </label>

                <label>
                  Longitud (GPS)
                  <input
                    type="number"
                    step="any"
                    name="longitud"
                    value={form.longitud}
                    onChange={handleFormChange}
                    placeholder="Ej. -90.532501"
                    disabled={saving}
                  />
                </label>
              </div>

              {form.latitud && form.longitud && !isNaN(form.latitud) && !isNaN(form.longitud) && (
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <a
                    href={`https://www.google.com/maps?q=${form.latitud},${form.longitud}`}
                    target="_blank"
                    rel="noreferrer"
                    className="destinos-coords-badge"
                  >
                    📍 Probar ubicación en Google Maps ↗
                  </a>
                </div>
              )}

              <div className="form-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={closeForm}
                  disabled={saving}
                >
                  Cancelar
                </button>

                <button type="submit" className="primary-button" disabled={saving}>
                  {saving
                    ? "Guardando..."
                    : isEditing
                    ? "Guardar cambios"
                    : "Guardar destino"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* =========================================================
          MODAL 2: VER DETALLE DEL DESTINO
          ========================================================= */}
      {detailDestino && (
        <div
          className="modal-overlay"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setDetailDestino(null);
          }}
        >
          <section
            className="modal-card destinos-detail-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="detail-destination-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="form-panel-header">
              <div>
                <span className="module-label">Detalles del Destino</span>
                <h2 id="detail-destination-title" style={{ marginTop: "4px" }}>
                  {detailDestino.nombre}
                </h2>
              </div>

              <button
                type="button"
                className="close-button"
                onClick={() => setDetailDestino(null)}
                aria-label="Cerrar detalles"
              >
                ×
              </button>
            </div>

            <div className="destinos-detail-grid">
              <div className="destinos-detail-row">
                <span>Estado operativo</span>
                <div>
                  <span
                    className={
                      detailDestino.activo
                        ? "status-badge status-active"
                        : "status-badge status-inactive"
                    }
                  >
                    {detailDestino.activo ? "Activo (Disponible)" : "Inactivo (Dado de baja)"}
                  </span>
                </div>
              </div>

              <div className="destinos-detail-row">
                <span>Dirección registrada</span>
                <strong>
                  {detailDestino.direccion || "Sin dirección específica registrada."}
                </strong>
              </div>

              <div className="destinos-detail-row">
                <span>Coordenadas Geográficas (GPS)</span>
                {detailDestino.latitud !== null && detailDestino.longitud !== null ? (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px", marginTop: "4px" }}>
                    <strong>
                      Lat: {detailDestino.latitud} | Long: {detailDestino.longitud}
                    </strong>

                    <a
                      href={`https://www.google.com/maps?q=${detailDestino.latitud},${detailDestino.longitud}`}
                      target="_blank"
                      rel="noreferrer"
                      className="primary-button"
                      style={{ fontSize: "0.82rem", padding: "6px 14px" }}
                    >
                      📍 Abrir en Google Maps ↗
                    </a>
                  </div>
                ) : (
                  <span style={{ color: "#94a3b8", fontStyle: "italic" }}>
                    No cuenta con coordenadas GPS asignadas.
                  </span>
                )}
              </div>
            </div>

            <div className="form-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setDetailDestino(null)}
              >
                Cerrar
              </button>

              {canEdit && (
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => {
                    const d = detailDestino;
                    setDetailDestino(null);
                    openEditForm(d);
                  }}
                >
                  Editar Destino
                </button>
              )}
            </div>
          </section>
        </div>
      )}

      {/* =========================================================
          MODAL 3: CONFIRMACIÓN PERSONALIZADA (BAJA / REACTIVAR / ELIMINAR)
          ========================================================= */}
      {confirmAction && (
        <div
          className="modal-overlay"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !updatingId) setConfirmAction(null);
          }}
        >
          <section
            className="modal-card destinos-confirm-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-modal-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="form-panel-header">
              <div>
                <h2
                  id="confirm-modal-title"
                  style={{
                    color:
                      confirmAction.type === "delete"
                        ? "#dc2626"
                        : confirmAction.nextStatus
                        ? "#16a34a"
                        : "#d97706"
                  }}
                >
                  {confirmAction.type === "delete"
                    ? "¿Eliminar destino definitivamente?"
                    : confirmAction.nextStatus
                    ? "¿Reactivar destino?"
                    : "¿Dar de baja destino?"}
                </h2>
                <p>
                  {confirmAction.type === "delete"
                    ? "Esta acción eliminará el lugar de la base de datos de manera irreversible."
                    : confirmAction.nextStatus
                    ? "El destino volverá a estar disponible para el registro de viajes."
                    : "El destino ya no aparecerá como opción para nuevos viajes, pero se conservará en el historial."}
                </p>
              </div>

              <button
                type="button"
                className="close-button"
                onClick={() => setConfirmAction(null)}
                disabled={Boolean(updatingId)}
              >
                ×
              </button>
            </div>

            <div style={{ padding: "12px 0 20px" }}>
              <div className="destinos-detail-row" style={{ background: "#fff" }}>
                <span>Destino seleccionado</span>
                <strong>{confirmAction.destino.nombre}</strong>
                {confirmAction.destino.direccion && (
                  <small style={{ color: "#64748b" }}>{confirmAction.destino.direccion}</small>
                )}
              </div>
            </div>

            <div className="form-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setConfirmAction(null)}
                disabled={Boolean(updatingId)}
              >
                Cancelar
              </button>

              <button
                type="button"
                className={
                  confirmAction.type === "delete"
                    ? "delete-destino-button"
                    : confirmAction.nextStatus
                    ? "primary-button"
                    : "danger-button"
                }
                style={{ padding: "10px 18px", fontSize: "0.9rem" }}
                onClick={executeConfirmAction}
                disabled={Boolean(updatingId)}
              >
                {updatingId
                  ? "Procesando..."
                  : confirmAction.type === "delete"
                  ? "Sí, eliminar"
                  : confirmAction.nextStatus
                  ? "Sí, reactivar"
                  : "Sí, dar de baja"}
              </button>
            </div>
          </section>
        </div>
      )}

      {/* =========================================================
          MODAL 4: IMPORTACIÓN DE DESTINOS (EXCEL / CSV)
          ========================================================= */}
      {showImportModal && (
        <div
          className="modal-overlay"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !importing) closeImportModal();
          }}
        >
          <section
            className="modal-card destinos-import-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="import-modal-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="form-panel-header">
              <div>
                <h2 id="import-modal-title">Importar Destinos desde Excel o CSV</h2>
                <p>
                  Carga masiva de lugares y destinos con coordenadas geográficas automáticas.
                </p>
              </div>

              <button
                type="button"
                className="close-button"
                onClick={closeImportModal}
                disabled={importing}
              >
                ×
              </button>
            </div>

            {/* Barra de descarga de plantilla */}
            <div className="destinos-template-bar">
              <div>
                <strong style={{ fontSize: "0.88rem", color: "#1e293b" }}>
                  ¿No tienes el formato correcto?
                </strong>
                <p style={{ margin: "2px 0 0", fontSize: "0.78rem", color: "#64748b" }}>
                  Descarga una plantilla de ejemplo para rellenar tus destinos:
                </p>
              </div>

              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  className="secondary-button"
                  style={{ fontSize: "0.8rem", padding: "6px 12px" }}
                  onClick={downloadTemplateExcel}
                >
                  📗 Plantilla Excel (.xlsx)
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  style={{ fontSize: "0.8rem", padding: "6px 12px" }}
                  onClick={downloadTemplateCsv}
                >
                  📄 Plantilla CSV (.csv)
                </button>
              </div>
            </div>

            {/* Zona de Selección de Archivo */}
            <input
              type="file"
              ref={fileInputRef}
              accept=".xlsx, .xls, .csv"
              style={{ display: "none" }}
              onChange={handleFileSelected}
            />

            <div
              className="destinos-dropzone"
              onClick={() => fileInputRef.current?.click()}
            >
              <div style={{ fontSize: "2rem" }}>📂</div>
              <div>
                <strong style={{ color: "#1e293b", fontSize: "0.95rem" }}>
                  {importFile ? importFile.name : "Haz clic aquí para seleccionar tu archivo Excel o CSV"}
                </strong>
                <p style={{ margin: "4px 0 0", fontSize: "0.8rem", color: "#64748b" }}>
                  Formatos compatibles: .xlsx, .xls, .csv (Columnas: Nombre, Dirección, Latitud, Longitud)
                </p>
              </div>
            </div>

            {/* Vista previa de los datos detectados */}
            {importRows.length > 0 && (
              <div style={{ marginTop: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong style={{ color: "#047857", fontSize: "0.88rem" }}>
                    ✅ Se detectaron {importRows.length} destinos listos para importar.
                  </strong>
                  <small style={{ color: "#64748b" }}>
                    Mostrando las primeras 5 filas:
                  </small>
                </div>

                <div className="destinos-preview-table-wrapper">
                  <table className="admin-table" style={{ fontSize: "0.82rem" }}>
                    <thead>
                      <tr>
                        <th>Nombre</th>
                        <th>Dirección</th>
                        <th>Latitud</th>
                        <th>Longitud</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importRows.slice(0, 5).map((row, idx) => (
                        <tr key={idx}>
                          <td><strong>{row.nombre}</strong></td>
                          <td>{row.direccion || "—"}</td>
                          <td>{row.latitud ?? "—"}</td>
                          <td>{row.longitud ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Resumen tras importación */}
            {importSummary && (
              <div
                style={{
                  marginTop: "16px",
                  padding: "12px 16px",
                  background: "#f0fdf4",
                  border: "1px solid #bbf7d0",
                  borderRadius: "8px",
                  color: "#166534"
                }}
              >
                <strong>¡Importación completada!</strong>
                <ul style={{ margin: "6px 0 0", paddingLeft: "20px", fontSize: "0.85rem" }}>
                  <li>Total procesados: {importSummary.total}</li>
                  <li>Nuevos destinos creados: {importSummary.inserted}</li>
                  <li>Destinos actualizados/reactivados: {importSummary.updated}</li>
                </ul>
              </div>
            )}

            <div className="form-actions" style={{ marginTop: "20px" }}>
              <button
                type="button"
                className="secondary-button"
                onClick={closeImportModal}
                disabled={importing}
              >
                {importSummary ? "Cerrar" : "Cancelar"}
              </button>

              {importRows.length > 0 && !importSummary && (
                <button
                  type="button"
                  className="primary-button"
                  onClick={handleConfirmImport}
                  disabled={importing}
                >
                  {importing
                    ? "Importando destinos..."
                    : `Confirmar e Importar (${importRows.length})`}
                </button>
              )}
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

export default DestinosPage;
