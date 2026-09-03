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
    const stateParam = urlParams.get("state");
    const errorParam = urlParams.get("error");

    if (stateParam === "supervisor" || window.location.pathname.startsWith("/supervisor")) {
      const codeQuery = codeParam ? `?code=${encodeURIComponent(codeParam)}&state=supervisor` : "";
      window.location.href = `${window.location.origin}/supervisor/${codeQuery}`;
      return;
    }

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
            <h2>Acceso Administrativo</h2>
          </div>

          <div className="login-actions-container">
            {/* ÚNICA VÍA DE INGRESO: BOTÓN OFICIAL DE MICROSOFT SSO */}
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
                  <svg width="20" height="20" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="0" y="0" width="10" height="10" fill="#f25022"/>
                    <rect x="11" y="0" width="10" height="10" fill="#7fba00"/>
                    <rect x="0" y="11" width="10" height="10" fill="#00a4ef"/>
                    <rect x="11" y="11" width="10" height="10" fill="#ffb900"/>
                  </svg>
                  Iniciar sesión con Microsoft
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
        </div>
      </section>
    </main>
  );
}

export default LoginPage;
