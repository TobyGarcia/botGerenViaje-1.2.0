import { useEffect, useState } from "react";
import { exchangeAzureOAuthCode, getAzureOAuthUrl } from "../services/api.js";
import logoAQR from "../assets/LoginAssets/logoAQR.webp";
import aquarioVideo from "../assets/LoginAssets/aquario_presentacion.mp4";

function LoginPage({ onAuthenticated }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

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

  async function handleAzureMicrosoftLogin() {
    setLoading(true);
    setMessage("");
    try {
      const response = await getAzureOAuthUrl();
      if (response?.authUrl) {
        console.log("Redirigiendo a Microsoft:", response.authUrl);
        window.location.href = response.authUrl;
      } else {
        throw new Error("No fue posible obtener la URL de inicio de sesión de Microsoft.");
      }
    } catch (error) {
      setLoading(false);
      setMessage(error.message || "Error al conectar con Microsoft.");
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
                <svg width="15" height="15" viewBox="0 0 23 23" fill="none">
                  <path fill="#f25022" d="M1 1h10v10H1z"/>
                  <path fill="#7fba00" d="M12 1h10v10H1z"/>
                  <path fill="#00a4ef" d="M1 12h10v10H1z"/>
                  <path fill="#ffb900" d="M12 12h10v10H1z"/>
                </svg>
                Microsoft Azure Entra ID
              </span>
            </div>
            <h2>Acceso Administrativo</h2>
            <p className="login-description">
              Autenticación corporativa obligatoria mediante Microsoft Azure Entra ID y verificación en Lista Blanca.
            </p>
          </div>

          <div className="login-actions-container">
            {/* ÚNICA VÍA DE INGRESO: BOTÓN OFICIAL DE MICROSOFT AZURE AD SSO */}
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
                  <svg width="22" height="22" viewBox="0 0 23 23" fill="none">
                    <path fill="#f25022" d="M1 1h10v10H1z"/>
                    <path fill="#7fba00" d="M12 1h10v10H1z"/>
                    <path fill="#00a4ef" d="M1 12h10v10H1z"/>
                    <path fill="#ffb900" d="M12 12h10v10H1z"/>
                  </svg>
                  Iniciar sesión con Microsoft (Azure AD)
                </>
              )}
            </button>

            {message && (
              <p className="login-error" role="alert">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                {message}
              </p>
            )}
          </div>

          <div className="login-footer-security">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
            Doble Verificación: Autenticación Microsoft + Lista Blanca BD
          </div>
        </div>
      </section>
    </main>
  );
}

export default LoginPage;
