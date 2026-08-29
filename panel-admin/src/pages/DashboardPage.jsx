import { useEffect, useState } from "react";
import ConductoresPage from "./ConductoresPage.jsx";
import VehiculosPage from "./VehiculosPage.jsx";
import DestinosPage from "./DestinosPage.jsx";
import UbicacionesPage from "./UbicacionesPage.jsx";
import ViajesPage from "./ViajesPage.jsx";
import InspeccionesPage from "./InspeccionesPage.jsx";
import ManejoComentadoPage from "./ManejoComentadoPage.jsx";
import AnaliticaCombustiblePage from "./AnaliticaCombustiblePage.jsx";
import UsuariosAdminPage from "./UsuariosAdminPage.jsx";
import PerfilPage from "./PerfilPage.jsx";
import { getAdminDashboardSummary, getAdminInspeccionesPendientesCount, getManejoComentadoResumenExpirados } from "../services/api.js";
import logoAQR from "../assets/LoginAssets/logoAQR.webp";
import logoAquarioBlanco from "../assets/page_assets/AQUARIO_BLANCO.png";
import {
  IconInicio,
  IconInspecciones,
  IconManejoComentado,
  IconCombustible,
  IconConductores,
  IconUnidades,
  IconDestinos,
  IconUbicaciones,
  IconViajes,
  IconUsuarios,
  IconConfiguracion,
  IconCerrarSesion,
  IconToggleSidebar
} from "../components/Icons.jsx";


function formatActivityDay(value) {
  const datePart = String(value || "").match(/^\d{4}-\d{2}-\d{2}/)?.[0];

  if (!datePart) {
    return "";
  }

  return new Date(`${datePart}T00:00:00`).toLocaleDateString("es-MX", {
    weekday: "short"
  });
}

function ExpiringManejoComentadoWidget({ onOpenManejoComentado }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    getManejoComentadoResumenExpirados()
      .then((res) => setData(res.data))
      .catch(() => setData(null));
  }, []);

  if (!data) return null;

  return (
    <article className="kpi-card" style={{ cursor: "pointer", borderLeft: "4px solid #eab308" }} onClick={onOpenManejoComentado}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>Manejos Comentados por Expirar</span>
        <strong style={{ color: data.total_expiring > 0 ? "#d97706" : "inherit" }}>{data.total_expiring}</strong>
      </div>
      <small style={{ display: "block", marginTop: "4px" }}>
        {data.vencidos_count} vencidos / {data.proximos_count} próximos (30 días)
      </small>
      {data.items && data.items.length > 0 && (
        <ul style={{ margin: "6px 0 0 0", padding: "0 0 0 14px", fontSize: "0.78rem", color: "#475569", textAlign: "left" }}>
          {data.items.slice(0, 2).map((item) => (
            <li key={item.id_conductores}>
              {item.nombre.split(" ")[0]} - <span style={{ color: item.estado_vigencia === "VENCIDO" || item.estado_vigencia === "SIN_REGISTRO" ? "#dc2626" : "#d97706", fontWeight: "bold" }}>{item.estado_vigencia}</span>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

function DashboardOverview({ pendingInspections, notificationError, onOpenInspections, onOpenManejoComentado }) {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getAdminDashboardSummary()
      .then((response) => setSummary(response.data))
      .catch((requestError) => setError(requestError.message));
  }, []);

  if (error) return <p className="module-message module-message-error">{error}</p>;
  if (!summary) return <p className="table-status">Cargando indicadores...</p>;

  return (
    <section className="dashboard-overview">
      <section className="kpi-grid">
        <ExpiringManejoComentadoWidget onOpenManejoComentado={onOpenManejoComentado} />
        <article className="kpi-card"><span>Conductores</span><strong>{summary.conductores_total}</strong><small>{summary.conductores_activos} activos</small></article>
        <article className="kpi-card"><span>Unidades</span><strong>{summary.unidades_total}</strong><small>{summary.unidades_activas} activas</small></article>
        <article className="kpi-card"><span>Viajes registrados</span><strong>{summary.viajes_total}</strong><small>{summary.viajes_en_curso} en curso</small></article>
        <button type="button" className="kpi-card inspection-notification-card" onClick={onOpenInspections}>
          <span>Inspecciones pendientes</span>
          <strong>{pendingInspections}</strong>
          <small>{pendingInspections ? "Requieren aprobación administrativa" : "No hay inspecciones por atender"}</small>
        </button>
      </section>


      {notificationError && <p className="module-message module-message-error">No se pudo actualizar el contador de inspecciones: {notificationError}</p>}

      {/* Disposición en columna para Ranking y Gráfico de Calor */}
      <RankingWidget
        rankingUnidades={summary.ranking_unidades}
        rankingDestinos={summary.ranking_destinos}
        rankingConductores={summary.ranking_conductores}
      />

      <ActivityHeatmapCard actividad={summary.actividad} />
    </section>
  );
}

function ActivityHeatmapCard({ actividad = [] }) {
  const [rangeFilter, setRangeFilter] = useState("anual");
  const [tooltip, setTooltip] = useState(null);

  const items = actividad.map((item) => {
    let dateObj = null;
    if (item.fecha) {
      const rawStr = String(item.fecha).match(/^\d{4}-\d{2}-\d{2}/)?.[0];
      if (rawStr) {
        const [y, m, d] = rawStr.split("-").map(Number);
        dateObj = new Date(y, m - 1, d);
      } else {
        dateObj = new Date(item.fecha);
      }
    }
    return {
      rawStr: item.fecha,
      dateObj,
      total: Number(item.total || 0)
    };
  });

  let filteredItems = items;
  if (rangeFilter === "semanal") {
    filteredItems = items.slice(-14);
  } else if (rangeFilter === "mensual") {
    filteredItems = items.slice(-35);
  } else {
    filteredItems = items.slice(-364);
  }

  const getLevel = (count) => {
    if (count === 0) return 0;
    if (count === 1) return 1;
    if (count <= 3) return 2;
    if (count <= 6) return 3;
    return 4;
  };

  const formatTooltipDate = (item) => {
    if (!item || !item.dateObj || isNaN(item.dateObj.getTime())) return item?.rawStr || "";
    const str = item.dateObj.toLocaleDateString("es-MX", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric"
    });
    return str.charAt(0).toUpperCase() + str.slice(1);
  };

  // Cálculo de día inicial y placeholders para vista anual
  let startDayOfWeek = 0;
  if (rangeFilter === "anual" && filteredItems.length > 0 && filteredItems[0].dateObj) {
    startDayOfWeek = filteredItems[0].dateObj.getDay(); // 0 = Dom, 1 = Lun, ..., 6 = Sáb
  }

  // Preparamos los elementos del grid (con placeholders al inicio si es anual)
  const gridCells = [];
  if (rangeFilter === "anual") {
    for (let i = 0; i < startDayOfWeek; i++) {
      gridCells.push({ isPlaceholder: true });
    }
  }
  filteredItems.forEach((item) => {
    gridCells.push({ ...item, isPlaceholder: false });
  });

  // Generar etiquetas de meses con cálculo estricto de columna y margen anti-colisión
  const getMonthLabels = () => {
    if (rangeFilter !== "anual" || filteredItems.length === 0) return [];

    const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    const labels = [];
    let lastMonth = -1;
    let lastCol = -10;

    filteredItems.forEach((item, idx) => {
      if (item.dateObj && !isNaN(item.dateObj.getTime())) {
        const m = item.dateObj.getMonth();
        if (m !== lastMonth) {
          lastMonth = m;
          const col = Math.floor((idx + startDayOfWeek) / 7) + 1;
          // Garantizar distancia mínima de 3 columnas (~51px) entre etiquetas para evitar solapamientos
          if (col - lastCol >= 3 && col <= 51) {
            labels.push({ col, name: monthNames[m] });
            lastCol = col;
          }
        }
      }
    });

    return labels;
  };

  const totalViajesPeriodo = filteredItems.reduce((acc, curr) => acc + curr.total, 0);

  return (
    <section className="activity-heatmap-card">
      <div className="activity-heatmap-header">
        <div>
          <h2>📊 Actividad de Viajes</h2>
          <p>
            {rangeFilter === "semanal" && "Frecuencia de viajes registrados en las últimas 2 semanas."}
            {rangeFilter === "mensual" && "Frecuencia de viajes registrados durante el último mes."}
            {rangeFilter === "anual" && "Mapa de calor anual de viajes (últimas 52 semanas)."}{" "}
            <strong>({totalViajesPeriodo} {totalViajesPeriodo === 1 ? "viaje registrado" : "viajes registrados"})</strong>
          </p>
        </div>

        <div className="ranking-segmented-control">
          <button
            type="button"
            className={`ranking-tab-btn ${rangeFilter === "semanal" ? "active" : ""}`}
            onClick={() => setRangeFilter("semanal")}
          >
            📅 Semanal
          </button>
          <button
            type="button"
            className={`ranking-tab-btn ${rangeFilter === "mensual" ? "active" : ""}`}
            onClick={() => setRangeFilter("mensual")}
          >
            📆 Mensual
          </button>
          <button
            type="button"
            className={`ranking-tab-btn ${rangeFilter === "anual" ? "active" : ""}`}
            onClick={() => setRangeFilter("anual")}
          >
            🗓️ Anual
          </button>
        </div>
      </div>

      <div className="heatmap-container">
        <div className="heatmap-days-legend">
          <span>Lun</span>
          <span>Mié</span>
          <span>Vie</span>
        </div>

        <div className="heatmap-grid-scroll">
          {rangeFilter === "anual" && (
            <div className="heatmap-month-labels">
              {getMonthLabels().map((lbl, i) => (
                <span key={i} className="heatmap-month-label" style={{ gridColumnStart: lbl.col }}>
                  {lbl.name}
                </span>
              ))}
            </div>
          )}

          <div className={`heatmap-grid mode-${rangeFilter}`}>
            {gridCells.map((cell, idx) => {
              if (cell.isPlaceholder) {
                return <div key={`ph-${idx}`} className="heatmap-cell heatmap-cell-placeholder" />;
              }
              const lvl = getLevel(cell.total);
              return (
                <div
                  key={idx}
                  className={`heatmap-cell level-${lvl}`}
                  onMouseEnter={(e) => {
                    const rect = e.target.getBoundingClientRect();
                    setTooltip({
                      text: `${formatTooltipDate(cell)}: ${cell.total} ${cell.total === 1 ? "viaje" : "viajes"}`,
                      x: rect.left + rect.width / 2,
                      y: rect.top - 8
                    });
                  }}
                  onMouseLeave={() => setTooltip(null)}
                />
              );
            })}
          </div>
        </div>
      </div>

      {tooltip && (
        <div className="heatmap-tooltip" style={{ left: `${tooltip.x}px`, top: `${tooltip.y}px` }}>
          {tooltip.text}
        </div>
      )}

      <div className="heatmap-footer">
        <span className="heatmap-note">
          {rangeFilter === "anual" ? "Se muestran 365 días de actividad registrada" : "Visualización por matriz de cuadrícula de calor"}
        </span>

        <div className="heatmap-scale-legend">
          <span>Menos</span>
          <div className="heatmap-cell level-0" />
          <div className="heatmap-cell level-1" />
          <div className="heatmap-cell level-2" />
          <div className="heatmap-cell level-3" />
          <div className="heatmap-cell level-4" />
          <span>Más</span>
        </div>
      </div>
    </section>
  );
}

function RankingWidget({ rankingUnidades = [], rankingDestinos = [], rankingConductores = [] }) {
  const [rankingTab, setRankingTab] = useState("unidades");

  const isUnidades = rankingTab === "unidades";
  const isDestinos = rankingTab === "destinos";
  const isConductores = rankingTab === "conductores";

  let list = rankingUnidades;
  if (isDestinos) list = rankingDestinos;
  if (isConductores) list = rankingConductores;

  const maxVal = Math.max(
    1,
    ...list.map((item) => Number(isConductores || isUnidades ? item.total_viajes : item.total_visitas))
  );

  return (
    <section className="ranking-card">
      <div className="ranking-header">
        <div>
          <h2>🏆 Ranking de Viajes</h2>
          <p>Métricas acumuladas por vehículos más utilizados, destinos con mayor frecuencia y top conductores (viajes finalizados).</p>
        </div>

        <div className="ranking-segmented-control">
          <button
            type="button"
            className={`ranking-tab-btn ${isUnidades ? "active" : ""}`}
            onClick={() => setRankingTab("unidades")}
          >
            🚚 Unidades más usadas
          </button>
          <button
            type="button"
            className={`ranking-tab-btn ${isDestinos ? "active" : ""}`}
            onClick={() => setRankingTab("destinos")}
          >
            📍 Destinos más visitados
          </button>
          <button
            type="button"
            className={`ranking-tab-btn ${isConductores ? "active" : ""}`}
            onClick={() => setRankingTab("conductores")}
          >
            👤 Top Conductores
          </button>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="ranking-empty">
          <p>No hay suficientes registros de viajes para calcular el ranking de {isUnidades ? "unidades" : isDestinos ? "destinos" : "conductores"}.</p>
        </div>
      ) : (
        <div className="ranking-list">
          {list.map((item, index) => {
            const count = Number(isConductores || isUnidades ? item.total_viajes : item.total_visitas);
            const percentage = Math.max(8, Math.round((count / maxVal) * 100));
            const rank = index + 1;

            const itemKey = isUnidades
              ? item.id_vehiculos || index
              : isDestinos
              ? item.id_destino || index
              : item.id_conductores || index;

            return (
              <div key={itemKey} className="ranking-row">
                <div className={`ranking-badge rank-${rank <= 3 ? rank : "other"}`}>
                  {rank === 1 && "🥇"}
                  {rank === 2 && "🥈"}
                  {rank === 3 && "🥉"}
                  {rank > 3 && `#${rank}`}
                </div>

                <div className="ranking-info">
                  <div className="ranking-title-area">
                    <strong className="ranking-item-name">{item.nombre}</strong>
                    {isUnidades && (
                      <span className="ranking-sub-info">
                        Eco: <strong>{item.numero_economico}</strong> • Placas: <strong>{item.placas}</strong> • Total KM: <strong>{item.total_km} km</strong>
                      </span>
                    )}
                    {isDestinos && (
                      <span className="ranking-sub-info">{item.direccion || "Destino registrado en sistema"}</span>
                    )}
                    {isConductores && (
                      <span className="ranking-sub-info">
                        Empresa: <strong>{item.empresa || "N/A"}</strong> • Tel: <strong>{item.telefono || "N/A"}</strong> • Total KM: <strong>{item.total_km} km</strong>
                      </span>
                    )}
                  </div>

                  <div className="ranking-bar-wrapper">
                    <div className="ranking-bar-background">
                      <div className="ranking-bar-fill" style={{ width: `${percentage}%` }} />
                    </div>
                    <span className="ranking-count">
                      <strong>{count}</strong>{" "}
                      {isConductores
                        ? count === 1
                          ? "viaje finalizado"
                          : "viajes finalizados"
                        : isUnidades
                        ? count === 1
                          ? "viaje"
                          : "viajes"
                        : count === 1
                        ? "visita"
                        : "visitas"}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function ModulePlaceholder({ title }) {
  return (
    <section className="module-page">
      <header className="module-header">
        <div>
          <span className="module-label">
            Administración
          </span>

          <h1>{title}</h1>

          <p>
            Este módulo estará disponible próximamente.
          </p>
        </div>
      </header>
    </section>
  );
}

function DashboardPage({ user, onLogout }) {
  const [activeModule, setActiveModule] = useState("inicio");
  const [pendingInspections, setPendingInspections] = useState(0);
  const [notificationError, setNotificationError] = useState("");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleSelectModule = (moduleId) => {
    setActiveModule(moduleId);
    setIsMobileMenuOpen(false);
  };

  useEffect(() => {
    if (!["ADMINISTRADOR", "SUPERVISOR"].includes(user.rol)) {
      return undefined;
    }
    let active = true;
    const refresh = () =>
      getAdminInspeccionesPendientesCount()
        .then((response) => {
          if (!active) return;
          setPendingInspections(Number(response.data?.total || 0));
          setNotificationError("");
        })
        .catch((error) => {
          if (active) setNotificationError(error.message || "Error desconocido.");
        });
    refresh();
    const timer = window.setInterval(refresh, 30000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [user.rol]);

  const modules = [
    { id: "analitica-combustible", label: "Analítica Combustible", icon: IconCombustible, roles: ["ADMINISTRADOR", "SUPERVISOR", "INSTRUCTOR"] },
    { id: "manejo-comentado", label: "Manejo Comentado", icon: IconManejoComentado, roles: ["ADMINISTRADOR", "SUPERVISOR", "INSTRUCTOR"] },
    { id: "conductores", label: "Conductores", icon: IconConductores, roles: ["ADMINISTRADOR"] },
    { id: "unidades", label: "Unidades", icon: IconUnidades, roles: ["ADMINISTRADOR", "SUPERVISOR", "INSTRUCTOR"] },
    { id: "destinos", label: "Destinos", icon: IconDestinos, roles: ["ADMINISTRADOR", "SUPERVISOR", "INSTRUCTOR"] },
    { id: "ubicaciones", label: "Ubicaciones", icon: IconUbicaciones, roles: ["ADMINISTRADOR", "SUPERVISOR", "INSTRUCTOR", "OPERADOR", "CONSULTA"] },
    { id: "viajes", label: "Viajes", icon: IconViajes, roles: ["ADMINISTRADOR", "SUPERVISOR", "INSTRUCTOR", "OPERADOR", "CONSULTA"] }
  ].filter((module) => module.roles.includes(user.rol));

  const canInspect = ["ADMINISTRADOR", "SUPERVISOR", "INSTRUCTOR"].includes(user.rol);


  return (
    <div className="admin-layout">
      {/* Fondo oscuro al abrir el menú en móviles */}
      {isMobileMenuOpen && (
        <div
          className="mobile-menu-backdrop"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <div className="sidebar-wrapper">
        <aside className={`sidebar ${isMobileMenuOpen ? "mobile-open" : ""}`}>
          <div className="sidebar-top">
            <div className="sidebar-brand">
              <img className="sidebar-brand-logo" src={logoAquarioBlanco} alt="AQUARIO" />
              <span className="sidebar-text sidebar-brand-title">Gerenciamiento viajes</span>
            </div>

            {/* Botón de Menú Hamburguesa para Móviles */}
            <button
              type="button"
              className="mobile-menu-btn"
              onClick={() => setIsMobileMenuOpen((prev) => !prev)}
              aria-label="Abrir menú de navegación"
            >
              {isMobileMenuOpen ? "✕" : "☰"}
              {pendingInspections > 0 && !isMobileMenuOpen && (
                <span className="mobile-badge-dot">{pendingInspections}</span>
              )}
            </button>
          </div>

          <nav className="sidebar-nav">
            <button
              type="button"
              title="Inicio"
              className={activeModule === "inicio" ? "sidebar-active" : ""}
              onClick={() => handleSelectModule("inicio")}
            >
              <span className="nav-icon"><IconInicio size={20} /></span>
              <span className="sidebar-text">Inicio</span>
            </button>

            {canInspect && (
              <button
                type="button"
                title="Inspecciones"
                className={`notification-button ${activeModule === "inspecciones" ? "sidebar-active" : ""}`}
                onClick={() => handleSelectModule("inspecciones")}
              >
                <span className="nav-icon"><IconInspecciones size={20} /></span>
                <span className="sidebar-text">Inspecciones</span>
                {pendingInspections > 0 && <strong>{pendingInspections}</strong>}
              </button>
            )}

            {modules.map((module) => {
              const IconComponent = module.icon;
              return (
                <button
                  key={module.id}
                  type="button"
                  title={module.label}
                  className={activeModule === module.id ? "sidebar-active" : ""}
                  onClick={() => handleSelectModule(module.id)}
                >
                  <span className="nav-icon"><IconComponent size={20} /></span>
                  <span className="sidebar-text">{module.label}</span>
                </button>
              );
            })}

            {user.rol === "ADMINISTRADOR" && (
              <button
                type="button"
                title="Administrador de usuarios"
                className={activeModule === "usuarios" ? "sidebar-active" : ""}
                onClick={() => handleSelectModule("usuarios")}
              >
                <span className="nav-icon"><IconUsuarios size={20} /></span>
                <span className="sidebar-text">Administrador de usuarios</span>
              </button>
            )}

            <button
              type="button"
              title="Configuración"
              className={activeModule === "perfil" ? "sidebar-active" : ""}
              onClick={() => handleSelectModule("perfil")}
            >
              <span className="nav-icon"><IconConfiguracion size={20} /></span>
              <span className="sidebar-text">Configuración</span>
            </button>

            <button
              type="button"
              className="logout-button mobile-logout"
              onClick={onLogout}
              title="Cerrar sesión"
            >
              <span className="nav-icon"><IconCerrarSesion size={20} /></span>
              <span className="sidebar-text">Cerrar sesión</span>
            </button>
          </nav>
        </aside>
      </div>

      <main className="dashboard-content">
        {activeModule === "inicio" && (
          <>
            <header className="dashboard-header">
              <div>
                <span>Panel administrativo</span>
                <h1>Bienvenido, {user.nombre}</h1>
              </div>

              <button
                type="button"
                className="user-summary"
                onClick={() => setActiveModule("perfil")}
                title="Personalizar perfil"
              >
                <span className="header-avatar">
                  {user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : user.nombre?.charAt(0)}
                </span>
                <span className="user-summary-copy">
                  <strong>{user.username}</strong>
                  <span>{user.rol}</span>
                </span>
              </button>
            </header>

            {user.rol !== "OPERADOR" && (
              <DashboardOverview
                pendingInspections={pendingInspections}
                notificationError={notificationError}
                onOpenInspections={() => setActiveModule("inspecciones")}
                onOpenManejoComentado={() => setActiveModule("manejo-comentado")}
              />
            )}
            {user.rol === "OPERADOR" && (
              <p className="table-status">Consulta tus viajes y ubicaciones desde el menú lateral.</p>
            )}
          </>
        )}

        {activeModule === "analitica-combustible" && <AnaliticaCombustiblePage />}
        {activeModule === "manejo-comentado" && <ManejoComentadoPage user={user} />}
        {activeModule === "conductores" && <ConductoresPage />}
        {activeModule === "unidades" && <VehiculosPage user={user} />}
        {activeModule === "destinos" && <DestinosPage user={user} />}
        {activeModule === "ubicaciones" && <UbicacionesPage />}
        {activeModule === "viajes" && <ViajesPage user={user} />}
        {activeModule === "inspecciones" && <InspeccionesPage onPendingChange={setPendingInspections} />}
        {activeModule === "usuarios" && user.rol === "ADMINISTRADOR" && <UsuariosAdminPage currentUser={user} />}
        {activeModule === "perfil" && <PerfilPage user={user} onUpdated={() => window.location.reload()} />}

        {modules
          .filter(
            (module) =>
              module.id !== "analitica-combustible" &&
              module.id !== "manejo-comentado" &&
              module.id !== "conductores" &&
              module.id !== "unidades" &&
              module.id !== "destinos" &&
              module.id !== "ubicaciones" &&
              module.id !== "viajes"
          )
          .map((module) =>
            activeModule === module.id ? (
              <ModulePlaceholder key={module.id} title={module.label} />
            ) : null
          )}

      </main>
    </div>
  );
}

export default DashboardPage;
