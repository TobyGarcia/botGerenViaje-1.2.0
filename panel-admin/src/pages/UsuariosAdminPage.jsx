import { useEffect, useState } from "react";
import {
  createAdminUser,
  deleteAdminUser,
  getAdminConductores,
  getAdminUsers,
  updateAdminUser
} from "../services/api.js";
import { IconEditar, IconEliminar } from "../components/Icons.jsx";

const empty = {
  nombre: "",
  username: "",
  correo: "",
  password: "",
  rol: "OPERADOR",
  activo: true,
  idConductor: ""
};

export default function UsuariosAdminPage({ currentUser }) {
  const [users, setUsers] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [form, setForm] = useState(empty);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");

  const load = async () => {
    try {
      const [u, d] = await Promise.all([
        getAdminUsers(),
        getAdminConductores({ status: "ACTIVOS" })
      ]);
      setUsers(u.data || []);
      setDrivers(d.data || []);
    } catch (error) {
      setMessage(error.message);
    }
  };

  useEffect(() => {
    load();
  }, []);

  function create() {
    setForm(empty);
    setOpen(true);
  }

  function edit(user) {
    setForm({
      idUsuariosAdmin: user.id_usuarios_admin,
      nombre: user.nombre,
      username: user.username,
      correo: user.correo || "",
      rol: user.rol,
      activo: user.activo,
      idConductor: user.id_conductores || ""
    });
    setOpen(true);
  }

  async function submit(event) {
    event.preventDefault();
    try {
      if (form.idUsuariosAdmin) {
        await updateAdminUser(form.idUsuariosAdmin, form);
      } else {
        await createAdminUser(form);
      }
      setOpen(false);
      setMessage("Cambios guardados.");
      load();
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <section className="module-page">
      <header className="module-header">
        <div>
          <span className="module-label">Administración</span>
          <h1>Administrador de usuarios</h1>
          <p>Gestiona jerarquías, accesos y la relación opcional de Operador con un conductor.</p>
        </div>
        <button type="button" className="primary-button" onClick={create}>
          ＋ Añadir usuario
        </button>
      </header>

      {message && <p className="module-message module-message-success">{message}</p>}

      <section className="table-panel">
        <div className="table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Correo</th>
                <th>Rol</th>
                <th>Conductor</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id_usuarios_admin}>
                  <td>
                    <strong>{user.nombre}</strong>
                    <small>@{user.username}</small>
                  </td>
                  <td>{user.correo || "—"}</td>
                  <td>
                    <span style={{
                      padding: "4px 10px",
                      borderRadius: "12px",
                      fontWeight: "bold",
                      fontSize: "0.78rem",
                      background: user.rol === "GERENTE" ? "#fee2e2" : user.rol === "COORDINADOR" ? "#fef9c3" : user.rol === "SUPERVISOR" || user.rol === "QHSE" ? "#dcfce7" : "#f1f5f9",
                      color: user.rol === "GERENTE" ? "#991b1b" : user.rol === "COORDINADOR" ? "#854d0e" : user.rol === "SUPERVISOR" || user.rol === "QHSE" ? "#166534" : "#334155"
                    }}>
                      {user.rol === "GERENTE" ? "🔴 GERENTE" : user.rol === "COORDINADOR" ? "🟡 COORDINADOR" : user.rol === "SUPERVISOR" ? "🟢 SUPERVISOR" : user.rol === "QHSE" ? "🛡️ QHSE" : user.rol}
                    </span>
                  </td>
                  <td>{user.conductor || "—"}</td>
                  <td>
                    <span className={`status-badge ${user.activo ? "status-active" : "status-inactive"}`}>
                      {user.activo ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td>
                    <div className="table-action-icons">
                      <button
                        type="button"
                        className="action-icon-btn action-icon-edit"
                        onClick={() => edit(user)}
                        title="Editar usuario"
                        aria-label="Editar usuario"
                      >
                        <IconEditar size={16} />
                      </button>
                      {user.id_usuarios_admin !== currentUser?.idUsuarioAdmin && (
                        <button
                          type="button"
                          className="action-icon-btn action-icon-delete"
                          onClick={async () => {
                            if (window.confirm("¿Eliminar este usuario?")) {
                              try {
                                await deleteAdminUser(user.id_usuarios_admin);
                                load();
                              } catch (error) {
                                setMessage(error.message);
                              }
                            }
                          }}
                          title="Eliminar usuario"
                          aria-label="Eliminar usuario"
                        >
                          <IconEliminar size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {open && (
        <div className="modal-overlay" role="presentation">
          <section className="modal-card user-form-modal" role="dialog" aria-modal="true" aria-labelledby="user-form-title">
            <div className="form-panel-header">
              <div>
                <h2 id="user-form-title">{form.idUsuariosAdmin ? "Editar usuario" : "Nuevo usuario"}</h2>
                <p>Define el acceso y los datos de la cuenta administrativa.</p>
              </div>
              <button type="button" className="close-button" onClick={() => setOpen(false)} aria-label="Cerrar">
                ×
              </button>
            </div>
            <form className="driver-form" onSubmit={submit}>
              <label>
                Nombre
                <input required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
              </label>
              <label>
                Usuario
                <input
                  required
                  disabled={Boolean(form.idUsuariosAdmin)}
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                />
              </label>
              <label>
                Correo
                <input
                  type="email"
                  value={form.correo || ""}
                  onChange={(e) => setForm({ ...form, correo: e.target.value })}
                />
              </label>
              {!form.idUsuariosAdmin && (
                <label>
                  Contraseña
                  <input
                    type="password"
                    required
                    minLength="8"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                  />
                </label>
              )}
              <label>
                Rol Administrativo (Jerarquía de Aprobación de Gerenciamientos)
                <select value={form.rol} onChange={(e) => setForm({ ...form, rol: e.target.value })}>
                  <option value="ADMINISTRADOR">👑 ADMINISTRADOR (Acceso Total)</option>
                  <option value="GERENTE">🔴 GERENTE (Aprueba Riesgo ALTO &gt; 23 pts)</option>
                  <option value="COORDINADOR">🟡 COORDINADOR DE ÁREA (Aprueba Riesgo MEDIO 16-22 pts)</option>
                  <option value="SUPERVISOR">🟢 SUPERVISOR DIRECTO (Aprueba Riesgo BAJO 0-15 pts)</option>
                  <option value="QHSE">🛡️ QHSE (Aprueba Riesgo BAJO 0-15 pts)</option>
                  <option value="OPERADOR">🚛 OPERADOR (Operaciones)</option>
                  <option value="CONSULTA">👁️ CONSULTA (Solo Lectura)</option>
                </select>
              </label>
              <label>
                Conductor vinculado
                <select value={form.idConductor || ""} onChange={(e) => setForm({ ...form, idConductor: e.target.value })}>
                  <option value="">No vinculado</option>
                  {drivers.map((driver) => (
                    <option value={driver.id_conductores} key={driver.id_conductores}>
                      {driver.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <div className="form-actions">
                <button type="button" className="secondary-button" onClick={() => setOpen(false)}>
                  Cancelar
                </button>
                <button className="primary-button">Guardar usuario</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </section>
  );
}
