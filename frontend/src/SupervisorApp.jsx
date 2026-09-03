import { useEffect, useState } from "react";
import SupervisorPortal from "./pages/SupervisorPortal.jsx";
import TopBar from "./components/TopBar.jsx";
import { exchangeAzureOAuthCode, getAzureOAuthUrl, getSupervisorAccess } from "./services/api.js";
import aquarioBlanco from "./assets/AQUARIO_BLANCO.png";

export default function SupervisorApp() {
  const [access, setAccess] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [authenticatingMs, setAuthenticatingMs] = useState(false);

  const getRedirectUri = () => {
    return window.location.origin + window.location.pathname;
  };

  async function loadAccess() {
    try {
      setLoading(true);
      setError("");
      const response = await getSupervisorAccess();

      if (response?.data?.invited && response?.data?.user) {
        setAccess(response.data);
      } else {
        setAccess(null);
      }
    } catch (err) {
      console.warn("Validación de acceso de supervisor:", err.message);
      setAccess(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    async function initSupervisorAuth() {
      const urlParams = new URLSearchParams(window.location.search);
      const codeParam = urlParams.get("code");
      const errorParam = urlParams.get("error");

      if (errorParam) {
        setError(decodeURIComponent(errorParam));
        window.history.replaceState({}, document.title, window.location.pathname);
        setLoading(false);
        return;
      }

      if (codeParam) {
        setAuthenticatingMs(true);
        setLoading(true);
        try {
          const redirectUri = getRedirectUri();
          const response = await exchangeAzureOAuthCode({ code: codeParam, redirectUri });
          
          if (response?.data?.user) {
            window.history.replaceState({}, document.title, window.location.pathname);
            await loadAccess();
          } else {
            throw new Error("No se pudo obtener el perfil de usuario de Microsoft.");
          }
        } catch (err) {
          window.history.replaceState({}, document.title, window.location.pathname);
          setError(err.message || "Error al autenticar con Microsoft.");
          setLoading(false);
        } finally {
          setAuthenticatingMs(false);
        }
        return;
      }

      // Si no hay código en URL, validar acceso actual
      await loadAccess();
    }

    initSupervisorAuth();
  }, []);

  const handleMicrosoftLogin = async () => {
    try {
      setAuthenticatingMs(true);
      setError("");
      const redirectUri = getRedirectUri();
      const response = await getAzureOAuthUrl(redirectUri);

      if (response?.authUrl) {
        window.location.href = response.authUrl;
      } else {
        throw new Error("No fue posible obtener la URL de inicio de sesión de Microsoft.");
      }
    } catch (err) {
      setError(err.message || "Error al conectar con Microsoft.");
      setAuthenticatingMs(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("supervisor_token");
    localStorage.removeItem("admin_token");
    setAccess(null);
    setError("");
  };

  const supervisorUser = access?.user ? {
    nombre: access.user.nombre || access.user.correo || "Supervisor"
  } : null;

  return (
    <div className="pin-view-shell">
      <TopBar conductor={supervisorUser} onLogout={handleLogout} />

      {loading ? (
        <main className="pin-view-main">
          <div className="pin-login-wrapper">
            <div className="pin-login-card glass-panel" style={{ textAlign: "center", padding: "24px" }}>
              <img src={aquarioBlanco} alt="AQUARIO" className="pin-aquario-logo" style={{ margin: "0 auto 12px" }} />
              <p className="loading-message" style={{ color: "#0f172a", fontWeight: 600 }}>
                {authenticatingMs ? "Autenticando en Microsoft..." : "Validando acceso de supervisor..."}
              </p>
            </div>
          </div>
        </main>
      ) : !access || !access.user ? (
        <main className="pin-view-main">
          <div className="pin-login-wrapper">
            <div className="pin-login-card glass-panel">
              <div className="pin-header">
                <img src={aquarioBlanco} alt="AQUARIO" className="pin-aquario-logo" />
                <h2 className="pin-title">Control de Supervisión</h2>
                <p className="pin-subtitle">
                  Inicia sesión con tu cuenta corporativa del tenant de Microsoft para acceder
                </p>
              </div>

              {error && (
                <div className="pin-error-banner" role="alert">
                  <span>⚠️ {error}</span>
                </div>
              )}

              <button
                type="button"
                className="pin-submit-btn ready microsoft-sso-btn"
                onClick={handleMicrosoftLogin}
                disabled={authenticatingMs}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "10px",
                  marginTop: "12px",
                  padding: "12px",
                  background: "#00a4ef",
                  color: "#ffffff"
                }}
              >
                <svg width="20" height="20" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="0" y="0" width="10" height="10" fill="#f25022"/>
                  <rect x="11" y="0" width="10" height="10" fill="#7fba00"/>
                  <rect x="0" y="11" width="10" height="10" fill="#00a4ef"/>
                  <rect x="11" y="11" width="10" height="10" fill="#ffb900"/>
                </svg>
                {authenticatingMs ? "Conectando..." : "Iniciar sesión con Microsoft"}
              </button>
            </div>
          </div>
        </main>
      ) : (
        <SupervisorPortal access={access} onAccessChanged={loadAccess} />
      )}
    </div>
  );
}
