import {
  useRef,
  useState
} from "react";

import {
  loginAdmin
} from "../services/api.js";
import logoAQR from "../assets/LoginAssets/logoAQR.webp";
import fleetImage from "../assets/LoginAssets/imagen_muestra.png";

function LoginPage({
  onAuthenticated
}) {
  const [form, setForm] =
    useState({
      username: "",
      password: ""
    });

  const [loading, setLoading] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const submittingRef =
    useRef(false);

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

    const username =
      form.username.trim();

    if (
      !username ||
      !form.password
    ) {
      setMessage(
        "Captura usuario y contraseña."
      );
      return;
    }

    submittingRef.current = true;
    setLoading(true);
    setMessage("");

    try {
      const response =
        await loginAdmin({
          username,
          password:
            form.password
        });

      onAuthenticated(
        response.data.user
      );
    } catch (error) {
      setMessage(
        error.message
      );
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-hero">
        <div className="hero-content">
          <span className="hero-label">
            Plataforma logística
          </span>

          <h1>
            Gerenciamiento viajes
          </h1>

          <p>
            Control de conductores,
            unidades, destinos, viajes
            y ubicaciones desde una
            plataforma centralizada.
          </p>

          <div className="fleet-image">
            <img
              src={fleetImage}
              alt="Flotilla de la empresa"
            />
          </div>
        </div>
      </section>

      <section className="login-section">
        <div className="login-card">
          <img
            className="login-logo"
            src={logoAQR}
            alt="AQR"
          />

          <span className="login-label">
            Acceso administrativo
          </span>

          <h2>Bienvenido</h2>

          <p className="login-description">
            Ingresa tus credenciales para
            acceder al panel.
          </p>

          <form
            onSubmit={handleSubmit}
          >
            <label htmlFor="username">
              Usuario
            </label>

            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              value={form.username}
              onChange={handleChange}
              disabled={loading}
              required
            />

            <label htmlFor="password">
              Contraseña
            </label>

            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={form.password}
              onChange={handleChange}
              disabled={loading}
              required
            />

            {message && (
              <p
                className="login-error"
                role="alert"
              >
                {message}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
            >
              {loading
                ? "Validando..."
                : "Entrar"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}

export default LoginPage;
