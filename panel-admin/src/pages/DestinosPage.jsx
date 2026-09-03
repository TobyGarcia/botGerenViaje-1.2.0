import {
  useEffect,
  useRef,
  useState
} from "react";

import {
  createAdminDestino,
  getAdminDestinos,
  updateAdminDestino,
  updateAdminDestinoStatus
} from "../services/api.js";

const initialForm = {
  idDestino: null,
  nombre: "",
  direccion: ""
};

function DestinosPage({ user }) {
  const canEdit = user?.rol === "ADMINISTRADOR";
  const canCreate = ["ADMINISTRADOR", "GERENTE", "GERENTE_GENERAL", "COORDINADOR", "COORDINADOR_AREA", "COORDINADOR_QHSE", "SUPERVISOR", "QHSE", "INSTRUCTOR"].includes(user?.rol);
  const [destinos, setDestinos] =
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

  const isEditing = Boolean(form.idDestino);

  const [saving, setSaving] =
    useState(false);

  const [updatingId, setUpdatingId] =
    useState(null);

  const submittingRef =
    useRef(false);

  async function loadDestinos() {
    setLoading(true);

    try {
      const response =
        await getAdminDestinos({
          search,
          status
        });

      setDestinos(
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
        loadDestinos();
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

  function openForm() {
    setForm(initialForm);
    setMessage("");
    setShowForm(true);
  }

  function openEditForm(destino) {
    setForm({
      idDestino: destino.id_lugares,
      nombre: destino.nombre,
      direccion: destino.direccion || ""
    });
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

  async function handleSubmit(event) {
    event.preventDefault();

    if (submittingRef.current) {
      return;
    }

    const nombre =
      form.nombre
        .replace(/\s+/g, " ")
        .trim();

    const direccion =
      form.direccion
        .replace(/\s+/g, " ")
        .trim();

    if (nombre.length < 2) {
      setMessage(
        "El nombre del destino debe tener al menos 2 caracteres."
      );

      setMessageType("error");
      return;
    }

    submittingRef.current = true;
    setSaving(true);
    setMessage("");

    try {
      const response = isEditing
        ? await updateAdminDestino(
            form.idDestino,
            { nombre, direccion }
          )
        : await createAdminDestino({
            nombre,
            direccion
          });

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

  async function handleStatusChange(
    destino
  ) {
    const nextStatus =
      !destino.activo;

    const action =
      nextStatus
        ? "reactivar"
        : "dar de baja";

    const confirmed =
      window.confirm(
        `¿Confirmas que deseas ${action} el destino "${destino.nombre}"?`
      );

    if (!confirmed) {
      return;
    }

    setUpdatingId(
      destino.id_lugares
    );

    setMessage("");

    try {
      const response =
        await updateAdminDestinoStatus(
          destino.id_lugares,
          nextStatus
        );

      setDestinos((current) =>
        current.map((item) =>
          item.id_lugares ===
          destino.id_lugares
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
        await loadDestinos();
      }

      if (
        status === "INACTIVOS" &&
        nextStatus
      ) {
        await loadDestinos();
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

          <h1>Destinos</h1>

          <p>
            Consulta y administra los
            lugares permitidos para los
            viajes.
          </p>
        </div>

        {canCreate && <button
          type="button"
          className="primary-button"
          onClick={openForm}
        >
          + Nuevo destino
        </button>}
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
            placeholder="Buscar por nombre o dirección"
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

      <section className="table-panel">
        {loading ? (
          <p className="table-status">
            Cargando destinos...
          </p>
        ) : destinos.length === 0 ? (
          <p className="table-status">
            No se encontraron destinos.
          </p>
        ) : (
          <div className="table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Destino</th>
                  <th>Dirección</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>

              <tbody>
                {destinos.map(
                  (destino) => (
                    <tr
                      key={
                        destino.id_lugares
                      }
                    >
                      <td>
                        <strong>
                          {destino.nombre}
                        </strong>
                      </td>

                      <td>
                        {destino.direccion ||
                          "Sin dirección registrada"}
                      </td>

                      <td>
                        <span
                          className={
                            destino.activo
                              ? "status-badge status-active"
                              : "status-badge status-inactive"
                          }
                        >
                          {destino.activo
                            ? "Activo"
                            : "Inactivo"}
                        </span>
                      </td>

                      <td className="table-actions">
                        {canEdit && <button
                          type="button"
                          className="edit-button"
                          onClick={() =>
                            openEditForm(destino)
                          }
                        >
                          Editar
                        </button>}

                        {canEdit && <button
                          type="button"
                          className={
                            destino.activo
                              ? "danger-button"
                              : "reactivate-button"
                          }
                          disabled={
                            updatingId ===
                            destino.id_lugares
                          }
                          onClick={() =>
                            handleStatusChange(
                              destino
                            )
                          }
                        >
                          {updatingId ===
                          destino.id_lugares
                            ? "Actualizando..."
                            : destino.activo
                              ? "Dar de baja"
                              : "Reactivar"}
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
            className="modal-card destination-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-destination-title"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >
            <div className="form-panel-header">
              <div>
                <h2 id="new-destination-title">
                  {isEditing
                    ? "Editar destino"
                    : "Nuevo destino"}
                </h2>

                <p>
                  Registra un lugar que
                  podrá utilizarse como
                  origen o destino.
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
              className="destination-form"
              onSubmit={handleSubmit}
            >
              <label>
                Nombre del destino

                <input
                  name="nombre"
                  value={form.nombre}
                  onChange={handleChange}
                  placeholder="Ej. Casa Uayamón"
                  minLength="2"
                  maxLength="150"
                  autoFocus
                  required
                  disabled={saving}
                />
              </label>

              <label>
                Dirección

                <textarea
                  name="direccion"
                  value={form.direccion}
                  onChange={handleChange}
                  placeholder="Calle, número, colonia, ciudad y código postal"
                  rows="4"
                  maxLength="500"
                  disabled={saving}
                />
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
                    : isEditing
                      ? "Guardar cambios"
                      : "Guardar destino"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </section>
  );
}

export default DestinosPage;
