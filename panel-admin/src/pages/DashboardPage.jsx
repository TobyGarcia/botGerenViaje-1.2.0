import {
  useEffect,
  useState
} from "react";

import ConductoresPage from "./ConductoresPage.jsx";
import VehiculosPage from "./VehiculosPage.jsx";
import DestinosPage from "./DestinosPage.jsx";
import UbicacionesPage from "./UbicacionesPage.jsx";
import ViajesPage from "./ViajesPage.jsx";
import { getAdminDashboardSummary } from "../services/api.js";

function formatActivityDay(value) {
  const datePart = String(value || "").match(/^\d{4}-\d{2}-\d{2}/)?.[0];

  if (!datePart) {
    return "";
  }

  return new Date(`${datePart}T00:00:00`).toLocaleDateString("es-MX", {
    weekday: "short"
  });
}

function DashboardOverview() {
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
      </section>
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

  const modules = [
    { id: "conductores", label: "Conductores" },
    { id: "unidades", label: "Unidades" },
    { id: "destinos", label: "Destinos" },
    { id: "ubicaciones", label: "Ubicaciones" },
    { id: "viajes", label: "Viajes" }
  ];

  return (
    <div className="admin-layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          Gerenciamiento viajes
        </div>

        <nav>
          <button
            type="button"
            className={
              activeModule === "inicio"
              ? "sidebar-active"
              : ""
            }
            onClick={() =>
              setActiveModule("inicio")
            }
          >
            Inicio
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
              {module.label}
            </button>
          ))}
        </nav>

        <button
          type="button"
          className="logout-button"
          onClick={onLogout}
        >
          Cerrar sesión
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

              <div className="user-summary">
                <strong>
                  {user.username}
                </strong>

                <span>
                  {user.rol}
                </span>
              </div>
            </header>

            <DashboardOverview />
          </>
        )}

        {activeModule === "conductores" && <ConductoresPage />}

        {activeModule === "unidades" && <VehiculosPage user={user} />}

        {activeModule === "destinos" && <DestinosPage />}

        {activeModule === "ubicaciones" && <UbicacionesPage />}

        {activeModule === "viajes" && <ViajesPage />}

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
