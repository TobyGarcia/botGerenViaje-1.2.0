function DashboardPage({
  user,
  onLogout
}) {
  const modules = [
    "Conductores",
    "Unidades",
    "Destinos",
    "Ubicaciones",
    "Viajes"
  ];

  return (
    <div className="admin-layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          Gerenciamiento viajes
        </div>

        <nav>
          <button type="button">
            Inicio
          </button>

          {modules.map((module) => (
            <button
              key={module}
              type="button"
            >
              {module}
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
              key={module}
            >
              <h2>{module}</h2>

              <p>
                Consulta y administra
                información de {module.toLowerCase()}.
              </p>

              <button type="button">
                Abrir módulo
              </button>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}

export default DashboardPage;