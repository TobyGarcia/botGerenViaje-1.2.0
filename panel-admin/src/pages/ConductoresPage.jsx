import {
  useEffect,
  useState
} from "react";

import {
  assignAdminConductorVehicle,
  getAdminConductores,
  getAdminVehiculos,
  updateAdminConductorStatus,
  approveAdminConductor,
  setAdminConductorPin,
  toggleAdminConductorActive
} from "../services/api.js";
import { downloadPinCardImage } from "../utils/downloadPinCard.js";

function formatDate(value) {
  if (!value) {
    return "No registrada";
  }

  const normalizedValue =
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? `${value}T00:00:00`
      : value;

  const date =
    new Date(normalizedValue);

  if (Number.isNaN(date.getTime())) {
    return "Fecha no válida";
  }

  return date.toLocaleDateString(
    "es-MX",
    {
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }
  );
}

function ConductoresPage({ user }) {
  const [conductores, setConductores] =
    useState([]);

  const [search, setSearch] =
    useState("");

  const [status, setStatus] =
    useState("TODOS");

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const [loading, setLoading] =
    useState(true);

  const [message, setMessage] =
    useState("");

  const [messageType, setMessageType] =
    useState("success");

  const [updatingId, setUpdatingId] =
    useState(null);

  const [vehiculosOptions, setVehiculosOptions] =
    useState([]);

  const [assigningId, setAssigningId] =
    useState(null);

  const [approveModalConductor, setApproveModalConductor] =
    useState(null);

  // Estados para modales personalizados (reemplazan window.alert, window.confirm y window.prompt)
  const [pinModalConductor, setPinModalConductor] = useState(null);
  const [pinMode, setPinMode] = useState("auto"); // 'auto' | 'manual'
  const [manualPin, setManualPin] = useState("");
  const [pinModalError, setPinModalError] = useState("");
  const [savingPin, setSavingPin] = useState(false);

  const [pinSuccessData, setPinSuccessData] = useState(null);
  const [copiedSuccessPin, setCopiedSuccessPin] = useState(false);

  const [toggleActiveConductor, setToggleActiveConductor] = useState(null);
  const [deleteConfirmConductor, setDeleteConfirmConductor] = useState(null);

  async function loadVehiculos() {
    try {
      const res = await getAdminVehiculos({ status: "ACTIVOS" });
      setVehiculosOptions(res.data ?? []);
    } catch (err) {
      console.error("Error cargando vehículos:", err);
    }
  }

  async function loadConductores() {
    setLoading(true);

    try {
      const response =
        await getAdminConductores({
          search,
          status
        });

      setConductores(
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

  async function handleAssignVehicle(idConductor, idVehiculoVal) {
    setAssigningId(idConductor);
    try {
      const idVehiculo = idVehiculoVal ? Number(idVehiculoVal) : null;
      const res = await assignAdminConductorVehicle(idConductor, idVehiculo);
      setMessage(res.message || "Asignación vehicular actualizada.");
      setMessageType("success");
      await Promise.all([loadConductores(), loadVehiculos()]);
    } catch (err) {
      setMessage(err.message || "Error al asignar vehículo.");
      setMessageType("error");
    } finally {
      setAssigningId(null);
    }
  }

  async function handleApproveDriver(idConductor, aprobado) {
    try {
      setUpdatingId(idConductor);
      const res = await approveAdminConductor(idConductor, aprobado);
      if (res.data?.pinGenerado) {
        const cond = conductores.find((c) => c.id_conductores === idConductor) || approveModalConductor;
        setPinSuccessData({
          conductorNombre: cond?.nombre || "Conductor",
          pin: res.data.pinGenerado,
          isApproval: true
        });
      }
      setMessage(res.message || "Estado de aprobación actualizado.");
      setMessageType("success");
      await loadConductores();
    } catch (err) {
      setMessage(err.message || "Error al actualizar estado de aprobación.");
      setMessageType("error");
    } finally {
      setUpdatingId(null);
    }
  }

  function handleOpenPinModal(conductor) {
    setPinModalConductor(conductor);
    setPinMode("auto");
    setManualPin("");
    setPinModalError("");
  }

  async function handleSavePin() {
    if (!pinModalConductor) return;
    if (pinMode === "manual") {
      const clean = manualPin.trim();
      if (!/^\d{4}$/.test(clean)) {
        setPinModalError("El PIN debe constar de exactamente 4 dígitos numéricos.");
        return;
      }
    }

    setSavingPin(true);
    setPinModalError("");
    try {
      setUpdatingId(pinModalConductor.id_conductores);
      const res = await setAdminConductorPin(
        pinModalConductor.id_conductores,
        pinMode === "manual" ? manualPin.trim() : null,
        pinMode === "auto"
      );
      const pinFinal = res.data?.pinGenerado || manualPin.trim();
      const conductorTarget = pinModalConductor;
      setPinModalConductor(null);
      setPinSuccessData({
        conductorNombre: conductorTarget.nombre,
        pin: pinFinal,
        isApproval: false
      });
      setMessage(res.message || `PIN asignado correctamente a ${conductorTarget.nombre}: ${pinFinal}`);
      setMessageType("success");
      await loadConductores();
    } catch (err) {
      setPinModalError(err.message || "Error al asignar el PIN.");
    } finally {
      setSavingPin(false);
      setUpdatingId(null);
    }
  }

  const canToggleActive = !user || [
    "ADMINISTRADOR",
    "GERENTE",
    "GERENTE_GENERAL",
    "COORDINADOR",
    "COORDINADOR_AREA",
    "COORDINADOR_QHSE"
  ].includes(user?.rol);

  function handleOpenToggleActive(conductor) {
    setToggleActiveConductor(conductor);
  }

  async function confirmToggleActive() {
    if (!toggleActiveConductor) return;
    const conductor = toggleActiveConductor;
    const nuevoEstado = !conductor.activo;
    const accionTexto = nuevoEstado ? "reactivar" : "desactivar";

    try {
      setUpdatingId(conductor.id_conductores);
      const res = await toggleAdminConductorActive(conductor.id_conductores, nuevoEstado);
      setMessage(res.message || `Conductor ${nuevoEstado ? "reactivado" : "desactivado"} correctamente.`);
      setMessageType("success");
      await loadConductores();
      if (approveModalConductor && approveModalConductor.id_conductores === conductor.id_conductores) {
        setApproveModalConductor((prev) => (prev ? { ...prev, activo: nuevoEstado } : null));
      }
      setToggleActiveConductor(null);
    } catch (err) {
      setMessage(err.message || `Error al ${accionTexto} al conductor.`);
      setMessageType("error");
    } finally {
      setUpdatingId(null);
    }
  }



  useEffect(() => {
    loadVehiculos();
  }, []);

  useEffect(() => {
    const timeoutId =
      window.setTimeout(() => {
        loadConductores();
      }, 300);

    return () => {
      window.clearTimeout(
        timeoutId
      );
    };
  }, [search, status]);



  function handleOpenDelete(conductor) {
    setDeleteConfirmConductor(conductor);
  }

  async function confirmDeleteDriver() {
    if (!deleteConfirmConductor) return;
    const conductor = deleteConfirmConductor;

    setUpdatingId(conductor.id_conductores);
    setMessage("");

    try {
      const response = await updateAdminConductorStatus(
        conductor.id_conductores,
        false
      );

      setConductores((current) =>
        current.filter((item) => item.id_conductores !== conductor.id_conductores)
      );
      await loadConductores();

      setMessage(response.message || "Conductor eliminado permanentemente.");
      setMessageType("success");
      setDeleteConfirmConductor(null);
    } catch (error) {
      setMessage(error.message);
      setMessageType("error");
    } finally {
      setUpdatingId(null);
    }
  }

  const totalFiltered = conductores.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / itemsPerPage));
  const paginatedConductores = conductores.slice(
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

          <h1>Conductores</h1>

          <p>
            Consulta, registra y controla
            el acceso de los conductores.
          </p>
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
            placeholder="Nombre, licencia o teléfono"
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
              Activos
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
            Cargando conductores...
          </p>
        ) : conductores.length === 0 ? (
          <p className="table-status">
            No se encontraron conductores.
          </p>
        ) : (
          <>
            <div className="table-wrapper admin-table-desktop">
            <table className="admin-table">
              <thead>
                <tr>

                  <th>Conductor</th>
                  <th>Teléfono</th>
                  <th>Empresa</th>
                  <th>Unidad Asignada</th>
                  <th>Licencia</th>
                  <th>Vencimiento Licencia</th>
                  <th>Manejo Comentado</th>
                  <th>Telegram</th>
                  <th>Aprobación Admin</th>
                  <th>Estado</th>
                  {(!user || ["ADMINISTRADOR", "GERENTE", "GERENTE_GENERAL", "COORDINADOR", "COORDINADOR_AREA", "COORDINADOR_QHSE", "SUPERVISOR", "QHSE"].includes(user.rol)) && <th>Acciones</th>}
                </tr>
              </thead>

              <tbody>
                {paginatedConductores.map(
                  (conductor) => (
                    <tr
                      key={
                        conductor.id_conductores
                      }
                    >
                      <td>
                        <strong>
                          {conductor.nombre}
                        </strong>
                      </td>

                      <td>
                        {conductor.telefono ||
                          "No registrado"}
                      </td>

                      <td>{conductor.empresa || "No registrada"}</td>

                      <td>
                        <select
                          value={conductor.id_vehiculo_asignado || ""}
                          onChange={(e) => handleAssignVehicle(conductor.id_conductores, e.target.value)}
                          disabled={assigningId === conductor.id_conductores || !conductor.activo}
                          style={{ padding: "4px 8px", borderRadius: "4px", border: "1px solid #cbd5e1", fontSize: "0.85rem" }}
                        >
                          <option value="">-- Sin asignar --</option>
                          {vehiculosOptions.map((v) => (
                            <option key={v.id_vehiculos} value={v.id_vehiculos}>
                              {v.nombre} — {v.numero_economico}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td>
                        <span>
                          {
                            conductor.licencia_numero
                          }
                        </span>

                        <small
                          className={
                            conductor.licencia_vigente
                              ? "license-valid"
                              : "license-expired"
                          }
                        >
                          {conductor.licencia_vigente
                            ? "Vigente"
                            : "Vencida"}
                        </small>
                      </td>

                      <td>
                        {formatDate(
                          conductor.licencia_vencimiento
                        )}
                      </td>

                      <td>
                        {formatDate(conductor.fecha_manejo_comentado)}
                      </td>

                      <td>
                        {conductor.telegram_user_id
                          ? (
                              <span className="telegram-linked">
                                Vinculado
                              </span>
                            )
                          : (
                              <span className="telegram-unlinked">
                                Sin vínculo
                              </span>
                            )}
                      </td>

                      <td>
                        <span
                          className={
                            conductor.aprobado_por_admin
                              ? "status-badge status-active"
                              : "status-badge status-inactive"
                          }
                          style={{
                            backgroundColor: conductor.aprobado_por_admin ? "#dcfce7" : "#fef3c7",
                            color: conductor.aprobado_por_admin ? "#166534" : "#92400e"
                          }}
                        >
                          {conductor.aprobado_por_admin
                            ? "Aprobado"
                            : "Pendiente"}
                        </span>
                      </td>

                      <td>
                        <span
                          className={
                            conductor.activo
                              ? "status-badge status-active"
                              : "status-badge status-inactive"
                          }
                        >
                          {conductor.activo
                            ? "Activo"
                            : "Inactivo"}
                        </span>
                      </td>

                      {(!user || ["ADMINISTRADOR", "GERENTE", "GERENTE_GENERAL", "COORDINADOR", "COORDINADOR_AREA", "COORDINADOR_QHSE", "SUPERVISOR", "QHSE"].includes(user.rol)) && (
                        <td>
                          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                            {!conductor.aprobado_por_admin ? (
                              <button
                                type="button"
                                className="primary-button"
                                style={{ padding: "4px 8px", fontSize: "0.8rem", backgroundColor: "#16a34a" }}
                                disabled={updatingId === conductor.id_conductores}
                                onClick={() => setApproveModalConductor(conductor)}
                              >
                                Aprobar
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="secondary-button"
                                style={{ padding: "4px 8px", fontSize: "0.8rem" }}
                                onClick={() => setApproveModalConductor(conductor)}
                              >
                                Ver Licencia
                              </button>
                            )}

                            <button
                              type="button"
                              className="secondary-button"
                              style={{ padding: "4px 8px", fontSize: "0.8rem" }}
                              disabled={updatingId === conductor.id_conductores}
                              onClick={() => handleOpenPinModal(conductor)}
                              title="Generar automáticamente o cambiar PIN"
                            >
                              {conductor.tiene_pin ? "Generar nuevo PIN" : "Asignar PIN"}
                            </button>

                            {canToggleActive && (
                              <button
                                type="button"
                                className={conductor.activo ? "danger-button" : "reactivate-button"}
                                style={{
                                  padding: "4px 8px",
                                  fontSize: "0.8rem",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px"
                                }}
                                disabled={updatingId === conductor.id_conductores}
                                onClick={() => handleOpenToggleActive(conductor)}
                                title={conductor.activo ? "Desactivar conductor (impedirá acceso y viajes)" : "Reactivar conductor"}
                              >
                                {conductor.activo ? "Desactivar" : "✓ Reactivar"}
                              </button>
                            )}

                            {(!user || user.rol === "ADMINISTRADOR") && (
                              <button
                                type="button"
                                className="secondary-button"
                                style={{ padding: "4px 8px", fontSize: "0.8rem", color: "#991b1b", border: "1px solid #fecaca" }}
                                disabled={updatingId === conductor.id_conductores}
                                onClick={() => handleOpenDelete(conductor)}
                                title="Eliminar permanentemente de la base de datos"
                              >
                                Eliminar
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>

          {/* Vista móvil en tarjetas responsivas (pantallas <= 900px) */}
          <div className="conductores-cards-mobile">
            {paginatedConductores.map((conductor) => (
              <article key={conductor.id_conductores} className="conductor-mobile-card">
                <header className="conductor-mobile-header">
                  <div>
                    <h3 className="conductor-mobile-name">{conductor.nombre}</h3>
                    <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
                      {conductor.empresa || "Sin empresa"}
                    </span>
                  </div>
                  <div className="conductor-mobile-badges">
                    <span className={`status-badge ${conductor.activo ? "status-active" : "status-inactive"}`}>
                      {conductor.activo ? "Activo" : "Inactivo"}
                    </span>
                    <span className={`status-badge ${conductor.aprobado_por_admin ? "status-active" : "status-pending"}`}>
                      {conductor.aprobado_por_admin ? "Aprobado" : "Pendiente"}
                    </span>
                  </div>
                </header>

                <div className="conductor-mobile-grid">
                  <div className="conductor-mobile-field">
                    <span className="conductor-mobile-label">Teléfono</span>
                    <span className="conductor-mobile-value">{conductor.telefono || "No registrado"}</span>
                  </div>

                  <div className="conductor-mobile-field">
                    <span className="conductor-mobile-label">Licencia</span>
                    <span className="conductor-mobile-value">
                      {conductor.licencia_numero || "N/A"}{" "}
                      <small className={conductor.licencia_vigente ? "license-valid" : "license-expired"}>
                        ({conductor.licencia_vigente ? "Vigente" : "Vencida"})
                      </small>
                    </span>
                  </div>

                  <div className="conductor-mobile-field">
                    <span className="conductor-mobile-label">Vencimiento</span>
                    <span className="conductor-mobile-value">{formatDate(conductor.licencia_vencimiento)}</span>
                  </div>

                  <div className="conductor-mobile-field">
                    <span className="conductor-mobile-label">Manejo Comentado</span>
                    <span className="conductor-mobile-value">{formatDate(conductor.fecha_manejo_comentado)}</span>
                  </div>

                  <div className="conductor-mobile-field">
                    <span className="conductor-mobile-label">Telegram</span>
                    <span className={`conductor-mobile-value ${conductor.telegram_id ? "telegram-linked" : "telegram-unlinked"}`}>
                      {conductor.telegram_id ? "Vinculado" : "Sin vínculo"}
                    </span>
                  </div>

                  <div className="conductor-mobile-field full-width">
                    <span className="conductor-mobile-label">Unidad Asignada</span>
                    <select
                      value={conductor.id_vehiculo_asignado || ""}
                      onChange={(e) => handleAssignVehicle(conductor.id_conductores, e.target.value)}
                      disabled={assigningId === conductor.id_conductores || !conductor.activo}
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: "6px",
                        border: "1px solid #cbd5e1",
                        fontSize: "0.85rem",
                        background: "#ffffff"
                      }}
                    >
                      <option value="">-- Sin asignar --</option>
                      {vehiculosOptions.map((v) => (
                        <option key={v.id_vehiculos} value={v.id_vehiculos}>
                          {v.nombre} — {v.numero_economico}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {(!user || ["ADMINISTRADOR", "GERENTE", "GERENTE_GENERAL", "COORDINADOR", "COORDINADOR_AREA", "COORDINADOR_QHSE", "SUPERVISOR", "QHSE"].includes(user.rol)) && (
                  <footer className="conductor-mobile-actions">
                    {!conductor.aprobado_por_admin ? (
                      <button
                        type="button"
                        className="primary-button"
                        style={{ backgroundColor: "#16a34a" }}
                        disabled={updatingId === conductor.id_conductores}
                        onClick={() => setApproveModalConductor(conductor)}
                      >
                        Aprobar
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => setApproveModalConductor(conductor)}
                      >
                        Ver Licencia
                      </button>
                    )}

                    <button
                      type="button"
                      className="secondary-button"
                      disabled={updatingId === conductor.id_conductores}
                      onClick={() => handleOpenPinModal(conductor)}
                      title="Generar automáticamente o cambiar PIN"
                    >
                      {conductor.tiene_pin ? "Nuevo PIN" : "Asignar PIN"}
                    </button>

                    {canToggleActive && (
                      <button
                        type="button"
                        className={conductor.activo ? "danger-button" : "reactivate-button"}
                        disabled={updatingId === conductor.id_conductores}
                        onClick={() => handleOpenToggleActive(conductor)}
                      >
                        {conductor.activo ? "Desactivar" : "✓ Reactivar"}
                      </button>
                    )}

                    {(!user || user.rol === "ADMINISTRADOR") && (
                      <button
                        type="button"
                        className="secondary-button"
                        style={{ color: "#991b1b", border: "1px solid #fecaca" }}
                        disabled={updatingId === conductor.id_conductores}
                        onClick={() => handleOpenDelete(conductor)}
                      >
                        Eliminar
                      </button>
                    )}
                  </footer>
                )}
              </article>
            ))}
          </div>

            {totalFiltered > 0 && (
              <div className="table-pagination">
                <span className="pagination-info">
                  Mostrando {Math.min((currentPage - 1) * itemsPerPage + 1, totalFiltered)} - {Math.min(currentPage * itemsPerPage, totalFiltered)} de {totalFiltered} conductores
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

      {approveModalConductor && (
        <div
          className="modal-overlay"
          role="presentation"
          onMouseDown={() => setApproveModalConductor(null)}
        >
          <section
            className="modal-card"
            style={{ maxWidth: "720px", width: "95%", maxHeight: "90vh", overflowY: "auto" }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="approve-modal-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="form-panel-header">
              <div>
                <h2 id="approve-modal-title">Revisión de Conductor</h2>
                <p>Verifica los datos personales y el documento de licencia antes de aprobar.</p>
              </div>
              <button
                type="button"
                className="close-button"
                onClick={() => setApproveModalConductor(null)}
                aria-label="Cerrar modal"
              >
                ×
              </button>
            </div>

            <div className="driver-approval-body" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px", padding: "16px 0" }}>
              <div className="driver-info-panel" style={{ background: "#f8fafc", padding: "16px", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "0.9rem", lineHeight: "1.7" }}>
                <h3 style={{ fontSize: "1rem", color: "#1e293b", margin: "0 0 12px 0", borderBottom: "2px solid #cbd5e1", paddingBottom: "6px" }}>
                  📋 Información General
                </h3>
                <p style={{ margin: "4px 0" }}><strong>Nombre:</strong> {approveModalConductor.nombre}</p>
                <p style={{ margin: "4px 0" }}><strong>Teléfono:</strong> {approveModalConductor.telefono || "No registrado"}</p>
                <p style={{ margin: "4px 0" }}><strong>Empresa:</strong> <span className="status-badge" style={{ background: "#e0f2fe", color: "#0369a1" }}>{approveModalConductor.empresa || "Sin asignar"}</span></p>
                <p style={{ margin: "4px 0" }}><strong>No. Licencia:</strong> {approveModalConductor.licencia_numero}</p>
                <p style={{ margin: "4px 0" }}><strong>Tipo de Licencia:</strong> {approveModalConductor.tipo_licencia || "No especificado"}</p>
                <p style={{ margin: "4px 0" }}>
                  <strong>Vencimiento:</strong> {formatDate(approveModalConductor.licencia_vencimiento)}{" "}
                  {approveModalConductor.licencia_vigente ? (
                    <span style={{ color: "#16a34a", fontWeight: "600", fontSize: "0.8rem" }}>✓ Vigente</span>
                  ) : (
                    <span style={{ color: "#dc2626", fontWeight: "600", fontSize: "0.8rem" }}>⚠ Vencida</span>
                  )}
                </p>
                <p style={{ margin: "4px 0" }}><strong>Manejo Comentado:</strong> {formatDate(approveModalConductor.fecha_manejo_comentado)}</p>
                <p style={{ margin: "4px 0" }}><strong>Telegram:</strong> {approveModalConductor.telegram_user_id ? "✅ Vinculado" : "⚪ Sin vincular"}</p>
                <p style={{ margin: "4px 0" }}>
                  <strong>Estatus Aprobación:</strong>{" "}
                  <span style={{ fontWeight: "600", color: approveModalConductor.aprobado_por_admin ? "#15803d" : "#b45309" }}>
                    {approveModalConductor.aprobado_por_admin ? "Aprobado" : "Pendiente de Aprobación"}
                  </span>
                </p>
              </div>

              <div className="driver-license-panel" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <h3 style={{ fontSize: "1rem", color: "#1e293b", margin: "0", borderBottom: "2px solid #cbd5e1", paddingBottom: "6px", width: "100%" }}>
                  🪪 Documentos de Licencia
                </h3>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", width: "100%" }}>
                  {/* Licencia Frente */}
                  <div style={{ background: "#f8fafc", padding: "10px", borderRadius: "8px", border: "1px solid #e2e8f0", textAlign: "center" }}>
                    <p style={{ fontSize: "0.82rem", fontWeight: "600", color: "#334155", margin: "0 0 6px 0" }}>📷 Frente</p>
                    {approveModalConductor.licencia_url ? (
                      approveModalConductor.licencia_url.toLowerCase().endsWith(".pdf") ? (
                        <div style={{ padding: "12px 8px", background: "#eff6ff", borderRadius: "6px" }}>
                          <span style={{ fontSize: "1.8rem", display: "block" }}>📄</span>
                          <a href={approveModalConductor.licencia_url} target="_blank" rel="noreferrer" style={{ fontSize: "0.75rem", color: "#2563eb", fontWeight: "600" }}>Abrir PDF ↗</a>
                        </div>
                      ) : (
                        <a href={approveModalConductor.licencia_url} target="_blank" rel="noreferrer" title="Ver Frente a tamaño completo">
                          <img
                            src={approveModalConductor.licencia_url}
                            alt={`Licencia frente de ${approveModalConductor.nombre}`}
                            style={{ width: "100%", maxHeight: "160px", borderRadius: "6px", border: "1px solid #cbd5e1", objectFit: "contain", background: "#fff" }}
                          />
                        </a>
                      )
                    ) : (
                      <p style={{ fontSize: "0.78rem", color: "#94a3b8", padding: "20px 0" }}>Sin foto Frente</p>
                    )}
                  </div>

                  {/* Licencia Reverso */}
                  <div style={{ background: "#f8fafc", padding: "10px", borderRadius: "8px", border: "1px solid #e2e8f0", textAlign: "center" }}>
                    <p style={{ fontSize: "0.82rem", fontWeight: "600", color: "#334155", margin: "0 0 6px 0" }}>📷 Reverso / Trasero</p>
                    {approveModalConductor.licencia_reverso_url ? (
                      approveModalConductor.licencia_reverso_url.toLowerCase().endsWith(".pdf") ? (
                        <div style={{ padding: "12px 8px", background: "#eff6ff", borderRadius: "6px" }}>
                          <span style={{ fontSize: "1.8rem", display: "block" }}>📄</span>
                          <a href={approveModalConductor.licencia_reverso_url} target="_blank" rel="noreferrer" style={{ fontSize: "0.75rem", color: "#2563eb", fontWeight: "600" }}>Abrir PDF ↗</a>
                        </div>
                      ) : (
                        <a href={approveModalConductor.licencia_reverso_url} target="_blank" rel="noreferrer" title="Ver Reverso a tamaño completo">
                          <img
                            src={approveModalConductor.licencia_reverso_url}
                            alt={`Licencia reverso de ${approveModalConductor.nombre}`}
                            style={{ width: "100%", maxHeight: "160px", borderRadius: "6px", border: "1px solid #cbd5e1", objectFit: "contain", background: "#fff" }}
                          />
                        </a>
                      )
                    ) : (
                      <p style={{ fontSize: "0.78rem", color: "#94a3b8", padding: "20px 0" }}>Sin foto Reverso</p>
                    )}
                  </div>
                </div>
                <p style={{ fontSize: "0.75rem", color: "#64748b", margin: "2px 0 0 0", textAlign: "center" }}>🔍 Haz clic en las imágenes para ampliarlas</p>
              </div>
            </div>

            <div className="form-actions" style={{ borderTop: "1px solid #e2e8f0", paddingTop: "14px", marginTop: "12px", display: "flex", gap: "8px", justifyContent: "flex-end", flexWrap: "wrap" }}>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setApproveModalConductor(null)}
                disabled={updatingId === approveModalConductor.id_conductores}
              >
                Cerrar
              </button>

              {canToggleActive && (
                <button
                  type="button"
                  className={approveModalConductor.activo ? "danger-button" : "reactivate-button"}
                  style={{ fontSize: "0.85rem", padding: "8px 16px" }}
                  disabled={updatingId === approveModalConductor.id_conductores}
                  onClick={() => handleOpenToggleActive(approveModalConductor)}
                >
                  {approveModalConductor.activo ? "Desactivar Conductor" : "✓ Reactivar Conductor"}
                </button>
              )}

              {!approveModalConductor.aprobado_por_admin && (
                <>
                  <button
                    type="button"
                    className="danger-button"
                    style={{ fontSize: "0.85rem", padding: "8px 16px" }}
                    disabled={updatingId === approveModalConductor.id_conductores}
                    onClick={async () => {
                      await handleApproveDriver(approveModalConductor.id_conductores, false);
                      setApproveModalConductor(null);
                    }}
                  >
                    Rechazar
                  </button>
                  <button
                    type="button"
                    className="primary-button"
                    style={{ backgroundColor: "#16a34a", fontSize: "0.85rem", padding: "8px 16px" }}
                    disabled={updatingId === approveModalConductor.id_conductores}
                    onClick={async () => {
                      await handleApproveDriver(approveModalConductor.id_conductores, true);
                      setApproveModalConductor(null);
                    }}
                  >
                    {updatingId === approveModalConductor.id_conductores ? "Procesando..." : "✓ Aprobar Conductor"}
                  </button>
                </>
              )}
            </div>
          </section>
        </div>
      )}

      {/* Modal 1: Asignar / Cambiar PIN */}
      {pinModalConductor && (
        <div className="modal-overlay" onClick={() => !savingPin && setPinModalConductor(null)}>
          <div
            className="modal-card"
            style={{ maxWidth: "440px", width: "100%" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="form-panel-header">
              <div>
                <h2>{pinModalConductor.tiene_pin ? "Cambiar PIN de Acceso" : "Asignar PIN de Acceso"}</h2>
                <p style={{ margin: "4px 0 0 0", color: "#64748b", fontSize: "0.85rem" }}>
                  Conductor: <strong>{pinModalConductor.nombre}</strong>
                </p>
              </div>
              <button
                type="button"
                className="close-button"
                disabled={savingPin}
                onClick={() => setPinModalConductor(null)}
              >
                ✕
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "16px 0" }}>
              <p style={{ fontSize: "0.88rem", color: "#475569", margin: 0 }}>
                Elige cómo deseas establecer el PIN de 4 dígitos para este conductor:
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <label
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "10px",
                    padding: "12px",
                    borderRadius: "8px",
                    border: pinMode === "auto" ? "2px solid #2563eb" : "1px solid #e2e8f0",
                    background: pinMode === "auto" ? "#eff6ff" : "#f8fafc",
                    cursor: "pointer"
                  }}
                >
                  <input
                    type="radio"
                    name="pinMode"
                    value="auto"
                    checked={pinMode === "auto"}
                    onChange={() => {
                      setPinMode("auto");
                      setPinModalError("");
                    }}
                    style={{ marginTop: "2px" }}
                  />
                  <div>
                    <strong style={{ fontSize: "0.9rem", color: "#1e293b", display: "block" }}>
                      🎲 Generar automáticamente
                    </strong>
                    <span style={{ fontSize: "0.78rem", color: "#64748b" }}>
                      El sistema creará un PIN aleatorio y seguro de 4 dígitos.
                    </span>
                  </div>
                </label>

                <label
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "10px",
                    padding: "12px",
                    borderRadius: "8px",
                    border: pinMode === "manual" ? "2px solid #2563eb" : "1px solid #e2e8f0",
                    background: pinMode === "manual" ? "#eff6ff" : "#f8fafc",
                    cursor: "pointer"
                  }}
                >
                  <input
                    type="radio"
                    name="pinMode"
                    value="manual"
                    checked={pinMode === "manual"}
                    onChange={() => {
                      setPinMode("manual");
                      setPinModalError("");
                    }}
                    style={{ marginTop: "2px" }}
                  />
                  <div style={{ width: "100%" }}>
                    <strong style={{ fontSize: "0.9rem", color: "#1e293b", display: "block" }}>
                      ✏️ Ingresar PIN manual
                    </strong>
                    <span style={{ fontSize: "0.78rem", color: "#64748b" }}>
                      Escribe un código numérico de exactamente 4 dígitos.
                    </span>

                    {pinMode === "manual" && (
                      <div style={{ marginTop: "10px" }}>
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={4}
                          placeholder="Ej. 4829"
                          value={manualPin}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, "").slice(0, 4);
                            setManualPin(val);
                            if (pinModalError) setPinModalError("");
                          }}
                          style={{
                            width: "100%",
                            padding: "10px 12px",
                            fontSize: "1.2rem",
                            letterSpacing: "4px",
                            textAlign: "center",
                            fontFamily: "monospace",
                            fontWeight: "bold",
                            borderRadius: "6px",
                            border: "1px solid #cbd5e1"
                          }}
                          autoFocus
                        />
                      </div>
                    )}
                  </div>
                </label>
              </div>

              {pinModalError && (
                <div style={{ padding: "8px 12px", background: "#fee2e2", color: "#991b1b", borderRadius: "6px", fontSize: "0.82rem" }}>
                  ⚠️ {pinModalError}
                </div>
              )}
            </div>

            <div className="form-actions" style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              <button
                type="button"
                className="secondary-button"
                disabled={savingPin}
                onClick={() => setPinModalConductor(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="primary-button"
                disabled={savingPin || (pinMode === "manual" && manualPin.length !== 4)}
                onClick={handleSavePin}
              >
                {savingPin ? "Guardando..." : "Asignar PIN"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: PIN Asignado con Éxito */}
      {pinSuccessData && (
        <div className="modal-overlay" onClick={() => setPinSuccessData(null)}>
          <div
            className="modal-card"
            style={{ maxWidth: "420px", width: "100%", textAlign: "center" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: "3rem", margin: "10px 0 6px 0" }}>🎉</div>
            <h2 style={{ fontSize: "1.25rem", color: "#1e293b", margin: "0 0 6px 0" }}>
              {pinSuccessData.isApproval ? "¡Conductor Aprobado!" : "¡PIN Asignado con Éxito!"}
            </h2>
            <p style={{ fontSize: "0.88rem", color: "#64748b", margin: "0 0 16px 0" }}>
              {pinSuccessData.isApproval
                ? `El conductor ${pinSuccessData.conductorNombre} ha sido aprobado. Se le generó el siguiente PIN para el bot:`
                : `Se asignó el nuevo PIN de acceso para ${pinSuccessData.conductorNombre}:`}
            </p>

            <div
              style={{
                background: "#f1f5f9",
                border: "2px dashed #94a3b8",
                borderRadius: "10px",
                padding: "16px",
                margin: "0 0 16px 0",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "10px"
              }}
            >
              <span
                style={{
                  fontSize: "2.4rem",
                  fontWeight: "bold",
                  letterSpacing: "8px",
                  fontFamily: "monospace",
                  color: "#0f172a"
                }}
              >
                {pinSuccessData.pin}
              </span>

              <div style={{ display: "flex", gap: "8px", justifyContent: "center", flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="secondary-button"
                  style={{
                    fontSize: "0.85rem",
                    padding: "6px 14px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px"
                  }}
                  onClick={() => {
                    navigator.clipboard.writeText(pinSuccessData.pin);
                    setCopiedSuccessPin(true);
                    setTimeout(() => setCopiedSuccessPin(false), 2000);
                  }}
                >
                  {copiedSuccessPin ? "✓ ¡Copiado!" : "📋 Copiar PIN"}
                </button>

                <button
                  type="button"
                  className="primary-button"
                  style={{
                    backgroundColor: "#059669",
                    fontSize: "0.85rem",
                    padding: "6px 14px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px"
                  }}
                  onClick={() => {
                    downloadPinCardImage({
                      nombre: pinSuccessData.conductorNombre,
                      pin: pinSuccessData.pin
                    });
                  }}
                  title="Descargar imagen digital con el PIN y nombre del conductor"
                >
                  📥 Guardar Imagen
                </button>
              </div>
            </div>

            <p style={{ fontSize: "0.8rem", color: "#475569", margin: "0 0 20px 0" }}>
              💡 Entrégale este PIN al conductor para que pueda iniciar sesión en el bot de Telegram de la empresa.
            </p>

            <div style={{ display: "flex", justifyContent: "center" }}>
              <button
                type="button"
                className="primary-button"
                style={{ width: "100%", padding: "10px" }}
                onClick={() => setPinSuccessData(null)}
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Confirmación Activar / Desactivar */}
      {toggleActiveConductor && (
        <div className="modal-overlay" onClick={() => updatingId !== toggleActiveConductor.id_conductores && setToggleActiveConductor(null)}>
          <div
            className="modal-card"
            style={{ maxWidth: "440px", width: "100%" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="form-panel-header">
              <div>
                <h2>{toggleActiveConductor.activo ? "¿Desactivar Conductor?" : "¿Reactivar Conductor?"}</h2>
                <p style={{ margin: "4px 0 0 0", color: "#64748b", fontSize: "0.85rem" }}>
                  Conductor: <strong>{toggleActiveConductor.nombre}</strong>
                </p>
              </div>
              <button
                type="button"
                className="close-button"
                disabled={updatingId === toggleActiveConductor.id_conductores}
                onClick={() => setToggleActiveConductor(null)}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: "16px 0", fontSize: "0.9rem", color: "#334155", lineHeight: "1.5" }}>
              {toggleActiveConductor.activo ? (
                <>
                  <p style={{ margin: "0 0 10px 0" }}>
                    ¿Estás seguro de que deseas <strong>desactivar</strong> a este conductor?
                  </p>
                  <ul style={{ margin: 0, paddingLeft: "20px", color: "#64748b", fontSize: "0.85rem" }}>
                    <li>No podrá iniciar sesión en el bot de Telegram.</li>
                    <li>No podrá iniciar nuevos viajes.</li>
                    <li>Si tiene un viaje actualmente en curso, el sistema rechazará la desactivación.</li>
                  </ul>
                </>
              ) : (
                <>
                  <p style={{ margin: "0 0 10px 0" }}>
                    ¿Estás seguro de que deseas <strong>reactivar</strong> a este conductor?
                  </p>
                  <p style={{ margin: 0, color: "#64748b", fontSize: "0.85rem" }}>
                    El conductor podrá volver a acceder al bot de Telegram y comenzar viajes con normalidad.
                  </p>
                </>
              )}
            </div>

            <div className="form-actions" style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              <button
                type="button"
                className="secondary-button"
                disabled={updatingId === toggleActiveConductor.id_conductores}
                onClick={() => setToggleActiveConductor(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={toggleActiveConductor.activo ? "danger-button" : "primary-button"}
                style={!toggleActiveConductor.activo ? { backgroundColor: "#16a34a" } : {}}
                disabled={updatingId === toggleActiveConductor.id_conductores}
                onClick={confirmToggleActive}
              >
                {updatingId === toggleActiveConductor.id_conductores
                  ? "Procesando..."
                  : toggleActiveConductor.activo
                  ? "Sí, desactivar"
                  : "✓ Sí, reactivar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 4: Confirmación Eliminar */}
      {deleteConfirmConductor && (
        <div className="modal-overlay" onClick={() => updatingId !== deleteConfirmConductor.id_conductores && setDeleteConfirmConductor(null)}>
          <div
            className="modal-card"
            style={{ maxWidth: "440px", width: "100%" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="form-panel-header">
              <div>
                <h2 style={{ color: "#b91c1c" }}>¿Eliminar Conductor?</h2>
                <p style={{ margin: "4px 0 0 0", color: "#64748b", fontSize: "0.85rem" }}>
                  Conductor: <strong>{deleteConfirmConductor.nombre}</strong>
                </p>
              </div>
              <button
                type="button"
                className="close-button"
                disabled={updatingId === deleteConfirmConductor.id_conductores}
                onClick={() => setDeleteConfirmConductor(null)}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: "16px 0", fontSize: "0.9rem", color: "#334155", lineHeight: "1.5" }}>
              <p style={{ margin: "0 0 10px 0" }}>
                ¿Estás seguro de que deseas eliminar permanentemente a <strong>{deleteConfirmConductor.nombre}</strong>?
              </p>
              <div style={{ padding: "10px", background: "#fef2f2", borderLeft: "4px solid #ef4444", borderRadius: "4px", fontSize: "0.82rem", color: "#991b1b" }}>
                ⚠️ <strong>Advertencia:</strong> Se desvinculará y eliminará su usuario de Telegram. Sus viajes históricos se conservarán para fines de auditoría.
              </div>
            </div>

            <div className="form-actions" style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              <button
                type="button"
                className="secondary-button"
                disabled={updatingId === deleteConfirmConductor.id_conductores}
                onClick={() => setDeleteConfirmConductor(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="danger-button"
                disabled={updatingId === deleteConfirmConductor.id_conductores}
                onClick={confirmDeleteDriver}
              >
                {updatingId === deleteConfirmConductor.id_conductores ? "Eliminando..." : "Sí, eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default ConductoresPage;

