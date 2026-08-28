import {
  useEffect,
  useRef,
  useState
} from "react";

import {
  createAdminConductor,
  getAdminConductores,
  updateAdminConductorStatus
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

function ConductoresPage() {
  const [conductores, setConductores] =
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

  const [updatingId, setUpdatingId] =
    useState(null);

  const submitRef =
    useRef(false);

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

        <button
          type="button"
          className="primary-button"
          onClick={() =>
            setShowForm(true)
          }
        >
          + Nuevo conductor
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
            placeholder="Nombre, licencia o teléfono"
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
          <div className="table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Conductor</th>
                  <th>Teléfono</th>
                  <th>Empresa</th>
                  <th>Licencia</th>
                  <th>Vencimiento Licencia</th>
                  <th>Manejo Comentado</th>
                  <th>Telegram</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>

              <tbody>
                {conductores.map(
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

                      <td>
                        <button
                          type="button"
                          className={
                            conductor.activo
                              ? "danger-button"
                              : "reactivate-button"
                          }
                          disabled={
                            updatingId ===
                            conductor.id_conductores
                          }
                          onClick={() =>
                            handleStatusChange(
                              conductor
                            )
                          }
                        >
                          {updatingId ===
                          conductor.id_conductores
                            ? "Actualizando..."
                            : conductor.activo
                              ? "Eliminar"
                              : "Eliminar"}
                        </button>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}

export default ConductoresPage;
