import {
  useState
} from "react";

import ConductoresPage from "./ConductoresPage.jsx";
import VehiculosPage from "./VehiculosPage.jsx";

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

            <section className="dashboard-grid">
              {modules.map((module) => (
                <article
                  className="dashboard-card"
                  key={module.id}
                >
                  <h2>{module.label}</h2>

                  <p>
                    Consulta y administra información de{" "}
                    {module.label.toLowerCase()}.
                  </p>

                  <button
                    type="button"
                    onClick={() => setActiveModule(module.id)}
                  >
                    Abrir módulo
                  </button>
                </article>
              ))}
            </section>
          </>
        )}

        {activeModule === "conductores" && <ConductoresPage />}

        {activeModule === "unidades" && <VehiculosPage />}

        {modules
          .filter(
            (module) =>
              module.id !== "conductores" &&
              module.id !== "unidades"
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
