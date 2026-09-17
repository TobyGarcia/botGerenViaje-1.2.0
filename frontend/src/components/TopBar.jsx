import React, { useState } from "react";
import logoGv from "../assets/LOGOGV.png";
import NavDrawer from "./NavDrawer.jsx";
import { IconMenu, IconCar, IconMap, IconAlert, IconUser } from "./Icons.jsx";

export default function TopBar({ conductor, onLogout, activeTabMode, onTabChange }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
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

  const getActiveTabMeta = () => {
    switch (activeTabMode) {
      case "gerenciamiento":
        return { label: "Gerenciamiento", Icon: IconMap };
      case "siniestro":
        return { label: "Siniestro", Icon: IconAlert };
      case "perfil":
        return { label: "Datos", Icon: IconUser };
      case "urban":
      default:
        return { label: "Viaje Urbano", Icon: IconCar };
    }
  };

  const activeMeta = getActiveTabMeta();
  const ActiveIcon = activeMeta.Icon;

  return (
    <>
      <header className="app-topbar">
        <div className="topbar-inner">
          <div className="topbar-brand">
            <img src={logoGv} alt="GV MOBILITY" className="topbar-logo-img" />
          </div>

        <div className="topbar-actions" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {typeof onTabChange === "function" && (
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              title="Abrir menú"
              aria-label="Abrir menú"
              style={{
                background: "#0284c7",
                color: "#ffffff",
                border: 0,
                borderRadius: "8px",
                width: "38px",
                height: "38px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 2px 6px rgba(2, 132, 199, 0.25)",
                transition: "all 0.15s ease"
              }}
            >
              <IconMenu size={20} color="#ffffff" />
            </button>
          )}

          {conductor ? (
            <div className="topbar-user-area">
              <button
                type="button"
                className="topbar-btn-logout-icon"
                onClick={onLogout}
                title="Cerrar sesión / Salir"
                aria-label="Cerrar sesión"
                style={{
                  background: "rgba(244, 63, 94, 0.15)",
                  border: "1px solid rgba(244, 63, 94, 0.3)",
                  borderRadius: "8px",
                  width: "38px",
                  height: "38px",
                  color: "#fda4af",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 0.15s ease"
                }}
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

      {/* Drawer Navegador Lateral */}
      <NavDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        activeTabMode={activeTabMode}
        onSelectTab={onTabChange}
        conductor={conductor}
      />
    </>
  );
}
