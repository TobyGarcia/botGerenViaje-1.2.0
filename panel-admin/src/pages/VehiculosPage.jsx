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
  updateAdminVehiculoMantenimiento,
  updateAdminVehiculo,
  updateAdminVehiculoStatus
} from "../services/api.js";

const initialForm = {
  marca: "",
  modelo: "",
  numeroEconomico: "",
  placas: "",
  numeroPoliza: "",
  seguroVencimiento: "",
  numeroSerie: "",
  tipoVehiculo: "",
  tipoPropiedad: "EMPRESARIAL"
};

function VehiculosPage({ user }) {
  const canManageMileage = user?.rol === "ADMINISTRADOR";
  const canEditVehicle = user?.rol === "ADMINISTRADOR";
  const [vehiculos, setVehiculos] =
    useState([]);

  const [search, setSearch] =
    useState("");

  const [status, setStatus] =
    useState("TODOS");

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
      tipoPropiedad: vehiculo.tipo_propiedad || "EMPRESARIAL"
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

  async function handleMaintenanceChange(vehiculo) {
    const nextValue = !vehiculo.en_mantenimiento;
    const confirmed = window.confirm(
      nextValue
        ? `¿Enviar la unidad ${vehiculo.nombre} a mantenimiento?`
        : `¿Retirar la unidad ${vehiculo.nombre} de mantenimiento?`
    );
    if (!confirmed) return;

    setUpdatingId(vehiculo.id_vehiculos);
    try {
      const response = await updateAdminVehiculoMantenimiento(vehiculo.id_vehiculos, nextValue);
      setMessage(response.message);
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

      <section className="module-toolbar">
        <label className="search-field">
          <span>Buscar</span>

          <input
            type="search"
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value
              )
            }
            placeholder="Marca, modelo, número económico o placas"
          />
        </label>

        <label className="status-filter">
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

            <option value="ACTIVOS">
              Disponibles
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
          <div className="table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Unidad</th>
                  <th>Número económico</th>
                  <th>Placas</th>
                  <th>Kilometraje actual</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>

              <tbody>
                {vehiculos.map(
                  (vehiculo) => (
                    <tr
                      key={
                        vehiculo.id_vehiculos
                      }
                    >
                      <td>
                        <strong>
                          {vehiculo.marca || vehiculo.nombre} {vehiculo.modelo || ""}
                        </strong>
                      </td>

                      <td>
                        {
                          vehiculo.numero_economico
                        }
                      </td>

                      <td>
                        {vehiculo.placas}
                      </td>

                      <td>{vehiculo.kilometraje_actual ?? 0} km</td>

                      <td>
                        <span
                          className={
                            vehiculo.disponibilidad === "DISPONIBLE"
                              ? "status-badge status-active"
                              : "status-badge status-inactive"
                          }
                        >
                          {vehiculo.disponibilidad === "DISPONIBLE" ? "Disponible" :
                            vehiculo.disponibilidad === "MANTENIMIENTO" ? "No disponible: mantenimiento" :
                            vehiculo.disponibilidad === "EN_VIAJE" ? "No disponible: en viaje" : "Inactivo"}
                        </span>
                      </td>

                      <td>
                        <button type="button" className="secondary-button" onClick={() => openMileage(vehiculo)}>
                          Historial
                        </button>
                        <button type="button" className="secondary-button" onClick={() => openDetail(vehiculo)}>
                          Ver detalle
                        </button>
                        {canEditVehicle && <button type="button" className="secondary-button" onClick={() => openForm(vehiculo)}>
                          Modificar
                        </button>}
                        {canEditVehicle && <button
                          type="button"
                          className="secondary-button"
                          disabled={updatingId === vehiculo.id_vehiculos || vehiculo.disponibilidad === "EN_VIAJE"}
                          onClick={() => handleMaintenanceChange(vehiculo)}
                        >
                          {vehiculo.en_mantenimiento ? "Retirar mantenimiento" : "Mantenimiento"}
                        </button>}
                        {canEditVehicle && <button
                          type="button"
                          className={
                            vehiculo.activo
                              ? "danger-button"
                              : "reactivate-button"
                          }
                          disabled={
                            updatingId ===
                            vehiculo.id_vehiculos
                          }
                          onClick={() =>
                            handleStatusChange(
                              vehiculo
                            )
                          }
                        >
                          {updatingId ===
                          vehiculo.id_vehiculos
                            ? "Actualizando..."
                            : vehiculo.activo
                              ? "Eliminar"
                              : "Eliminar"}
                        </button>}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
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
                <span><strong>Tipo:</strong> {detailVehicle.tipo_vehiculo || "Sin capturar"}</span>
                <span><strong>Propiedad:</strong> {detailVehicle.tipo_propiedad || "Sin capturar"}</span>
                <span><strong>Núm. de serie:</strong> {detailVehicle.numero_serie || "Sin capturar"}</span>
                <span><strong>Póliza:</strong> {detailVehicle.numero_poliza || "Sin capturar"}</span>
                <span><strong>Vence seguro:</strong> {detailVehicle.seguro_vencimiento ? new Date(`${detailVehicle.seguro_vencimiento}T00:00:00`).toLocaleDateString("es-MX") : "Sin capturar"}</span>
                <span><strong>Kilometraje:</strong> {detailVehicle.kilometraje_actual ?? 0} km</span>
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
    </section>
  );
}

export default VehiculosPage;
