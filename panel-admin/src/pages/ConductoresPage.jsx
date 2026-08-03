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
  licenciaVencimiento: ""
};

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
    const nextStatus =
      !conductor.activo;

    const action =
      nextStatus
        ? "reactivar"
        : "dar de baja";

    const confirmed =
      window.confirm(
        `¿Confirmas que deseas ${action} a ${conductor.nombre}?`
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
          nextStatus
        );

      setConductores((current) =>
        current.map((item) =>
          item.id_conductores ===
          conductor.id_conductores
            ? {
                ...item,
                ...response.data
              }
            : item
        )
      );

      setMessage(
        response.message
      );

      setMessageType("success");

      /*
       * Si el filtro actual ya no incluye
       * el nuevo estado, recargamos.
       */
      if (
        status === "ACTIVOS" &&
        !nextStatus
      ) {
        await loadConductores();
      }

      if (
        status === "INACTIVOS" &&
        nextStatus
      ) {
        await loadConductores();
      }
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
                Vencimiento de licencia

                <input
                  type="date"
                  name="licenciaVencimiento"
                  value={
                    form.licenciaVencimiento
                  }
                  onChange={handleChange}
                  required
                />
              </label>

              <label>
                Tipo de licencia
                <input name="tipoLicencia" value={form.tipoLicencia} onChange={handleChange} placeholder="Ej. Federal B" required />
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
                  <th>Licencia</th>
                  <th>Vencimiento</th>
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
                              ? "Dar de baja"
                              : "Reactivar"}
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
