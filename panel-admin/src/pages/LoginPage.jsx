import { useEffect, useRef, useState } from "react";
import { loginWithTenantEmail, exchangeAzureOAuthCode } from "../services/api.js";
import logoAQR from "../assets/LoginAssets/logoAQR.webp";
import aquarioVideo from "../assets/LoginAssets/aquario_presentacion.mp4";

// Construir la URL base de la API
const configuredApiBaseUrl = String(import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");
const API_BASE_URL = configuredApiBaseUrl.replace(/\/api$/, "");

function LoginPage({ onAuthenticated }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const submittingRef = useRef(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const codeParam = urlParams.get("code");
    const errorParam = urlParams.get("error");

    if (errorParam) {
      setMessage(decodeURIComponent(errorParam));
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (codeParam) {
      setLoading(true);
      setMessage("Autenticando en Microsoft...");

      // Usar la raíz de la web como Redirect URI por defecto si no hay otra definida
      const redirectUri = window.location.origin + "/";
      exchangeAzureOAuthCode({ code: codeParam, redirectUri })
        .then((response) => {
          window.history.replaceState({}, document.title, window.location.pathname);
          onAuthenticated(response.data.user);
        })
        .catch((error) => {
          window.history.replaceState({}, document.title, window.location.pathname);
          setMessage(error.message || "Error al completar inicio de sesión con Microsoft.");
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [onAuthenticated]);

  function handleChange(event) {
    setEmail(event.target.value);
    setMessage("");
  }

  function handleAzureMicrosoftLogin() {
    setLoading(true);
    setMessage("");
    // Redirigir a Microsoft Entra ID para autenticación interactiva (Doble Match)
    window.location.href = `${API_BASE_URL}/api/admin/auth/azure/login`;
  }

  async function handleTenantEmailSubmit(event) {
    event.preventDefault();
    if (submittingRef.current) return;

    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setMessage("Ingresa tu correo corporativo del tenant.");
      return;
    }

    submittingRef.current = true;
    setLoading(true);
    setMessage("");

    try {
      const response = await loginWithTenantEmail({ email: normalizedEmail });
      onAuthenticated(response.data.user);
    } catch (error) {
      setMessage(error.message || "No fue posible verificar tu correo corporativo.");
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
        <div className="login-card single-tenant-card">
          <div className="login-header">
            <img className="login-logo" src={logoAQR} alt="AQR Logistics" />
            <div className="azure-badge-container">
              <span className="azure-badge">
                <svg width="14" height="14" viewBox="0 0 23 23" fill="none">
                  <path fill="#f35325" d="M1 1h10v10H1z"/>
                  <path fill="#81bc06" d="M12 1h10v10H12z"/>
                  <path fill="#05a6f0" d="M1 12h10v10H1z"/>
                  <path fill="#ffba08" d="M12 12h10v10H1z"/>
                </svg>
                Microsoft Azure Entra ID
              </span>
            </div>
            <h2>Bienvenido</h2>
            <p className="login-description">
              Autentícate de forma segura con tu cuenta de Microsoft del tenant y verificación en Lista Blanca.
            </p>
          </div>

          <div className="login-actions-container">
            {/* BOTÓN PRINCIPAL: DOBLE MATCH CON AUTENTICACIÓN INTERACTIVA DE MICROSOFT */}
            <button
              type="button"
              className="login-submit-btn tenant-submit-btn microsoft-sso-btn"
              onClick={handleAzureMicrosoftLogin}
              disabled={loading}
            >
              {loading ? (
                <span className="spinner-container">
                  <span className="btn-spinner" /> Conectando con Microsoft...
                </span>
              ) : (
                <>
                  <svg width="20" height="20" viewBox="0 0 23 23" fill="none">
                    <path fill="#f35325" d="M1 1h10v10H1z"/>
                    <path fill="#81bc06" d="M12 1h10v10H12z"/>
                    <path fill="#05a6f0" d="M1 12h10v10H1z"/>
                    <path fill="#ffba08" d="M12 12h10v10H1z"/>
                  </svg>
                  Iniciar sesión con Microsoft (Azure AD)
                </>
              )}
            </button>

            <div className="login-divider">
              <span>o verificar por correo registrado</span>
            </div>

            <form onSubmit={handleTenantEmailSubmit} className="login-form">
              <div className="form-group">
                <div className="input-wrapper email-input-wrapper">
                  <svg className="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                    <polyline points="22,6 12,13 2,6"></polyline>
                  </svg>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="usuario@aspromex.com"
                    value={email}
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

              <button type="submit" className="login-secondary-submit-btn" disabled={loading}>
                Validar Correo en Lista Blanca
              </button>
            </form>
          </div>

          <div className="login-footer-security">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            </svg>
            Doble Verificación: Autenticación Microsoft + Lista Blanca BD
          </div>
        </div>
      </section>
    </main>
  );
}

export default LoginPage;
