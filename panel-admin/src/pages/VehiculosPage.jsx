import {
  useEffect,
  useRef,
  useState
} from "react";

import {
  createAdminVehiculo,
  createAdminVehiculoKilometraje,
  getAdminVehiculoDetalle,
  getAdminVehiculoKilometraje,
  getAdminVehiculoKilometrajeResumen,
  getAdminVehiculos,
  getAdminConductores,
  getAdminUsers,
  updateAdminVehiculoMantenimiento,
  updateAdminVehiculo,
  updateAdminVehiculoStatus
} from "../services/api.js";

import {
  IconHistorial,
  IconVerDetalle,
  IconEditar,
  IconMantenimiento,
  IconEliminar,
  IconReactivar,
  IconReloj
} from "../components/Icons.jsx";

const initialForm = {
  marca: "",
  modelo: "",
  numeroEconomico: "",
  placas: "",
  numeroPoliza: "",
  seguroVencimiento: "",
  numeroSerie: "",
  tipoVehiculo: "",
  tipoPropiedad: "EMPRESARIAL",
  color: "",
  tipoPersonalAsignado: "",
  idConductorAsignado: "",
  idSupervisorAsignado: "",
  personalAsignadoNombre: ""
};

function formatVehicleDate(value) {
  if (!value) return "Sin capturar";
  const datePart = String(value).match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (datePart) {
    const [y, m, d] = datePart.split("-").map(Number);
    const dateObj = new Date(y, m - 1, d);
    if (!isNaN(dateObj.getTime())) {
      return dateObj.toLocaleDateString("es-MX");
    }
  }
  const fallbackDate = new Date(value);
  return !isNaN(fallbackDate.getTime()) ? fallbackDate.toLocaleDateString("es-MX") : "Sin capturar";
}

function VehiculosPage({ user }) {
  const canManageMileage = user?.rol === "ADMINISTRADOR";
  const canEditVehicle = user?.rol === "ADMINISTRADOR";
  const [vehiculos, setVehiculos] = useState([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("TODOS");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const [maintenanceModalVehicle, setMaintenanceModalVehicle] = useState(null);
  const [maintenanceReason, setMaintenanceReason] = useState("");
  const [maintenanceSaving, setMaintenanceSaving] = useState(false);

  const [loading, setLoading] =
    useState(true);

  const [message, setMessage] =
    useState("");

  const [messageType, setMessageType] =
    useState("success");

  const [showForm, setShowForm] =
    useState(false);

  const [form, setForm] =
    useState(initialForm);

  const [saving, setSaving] =
    useState(false);

  const [editingVehicle, setEditingVehicle] = useState(null);

  const [updatingId, setUpdatingId] =
    useState(null);

  const [mileageVehicle, setMileageVehicle] = useState(null);
  const [mileageHistory, setMileageHistory] = useState([]);
  const [mileageSummary, setMileageSummary] = useState(null);
  const [mileageLoading, setMileageLoading] = useState(false);
  const [mileageSaving, setMileageSaving] = useState(false);
  const [mileageForm, setMileageForm] = useState({ kilometraje: "", observaciones: "" });
  const [detailVehicle, setDetailVehicle] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [conductoresOptions, setConductoresOptions] = useState([]);
  const [supervisoresOptions, setSupervisoresOptions] = useState([]);

  useEffect(() => {
    async function loadOptions() {
      try {
        const [condRes, userRes] = await Promise.all([
          getAdminConductores({ status: "ACTIVOS" }),
          getAdminUsers()
        ]);
        setConductoresOptions(condRes.data ?? []);
        setSupervisoresOptions((userRes.data ?? []).filter((u) => u.activo));
      } catch (err) {
        console.error("Error cargando opciones de personal asignado:", err);
      }
    }
    loadOptions();
  }, []);

  const submittingRef =
    useRef(false);

  async function loadVehiculos() {
    setLoading(true);

    try {
      const response =
        await getAdminVehiculos({
          search,
          status
        });

      setVehiculos(
        response.data ?? []
      );
      setCurrentPage(1);
    } catch (error) {
      setMessage(error.message);
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeoutId =
      window.setTimeout(() => {
        loadVehiculos();
      }, 300);

    return () => {
      window.clearTimeout(
        timeoutId
      );
    };
  }, [search, status]);

  useEffect(() => {
    if (!showForm) {
      return undefined;
    }

    function handleKeyDown(event) {
      if (
        event.key === "Escape" &&
        !saving
      ) {
        closeForm();
      }
    }

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow =
      "hidden";

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
  }, [showForm, saving]);

  function handleChange(event) {
    const {
      name,
      value
    } = event.target;

    setForm((current) => ({
      ...current,
      [name]:
        name === "placas"
          ? value.toUpperCase()
          : value
    }));

    setMessage("");
  }

  function openForm(vehiculo = null) {
    setForm(vehiculo ? {
      marca: vehiculo.marca || "",
      modelo: vehiculo.modelo || "",
      numeroEconomico: vehiculo.numero_economico || "",
      placas: vehiculo.placas || "",
      numeroPoliza: vehiculo.numero_poliza || "",
      seguroVencimiento: vehiculo.seguro_vencimiento ? String(vehiculo.seguro_vencimiento).slice(0, 10) : "",
      numeroSerie: vehiculo.numero_serie || "",
      tipoVehiculo: vehiculo.tipo_vehiculo || "",
      tipoPropiedad: vehiculo.tipo_propiedad || "EMPRESARIAL",
      color: vehiculo.color || "",
      idSupervisorAsignado: vehiculo.id_supervisor_asignado ? String(vehiculo.id_supervisor_asignado) : "",
      personalAsignadoNombre: vehiculo.personal_asignado_nombre || vehiculo.personal_asignado || ""
    } : initialForm);
    setEditingVehicle(vehiculo);
    setMessage("");
    setShowForm(true);
  }

  function closeForm() {
    if (saving) {
      return;
    }

    setShowForm(false);
    setForm(initialForm);
    setEditingVehicle(null);
  }

  function handleOverlayMouseDown(
    event
  ) {
    if (
      event.target ===
      event.currentTarget
    ) {
      closeForm();
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (submittingRef.current) {
      return;
    }

    submittingRef.current = true;
    setSaving(true);
    setMessage("");

    try {
      const response = editingVehicle
        ? await updateAdminVehiculo(editingVehicle.id_vehiculos, form)
        : await createAdminVehiculo(form);

      setMessage(
        response.message ||
        "Vehículo creado correctamente."
      );

      setMessageType("success");
      setShowForm(false);
      setForm(initialForm);
      setEditingVehicle(null);

      await loadVehiculos();
    } catch (error) {
      setMessage(error.message);
      setMessageType("error");
    } finally {
      submittingRef.current = false;
      setSaving(false);
    }
  }

  async function handleStatusChange(
    vehiculo
  ) {
    const confirmed =
      window.confirm(
        `¿Eliminar permanentemente la unidad ${vehiculo.nombre}? Sus viajes e historial se conservarán.`
      );

    if (!confirmed) {
      return;
    }

    setUpdatingId(
      vehiculo.id_vehiculos
    );

    setMessage("");

    try {
      const response =
        await updateAdminVehiculoStatus(
          vehiculo.id_vehiculos,
          false
        );

      setVehiculos((current) =>
        current.filter((item) => item.id_vehiculos !== vehiculo.id_vehiculos)
      );
      await loadVehiculos();

      setMessage(
        response.message
      );

      setMessageType("success");

    } catch (error) {
      setMessage(error.message);
      setMessageType("error");
    } finally {
      setUpdatingId(null);
    }
  }

  async function openMileage(vehiculo) {
    setMileageVehicle(vehiculo);
    setMileageHistory([]);
    setMileageSummary(null);
    setMileageForm({ kilometraje: "", observaciones: "" });
    setMileageLoading(true);
    try {
      const [historyResponse, summaryResponse] = await Promise.all([
        getAdminVehiculoKilometraje(vehiculo.id_vehiculos),
        getAdminVehiculoKilometrajeResumen(vehiculo.id_vehiculos)
      ]);
      setMileageHistory(historyResponse.data.historial ?? []);
      setMileageSummary(summaryResponse.data);
    } catch (error) {
      setMessage(error.message);
      setMessageType("error");
    } finally { setMileageLoading(false); }
  }

  async function openDetail(vehiculo) {
    setDetailVehicle(null);
    setDetailLoading(true);
    try {
      const response = await getAdminVehiculoDetalle(vehiculo.id_vehiculos);
      setDetailVehicle(response.data);
    } catch (error) {
      setMessage(error.message);
      setMessageType("error");
    } finally {
      setDetailLoading(false);
    }
  }

  function handleMaintenanceChange(vehiculo) {
    if (vehiculo.en_mantenimiento) {
      handleRepairVehicle(vehiculo);
    } else {
      setMaintenanceModalVehicle(vehiculo);
      setMaintenanceReason("");
    }
  }

  async function handleRepairVehicle(vehiculo) {
    const confirmed = window.confirm(
      `¿Marcar como reparada la unidad ${vehiculo.marca || vehiculo.nombre} ${vehiculo.modelo || ""} (${vehiculo.numero_economico}) y devolverla a estado DISPONIBLE?`
    );
    if (!confirmed) return;

    setUpdatingId(vehiculo.id_vehiculos);
    try {
      const response = await updateAdminVehiculoMantenimiento(vehiculo.id_vehiculos, false);
      setMessage(response.message || "Vehículo reparado y reintegrado a unidades disponibles.");
      setMessageType("success");
      await loadVehiculos();
      if (detailVehicle?.id_vehiculos === vehiculo.id_vehiculos) {
        await openDetail(vehiculo);
      }
    } catch (error) {
      setMessage(error.message);
      setMessageType("error");
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleSendToMaintenance(e) {
    e?.preventDefault();
    if (!maintenanceModalVehicle) return;
    if (!maintenanceReason.trim()) {
      alert("Por favor especifica el motivo del mantenimiento.");
      return;
    }

    setMaintenanceSaving(true);
    try {
      const response = await updateAdminVehiculoMantenimiento(
        maintenanceModalVehicle.id_vehiculos,
        true,
        maintenanceReason.trim()
      );
      setMessage(response.message || "Vehículo enviado a mantenimiento.");
      setMessageType("success");
      setMaintenanceModalVehicle(null);
      setMaintenanceReason("");
      await loadVehiculos();
      if (detailVehicle?.id_vehiculos === maintenanceModalVehicle.id_vehiculos) {
        await openDetail(maintenanceModalVehicle);
      }
    } catch (error) {
      setMessage(error.message);
      setMessageType("error");
    } finally {
      setMaintenanceSaving(false);
    }
  }

  async function saveMileage(event) {
    event.preventDefault();
    if (!mileageVehicle || mileageSaving) return;
    setMileageSaving(true);
    try {
      const response = await createAdminVehiculoKilometraje(mileageVehicle.id_vehiculos, {
        kilometraje: Number(mileageForm.kilometraje), observaciones: mileageForm.observaciones
      });
      setMessage(response.message);
      setMessageType("success");
      await openMileage(mileageVehicle);
      await loadVehiculos();
    } catch (error) { setMessage(error.message); setMessageType("error"); }
    finally { setMileageSaving(false); }
  }

  const totalFiltered = vehiculos.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / itemsPerPage));
  const paginatedVehiculos = vehiculos.slice(
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

          <h1>Unidades</h1>

          <p>
            Consulta, registra y controla
            las unidades vehiculares.
          </p>
        </div>

        <button
          type="button"
          className="primary-button"
          onClick={() => openForm()}
        >
          + Nueva unidad
        </button>
      </header>

      {/* Subpestañas de estado */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "16px", borderBottom: "2px solid #e2e8f0", paddingBottom: "10px", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => { setStatus("TODOS"); setCurrentPage(1); }}
          style={{
            padding: "8px 16px",
            borderRadius: "6px",
            border: 0,
            fontWeight: "bold",
            cursor: "pointer",
            background: status === "TODOS" ? "#0f172a" : "#f1f5f9",
            color: status === "TODOS" ? "#ffffff" : "#475569"
          }}
        >
          Todos los Vehículos
        </button>
        <button
          type="button"
          onClick={() => { setStatus("ACTIVOS"); setCurrentPage(1); }}
          style={{
            padding: "8px 16px",
            borderRadius: "6px",
            border: 0,
            fontWeight: "bold",
            cursor: "pointer",
            background: status === "ACTIVOS" ? "#16a34a" : "#f1f5f9",
            color: status === "ACTIVOS" ? "#ffffff" : "#475569"
          }}
        >
          Disponibles
        </button>
        <button
          type="button"
          onClick={() => { setStatus("MANTENIMIENTO"); setCurrentPage(1); }}
          style={{
            padding: "8px 16px",
            borderRadius: "6px",
            border: 0,
            fontWeight: "bold",
            cursor: "pointer",
            background: status === "MANTENIMIENTO" ? "#d97706" : "#f1f5f9",
            color: status === "MANTENIMIENTO" ? "#ffffff" : "#475569"
          }}
        >
          En Mantenimiento
        </button>
        <button
          type="button"
          onClick={() => { setStatus("INACTIVOS"); setCurrentPage(1); }}
          style={{
            padding: "8px 16px",
            borderRadius: "6px",
            border: 0,
            fontWeight: "bold",
            cursor: "pointer",
            background: status === "INACTIVOS" ? "#64748b" : "#f1f5f9",
            color: status === "INACTIVOS" ? "#ffffff" : "#475569"
          }}
        >
          Inactivos
        </button>
      </div>

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
            placeholder="Marca, modelo, número económico o placas"
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
            <option value="TODOS">
              Todos
            </option>

            <option value="ACTIVOS">
              Disponibles
            </option>

            <option value="MANTENIMIENTO">
              En Mantenimiento
            </option>

            <option value="INACTIVOS">
              Inactivos
            </option>
          </select>
        </label>
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
            Cargando unidades...
          </p>
        ) : vehiculos.length === 0 ? (
          <p className="table-status">
            No se encontraron unidades.
          </p>
        ) : (
          <>
            <div className="table-wrapper">
              <table className="admin-table">
                {status === "MANTENIMIENTO" ? (
                  <thead>
                    <tr>
                      <th>Unidad</th>
                      <th>Número económico</th>
                      <th>Placas</th>
                      <th>Personal asignado</th>
                      <th>Tiempo en Mantenimiento</th>
                      <th>Motivo del Mantenimiento</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                ) : (
                  <thead>
                    <tr>
                      <th>Unidad</th>
                      <th>Número económico</th>
                      <th>Placas</th>
                      <th>Color</th>
                      <th>Personal asignado</th>
                      <th>Kilometraje actual</th>
                      <th>Estado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                )}

                <tbody>
                  {paginatedVehiculos.map((vehiculo) => (
                    <tr key={vehiculo.id_vehiculos}>
                      <td>
                        <strong>
                          {vehiculo.marca || vehiculo.nombre} {vehiculo.modelo || ""}
                        </strong>
                      </td>

                      <td>{vehiculo.numero_economico}</td>

                      <td>{vehiculo.placas}</td>

                      {status === "MANTENIMIENTO" ? (
                        <>
                          <td>{vehiculo.personal_asignado || "—"}</td>
                          <td>
                            <span style={{ padding: "4px 10px", borderRadius: "12px", background: "#fef2f2", color: "#b91c1c", fontWeight: "bold", fontSize: "0.85rem", border: "1px solid #fecaca", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                              <IconReloj size={14} /> {vehiculo.dias_en_mantenimiento ?? 0} {vehiculo.dias_en_mantenimiento === 1 ? "día" : "días"}
                            </span>
                          </td>
                          <td style={{ maxWidth: "250px", wordBreak: "break-word" }}>
                            {vehiculo.motivo_mantenimiento || "Sin especificar"}
                          </td>
                        </>
                      ) : (
                        <>
                          <td>{vehiculo.color || "—"}</td>
                          <td>{vehiculo.personal_asignado || "—"}</td>
                          <td>{vehiculo.kilometraje_actual ?? 0} km</td>
                          <td>
                            {vehiculo.en_mantenimiento ? (
                              <div>
                                <span className="status-badge" style={{ background: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca", display: "inline-block", marginBottom: "4px" }}>
                                  Mantenimiento ({vehiculo.dias_en_mantenimiento ?? 0} {vehiculo.dias_en_mantenimiento === 1 ? "día" : "días"})
                                </span>
                                {vehiculo.motivo_mantenimiento && (
                                  <small style={{ display: "block", color: "#64748b", fontSize: "0.75rem", maxWidth: "160px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={vehiculo.motivo_mantenimiento}>
                                    {vehiculo.motivo_mantenimiento}
                                  </small>
                                )}
                              </div>
                            ) : (
                              <span
                                className={
                                  vehiculo.disponibilidad === "DISPONIBLE"
                                    ? "status-badge status-active"
                                    : "status-badge status-inactive"
                                }
                              >
                                {vehiculo.disponibilidad === "DISPONIBLE" ? "Disponible" :
                                  vehiculo.disponibilidad === "EN_VIAJE" ? "No disponible: en viaje" : "Inactivo"}
                              </span>
                            )}
                          </td>
                        </>
                      )}

                      <td>
                        <div className="table-action-icons">
                          <button
                            type="button"
                            className="action-icon-btn action-icon-history"
                            onClick={() => openMileage(vehiculo)}
                            title="Ver historial de kilometraje"
                            aria-label="Ver historial de kilometraje"
                          >
                            <IconHistorial size={16} />
                          </button>
                          <button
                            type="button"
                            className="action-icon-btn action-icon-detail"
                            onClick={() => openDetail(vehiculo)}
                            title="Ver detalle de unidad"
                            aria-label="Ver detalle de unidad"
                          >
                            <IconVerDetalle size={16} />
                          </button>
                          {canEditVehicle && (
                            <button
                              type="button"
                              className="action-icon-btn action-icon-edit"
                              onClick={() => openForm(vehiculo)}
                              title="Editar unidad"
                              aria-label="Editar unidad"
                            >
                              <IconEditar size={16} />
                            </button>
                          )}
                          {canEditVehicle && (
                            <button
                              type="button"
                              className={`action-icon-btn action-icon-maintenance ${vehiculo.en_mantenimiento ? "active-maintenance" : ""}`}
                              disabled={updatingId === vehiculo.id_vehiculos || vehiculo.disponibilidad === "EN_VIAJE"}
                              onClick={() => handleMaintenanceChange(vehiculo)}
                              title={vehiculo.en_mantenimiento ? "Retirar de mantenimiento" : "Poner en mantenimiento"}
                              aria-label={vehiculo.en_mantenimiento ? "Retirar de mantenimiento" : "Poner en mantenimiento"}
                            >
                              <IconMantenimiento size={16} />
                            </button>
                          )}
                          {canEditVehicle && (
                            <button
                              type="button"
                              className={`action-icon-btn ${vehiculo.activo ? "action-icon-delete" : "action-icon-restore"}`}
                              disabled={updatingId === vehiculo.id_vehiculos}
                              onClick={() => handleStatusChange(vehiculo)}
                              title={vehiculo.activo ? "Dar de baja unidad" : "Reactivar unidad"}
                              aria-label={vehiculo.activo ? "Dar de baja unidad" : "Reactivar unidad"}
                            >
                              {vehiculo.activo ? <IconEliminar size={16} /> : <IconReactivar size={16} />}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalFiltered > 0 && (
              <div className="table-pagination">
                <span className="pagination-info">
                  Mostrando {Math.min((currentPage - 1) * itemsPerPage + 1, totalFiltered)} - {Math.min(currentPage * itemsPerPage, totalFiltered)} de {totalFiltered} unidades
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

      {showForm && (
        <div
          className="modal-overlay"
          role="presentation"
          onMouseDown={
            handleOverlayMouseDown
          }
        >
          <section
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-vehicle-title"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >
            <div className="form-panel-header">
              <div>
                <h2
                  id="new-vehicle-title"
                >
                  {editingVehicle ? "Editar unidad" : "Nueva unidad"}
                </h2>

                <p>
                  {editingVehicle ? "Actualiza los datos de la unidad vehicular." : "Registra los datos de la unidad vehicular."}
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

            <form
              className="driver-form"
              onSubmit={handleSubmit}
            >
              <label>
                Marca

                <input
                  name="marca"
                  value={form.marca}
                  onChange={handleChange}
                  placeholder="Ej. Mitsubishi"
                  minLength="2"
                  required
                  disabled={saving}
                />
              </label>

              <label>
                Modelo

                <input
                  name="modelo"
                  value={form.modelo}
                  onChange={handleChange}
                  placeholder="Ej. L300"
                  required
                  disabled={saving}
                />
              </label>

              <label>
                Número económico

                <input
                  name="numeroEconomico"
                  value={
                    form.numeroEconomico
                  }
                  onChange={handleChange}
                  placeholder="Ej. AQR-05"
                  required
                  disabled={saving}
                />
              </label>

              <label>
                Placas

                <input
                  name="placas"
                  value={form.placas}
                  onChange={handleChange}
                  placeholder="Ej. CR-1234-A"
                  required
                  disabled={saving}
                />
              </label>

              <label>
                Número de póliza
                <input name="numeroPoliza" value={form.numeroPoliza} onChange={handleChange} required disabled={saving} />
              </label>

              <label>
                Vencimiento del seguro
                <input type="date" name="seguroVencimiento" value={form.seguroVencimiento} onChange={handleChange} required disabled={saving} />
              </label>

              <label>
                Número de serie
                <input name="numeroSerie" value={form.numeroSerie} onChange={handleChange} required disabled={saving} />
              </label>

              <label>
                Tipo de vehículo
                <input name="tipoVehiculo" value={form.tipoVehiculo} onChange={handleChange} placeholder="Ej. Camioneta" required disabled={saving} />
              </label>

              <label>
                Propiedad
                <select name="tipoPropiedad" value={form.tipoPropiedad} onChange={handleChange} disabled={saving}>
                  <option value="EMPRESARIAL">Empresarial</option>
                  <option value="PATRIMONIAL">Patrimonial</option>
                </select>
              </label>

              <label>
                Color
                <input
                  name="color"
                  value={form.color}
                  onChange={handleChange}
                  placeholder="Ej. Blanco / Rojo"
                  disabled={saving}
                />
              </label>

              <label>
                Personal Asignado (Supervisor a cargo)
                <select
                  name="idSupervisorAsignado"
                  value={form.idSupervisorAsignado}
                  onChange={(e) => {
                    const id = e.target.value;
                    const userObj = supervisoresOptions.find((u) => String(u.id_usuarios_admin) === String(id));
                    setForm((cur) => ({
                      ...cur,
                      idSupervisorAsignado: id,
                      personalAsignadoNombre: userObj ? userObj.nombre : ""
                    }));
                  }}
                  disabled={saving}
                >
                  <option value="">-- Sin supervisor asignado --</option>
                  {supervisoresOptions.map((u) => (
                    <option key={u.id_usuarios_admin} value={u.id_usuarios_admin}>
                      {u.nombre} ({u.rol})
                    </option>
                  ))}
                </select>
              </label>

              <div className="vehicle-name-preview">
                <span>
                  Nombre que se guardará:
                </span>

                <strong>
                  {`${form.marca} ${form.modelo}`
                    .replace(/\s+/g, " ")
                    .trim() ||
                    "Marca y modelo"}
                </strong>
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={closeForm}
                  disabled={saving}
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="primary-button"
                  disabled={saving}
                >
                  {saving
                    ? "Guardando..."
                    : editingVehicle ? "Guardar cambios" : "Guardar unidad"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {mileageVehicle && (
        <div className="modal-overlay" role="presentation" onMouseDown={() => !mileageSaving && setMileageVehicle(null)}>
          <section className="modal-card mileage-modal" role="dialog" aria-modal="true" aria-labelledby="mileage-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="form-panel-header">
              <div><h2 id="mileage-title">Historial de kilometraje</h2><p>{mileageVehicle.nombre} · {mileageVehicle.numero_economico}</p></div>
              <button type="button" className="close-button" onClick={() => setMileageVehicle(null)} aria-label="Cerrar historial">×</button>
            </div>
            {mileageLoading ? <p className="table-status">Cargando historial...</p> : <>
              <div className="mileage-summary">
                <strong>Actual: {mileageSummary?.kilometraje_actual ?? mileageVehicle.kilometraje_actual ?? 0} km</strong>
                <span>Viajes: {mileageSummary?.total_viajes ?? 0}</span>
                <span>Recorridos: {mileageSummary?.kilometros_recorridos ?? 0} km</span>
              </div>
              <div className="mileage-chart" aria-label="Evolución de kilometraje">
                {mileageHistory.slice(0, 20).reverse().map((row) => <span key={row.id_historial_kilometraje} title={`${row.kilometraje} km`} style={{ height: `${Math.max(8, Math.min(100, Number(row.kilometraje) / Math.max(1, Number(mileageSummary?.kilometraje_actual || row.kilometraje)) * 100))}%` }} />)}
              </div>
              <div className="table-wrapper mileage-history-table"><table className="admin-table"><thead><tr><th>Fecha</th><th>Km</th><th>Tipo</th><th>Viaje</th><th>Observaciones</th></tr></thead><tbody>
                {mileageHistory.length ? mileageHistory.map((row) => <tr key={row.id_historial_kilometraje}><td>{new Date(row.fecha_lectura).toLocaleString("es-MX")}</td><td>{row.kilometraje}</td><td>{row.tipo_registro}</td><td>{row.folio || "—"}</td><td>{row.observaciones || "—"}</td></tr>) : <tr><td colSpan="5">Aún no hay lecturas.</td></tr>}
              </tbody></table></div>
              {canManageMileage && <form className="driver-form mileage-form" onSubmit={saveMileage}>
                <h3>Registrar ajuste manual</h3>
                <label>Kilometraje<input type="number" min="0" step="1" value={mileageForm.kilometraje} onChange={(event) => setMileageForm((current) => ({ ...current, kilometraje: event.target.value }))} required /></label>
                <label>Observaciones<textarea value={mileageForm.observaciones} onChange={(event) => setMileageForm((current) => ({ ...current, observaciones: event.target.value }))} required /></label>
                <div className="form-actions"><button type="submit" className="primary-button" disabled={mileageSaving}>{mileageSaving ? "Guardando..." : "Registrar lectura"}</button></div>
              </form>
              }
            </>}
          </section>
        </div>
      )}

      {(detailLoading || detailVehicle) && (
        <div className="modal-overlay" role="presentation" onMouseDown={() => !detailLoading && setDetailVehicle(null)}>
          <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="vehicle-detail-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="form-panel-header">
              <div><h2 id="vehicle-detail-title">Detalle de unidad</h2><p>{detailVehicle ? `${detailVehicle.marca || detailVehicle.nombre} ${detailVehicle.modelo || ""}` : "Cargando información..."}</p></div>
              <button type="button" className="close-button" onClick={() => setDetailVehicle(null)} aria-label="Cerrar detalle" disabled={detailLoading}>×</button>
            </div>
            {detailLoading ? <p className="table-status">Cargando detalle...</p> : detailVehicle && (
              <div className="mileage-summary">
                <span><strong>Estado:</strong> {detailVehicle.disponibilidad}</span>
                <span><strong>Núm. económico:</strong> {detailVehicle.numero_economico}</span>
                <span><strong>Placas:</strong> {detailVehicle.placas}</span>
                <span><strong>Color:</strong> {detailVehicle.color || "Sin capturar"}</span>
                <span><strong>Personal asignado:</strong> {detailVehicle.personal_asignado || "Sin asignar"}</span>
                <span><strong>Tipo:</strong> {detailVehicle.tipo_vehiculo || "Sin capturar"}</span>
                <span><strong>Propiedad:</strong> {detailVehicle.tipo_propiedad || "Sin capturar"}</span>
                <span><strong>Núm. de serie:</strong> {detailVehicle.numero_serie || "Sin capturar"}</span>
                <span><strong>Póliza:</strong> {detailVehicle.numero_poliza || "Sin capturar"}</span>
                <span><strong>Vence seguro:</strong> {formatVehicleDate(detailVehicle.seguro_vencimiento)}</span>
                <span><strong>Kilometraje:</strong> {detailVehicle.kilometraje_actual ?? 0} km</span>
                {detailVehicle.en_mantenimiento && (
                  <>
                    <span style={{ color: "#b91c1c" }}><strong>En mantenimiento:</strong> Sí ({detailVehicle.dias_en_mantenimiento ?? 0} {detailVehicle.dias_en_mantenimiento === 1 ? "día" : "días"})</span>
                    <span><strong>Motivo mantenimiento:</strong> {detailVehicle.motivo_mantenimiento || "Sin registrar"}</span>
                  </>
                )}
                {detailVehicle.folio_viaje_en_curso && <span><strong>Viaje en curso:</strong> {detailVehicle.folio_viaje_en_curso} · {detailVehicle.conductor_viaje_en_curso}</span>}
              </div>
            )}
            {detailVehicle && !detailLoading && (
              <div className="form-actions">
                {canEditVehicle && <button type="button" className="primary-button" onClick={() => { const vehicle = detailVehicle; setDetailVehicle(null); openForm(vehicle); }}>
                  Editar datos
                </button>}
              </div>
            )}
          </section>
        </div>
      )}

      {/* Modal para ingresar motivo de mantenimiento */}
      {maintenanceModalVehicle && (
        <div className="modal-overlay" role="presentation" onMouseDown={() => !maintenanceSaving && setMaintenanceModalVehicle(null)}>
          <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="maintenance-modal-title" onMouseDown={(e) => e.stopPropagation()} style={{ maxWidth: "520px" }}>
            <div className="form-panel-header">
              <div>
                <h2 id="maintenance-modal-title">Enviar a Mantenimiento</h2>
                <p>{maintenanceModalVehicle.marca || maintenanceModalVehicle.nombre} {maintenanceModalVehicle.modelo || ""} · Económico: {maintenanceModalVehicle.numero_economico}</p>
              </div>
              <button type="button" className="close-button" onClick={() => setMaintenanceModalVehicle(null)} disabled={maintenanceSaving}>×</button>
            </div>
            <form onSubmit={handleSendToMaintenance}>
              <div style={{ padding: "8px 0" }}>
                <p style={{ margin: "0 0 12px", fontSize: "0.88rem", color: "#475569" }}>
                  Al enviar la unidad a mantenimiento, su estado cambiará a <strong>NO DISPONIBLE: MANTENIMIENTO</strong> y comenzará el conteo de días en taller hasta su reparación.
                </p>
                <label style={{ display: "block", fontWeight: "600", fontSize: "0.88rem", marginBottom: "6px" }}>
                  Motivo del mantenimiento / Falla reportada *
                  <textarea
                    required
                    rows="4"
                    value={maintenanceReason}
                    onChange={(e) => setMaintenanceReason(e.target.value)}
                    placeholder="Describe detalladamente el motivo del servicio, falla mecánica o mantenimiento preventivo..."
                    style={{ width: "100%", marginTop: "6px", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", boxSizing: "border-box" }}
                    disabled={maintenanceSaving}
                  />
                </label>
              </div>
              <div className="form-actions" style={{ marginTop: "16px" }}>
                <button type="button" className="secondary-button" onClick={() => setMaintenanceModalVehicle(null)} disabled={maintenanceSaving}>
                  Cancelar
                </button>
                <button type="submit" className="primary-button" style={{ background: "#d97706" }} disabled={maintenanceSaving || !maintenanceReason.trim()}>
                  {maintenanceSaving ? "Enviando..." : "Confirmar Envío a Mantenimiento"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </section>
  );
}

export default VehiculosPage;
