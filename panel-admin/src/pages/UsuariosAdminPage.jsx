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
        <div className="modal-overlay" role="presentation" onMouseDown={() => setOpen(false)}>
          <section
            className="modal-card user-form-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="user-form-title"
            onMouseDown={(e) => e.stopPropagation()}
            style={{ maxWidth: "700px", width: "100%", overflowX: "hidden", padding: "28px" }}
          >
            <div className="form-panel-header">
              <div>
                <h2 id="user-form-title">{form.idUsuariosAdmin ? "Editar usuario" : "Nuevo usuario"}</h2>
                <p style={{ margin: "4px 0 0 0", color: "#64748b", fontSize: "0.88rem" }}>
                  Define el nivel de acceso y los datos de la cuenta administrativa.
                </p>
              </div>
              <button type="button" className="close-button" onClick={() => setOpen(false)} aria-label="Cerrar">
                ×
              </button>
            </div>

            <form className="driver-form" onSubmit={submit} style={{ gap: "20px" }}>
              <label>
                Nombre Completo *
                <input required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Ej: Itzayana Ocaña Estrella" />
              </label>

              <label>
                Nombre de Usuario *
                <input
                  required
                  disabled={Boolean(form.idUsuariosAdmin)}
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  placeholder="itzayana.ocana"
                />
              </label>

              <label style={{ gridColumn: form.idUsuariosAdmin ? "1 / -1" : "auto" }}>
                Correo Electrónico
                <input
                  type="email"
                  value={form.correo || ""}
                  onChange={(e) => setForm({ ...form, correo: e.target.value })}
                  placeholder="usuario@itzamna.mx"
                />
              </label>

              {!form.idUsuariosAdmin && (
                <label>
                  Contraseña de Acceso *
                  <input
                    type="password"
                    required
                    minLength="8"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="Mínimo 8 caracteres"
                  />
                </label>
              )}

              <label style={{ gridColumn: "1 / -1" }}>
                <span style={{ display: "block", marginBottom: "4px", fontWeight: "bold" }}>
                  Rol Administrativo (Jerarquía de Aprobación de Gerenciamientos) *
                </span>
                <select
                  value={form.rol}
                  onChange={(e) => setForm({ ...form, rol: e.target.value })}
                  style={{ width: "100%", padding: "12px 14px", borderRadius: "9px", border: "1px solid #cadde6", background: "#ffffff", fontSize: "0.9rem" }}
                >
                  <option value="ADMINISTRADOR">👑 ADMINISTRADOR — Acceso Total a Todos los Módulos</option>
                  <option value="GERENTE">🔴 GERENTE — Aprueba Viajes de Riesgo ALTO (&gt; 23 pts)</option>
                  <option value="COORDINADOR">🟡 COORDINADOR DE ÁREA — Aprueba Viajes de Riesgo MEDIO (16-22 pts)</option>
                  <option value="SUPERVISOR">🟢 SUPERVISOR DIRECTO — Aprueba Viajes de Riesgo BAJO (0-15 pts)</option>
                  <option value="QHSE">🛡️ QHSE — Aprueba Viajes de Riesgo BAJO (0-15 pts)</option>
                  <option value="OPERADOR">🚛 OPERADOR — Módulo de Operaciones Diarias</option>
                  <option value="CONSULTA">👁️ CONSULTA — Solo Lectura</option>
                </select>
              </label>

              <label style={{ gridColumn: "1 / -1" }}>
                Conductor Vinculado (Opcional)
                <select
                  value={form.idConductor || ""}
                  onChange={(e) => setForm({ ...form, idConductor: e.target.value })}
                  style={{ width: "100%", padding: "12px 14px", borderRadius: "9px", border: "1px solid #cadde6", background: "#ffffff", fontSize: "0.9rem" }}
                >
                  <option value="">No vinculado a ningún conductor</option>
                  {drivers.map((driver) => (
                    <option value={driver.id_conductores} key={driver.id_conductores}>
                      {driver.nombre} {driver.empresa ? `(${driver.empresa})` : ""}
                    </option>
                  ))}
                </select>
              </label>

              <div className="form-actions" style={{ gridColumn: "1 / -1", marginTop: "12px", display: "flex", justifyContent: "flex-end", gap: "12px" }}>
                <button type="button" className="secondary-button" onClick={() => setOpen(false)} style={{ padding: "10px 20px" }}>
                  Cancelar
                </button>
                <button type="submit" className="primary-button" style={{ padding: "10px 24px" }}>
                  Guardar usuario
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </section>
  );
}
