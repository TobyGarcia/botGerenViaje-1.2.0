import {
  useEffect,
  useRef,
  useState
} from "react";

import {
  createAdminVehiculo,
  getAdminVehiculos,
  updateAdminVehiculoStatus
} from "../services/api.js";

const initialForm = {
  marca: "",
  modelo: "",
  numeroEconomico: "",
  placas: ""
};

function VehiculosPage() {
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

  const [updatingId, setUpdatingId] =
    useState(null);

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

  function openForm() {
    setForm(initialForm);
    setMessage("");
    setShowForm(true);
  }

  function closeForm() {
    if (saving) {
      return;
    }

    setShowForm(false);
    setForm(initialForm);
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
      const response =
        await createAdminVehiculo(
          form
        );

      setMessage(
        response.message ||
        "Vehículo creado correctamente."
      );

      setMessageType("success");
      setShowForm(false);
      setForm(initialForm);

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
    const nextStatus =
      !vehiculo.activo;

    const action =
      nextStatus
        ? "reactivar"
        : "dar de baja";

    const confirmed =
      window.confirm(
        `¿Confirmas que deseas ${action} la unidad ${vehiculo.nombre}?`
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
          nextStatus
        );

      setVehiculos((current) =>
        current.map((item) =>
          item.id_vehiculos ===
          vehiculo.id_vehiculos
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

      if (
        status === "ACTIVOS" &&
        !nextStatus
      ) {
        await loadVehiculos();
      }

      if (
        status === "INACTIVOS" &&
        nextStatus
      ) {
        await loadVehiculos();
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

          <h1>Unidades</h1>

          <p>
            Consulta, registra y controla
            las unidades vehiculares.
          </p>
        </div>

        <button
          type="button"
          className="primary-button"
          onClick={openForm}
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
                          {vehiculo.nombre}
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

                      <td>
                        <span
                          className={
                            vehiculo.activo
                              ? "status-badge status-active"
                              : "status-badge status-inactive"
                          }
                        >
                          {vehiculo.activo
                            ? "Disponible"
                            : "Inactivo"}
                        </span>
                      </td>

                      <td>
                        <button
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
                  Nueva unidad
                </h2>

                <p>
                  Registra los datos de
                  la unidad vehicular.
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
                    : "Guardar unidad"}
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