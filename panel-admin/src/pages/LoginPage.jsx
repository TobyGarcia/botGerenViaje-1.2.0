import { useRef, useState } from "react";
import { loginAdmin, loginWithTenantEmail } from "../services/api.js";
import logoAQR from "../assets/LoginAssets/logoAQR.webp";
import aquarioVideo from "../assets/LoginAssets/aquario_presentacion.mp4";

function LoginPage({ onAuthenticated }) {
  const [authMode, setAuthMode] = useState("tenant"); // "tenant" | "credentials"
  const [form, setForm] = useState({
    username: "",
    password: "",
    email: ""
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const submittingRef = useRef(false);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({
      ...current,
      [name]: value
    }));
    setMessage("");
  }

  async function handleTenantSubmit(event) {
    event.preventDefault();
    if (submittingRef.current) return;

    const email = form.email.trim();
    if (!email) {
      setMessage("Ingresa tu correo corporativo del tenant.");
      return;
    }

    submittingRef.current = true;
    setLoading(true);
    setMessage("");

    try {
      const response = await loginWithTenantEmail({ email });
      onAuthenticated(response.data.user);
    } catch (error) {
      setMessage(error.message || "No fue posible verificar tu correo corporativo.");
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  }

  async function handleCredentialsSubmit(event) {
    event.preventDefault();
    if (submittingRef.current) return;

    const username = form.username.trim();
    if (!username || !form.password) {
      setMessage("Captura usuario y contraseña.");
      return;
    }

    submittingRef.current = true;
    setLoading(true);
    setMessage("");

    try {
      const response = await loginAdmin({
        username,
        password: form.password
      });

      onAuthenticated(response.data.user);
    } catch (error) {
      setMessage(error.message);
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-hero">
        <video
          className="hero-video"
          src={aquarioVideo}
          autoPlay
          loop
          muted
          playsInline
        />
        <div className="hero-overlay" />

        <div className="hero-content">
          <span className="hero-label">Plataforma logística</span>
          <h1>Gerenciamiento viajes</h1>
          <p>
            Control inteligente de conductores, unidades, destinos, viajes y seguimiento en tiempo real desde una plataforma centralizada.
          </p>
        </div>
      </section>

      <section className="login-section">
        <div className="login-card">
          <div className="login-header">
            <img className="login-logo" src={logoAQR} alt="AQR Logistics" />
            <span className="login-label">Acceso administrativo</span>
            <h2>Bienvenido</h2>
            <p className="login-description">
              Autentícate con tu correo corporativo del tenant o tus credenciales autorizadas.
            </p>
          </div>

          <div className="login-tabs">
            <button
              type="button"
              className={`login-tab ${authMode === "tenant" ? "active" : ""}`}
              onClick={() => { setAuthMode("tenant"); setMessage(""); }}
            >
              <svg width="16" height="16" viewBox="0 0 23 23" fill="none">
                <path fill="#f35325" d="M1 1h10v10H1z"/>
                <path fill="#81bc06" d="M12 1h10v10H12z"/>
                <path fill="#05a6f0" d="M1 12h10v10H1z"/>
                <path fill="#ffba08" d="M12 12h10v10H12z"/>
              </svg>
              Correo Tenant (Azure)
            </button>
            <button
              type="button"
              className={`login-tab ${authMode === "credentials" ? "active" : ""}`}
              onClick={() => { setAuthMode("credentials"); setMessage(""); }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
              Usuario y Clave
            </button>
          </div>

          {authMode === "tenant" ? (
            <form onSubmit={handleTenantSubmit} className="login-form">
              <div className="form-group">
                <label htmlFor="email">Correo Corporativo Tenant</label>
                <div className="input-wrapper">
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="usuario@aspromex.com"
                    value={form.email}
                    onChange={handleChange}
                    disabled={loading}
                    required
                  />
                </div>
                <small className="form-help-text">
                  Verificación segura contra el tenant de Azure y lista blanca de administración.
                </small>
              </div>

              {message && (
                <p className="login-error" role="alert">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                  </svg>
                  {message}
                </p>
              )}

              <button type="submit" className="login-submit-btn tenant-submit-btn" disabled={loading}>
                {loading ? (
                  <span className="spinner-container">
                    <span className="btn-spinner" /> Verificando Tenant...
                  </span>
                ) : (
                  <>
                    <svg width="18" height="18" viewBox="0 0 23 23" fill="none">
                      <path fill="#ffffff" d="M1 1h10v10H1z"/>
                      <path fill="#ffffff" d="M12 1h10v10H12z"/>
                      <path fill="#ffffff" d="M1 12h10v10H1z"/>
                      <path fill="#ffffff" d="M12 12h10v10H12z"/>
                    </svg>
                    Ingresar con Correo Tenant
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleCredentialsSubmit} className="login-form">
              <div className="form-group">
                <label htmlFor="username">Usuario o Correo</label>
                <div className="input-wrapper">
                  <input
                    id="username"
                    name="username"
                    type="text"
                    autoComplete="username"
                    placeholder="Ej. admin o usuario@aspromex.com"
                    value={form.username}
                    onChange={handleChange}
                    disabled={loading}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="password">Contraseña</label>
                <div className="input-wrapper">
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={form.password}
                    onChange={handleChange}
                    disabled={loading}
                    required
                  />
                </div>
              </div>

              {message && (
                <p className="login-error" role="alert">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                  </svg>
                  {message}
                </p>
              )}

              <button type="submit" className="login-submit-btn" disabled={loading}>
                {loading ? (
                  <span className="spinner-container">
                    <span className="btn-spinner" /> Validando...
                  </span>
                ) : (
                  "Entrar al sistema"
                )}
              </button>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}

export default LoginPage;
