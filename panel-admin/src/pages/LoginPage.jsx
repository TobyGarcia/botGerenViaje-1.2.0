import {
  useRef,
  useState
} from "react";

import {
  loginAdmin
} from "../services/api.js";
import logoAQR from "../assets/LoginAssets/logoAQR.webp";
import aquarioVideo from "../assets/LoginAssets/aquario_presentacion.mp4";

function LoginPage({
  onAuthenticated
}) {
  const [form, setForm] = useState({
    username: "",
    password: ""
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

  async function handleSubmit(event) {
    event.preventDefault();

    if (submittingRef.current) {
      return;
    }

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
          <span className="hero-label">
            Plataforma logística
          </span>

          <h1>
            Gerenciamiento viajes
          </h1>

          <p>
            Control inteligente de conductores, unidades, destinos, viajes y seguimiento en tiempo real desde una plataforma centralizada.
          </p>
        </div>
      </section>

      <section className="login-section">
        <div className="login-card">
          <div className="login-header">
            <img
              className="login-logo"
              src={logoAQR}
              alt="AQR Logistics"
            />
            <span className="login-label">
              Acceso administrativo
            </span>
            <h2>Bienvenido</h2>
            <p className="login-description">
              Ingresa tus credenciales autorizadas para acceder al panel de administración.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            <div className="form-group">
              <label htmlFor="username">Usuario</label>
              <div className="input-wrapper">
                <input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  placeholder="Ej. admin"
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
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
        </div>
      </section>
    </main>
  );
}

export default LoginPage;

