import {
  useEffect,
  useRef,
  useState
} from "react";

import {
  assignAdminConductorVehicle,
  createAdminConductor,
  getAdminConductores,
  getAdminVehiculos,
  updateAdminConductorStatus,
  approveAdminConductor,
  setAdminConductorPin
} from "../services/api.js";


const initialForm = {
  nombre: "",
  telefono: "",
  licenciaNumero: "",
  tipoLicencia: "",
  empresa: "",
  licenciaVencimiento: ""
};

const empresas = ["ITZAMNA", "MCCLICK", "AQUARIO", "ASPROMEX", "BALAM", "AGROKOOL"];
const dias = Array.from({ length: 31 }, (_, index) => String(index + 1).padStart(2, "0"));
const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const anios = Array.from({ length: 16 }, (_, index) => String(new Date().getFullYear() + index));

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

  const [showForm, setShowForm] =
    useState(false);

  const [form, setForm] =
    useState(initialForm);

  const [saving, setSaving] =
    useState(false);

  const [updatingId, setUpdatingId] =
    useState(null);

  const [vehiculosOptions, setVehiculosOptions] =
    useState([]);

  const [assigningId, setAssigningId] =
    useState(null);

  const [approveModalConductor, setApproveModalConductor] =
    useState(null);

  const submitRef =
    useRef(false);

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
        window.alert(`✅ Conductor aprobado correctamente.\n\n🔑 Se le asignó el PIN de acceso: ${res.data.pinGenerado}`);
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

  async function handleSetPin(conductor) {
    const opcionAuto = window.confirm(
      `¿Deseas generar automáticamente un nuevo PIN de 4 dígitos para ${conductor.nombre}?\n\n- Clic en [Aceptar] para generar un PIN aleatorio automáticamente.\n- Clic en [Cancelar] si prefieres escribir un PIN manual.`
    );

    let pinToSend = null;
    let auto = false;

    if (opcionAuto) {
      auto = true;
    } else {
      const inputPin = window.prompt(`Ingresa el nuevo PIN de 4 dígitos para ${conductor.nombre}:`);
      if (!inputPin) return;
      const cleanPin = inputPin.trim();
      if (!/^\d{4}$/.test(cleanPin)) {
        alert("El PIN debe constar de exactamente 4 dígitos numéricos.");
        return;
      }
      pinToSend = cleanPin;
    }

    try {
      setUpdatingId(conductor.id_conductores);
      const res = await setAdminConductorPin(conductor.id_conductores, pinToSend, auto);
      const pinFinal = res.data?.pinGenerado || pinToSend;
      window.alert(`✅ ¡Nuevo PIN asignado con éxito a ${conductor.nombre}!\n\n🔑 PIN: ${pinFinal}\n\nPor favor compárteselo al conductor.`);
      setMessage(res.message || `PIN asignado correctamente a ${conductor.nombre}: ${pinFinal}`);
      setMessageType("success");
      await loadConductores();
    } catch (err) {
      setMessage(err.message || "Error al asignar el PIN.");
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
      [name]: value
    }));

    setMessage("");
  }

  function updateExpiry(part, value) {
    const [year = "", month = "", day = ""] = form.licenciaVencimiento.split("-");
    const next = { year, month, day, [part]: value };
    setForm((current) => ({ ...current, licenciaVencimiento: next.year && next.month && next.day ? `${next.year}-${next.month}-${next.day}` : "" }));
  }

  function closeForm() {
    if (saving) {
      return;
    }

    setShowForm(false);
    setForm(initialForm);
  }

  function handleOverlayMouseDown(event) {
    if (
      event.target ===
      event.currentTarget
    ) {
      closeForm();
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (submitRef.current) {
      return;
    }

    submitRef.current = true;
    setSaving(true);
    setMessage("");

    try {
      const response =
        await createAdminConductor(
          form
        );

      setMessage(
        response.message ||
        "Conductor creado correctamente."
      );

      setMessageType("success");
      setForm(initialForm);
      setShowForm(false);

      await loadConductores();
    } catch (error) {
      setMessage(error.message);
      setMessageType("error");
    } finally {
      submitRef.current = false;
      setSaving(false);
    }
  }

  async function handleStatusChange(
    conductor
  ) {
    const confirmed =
      window.confirm(
        `¿Eliminar permanentemente a ${conductor.nombre}? También se eliminará su usuario de Telegram. Sus viajes históricos se conservarán.`
      );

    if (!confirmed) {
      return;
    }

    setUpdatingId(
      conductor.id_conductores
    );

    setMessage("");

    try {
      const response =
        await updateAdminConductorStatus(
          conductor.id_conductores,
          false
        );

      setConductores((current) =>
        current.filter((item) => item.id_conductores !== conductor.id_conductores)
      );
      await loadConductores();

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

        {(!user || user.rol === "ADMINISTRADOR") && (
          <button
            type="button"
            className="primary-button"
            onClick={() =>
              setShowForm(true)
            }
          >
            + Nuevo conductor
          </button>
        )}
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

      {showForm && (
        <div
          className="modal-overlay"
          role="presentation"
          onMouseDown={handleOverlayMouseDown}
        >
          <section
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-driver-title"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >
            <div className="form-panel-header">
              <div>
                <h2 id="new-driver-title">
                  Nuevo conductor
                </h2>

                <p>
                  Captura los datos del
                  conductor.
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
                Nombre completo

                <input
                  name="nombre"
                  value={form.nombre}
                  onChange={handleChange}
                  minLength="3"
                  required
                />
              </label>

              <label>
                Teléfono

                <input
                  name="telefono"
                  value={form.telefono}
                  onChange={handleChange}
                  inputMode="tel"
                  required
                />
              </label>

              <label>
                Número de licencia

                <input
                  name="licenciaNumero"
                  value={
                    form.licenciaNumero
                  }
                  onChange={handleChange}
                  required
                />
              </label>

              <label>
                Empresa
                <select name="empresa" value={form.empresa} onChange={handleChange} required><option value="">Selecciona una empresa</option>{empresas.map((empresa) => <option key={empresa} value={empresa}>{empresa}</option>)}</select>
              </label>

              <label>
                Vencimiento de licencia
                <span className="date-selects"><select value={form.licenciaVencimiento.split("-")[2] || ""} onChange={e=>updateExpiry("day",e.target.value)} required><option value="">Día</option>{dias.map(day=><option key={day}>{day}</option>)}</select><select value={form.licenciaVencimiento.split("-")[1] || ""} onChange={e=>updateExpiry("month",e.target.value)} required><option value="">Mes</option>{meses.map((month,index)=><option key={month} value={String(index+1).padStart(2,"0")}>{month}</option>)}</select><select value={form.licenciaVencimiento.split("-")[0] || ""} onChange={e=>updateExpiry("year",e.target.value)} required><option value="">Año</option>{anios.map(year=><option key={year}>{year}</option>)}</select></span>
              </label>

              <label>
                Tipo de licencia
                <input name="tipoLicencia" value={form.tipoLicencia} onChange={handleChange} placeholder="Ej. Federal B" required />
              </label>

              <label>
                Última Evaluación de Manejo Comentado (dd/mm/aaaa)
                <div className="date-picker-row">
                  <select
                    value={form.mcDia || ""}
                    onChange={(e) => {
                      const mcDia = e.target.value;
                      setForm((prev) => {
                        const mcMes = prev.mcMes || "";
                        const mcAnio = prev.mcAnio || "";
                        return {
                          ...prev,
                          mcDia,
                          fechaManejoComentado: mcDia && mcMes && mcAnio ? `${mcAnio}-${mcMes}-${mcDia}` : ""
                        };
                      });
                    }}
                  >
                    <option value="">Día</option>
                    {dias.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                  <select
                    value={form.mcMes || ""}
                    onChange={(e) => {
                      const mcMes = e.target.value;
                      setForm((prev) => {
                        const mcDia = prev.mcDia || "";
                        const mcAnio = prev.mcAnio || "";
                        return {
                          ...prev,
                          mcMes,
                          fechaManejoComentado: mcDia && mcMes && mcAnio ? `${mcAnio}-${mcMes}-${mcDia}` : ""
                        };
                      });
                    }}
                  >
                    <option value="">Mes</option>
                    {meses.map((m, i) => <option key={m} value={String(i + 1).padStart(2, "0")}>{m}</option>)}
                  </select>
                  <select
                    value={form.mcAnio || ""}
                    onChange={(e) => {
                      const mcAnio = e.target.value;
                      setForm((prev) => {
                        const mcDia = prev.mcDia || "";
                        const mcMes = prev.mcMes || "";
                        return {
                          ...prev,
                          mcAnio,
                          fechaManejoComentado: mcDia && mcMes && mcAnio ? `${mcAnio}-${mcMes}-${mcDia}` : ""
                        };
                      });
                    }}
                  >
                    <option value="">Año</option>
                    {Array.from({ length: 10 }, (_, index) => String(new Date().getFullYear() - 5 + index)).map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
              </label>


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
                    : "Guardar conductor"}
                </button>
              </div>
            </form>
          </section>
        </div>
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
            <div className="table-wrapper">
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
                  <th>PIN Web</th>
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
                        <span style={{
                          fontSize: "0.82rem",
                          fontWeight: "600",
                          padding: "2px 8px",
                          borderRadius: "12px",
                          background: conductor.tiene_pin ? "#dcfce7" : "#fee2e2",
                          color: conductor.tiene_pin ? "#15803d" : "#b91c1c"
                        }}>
                          {conductor.tiene_pin ? "✓ PIN Activo" : "Sin PIN"}
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
                              onClick={() => handleSetPin(conductor)}
                              title="Generar automáticamente o cambiar PIN"
                            >
                              {conductor.tiene_pin ? "Generar nuevo PIN" : "Asignar PIN"}
                            </button>

                            {(!user || user.rol === "ADMINISTRADOR") && (
                              <button
                                type="button"
                                className={
                                  conductor.activo
                                    ? "danger-button"
                                    : "reactivate-button"
                                }
                                style={{ padding: "4px 8px", fontSize: "0.8rem" }}
                                disabled={
                                  updatingId === conductor.id_conductores
                                }
                                onClick={() =>
                                  handleStatusChange(conductor)
                                }
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

            <div className="form-actions" style={{ borderTop: "1px solid #e2e8f0", paddingTop: "14px", marginTop: "12px" }}>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setApproveModalConductor(null)}
                disabled={updatingId === approveModalConductor.id_conductores}
              >
                Cerrar
              </button>

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
    </section>
  );
}

export default ConductoresPage;

