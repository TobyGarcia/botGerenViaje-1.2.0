import { Component, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import "leaflet/dist/leaflet.css";
import './index.css'
import App from './App.jsx'

class RootErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null, copied: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("[PanelAdmin ErrorBoundary] Error en aplicación:", error, errorInfo);
    this.setState({ errorInfo });
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

    setTimeout(() => {
      window.location.reload();
    }, 200);
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
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
            borderRadius: '16px',
            padding: '28px',
            maxWidth: '480px',
            width: '100%',
            boxShadow: '0 12px 32px rgba(15, 23, 42, 0.1)',
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
              AQUARIO · Panel Administrativo
            </div>

            <h2 style={{ fontSize: '1.25rem', margin: '0 0 8px', color: '#0f172a', fontWeight: 800 }}>
              Se produjo un error al cargar este módulo
            </h2>
            <p style={{ fontSize: '0.88rem', color: '#64748b', margin: '0 0 16px', lineHeight: 1.4 }}>
              Ocurrió una excepción inesperada durante la visualización. Puedes recargar la ventana o consultar los detalles técnicos.
            </p>

            <div style={{
              textAlign: 'left',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '10px 12px',
              fontFamily: 'monospace',
              fontSize: '0.78rem',
              color: '#dc2626',
              maxHeight: '120px',
              overflowY: 'auto',
              marginBottom: '18px',
              wordBreak: 'break-word'
            }}>
              {this.state.error?.message || "Error al procesar componentes del panel"}
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
                🔄 Reintentar / Recargar Panel
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

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </StrictMode>,
)
