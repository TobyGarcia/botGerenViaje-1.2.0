import React from "react";

export default function TopBar({ conductor, onLogout }) {
  const isTelegram = Boolean(window.Telegram?.WebApp);

  const handleCloseMiniApp = () => {
    if (window.Telegram?.WebApp) {
      try {
        window.Telegram.WebApp.close();
      } catch (err) {
        console.warn("Error al cerrar Mini App:", err);
      }
    }
  };

  return (
    <header className="app-topbar">
      <div className="topbar-inner">
        <div className="topbar-brand">
          <span className="topbar-icon" aria-hidden="true">🛡️</span>
          <div className="topbar-titles">
            <span className="topbar-title">AQUARIO</span>
            <span className="topbar-subtitle">Control de Viajes</span>
          </div>
        </div>

        <div className="topbar-actions">
          {conductor ? (
            <div className="topbar-user-area">
              <span className="topbar-driver-pill" title={conductor.nombre}>
                <span className="driver-avatar-icon">👤</span>
                <span className="driver-name-text">
                  {conductor.nombre ? conductor.nombre.split(" ").slice(0, 2).join(" ") : "Conductor"}
                </span>
              </span>

              <button
                type="button"
                className="topbar-btn-logout"
                onClick={onLogout}
                title="Cerrar sesión / Salir"
              >
                <span className="btn-logout-icon">🚪</span>
                <span className="btn-logout-label">Salir</span>
              </button>
            </div>
          ) : (
            <div className="topbar-guest-area">
              <span className="topbar-badge-pin">
                🔑 Acceso PIN
              </span>
              {isTelegram && (
                <button
                  type="button"
                  className="topbar-btn-close-app"
                  onClick={handleCloseMiniApp}
                  title="Cerrar Mini App"
                >
                  ✕
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
