import "./App.css";

function App() {
  return (
    <main className="login-page">
      <section className="login-hero">
        <div className="hero-content">
          <span className="hero-label">
            Plataforma de logística
          </span>

          <h1>Gerenciamiento viajes</h1>

          <p>
            Control de conductores, unidades, destinos,
            viajes y ubicaciones desde una plataforma
            centralizada.
          </p>

          <div className="fleet-placeholder">
            <span>Imagen temporal de flotilla</span>
          </div>
        </div>
      </section>

      <section className="login-section">
        <div className="login-card">
          <div className="brand-placeholder">
            LOGO
          </div>

          <span className="login-label">
            Acceso administrativo
          </span>

          <h2>Bienvenido</h2>

          <p className="login-description">
            Ingresa tus credenciales para acceder al
            panel de gerenciamiento de viajes.
          </p>

          <form>
            <label htmlFor="username">
              Usuario
            </label>

            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              placeholder="Ingresa tu usuario"
            />

            <label htmlFor="password">
              Contraseña
            </label>

            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="Ingresa tu contraseña"
            />

            <button type="submit">
              Entrar
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}

export default App;