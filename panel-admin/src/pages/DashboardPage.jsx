import {
  useEffect,
  useState
} from "react";

import ConductoresPage from "./ConductoresPage.jsx";
import VehiculosPage from "./VehiculosPage.jsx";
import DestinosPage from "./DestinosPage.jsx";
import UbicacionesPage from "./UbicacionesPage.jsx";
import ViajesPage from "./ViajesPage.jsx";
import InspeccionesPage from "./InspeccionesPage.jsx";
import UsuariosAdminPage from "./UsuariosAdminPage.jsx";
import PerfilPage from "./PerfilPage.jsx";
import { getAdminDashboardSummary, getAdminInspeccionesPendientesCount } from "../services/api.js";
import inicioIcon from "../assets/icons-side-bar/Inicio.png";
import conductoresIcon from "../assets/icons-side-bar/conductores.png";
import vehiculosIcon from "../assets/icons-side-bar/vehiculos.png";
import destinosIcon from "../assets/icons-side-bar/destinos.png";
import ubicacionesIcon from "../assets/icons-side-bar/ubicaciones.png";
import viajesIcon from "../assets/icons-side-bar/viajes.png";
import inspeccionesIcon from "../assets/icons-side-bar/inspecciones.png";
import usuariosIcon from "../assets/icons-side-bar/administrador_Usuarios.png";
import configuracionIcon from "../assets/icons-side-bar/configuracion.png";
import cerrarSesionIcon from "../assets/icons-side-bar/icons.png";

function SidebarIcon({ src, alt = "" }) {
  return <img className="nav-icon-image" src={src} alt={alt} aria-hidden={alt ? undefined : "true"} />;
}

function formatActivityDay(value) {
  const datePart = String(value || "").match(/^\d{4}-\d{2}-\d{2}/)?.[0];

  if (!datePart) {
    return "";
  }

  return new Date(`${datePart}T00:00:00`).toLocaleDateString("es-MX", {
    weekday: "short"
  });
}

function DashboardOverview({ pendingInspections, notificationError, onOpenInspections }) {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getAdminDashboardSummary()
      .then((response) => setSummary(response.data))
      .catch((requestError) => setError(requestError.message));
  }, []);

  if (error) return <p className="module-message module-message-error">{error}</p>;
  if (!summary) return <p className="table-status">Cargando indicadores...</p>;

  const maxActivity = Math.max(1, ...summary.actividad.map((item) => Number(item.total)));

  return (
    <section className="dashboard-overview">
      <section className="kpi-grid">
        <article className="kpi-card"><span>Conductores</span><strong>{summary.conductores_total}</strong><small>{summary.conductores_activos} activos</small></article>
        <article className="kpi-card"><span>Unidades</span><strong>{summary.unidades_total}</strong><small>{summary.unidades_activas} activas</small></article>
        <article className="kpi-card"><span>Viajes registrados</span><strong>{summary.viajes_total}</strong><small>{summary.viajes_en_curso} en curso</small></article>
        <button type="button" className="kpi-card inspection-notification-card" onClick={onOpenInspections}>
          <span>Inspecciones pendientes</span>
          <strong>{pendingInspections}</strong>
          <small>{pendingInspections ? "Requieren aprobación administrativa" : "No hay inspecciones por atender"}</small>
        </button>
      </section>
      {notificationError && <p className="module-message module-message-error">No se pudo actualizar el contador de inspecciones: {notificationError}</p>}
      <section className="activity-card">
        <div><h2>Actividad de viajes</h2><p>Viajes registrados durante los últimos siete días.</p></div>
        <div className="activity-chart" aria-label="Gráfica de actividad de viajes">
          {summary.actividad.map((item) => (
            <div className="activity-column" key={item.fecha}>
              <span className="activity-value">{item.total}</span>
              <div className="activity-bar-area"><div className="activity-bar" style={{ height: `${Math.max(6, (Number(item.total) / maxActivity) * 100)}%` }} /></div>
              <small>{formatActivityDay(item.fecha)}</small>
            </div>
          ))}
        </div>
      </section>
    </section>
  );
}

function ModulePlaceholder({ title }) {
  return (
    <section className="module-page">
      <header className="module-header">
        <div>
          <span className="module-label">
            Administración
          </span>

          <h1>{title}</h1>

          <p>
            Este módulo estará disponible próximamente.
          </p>
        </div>
      </header>
    </section>
  );
}

function DashboardPage({
  user,
  onLogout
}) {
  const [activeModule, setActiveModule] = useState("inicio");
  const [pendingInspections, setPendingInspections] = useState(0);
  const [notificationError, setNotificationError] = useState("");

  useEffect(() => {
    if (!["ADMINISTRADOR", "SUPERVISOR"].includes(user.rol)) {
      return undefined;
    }
    let active = true;
    const refresh = () => getAdminInspeccionesPendientesCount()
      .then((response) => {
        if (!active) return;
        setPendingInspections(Number(response.data?.total || 0));
        setNotificationError("");
      })
      .catch((error) => {
        if (active) setNotificationError(error.message || "Error desconocido.");
      });
    refresh(); const timer = window.setInterval(refresh, 30000);
    return () => { active=false; window.clearInterval(timer); };
  }, [user.rol]);

  const modules = [
    { id: "conductores", label: "Conductores", icon: conductoresIcon, roles: ["ADMINISTRADOR"] },
    { id: "unidades", label: "Unidades", icon: vehiculosIcon, roles: ["ADMINISTRADOR", "SUPERVISOR"] },
    { id: "destinos", label: "Destinos", icon: destinosIcon, roles: ["ADMINISTRADOR", "SUPERVISOR"] },
    { id: "ubicaciones", label: "Ubicaciones", icon: ubicacionesIcon, roles: ["ADMINISTRADOR", "SUPERVISOR", "OPERADOR", "CONSULTA"] },
    { id: "viajes", label: "Viajes", icon: viajesIcon, roles: ["ADMINISTRADOR", "SUPERVISOR", "OPERADOR", "CONSULTA"] }
  ].filter((module) => module.roles.includes(user.rol));
  const canInspect = ["ADMINISTRADOR", "SUPERVISOR"].includes(user.rol);

  return (
    <div className="admin-layout sidebar-collapsed">
      <aside className="sidebar">
        <div className="sidebar-top"><div className="sidebar-brand"><span className="brand-mark">GV</span><span className="sidebar-text">Gerenciamiento viajes</span></div></div>

        <nav>
          {canInspect && <button type="button" title="Inspecciones" className={`notification-button ${activeModule === "inspecciones" ? "sidebar-active" : ""}`} onClick={()=>setActiveModule("inspecciones")}><span className="nav-icon"><SidebarIcon src={inspeccionesIcon} /></span><span className="sidebar-text">Inspecciones</span>{pendingInspections>0&&<strong>{pendingInspections}</strong>}</button>}
          <button
            type="button"
            title="Inicio"
            className={
              activeModule === "inicio"
              ? "sidebar-active"
              : ""
            }
            onClick={() =>
              setActiveModule("inicio")
            }
          >
            <span className="nav-icon"><SidebarIcon src={inicioIcon} /></span><span className="sidebar-text">Inicio</span>
          </button>

          {modules.map((module) => (
            <button
              key={module.id}
              type="button"
              className={
                activeModule === module.id
                  ? "sidebar-active"
                  : ""
              }
              onClick={() => setActiveModule(module.id)}
            >
              <span className="nav-icon"><SidebarIcon src={module.icon} /></span><span className="sidebar-text">{module.label}</span>
            </button>
          ))}
          {user.rol === "ADMINISTRADOR" && <button type="button" title="Administrador de usuarios" className={activeModule === "usuarios" ? "sidebar-active" : ""} onClick={() => setActiveModule("usuarios")}><span className="nav-icon"><SidebarIcon src={usuariosIcon} /></span><span className="sidebar-text">Administrador de usuarios</span></button>}
          <button type="button" title="Configuración" className={activeModule === "perfil" ? "sidebar-active" : ""} onClick={() => setActiveModule("perfil")}><span className="nav-icon"><SidebarIcon src={configuracionIcon} /></span><span className="sidebar-text">Configuración</span></button>
        </nav>

        <button
          type="button"
          className="logout-button"
          onClick={onLogout}
        >
          <span className="nav-icon"><SidebarIcon src={cerrarSesionIcon} /></span><span className="sidebar-text">Cerrar sesión</span>
        </button>
      </aside>

      <main className="dashboard-content">
        {activeModule === "inicio" && (
          <>
            <header className="dashboard-header">
              <div>
                <span>
                  Panel administrativo
                </span>

                <h1>
                  Bienvenido, {user.nombre}
                </h1>
              </div>

              <button type="button" className="user-summary" onClick={() => setActiveModule("perfil")} title="Personalizar perfil">
                <span className="header-avatar">{user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : user.nombre?.charAt(0)}</span>
                <span className="user-summary-copy">
                <strong>
                  {user.username}
                </strong>

                <span>
                  {user.rol}
                </span>
                </span>
              </button>
            </header>

            {user.rol !== "OPERADOR" && <DashboardOverview
              pendingInspections={pendingInspections}
              notificationError={notificationError}
              onOpenInspections={() => setActiveModule("inspecciones")}
            />}
            {user.rol === "OPERADOR" && <p className="table-status">Consulta tus viajes y ubicaciones desde el menú lateral.</p>}
          </>
        )}

        {activeModule === "conductores" && <ConductoresPage />}

        {activeModule === "unidades" && <VehiculosPage user={user} />}

        {activeModule === "destinos" && <DestinosPage user={user} />}

        {activeModule === "ubicaciones" && <UbicacionesPage />}

        {activeModule === "viajes" && <ViajesPage user={user} />}
        {activeModule === "inspecciones" && <InspeccionesPage onPendingChange={setPendingInspections} />}
        {activeModule === "usuarios" && user.rol === "ADMINISTRADOR" && <UsuariosAdminPage currentUser={user} />}
        {activeModule === "perfil" && <PerfilPage user={user} onUpdated={() => window.location.reload()} />}

        {modules
          .filter(
            (module) =>
              module.id !== "conductores" &&
              module.id !== "unidades" &&
              module.id !== "destinos" &&
              module.id !== "ubicaciones" &&
              module.id !== "viajes"
          )
          .map((module) =>
            activeModule === module.id ? (
              <ModulePlaceholder
                key={module.id}
                title={module.label}
              />
            ) : null
          )}

      </main>
    </div>
  );
}

export default DashboardPage;
