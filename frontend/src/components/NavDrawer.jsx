import React from "react";
import {
  IconCar,
  IconMap,
  IconAlert,
  IconUser,
  IconCross,
  IconCheck
} from "./Icons.jsx";

const NAV_ITEMS = [
  {
    id: "urban",
    label: "Viaje Urbano / Local",
    icon: IconCar,
    color: "#0284c7"
  },
  {
    id: "gerenciamiento",
    label: "Gerenciamiento de viajes",
    icon: IconMap,
    color: "#0284c7"
  },
  {
    id: "siniestro",
    label: "Reportar siniestro",
    icon: IconAlert,
    color: "#dc2626"
  },
  {
    id: "perfil",
    label: "Actualización de datos",
    icon: IconUser,
    color: "#0f172a"
  }
];

export default function NavDrawer({
  isOpen,
  onClose,
  activeTabMode,
  onSelectTab,
  conductor
}) {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        display: "flex"
      }}
    >
      {/* Fondo oscuro semi-transparente */}
      <div
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(15, 23, 42, 0.6)",
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)"
        }}
      />

      {/* Menú Lateral Deslizante */}
      <div
        style={{
          position: "relative",
          width: "310px",
          maxWidth: "85vw",
          height: "100%",
          background: "#f4f8fb",
          display: "flex",
          flexDirection: "column",
          boxShadow: "4px 0 24px rgba(0, 0, 0, 0.25)",
          zIndex: 1,
          boxSizing: "border-box"
        }}
      >
        {/* Encabezado del Menú Drawer */}
        <div
          style={{
            background: "#0f1d28",
            color: "#ffffff",
            padding: "20px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid rgba(255, 255, 255, 0.1)"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "50%",
                background: "#0284c7",
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0
              }}
            >
              <IconUser size={22} color="#ffffff" />
            </div>
            <div>
              <div style={{ fontSize: "0.95rem", fontWeight: "800", color: "#ffffff" }}>
                {conductor?.nombre ? conductor.nombre.split(" ").slice(0, 2).join(" ") : "Conductor"}
              </div>
              <div style={{ fontSize: "0.72rem", color: "#38bdf8", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                CONDUCTOR AUTENTICADO
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              width: "34px",
              height: "34px",
              borderRadius: "10px",
              background: "rgba(255, 255, 255, 0.12)",
              border: 0,
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer"
            }}
          >
            <IconCross size={18} color="#ffffff" />
          </button>
        </div>

        {/* Cuerpo con Opciones del Menú */}
        <div style={{ flex: 1, padding: "20px 16px", overflowY: "auto" }}>
          <div style={{ fontSize: "0.75rem", fontWeight: "800", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "14px" }}>
            MÓDULOS DE NAVEGACIÓN
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {NAV_ITEMS.map((item) => {
              const IconComp = item.icon;
              const isActive = activeTabMode === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onSelectTab(item.id);
                    onClose();
                  }}
                  style={{
                    width: "100%",
                    padding: "14px 16px",
                    borderRadius: "12px",
                    border: isActive ? "1px solid #bae6fd" : "1px solid #e2e8f0",
                    borderLeft: isActive ? "4px solid #0284c7" : "1px solid #e2e8f0",
                    background: isActive ? "#e0f2fe" : "#ffffff",
                    color: isActive ? "#0369a1" : "#1e293b",
                    fontWeight: "700",
                    fontSize: "0.9rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    cursor: "pointer",
                    boxShadow: isActive ? "0 4px 12px rgba(2, 132, 199, 0.12)" : "0 2px 6px rgba(0,0,0,0.03)",
                    transition: "all 0.15s ease",
                    textAlign: "left"
                  }}
                >
                  <IconComp size={20} color={isActive ? "#0284c7" : item.color} />
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {isActive && <IconCheck size={16} color="#0284c7" />}
                </button>
              );
            })}
          </div>

          {/* Guia discreta de uso sin internet */}
          <div
            style={{
              marginTop: "20px",
              padding: "12px 14px",
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "12px",
              fontSize: "0.8rem",
              color: "#475569"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: "700", color: "#0f2b46", marginBottom: "4px" }}>
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#0284c7" }}></span>
              <span>¿Cómo usar sin internet?</span>
            </div>
            <p style={{ margin: 0, fontSize: "0.74rem", lineHeight: "1.4", color: "#64748b" }}>
              En el menú de tu navegador (3 puntos arriba a la derecha), elige <strong>"Instalar aplicación"</strong> o <strong>"Añadir a inicio"</strong> para operar sin conexión.
            </p>
          </div>
        </div>

        {/* Pie de página del Drawer */}
        <div
          style={{
            padding: "16px",
            borderTop: "1px solid #e2e8f0",
            textAlign: "center",
            fontSize: "0.78rem",
            color: "#94a3b8",
            fontWeight: "600"
          }}
        >
          AQUARIO · Control de Viajes
        </div>
      </div>
    </div>
  );
}
