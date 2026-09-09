import { Component, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import SupervisorApp from './SupervisorApp.jsx'
import EvaluacionApp from './pages/EvaluacionApp.jsx'

// Inicializar y expandir Telegram WebApp tan pronto como sea posible
if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
  try {
    window.Telegram.WebApp.ready();
    window.Telegram.WebApp.expand();
  } catch (err) {
    console.warn("Error al inicializar Telegram WebApp en main:", err);
  }
}

class RootErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null, copied: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("[RootErrorBoundary] Error no controlado en aplicación:", error, errorInfo);
    this.setState({ errorInfo });
    // Asegurar que Telegram WebApp retire la cortina incluso en caso de error
    if (window.Telegram?.WebApp?.ready) {
      try { window.Telegram.WebApp.ready(); } catch {}
    }
  }

  handleCopyError = () => {
    const errorDetails = `Error: ${this.state.error?.message || "Desconocido"}\nStack: ${this.state.error?.stack || "N/A"}\nComponent: ${this.state.errorInfo?.componentStack || "N/A"}`;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(errorDetails).then(() => {
        this.setState({ copied: true });
        setTimeout(() => this.setState({ copied: false }), 2500);
      }).catch(() => {});
    }
  };

  handleClearCacheAndReload = async () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {}

    if (typeof window !== 'undefined' && window.caches) {
      try {
        const keys = await window.caches.keys();
        await Promise.all(keys.map((key) => window.caches.delete(key)));
      } catch {}
    }

    if (navigator.serviceWorker) {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((r) => r.unregister()));
      } catch {}
    }

    setTimeout(() => {
      window.location.reload();
    }, 200);
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100dvh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
          background: '#f4f8fb',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          boxSizing: 'border-box'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '20px',
            padding: '24px',
            maxWidth: '440px',
            width: '100%',
            boxShadow: '0 12px 32px rgba(15, 23, 42, 0.08)',
            border: '1px solid #d2e4ee',
            textAlign: 'center',
            boxSizing: 'border-box'
          }}>
            <div style={{
              display: 'inline-block',
              padding: '6px 14px',
              background: '#e8f8fe',
              borderRadius: '12px',
              fontWeight: 700,
              color: '#2e81ab',
              fontSize: '13px',
              marginBottom: '14px'
            }}>
              AQUARIO · Control de Viajes
            </div>

            <h2 style={{ fontSize: '1.2rem', margin: '0 0 8px', color: '#0f172a', fontWeight: 800 }}>
              Ocurrió un problema inesperado
            </h2>
            <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0 0 16px', lineHeight: 1.4 }}>
              La aplicación encontró un error al procesar esta vista. Puedes recargar o limpiar la memoria local para continuar.
            </p>

            <div style={{
              textAlign: 'left',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '10px 12px',
              fontFamily: 'monospace',
              fontSize: '0.75rem',
              color: '#dc2626',
              maxHeight: '110px',
              overflowY: 'auto',
              marginBottom: '18px',
              wordBreak: 'break-word'
            }}>
              {this.state.error?.message || "Error al renderizar los componentes"}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                type="button"
                onClick={() => window.location.reload()}
                style={{
                  background: '#2e81ab',
                  color: '#ffffff',
                  border: 'none',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontSize: '0.9rem'
                }}
              >
                🔄 Reintentar / Recargar
              </button>

              <button
                type="button"
                onClick={this.handleClearCacheAndReload}
                style={{
                  background: '#f1f5f9',
                  color: '#334155',
                  border: '1px solid #cbd5e1',
                  padding: '10px 16px',
                  borderRadius: '10px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: '0.82rem'
                }}
              >
                🧹 Limpiar Caché y Reiniciar
              </button>

              <button
                type="button"
                onClick={this.handleCopyError}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#0284c7',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  padding: '4px'
                }}
              >
                {this.state.copied ? "✓ Diagnóstico copiado al portapapeles" : "📋 Copiar reporte de error"}
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Detección de ruta y parámetros de arranque de Telegram
const pathname = window.location.pathname;
const urlParams = new URLSearchParams(window.location.search);
const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));

const stateParam = urlParams.get("state") || hashParams.get("state");
const tgStartParam = (
  window.Telegram?.WebApp?.initDataUnsafe?.start_param ||
  urlParams.get("tgWebAppStartParam") ||
  hashParams.get("tgWebAppStartParam") ||
  hashParams.get("start_param") ||
  ""
).toLowerCase();

let RootApp = App;
if (
  import.meta.env.VITE_APP_MODE === "supervisor" ||
  pathname.startsWith("/supervisor") ||
  stateParam === "supervisor" ||
  tgStartParam === "supervisor"
) {
  RootApp = SupervisorApp;
} else if (
  import.meta.env.VITE_APP_MODE === "evaluacion" ||
  pathname.startsWith("/evaluacion") ||
  stateParam === "evaluacion" ||
  tgStartParam === "evaluacion"
) {
  RootApp = EvaluacionApp;
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RootErrorBoundary>
      <RootApp />
    </RootErrorBoundary>
  </StrictMode>,
)
