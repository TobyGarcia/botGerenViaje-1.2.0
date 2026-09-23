import { useEffect, useMemo, useState } from "react";
import ConductoresPage from "./ConductoresPage.jsx";
import VehiculosPage from "./VehiculosPage.jsx";
import DestinosPage from "./DestinosPage.jsx";
import UbicacionesPage from "./UbicacionesPage.jsx";
import ViajesPage from "./ViajesPage.jsx";
import MonitoreoActivoPage from "./MonitoreoActivoPage.jsx";
import InspeccionesPage from "./InspeccionesPage.jsx";
import ManejoComentadoPage from "./ManejoComentadoPage.jsx";
import AnaliticaCombustiblePage from "./AnaliticaCombustiblePage.jsx";
import PerfilPage from "./PerfilPage.jsx";
import GerenciamientoAdminPage from "./GerenciamientoAdminPage.jsx";
import TripDetailModal from "../components/TripDetailModal.jsx";
import { getAdminDashboardSummary, getAdminInspeccionesPendientesCount, getManejoComentadoResumenExpirados } from "../services/api.js";
import logoAQR from "../assets/LoginAssets/logoAQR.webp";
import logoGv from "../assets/LOGOGV.png";
import isologoGv from "../assets/ISOLOGO.png";
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
  IconRadar,
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
        <span style={{ minWidth: 0, flex: 1 }}>Manejos Comentados por Expirar</span>
        <strong style={{ color: data.total_expiring > 0 ? "#d97706" : "inherit", flexShrink: 0 }}>{data.total_expiring}</strong>
      </div>
      <small style={{ display: "block", marginTop: "4px" }}>
        {data.vencidos_count} vencidos / {data.proximos_count} próximos (30 días)
      </small>
      {data.items && data.items.length > 0 && (
        <ul style={{ margin: "6px 0 0 0", padding: "0 0 0 14px", fontSize: "0.78rem", color: "#475569", textAlign: "left", wordBreak: "break-word" }}>
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

function ActiveTripsCardWidget({ viajesActivos = [], onSelectTrip }) {
  const totalEnCurso = viajesActivos.filter((v) => v.estado === "EN_CURSO").length;
  const totalPendientes = viajesActivos.filter((v) => v.estado === "PENDIENTE").length;

  return (
    <article className="kpi-card active-trips-card">
      <div className="active-trips-card-header">
        <span>Viajes activos ({viajesActivos.length})</span>
        <div style={{ marginTop: "2px", display: "flex", alignItems: "baseline", gap: "8px", flexWrap: "wrap" }}>
          <span className="active-trips-card-count">
            {viajesActivos.length}
          </span>
          <small style={{ color: "#607986" }}>
            {totalEnCurso} en curso • {totalPendientes} pendientes
          </small>
        </div>
      </div>

      {viajesActivos.length === 0 ? (
        <div className="active-trips-empty-text">
          <small>No hay viajes en curso ni pendientes</small>
        </div>
      ) : (
        <ul className="active-trips-mini-list">
          {viajesActivos.map((item, index) => {
            const isEnCurso = item.estado === "EN_CURSO";
            return (
              <li
                key={item.id_viajes || index}
                className="active-trips-mini-item clickable"
                onClick={() => onSelectTrip?.(item)}
                title="Clic para ver detalle de viaje"
              >
                <div className="active-trips-mini-top">
                  <span className={`status-dot ${isEnCurso ? "dot-green-blinking" : "dot-yellow-fixed"}`} />
                  <span className="active-trips-mini-driver">{item.conductor}</span>
                  <span className={`active-trips-mini-status-text ${isEnCurso ? "en-curso" : "pendiente"}`}>
                    {isEnCurso ? "En curso" : "Pendiente"}
                  </span>
                </div>
                <div className="active-trips-mini-details">
                  <span className="active-trips-mini-route" title={`${item.origen} → ${item.destino}`}>
                    {item.origen} → {item.destino}
                  </span>
                  <span className="active-trips-mini-unit">
                    {item.vehiculo} {item.numero_economico !== "N/A" ? `(${item.numero_economico})` : ""}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </article>
  );
}

function RecentTripsCardWidget({ viajesRecientes = [], onSelectTrip }) {
  const totalFinalizados = viajesRecientes.filter((v) => v.estado === "FINALIZADO").length;

  return (
    <article className="kpi-card recent-trips-card">
      <div className="recent-trips-card-header">
        <span>Viajes recientes ({viajesRecientes.length})</span>
        <div style={{ marginTop: "2px", display: "flex", alignItems: "baseline", gap: "8px", flexWrap: "wrap" }}>
          <span className="recent-trips-card-count">
            {viajesRecientes.length}
          </span>
          <small style={{ color: "#607986" }}>
            {totalFinalizados} finalizados en registro
          </small>
        </div>
      </div>

      {viajesRecientes.length === 0 ? (
        <div className="active-trips-empty-text">
          <small>No hay viajes registrados recientemente</small>
        </div>
      ) : (
        <ul className="active-trips-mini-list">
          {viajesRecientes.map((item, index) => {
            const isFinalizado = item.estado === "FINALIZADO";
            const isCancelado = item.estado === "CANCELADO";
            const dotClass = isFinalizado ? "dot-blue-fixed" : isCancelado ? "dot-red-fixed" : "dot-green-blinking";
            const statusClass = isFinalizado ? "finalizado" : isCancelado ? "cancelado" : "en-curso";

            return (
              <li
                key={item.id_viajes || index}
                className="active-trips-mini-item clickable"
                onClick={() => onSelectTrip?.(item)}
                title="Clic para ver detalle de viaje"
              >
                <div className="active-trips-mini-top">
                  <span className={`status-dot ${dotClass}`} />
                  <span className="active-trips-mini-driver">{item.conductor}</span>
                  <span className={`active-trips-mini-status-text ${statusClass}`}>
                    {item.estado || "Finalizado"}
                  </span>
                </div>
                <div className="active-trips-mini-details">
                  <span className="active-trips-mini-route" title={`${item.origen} → ${item.destino}`}>
                    {item.origen} → {item.destino}
                  </span>
                  <span className="active-trips-mini-unit">
                    {item.vehiculo} {item.numero_economico !== "N/A" ? `(${item.numero_economico})` : ""}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </article>
  );
}


function DashboardOverview({ pendingInspections, pendingGerenciamientos, notificationError, onOpenInspections, onOpenGerenciamiento, onOpenManejoComentado }) {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");
  const [selectedTripId, setSelectedTripId] = useState(null);

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
        <button type="button" className="kpi-card inspection-notification-card" style={{ borderLeft: "4px solid #0284c7" }} onClick={onOpenGerenciamiento}>
          <span>Gerenciamientos pendientes</span>
          <strong style={{ color: "#0284c7" }}>{pendingGerenciamientos}</strong>
          <small>{pendingGerenciamientos ? "Viajes fuera de ciudad requieren aprobación" : "No hay gerenciamientos pendientes"}</small>
        </button>
      </section>

      {/* Grid de 2 Columnas para Viajes Activos y Viajes Recientes */}
      <section className="dashboard-trips-grid">
        <ActiveTripsCardWidget
          viajesActivos={summary.viajes_activos || []}
          onSelectTrip={(trip) => setSelectedTripId(trip.id_viajes)}
        />
        <RecentTripsCardWidget
          viajesRecientes={summary.viajes_recientes || []}
          onSelectTrip={(trip) => setSelectedTripId(trip.id_viajes)}
        />
      </section>

      {notificationError && <p className="module-message module-message-error">No se pudo actualizar el contador de inspecciones: {notificationError}</p>}

      {/* Disposición en columna para Ranking y Gráfico de Calor */}
      <RankingWidget
        rankingUnidades={summary.ranking_unidades}
        rankingDestinos={summary.ranking_destinos}
        rankingConductores={summary.ranking_conductores}
      />

      <ActivityHeatmapCard actividad={summary.actividad} />

      {/* Modal de Detalle de Viaje */}
      {selectedTripId && (
        <TripDetailModal
          idViaje={selectedTripId}
          onClose={() => setSelectedTripId(null)}
        />
      )}
    </section>
  );
}

function ActivityHeatmapCard({ actividad = [] }) {
  const [rangeFilter, setRangeFilter] = useState("anual");
  const [tooltip, setTooltip] = useState(null);

  const items = useMemo(() => {
    return actividad.map((item) => {
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
  }, [actividad]);

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

  // Preparamos los datos del calendario para semanal y mensual (7 columnas que ocupan el 100% del ancho)
  const calendarCells = useMemo(() => {
    if (rangeFilter === "anual") return [];

    const dateMap = new Map();
    items.forEach((it) => {
      if (it.rawStr) {
        const dStr = String(it.rawStr).match(/^\d{4}-\d{2}-\d{2}/)?.[0];
        if (dStr) dateMap.set(dStr, it.total);
      }
    });

    const now = new Date();
    const refDate = items.length > 0 && items[items.length - 1].dateObj
      ? items[items.length - 1].dateObj
      : now;

    // Día de la semana de refDate: 0 = Dom, 1 = Lun, ..., 6 = Sáb
    // Convertimos para que Lunes sea 0 y Domingo sea 6
    const refDow = (refDate.getDay() + 6) % 7;

    // Lunes de la semana de referencia
    const currentWeekMonday = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate() - refDow);

    // Semanal: 14 días (2 semanas completas Lun-Dom)
    // Mensual: 35 días (5 semanas completas Lun-Dom)
    const totalDays = rangeFilter === "semanal" ? 14 : 35;
    const offsetWeeks = rangeFilter === "semanal" ? 1 : 4;
    const startMonday = new Date(
      currentWeekMonday.getFullYear(),
      currentWeekMonday.getMonth(),
      currentWeekMonday.getDate() - (offsetWeeks * 7)
    );

    const result = [];
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    for (let i = 0; i < totalDays; i++) {
      const d = new Date(startMonday.getFullYear(), startMonday.getMonth(), startMonday.getDate() + i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      const dateKey = `${yyyy}-${mm}-${dd}`;

      const total = dateMap.get(dateKey) || 0;
      const isToday = dateKey === todayStr;
      const isFuture = d > refDate;

      result.push({
        rawStr: dateKey,
        dateObj: d,
        dayNum: d.getDate(),
        monthNum: d.getMonth(),
        isFirstOfMonth: d.getDate() === 1,
        total,
        isToday,
        isFuture
      });
    }

    return result;
  }, [items, rangeFilter]);

  // Cálculo de día inicial y placeholders para vista anual
  let startDayOfWeek = 0;
  if (rangeFilter === "anual" && filteredItems.length > 0 && filteredItems[0].dateObj) {
    startDayOfWeek = filteredItems[0].dateObj.getDay(); // 0 = Dom, 1 = Lun, ..., 6 = Sáb
  }

  // Preparamos los elementos del grid anual (con placeholders al inicio)
  const gridCells = [];
  if (rangeFilter === "anual") {
    for (let i = 0; i < startDayOfWeek; i++) {
      gridCells.push({ isPlaceholder: true });
    }
    filteredItems.forEach((item) => {
      gridCells.push({ ...item, isPlaceholder: false });
    });
  }

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
          <h2>Actividad de Viajes</h2>
          <p>
            {rangeFilter === "semanal" && "Frecuencia de viajes registrados en las últimas 2 semanas."}
            {rangeFilter === "mensual" && "Frecuencia de viajes registrados durante las últimas 5 semanas."}
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
            Semanal
          </button>
          <button
            type="button"
            className={`ranking-tab-btn ${rangeFilter === "mensual" ? "active" : ""}`}
            onClick={() => setRangeFilter("mensual")}
          >
            Mensual
          </button>
          <button
            type="button"
            className={`ranking-tab-btn ${rangeFilter === "anual" ? "active" : ""}`}
            onClick={() => setRangeFilter("anual")}
          >
            Anual
          </button>
        </div>
      </div>

      <div className="heatmap-container">
        {rangeFilter === "anual" ? (
          <div className="heatmap-anual-view">
            <div className="heatmap-days-legend">
              <span>Lun</span>
              <span>Mié</span>
              <span>Vie</span>
            </div>

            <div className="heatmap-grid-scroll">
              <div className="heatmap-month-labels">
                {getMonthLabels().map((lbl, i) => (
                  <span key={i} className="heatmap-month-label" style={{ gridColumnStart: lbl.col }}>
                    {lbl.name}
                  </span>
                ))}
              </div>

              <div className="heatmap-grid mode-anual">
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
                        const rect = e.currentTarget.getBoundingClientRect();
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
        ) : (
          <div className="heatmap-calendar-view">
            <div className="heatmap-calendar-weekdays">
              <span>Lun</span>
              <span>Mar</span>
              <span>Mié</span>
              <span>Jue</span>
              <span>Vie</span>
              <span>Sáb</span>
              <span>Dom</span>
            </div>

            <div className={`heatmap-calendar-grid mode-${rangeFilter}`}>
              {calendarCells.map((cell) => {
                const lvl = getLevel(cell.total);
                return (
                  <div
                    key={cell.rawStr}
                    className={`heatmap-calendar-cell mode-${rangeFilter} level-${lvl} ${cell.isToday ? "is-today" : ""} ${cell.isFuture ? "is-future" : ""}`}
                    onMouseEnter={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setTooltip({
                        text: `${formatTooltipDate(cell)}: ${cell.total} ${cell.total === 1 ? "viaje" : "viajes"}`,
                        x: rect.left + rect.width / 2,
                        y: rect.top - 8
                      });
                    }}
                    onMouseLeave={() => setTooltip(null)}
                  >
                    <div className="calendar-cell-header">
                      {rangeFilter === "semanal" ? (
                        <span className="calendar-cell-date">
                          {cell.dateObj.toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short" })}
                        </span>
                      ) : (
                        <span className="calendar-cell-daynum">
                          {cell.dayNum}
                          {cell.isFirstOfMonth && (
                            <span className="calendar-cell-first-month">
                              {" "}{cell.dateObj.toLocaleDateString("es-MX", { month: "short" })}
                            </span>
                          )}
                        </span>
                      )}
                      {cell.isToday ? (
                        rangeFilter === "semanal" ? (
                          <span className="calendar-cell-today-pill">Hoy</span>
                        ) : (
                          <span className="calendar-cell-today-dot" title="Hoy" />
                        )
                      ) : null}
                    </div>

                    <div className="calendar-cell-body">
                      <span className="calendar-cell-trips">
                        <strong>{cell.total}</strong>
                        <span className="calendar-cell-trips-label">
                          {rangeFilter === "semanal"
                            ? cell.total === 1 ? " viaje" : " viajes"
                            : " v."}
                        </span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {tooltip && (
        <div className="heatmap-tooltip" style={{ left: `${tooltip.x}px`, top: `${tooltip.y}px` }}>
          {tooltip.text}
        </div>
      )}

      <div className="heatmap-footer">
        <span className="heatmap-note">
          {rangeFilter === "anual"
            ? "Se muestran 365 días de actividad registrada"
            : rangeFilter === "mensual"
            ? "Visualización de las últimas 5 semanas de actividad"
            : "Visualización de las últimas 2 semanas de actividad"}
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

  const list = (isDestinos ? rankingDestinos : isConductores ? rankingConductores : rankingUnidades) || [];

  const maxVal = Math.max(
    1,
    ...list.map((item) => Number(isConductores || isUnidades ? item.total_viajes : item.total_visitas))
  );

  return (
    <section className="ranking-card">
      <div className="ranking-header">
        <div>
          <h2>Ranking de Viajes</h2>
          <p>Métricas acumuladas por vehículos más utilizados, destinos con mayor frecuencia y top conductores (viajes finalizados).</p>
        </div>

        <div className="ranking-segmented-control">
          <button
            type="button"
            className={`ranking-tab-btn ${isUnidades ? "active" : ""}`}
            onClick={() => setRankingTab("unidades")}
          >
            <span className="ranking-tab-full">Unidades más usadas</span>
            <span className="ranking-tab-short">Unidades</span>
          </button>
          <button
            type="button"
            className={`ranking-tab-btn ${isDestinos ? "active" : ""}`}
            onClick={() => setRankingTab("destinos")}
          >
            <span className="ranking-tab-full">Destinos más visitados</span>
            <span className="ranking-tab-short">Destinos</span>
          </button>
          <button
            type="button"
            className={`ranking-tab-btn ${isConductores ? "active" : ""}`}
            onClick={() => setRankingTab("conductores")}
          >
            <span className="ranking-tab-full">Top Conductores</span>
            <span className="ranking-tab-short">Conductores</span>
          </button>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="ranking-empty">
          <p>No hay suficientes registros de viajes para calcular el ranking de {isUnidades ? "unidades" : isDestinos ? "destinos" : "conductores"}.</p>
        </div>
      ) : (
        <div key={rankingTab} className="ranking-list">
          {list.map((item, index) => {
            const count = Number(isConductores || isUnidades ? item.total_viajes : item.total_visitas);
            const percentage = Math.max(8, Math.round((count / maxVal) * 100));
            const rank = index + 1;

            const rawId = isUnidades
              ? item.id_vehiculos
              : isDestinos
              ? item.id_destino
              : item.id_conductores;
            const itemKey = `${rankingTab}-${rawId ?? index}`;

            return (
              <div key={itemKey} className="ranking-row">
                <div className={`ranking-badge rank-${rank <= 3 ? rank : "other"}`}>
                  #{rank}
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
                      <span className="ranking-count-label">
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

const ROLES_SUPERVISOR_Y_SUPERIOR = ["ADMINISTRADOR", "GERENTE", "GERENTE_GENERAL", "COORDINADOR", "COORDINADOR_AREA", "COORDINADOR_QHSE", "SUPERVISOR", "QHSE", "INSTRUCTOR"];
const ROLES_TODOS = [...ROLES_SUPERVISOR_Y_SUPERIOR, "OPERADOR", "CONSULTA"];

function getInitialAdminModule(userRol) {
  const hash = window.location.hash.replace(/^#\/?/, "").split("?")[0].trim().toLowerCase();
  const validModulesSupervisor = [
    "inicio", "inspecciones", "gerenciamiento", "perfil",
    "monitoreo-activo", "analitica-combustible", "manejo-comentado",
    "conductores", "unidades", "destinos", "ubicaciones", "viajes"
  ];
  const validModulesOperador = [
    "inicio", "perfil", "monitoreo-activo", "ubicaciones", "viajes"
  ];
  const canSupervisor = ROLES_SUPERVISOR_Y_SUPERIOR.includes(userRol);
  const allowed = canSupervisor ? validModulesSupervisor : validModulesOperador;

  if (hash && allowed.includes(hash)) {
    return hash;
  }

  try {
    const saved = sessionStorage.getItem("gv_admin_active_module");
    if (saved && allowed.includes(saved)) {
      return saved;
    }
  } catch {}

  return "inicio";
}

function DashboardPage({ user, onLogout }) {
  const [activeModule, setActiveModule] = useState(() => getInitialAdminModule(user?.rol));
  const [pendingInspections, setPendingInspections] = useState(0);
  const [pendingGerenciamientos, setPendingGerenciamientos] = useState(0);
  const [notificationError, setNotificationError] = useState("");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleSelectModule = (moduleId) => {
    setActiveModule(moduleId);
    setIsMobileMenuOpen(false);
    try {
      sessionStorage.setItem("gv_admin_active_module", moduleId);
      if (moduleId === "inicio") {
        if (window.location.hash) {
          window.history.pushState(null, "", window.location.pathname + window.location.search);
        }
      } else {
        if (window.location.hash !== `#${moduleId}`) {
          window.location.hash = moduleId;
        }
      }
    } catch {}
  };

  useEffect(() => {
    // Sincronizar la URL al cargar si el módulo inicial no es 'inicio'
    if (activeModule && activeModule !== "inicio") {
      const currentHash = window.location.hash.replace(/^#\/?/, "").split("?")[0].trim().toLowerCase();
      if (currentHash !== activeModule) {
        window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#${activeModule}`);
      }
    }

    // Escuchar cambios de navegación con botones Atrás/Adelante del navegador
    const onHashChange = () => {
      const rawHash = window.location.hash.replace(/^#\/?/, "").split("?")[0].trim().toLowerCase();
      const target = rawHash || "inicio";
      const canSupervisor = ROLES_SUPERVISOR_Y_SUPERIOR.includes(user?.rol);
      const allowed = canSupervisor
        ? ["inicio", "inspecciones", "gerenciamiento", "perfil", "monitoreo-activo", "analitica-combustible", "manejo-comentado", "conductores", "unidades", "destinos", "ubicaciones", "viajes"]
        : ["inicio", "perfil", "monitoreo-activo", "ubicaciones", "viajes"];

      if (allowed.includes(target)) {
        setActiveModule(target);
        try {
          sessionStorage.setItem("gv_admin_active_module", target);
        } catch {}
      }
    };

    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [user?.rol, activeModule]);

  useEffect(() => {
    let active = true;
    const fetchPendingGerenciamientos = () => {
      fetch(`${import.meta.env.VITE_API_BASE_URL || ""}/api/gerenciamiento-viajes?estado=PENDIENTE`)
        .then((res) => res.json())
        .then((data) => {
          if (active && Array.isArray(data.data)) {
            setPendingGerenciamientos(data.data.length);
          }
        })
        .catch(() => {});
    };
    fetchPendingGerenciamientos();
    const interval = setInterval(fetchPendingGerenciamientos, 15000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const rolesSupervisorYSuperior = ROLES_SUPERVISOR_Y_SUPERIOR;
  const rolesTodos = ROLES_TODOS;

  useEffect(() => {
    if (!rolesSupervisorYSuperior.includes(user.rol)) {
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
    { id: "monitoreo-activo", label: "Monitoreo en Vivo", icon: IconRadar, roles: rolesTodos },
    { id: "analitica-combustible", label: "Analítica Combustible", icon: IconCombustible, roles: rolesSupervisorYSuperior },
    { id: "manejo-comentado", label: "Manejo Comentado", icon: IconManejoComentado, roles: rolesSupervisorYSuperior },
    { id: "conductores", label: "Conductores", icon: IconConductores, roles: rolesSupervisorYSuperior },
    { id: "unidades", label: "Unidades", icon: IconUnidades, roles: rolesSupervisorYSuperior },
    { id: "destinos", label: "Destinos", icon: IconDestinos, roles: rolesSupervisorYSuperior },
    { id: "ubicaciones", label: "Ubicaciones", icon: IconUbicaciones, roles: rolesTodos },
    { id: "viajes", label: "Viajes", icon: IconViajes, roles: rolesTodos }
  ].filter((module) => module.roles.includes(user.rol));

  const canInspect = rolesSupervisorYSuperior.includes(user.rol);


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
              <img className="sidebar-brand-logo sidebar-brand-full" src={logoGv} alt="GV MOBILITY" />
              <img className="sidebar-brand-logo sidebar-brand-isologo" src={isologoGv} alt="GV MOBILITY" />
            </div>

            {/* Botón de Menú Hamburguesa para Móviles */}
            <button
              type="button"
              className="mobile-menu-btn"
              onClick={() => setIsMobileMenuOpen((prev) => !prev)}
              aria-label="Abrir menú de navegación"
            >
              {isMobileMenuOpen ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              )}
              {(pendingInspections > 0 || pendingGerenciamientos > 0) && !isMobileMenuOpen && (
                <span className="mobile-badge-dot">{pendingInspections + pendingGerenciamientos}</span>
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
                title="Inspecciones y Gerenciamiento"
                className={`notification-button ${activeModule === "inspecciones" ? "sidebar-active" : ""}`}
                onClick={() => handleSelectModule("inspecciones")}
              >
                <span className="nav-icon"><IconInspecciones size={20} /></span>
                <span className="sidebar-text">Inspecciones y Gerenciamiento</span>
                {(pendingInspections + pendingGerenciamientos) > 0 && <strong>{pendingInspections + pendingGerenciamientos}</strong>}
              </button>
            )}

            {modules.map((module) => {
              const IconComponent = module.icon;
              const isGerenciamiento = module.id === "gerenciamiento";
              return (
                <button
                  key={module.id}
                  type="button"
                  title={module.label}
                  className={`${isGerenciamiento ? "notification-button" : ""} ${activeModule === module.id ? "sidebar-active" : ""}`}
                  onClick={() => handleSelectModule(module.id)}
                >
                  <span className="nav-icon"><IconComponent size={20} /></span>
                  <span className="sidebar-text">{module.label}</span>
                  {isGerenciamiento && pendingGerenciamientos > 0 && <strong style={{ background: "#0284c7" }}>{pendingGerenciamientos}</strong>}
                </button>
              );
            })}

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
                onClick={() => handleSelectModule("perfil")}
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
                pendingGerenciamientos={pendingGerenciamientos}
                notificationError={notificationError}
                onOpenInspections={() => handleSelectModule("inspecciones")}
                onOpenGerenciamiento={() => handleSelectModule("gerenciamiento")}
                onOpenManejoComentado={() => handleSelectModule("manejo-comentado")}
              />
            )}
            {user.rol === "OPERADOR" && (
              <p className="table-status">Consulta tus viajes y ubicaciones desde el menú lateral.</p>
            )}
          </>
        )}

        {activeModule === "monitoreo-activo" && <MonitoreoActivoPage />}
        {activeModule === "analitica-combustible" && <AnaliticaCombustiblePage />}
        {activeModule === "manejo-comentado" && <ManejoComentadoPage user={user} />}
        {activeModule === "conductores" && <ConductoresPage user={user} />}
        {activeModule === "unidades" && <VehiculosPage user={user} />}
        {activeModule === "destinos" && <DestinosPage user={user} />}
        {activeModule === "ubicaciones" && <UbicacionesPage />}
        {activeModule === "viajes" && <ViajesPage user={user} />}
        {activeModule === "gerenciamiento" && <GerenciamientoAdminPage user={user} />}
        {activeModule === "inspecciones" && <InspeccionesPage onPendingChange={setPendingInspections} />}
        {activeModule === "perfil" && <PerfilPage user={user} onUpdated={() => window.location.reload()} />}

        {modules
          .filter(
            (module) =>
              module.id !== "monitoreo-activo" &&
              module.id !== "analitica-combustible" &&
              module.id !== "manejo-comentado" &&
              module.id !== "conductores" &&
              module.id !== "unidades" &&
              module.id !== "destinos" &&
              module.id !== "ubicaciones" &&
              module.id !== "viajes" &&
              module.id !== "gerenciamiento"
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
