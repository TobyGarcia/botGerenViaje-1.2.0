import React from "react";
import aquarioBlanco from "../assets/AQUARIO_BLANCO.png";

export default function TopBar({ conductor, onLogout, activeTabMode, onTabChange }) {
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
          <img src={aquarioBlanco} alt="AQUARIO" className="topbar-logo-img" />

          {/* Menú Desplegable Superior al lado del Logotipo */}
          {typeof onTabChange === "function" && (
            <div className="topbar-menu-dropdown-wrapper">
              <select
                className="topbar-menu-select"
                value={activeTabMode || "urban"}
                onChange={(e) => onTabChange(e.target.value)}
                aria-label="Menú principal de navegación"
              >
                <option value="urban">🚘 Viaje Urbano</option>
                <option value="gerenciamiento">🗺️ Gerenciamiento</option>
                <option value="siniestro">🚨 Reportar Siniestro</option>
                <option value="perfil">👤 Datos Conductor</option>
              </select>
              <div className="topbar-select-arrow">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m6 9 6 6 6-6"/>
                </svg>
              </div>
            </div>
          )}
        </div>

        <div className="topbar-actions">
          {conductor ? (
            <div className="topbar-user-area">
              <span className="topbar-driver-pill" title={conductor.nombre}>
                <svg className="driver-avatar-svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                <span className="driver-name-text">
                  {conductor.nombre ? conductor.nombre.split(" ").slice(0, 2).join(" ") : "Conductor"}
                </span>
              </span>

              <button
                type="button"
                className="topbar-btn-logout-icon"
                onClick={onLogout}
                title="Cerrar sesión / Salir"
                aria-label="Cerrar sesión"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </button>
            </div>
          ) : (
            <div className="topbar-guest-area">
              <span className="topbar-badge-pin">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}>
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                Acceso PIN
              </span>
              {isTelegram && (
                <button
                  type="button"
                  className="topbar-btn-close-app"
                  onClick={handleCloseMiniApp}
                  title="Cerrar Mini App"
                  aria-label="Cerrar Mini App"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
