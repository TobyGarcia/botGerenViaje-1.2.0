import { useEffect, useState } from "react";
import { getAdminAnaliticaCombustible, getAdminVehiculos } from "../services/api.js";
import { IconCombustible } from "../components/Icons.jsx";

const FUEL_BADGE_CLASS = {
  F: "good",
  "3/4": "good",
  "1/2": "regular",
  "1/4": "bad",
  E: "bad"
};

function formatKm(val) {
  if (val === null || val === undefined) return "N/R";
  return `${Number(val).toLocaleString("es-MX")} km`;
}

function formatDate(isoStr) {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return String(isoStr);
  return d.toLocaleDateString("es-MX", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function FuelOnlyChart({ lecturas = [] }) {
  const [hoveredPoint, setHoveredPoint] = useState(null);

  if (!lecturas || lecturas.length === 0) {
    return (
      <div className="chart-empty-state">
        <p>No hay suficientes lecturas de inspección en el período seleccionado para generar la gráfica de combustible.</p>
      </div>
    );
  }

  const width = 800;
  const height = 240;
  const padding = { top: 30, right: 40, bottom: 40, left: 75 };

  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  const points = lecturas.map((item, index) => {
    const x = padding.left + (index / Math.max(1, lecturas.length - 1)) * innerWidth;
    const yFuel = padding.top + innerHeight - (item.combustible_porcentaje / 100) * innerHeight;
    return { x, yFuel, item, index };
  });

  const fuelPath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.yFuel}`).join(" ");
  const areaPath = `${fuelPath} L ${points[points.length - 1].x} ${padding.top + innerHeight} L ${points[0].x} ${padding.top + innerHeight} Z`;

  return (
    <div className="analytics-chart-container">
      <div className="chart-header-legend">
        <div className="legend-item fuel-legend">
          <span className="legend-dot" style={{ backgroundColor: "#2563eb" }} />
          <strong>Nivel de Tanque Inicial (%)</strong>
        </div>
      </div>

      <div className="svg-responsive-wrapper">
        <svg viewBox={`0 0 ${width} ${height}`} className="analytics-svg-chart">
          <defs>
            <linearGradient id="fuelGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2563eb" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#2563eb" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {[
            { label: "100% (F)", pct: 100 },
            { label: "75% (3/4)", pct: 75 },
            { label: "50% (1/2)", pct: 50 },
            { label: "25% (1/4)", pct: 25 },
            { label: "0% (E)", pct: 0 }
          ].map(({ label, pct }) => {
            const y = padding.top + innerHeight - (pct / 100) * innerHeight;
            return (
              <g key={pct} className="grid-group">
                <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="#e2e8f0" strokeDasharray="4 4" />
                <text x={padding.left - 10} y={y + 4} textAnchor="end" fontSize="11" fill="#64748b" fontWeight="500">
                  {label}
                </text>
              </g>
            );
          })}

          <path d={areaPath} fill="url(#fuelGradient)" />
          <path d={fuelPath} fill="none" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

          {points.map((p) => (
            <g key={`fuel-${p.index}`}>
              <circle
                cx={p.x}
                cy={p.yFuel}
                r={hoveredPoint?.index === p.index ? "7" : "5"}
                fill="#2563eb"
                stroke="#ffffff"
                strokeWidth="2"
                style={{ cursor: "pointer", transition: "all 0.2s ease" }}
                onMouseEnter={() => setHoveredPoint(p)}
                onMouseLeave={() => setHoveredPoint(null)}
              />
            </g>
          ))}
        </svg>

        {hoveredPoint && (
          <div
            className="chart-tooltip"
            style={{
              left: `${(hoveredPoint.x / width) * 100}%`,
              top: `${(hoveredPoint.yFuel / height) * 100}%`
            }}
          >
            <strong>{hoveredPoint.item.vehiculo}</strong>
            <div>Folio: {hoveredPoint.item.folio}</div>
            <div>Fecha: {formatDate(hoveredPoint.item.fecha_operativa)}</div>
            <div>Conductor: {hoveredPoint.item.conductor}</div>
            <div style={{ color: "#38bdf8", marginTop: "4px", fontWeight: "bold" }}>
              Nivel Combustible: {hoveredPoint.item.combustible} ({hoveredPoint.item.combustible_porcentaje}%)
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function KilometrajeOnlyChart({ lecturas = [] }) {
  const [hoveredPoint, setHoveredPoint] = useState(null);

  if (!lecturas || lecturas.length === 0) {
    return (
      <div className="chart-empty-state">
        <p>No hay suficientes lecturas de inspección en el período seleccionado para generar la gráfica de kilometraje.</p>
      </div>
    );
  }

  const width = 800;
  const height = 240;
  const padding = { top: 30, right: 40, bottom: 40, left: 85 };

  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  const kmValues = lecturas.map((l) => l.kilometraje_inicial);
  const minKm = Math.min(...kmValues);
  const maxKm = Math.max(...kmValues);
  const rangeKm = maxKm - minKm || 1;

  const steps = 4;
  const gridTicks = Array.from({ length: steps + 1 }).map((_, i) => {
    const val = Math.round(minKm + (rangeKm * (steps - i)) / steps);
    const y = padding.top + (i / steps) * innerHeight;
    return { val, y };
  });

  const points = lecturas.map((item, index) => {
    const x = padding.left + (index / Math.max(1, lecturas.length - 1)) * innerWidth;
    const yKm = padding.top + innerHeight - ((item.kilometraje_inicial - minKm) / rangeKm) * innerHeight;
    return { x, yKm, item, index };
  });

  const kmPath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.yKm}`).join(" ");
  const areaPath = `${kmPath} L ${points[points.length - 1].x} ${padding.top + innerHeight} L ${points[0].x} ${padding.top + innerHeight} Z`;

  return (
    <div className="analytics-chart-container">
      <div className="chart-header-legend">
        <div className="legend-item km-legend">
          <span className="legend-dot" style={{ backgroundColor: "#059669" }} />
          <strong>Kilometraje Acumulado (Km)</strong>
        </div>
      </div>

      <div className="svg-responsive-wrapper">
        <svg viewBox={`0 0 ${width} ${height}`} className="analytics-svg-chart">
          <defs>
            <linearGradient id="kmGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#059669" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#059669" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {gridTicks.map(({ val, y }, idx) => (
            <g key={idx} className="grid-group">
              <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="#e2e8f0" strokeDasharray="4 4" />
              <text x={padding.left - 10} y={y + 4} textAnchor="end" fontSize="11" fill="#64748b" fontWeight="500">
                {val.toLocaleString("es-MX")} km
              </text>
            </g>
          ))}

          <path d={areaPath} fill="url(#kmGradient)" />
          <path d={kmPath} fill="none" stroke="#059669" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

          {points.map((p) => (
            <g key={`km-${p.index}`}>
              <circle
                cx={p.x}
                cy={p.yKm}
                r={hoveredPoint?.index === p.index ? "7" : "5"}
                fill="#059669"
                stroke="#ffffff"
                strokeWidth="2"
                style={{ cursor: "pointer", transition: "all 0.2s ease" }}
                onMouseEnter={() => setHoveredPoint(p)}
                onMouseLeave={() => setHoveredPoint(null)}
              />
            </g>
          ))}
        </svg>

        {hoveredPoint && (
          <div
            className="chart-tooltip"
            style={{
              left: `${(hoveredPoint.x / width) * 100}%`,
              top: `${(hoveredPoint.yKm / height) * 100}%`
            }}
          >
            <strong>{hoveredPoint.item.vehiculo}</strong>
            <div>Folio: {hoveredPoint.item.folio}</div>
            <div>Fecha: {formatDate(hoveredPoint.item.fecha_operativa)}</div>
            <div>Conductor: {hoveredPoint.item.conductor}</div>
            <div style={{ color: "#34d399", marginTop: "4px", fontWeight: "bold" }}>
              Kilometraje: {hoveredPoint.item.kilometraje_inicial.toLocaleString("es-MX")} km
            </div>
            {hoveredPoint.item.kilometros_recorridos > 0 && (
              <div style={{ color: "#e2e8f0" }}>
                KM Recorridos en viaje: +{hoveredPoint.item.kilometros_recorridos} km
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AnaliticaCombustiblePage() {
  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicle, setSelectedVehicle] = useState("");
  const [presetFilter, setPresetFilter] = useState("30d");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getAdminVehiculos({ status: "ACTIVO" })
      .then((res) => setVehicles(res.data || []))
      .catch(() => setVehicles([]));
  }, []);

  useEffect(() => {
    if (presetFilter === "all") {
      setDateFrom("");
      setDateTo("");
      return;
    }

    const now = new Date();
    const toStr = now.toISOString().split("T")[0];
    let daysAgo = 30;

    if (presetFilter === "7d") daysAgo = 7;
    if (presetFilter === "90d") daysAgo = 90;

    const fromDate = new Date(now.setDate(now.getDate() - daysAgo));
    const fromStr = fromDate.toISOString().split("T")[0];

    setDateFrom(fromStr);
    setDateTo(toStr);
  }, [presetFilter]);

  const fetchAnalytics = () => {
    setLoading(true);
    setError("");

    getAdminAnaliticaCombustible({
      idVehiculo: selectedVehicle || null,
      dateFrom: dateFrom || null,
      dateTo: dateTo || null
    })
      .then((res) => {
        setData(res.data);
      })
      .catch((err) => {
        setError(err.message || "Error al cargar la analítica de combustible.");
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchAnalytics();
  }, [selectedVehicle, dateFrom, dateTo]);

  const kpis = data?.kpis || {
    total_inspecciones: 0,
    total_km_monitoreados: 0,
    promedio_combustible_inicial: 0,
    total_vehiculos_analizados: 0
  };

  return (
    <section className="module-page analytics-page">
      <header className="module-header">
        <div>
          <span className="module-label">Desempeño Operativo</span>
          <h1>
            <IconCombustible size={24} style={{ verticalAlign: "middle", marginRight: "8px" }} />
            Analítica de Combustible y Kilometraje
          </h1>
          <p>
            Medición de consumo y nivel de combustible inicial tomado de las inspecciones vehiculares cruzado con el historial de kilometraje.
          </p>
        </div>
      </header>

      {/* Panel de Filtros */}
      <section className="analytics-filter-card">
        <div className="filter-group">
          <label htmlFor="select-vehiculo">Unidad Vehicular</label>
          <select
            id="select-vehiculo"
            value={selectedVehicle}
            onChange={(e) => setSelectedVehicle(e.target.value)}
          >
            <option value="">Todas las unidades activas</option>
            {vehicles.map((v) => (
              <option key={v.id_vehiculos} value={v.id_vehiculos}>
                {v.nombre} ({v.numero_economico}) - {v.placas}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>Período Rápido</label>
          <div className="ranking-segmented-control">
            <button
              type="button"
              className={`ranking-tab-btn ${presetFilter === "7d" ? "active" : ""}`}
              onClick={() => setPresetFilter("7d")}
            >
              7 Días
            </button>
            <button
              type="button"
              className={`ranking-tab-btn ${presetFilter === "30d" ? "active" : ""}`}
              onClick={() => setPresetFilter("30d")}
            >
              30 Días
            </button>
            <button
              type="button"
              className={`ranking-tab-btn ${presetFilter === "90d" ? "active" : ""}`}
              onClick={() => setPresetFilter("90d")}
            >
              90 Días
            </button>
            <button
              type="button"
              className={`ranking-tab-btn ${presetFilter === "all" ? "active" : ""}`}
              onClick={() => setPresetFilter("all")}
            >
              Histórico Completo
            </button>
          </div>
        </div>

        <div className="filter-group date-range-group">
          <div>
            <label htmlFor="date-from">Desde</label>
            <input
              id="date-from"
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setPresetFilter("custom");
                setDateFrom(e.target.value);
              }}
            />
          </div>
          <div>
            <label htmlFor="date-to">Hasta</label>
            <input
              id="date-to"
              type="date"
              value={dateTo}
              onChange={(e) => {
                setPresetFilter("custom");
                setDateTo(e.target.value);
              }}
            />
          </div>
        </div>
      </section>

      {error && <p className="module-message module-message-error">{error}</p>}

      {/* Tarjetas KPI */}
      <section className="kpi-grid">
        <article className="kpi-card">
          <span>Total Inspecciones Analizadas</span>
          <strong>{kpis.total_inspecciones}</strong>
          <small>Lecturas iniciales en el período</small>
        </article>

        <article className="kpi-card">
          <span>Distancia Monitoreada</span>
          <strong>{kpis.total_km_monitoreados.toLocaleString("es-MX")} km</strong>
          <small>Kilómetros recorridos asociados</small>
        </article>

        <article className="kpi-card">
          <span>Nivel Promedio Tanque Inicial</span>
          <strong style={{ color: kpis.promedio_combustible_inicial < 30 ? "#dc2626" : "#2563eb" }}>
            {kpis.promedio_combustible_inicial}%
          </strong>
          <div className="fuel-level-progress-bar">
            <div
              className="fuel-level-progress-fill"
              style={{
                width: `${kpis.promedio_combustible_inicial}%`,
                backgroundColor: kpis.promedio_combustible_inicial < 30 ? "#dc2626" : "#2563eb"
              }}
            />
          </div>
        </article>

        <article className="kpi-card">
          <span>Unidades Monitoreadas</span>
          <strong>{kpis.total_vehiculos_analizados}</strong>
          <small>Vehículos con registros de inspección</small>
        </article>
      </section>

      {/* Gráfica 1: Nivel de Combustible */}
      <section className="ranking-card analytics-chart-card">
        <div className="ranking-header">
          <div>
            <h2>⛽ Gráfica 1: Nivel de Combustible Inicial (%)</h2>
            <p>Variación cronológica del nivel de combustible reportado en las inspecciones al iniciar viajes.</p>
          </div>
        </div>

        {loading ? (
          <p className="table-status">Cargando gráfico de combustible...</p>
        ) : (
          <FuelOnlyChart lecturas={data?.lecturas_lineales || []} />
        )}
      </section>

      {/* Gráfica 2: Kilometraje Acumulado */}
      <section className="ranking-card analytics-chart-card">
        <div className="ranking-header">
          <div>
            <h2>🛣️ Gráfica 2: Évolución del Kilometraje (Km)</h2>
            <p>Comportamiento cronológico de la lectura del odiómetro e incremento del kilometraje acumulado.</p>
          </div>
        </div>

        {loading ? (
          <p className="table-status">Cargando gráfico de kilometraje...</p>
        ) : (
          <KilometrajeOnlyChart lecturas={data?.lecturas_lineales || []} />
        )}
      </section>

      {/* Resumen por Unidad Vehicular */}
      {data?.vehiculos && data.vehiculos.length > 0 && (
        <section className="ranking-card">
          <div className="ranking-header">
            <div>
              <h2>🚚 Desempeño Consolidado por Unidad</h2>
              <p>Resumen de inspecciones, kilometraje acumulado y rendimiento por vehículo.</p>
            </div>
          </div>

          <div className="table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Vehículo</th>
                  <th>Económico</th>
                  <th>Placas</th>
                  <th style={{ textAlign: "center" }}>Inspecciones</th>
                  <th style={{ textAlign: "right" }}>KM Recorridos</th>
                  <th style={{ textAlign: "center" }}>Est. Rendimiento (KM / % tanque)</th>
                </tr>
              </thead>
              <tbody>
                {data.vehiculos.map((veh) => (
                  <tr key={veh.id_vehiculos}>
                    <td>
                      <strong>{veh.vehiculo_nombre}</strong>
                      <small style={{ display: "block", color: "#64748b" }}>{veh.marca} {veh.modelo}</small>
                    </td>
                    <td><strong>{veh.numero_economico}</strong></td>
                    <td>{veh.placas}</td>
                    <td style={{ textAlign: "center" }}>{veh.total_lecturas}</td>
                    <td style={{ textAlign: "right" }}><strong>{formatKm(veh.km_total_monitoreado)}</strong></td>
                    <td style={{ textAlign: "center" }}>
                      {veh.km_por_porcentaje_promedio !== null ? (
                        <span className="checklist-badge checklist-badge-good">
                          ~{veh.km_por_porcentaje_promedio} km / 1%
                        </span>
                      ) : (
                        <span className="checklist-badge checklist-badge-na">En recopilación</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Tabla Detallada de Lecturas */}
      <section className="ranking-card">
        <div className="ranking-header">
          <div>
            <h2>📋 Registro Detallado de Inspecciones y Kilometraje</h2>
            <p>Historial individual de viajes, lecturas de odiómetro y nivel de combustible reportado.</p>
          </div>
        </div>

        {loading ? (
          <p className="table-status">Cargando registros de lecturas...</p>
        ) : !data?.lecturas_lineales || data.lecturas_lineales.length === 0 ? (
          <div className="ranking-empty">
            <p>No se encontraron registros de inspecciones vehiculares para el período seleccionado.</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Folio Viaje</th>
                  <th>Fecha Operativa</th>
                  <th>Vehículo</th>
                  <th>Conductor</th>
                  <th style={{ textAlign: "center" }}>Combustible Inicial</th>
                  <th style={{ textAlign: "right" }}>KM Inicial</th>
                  <th style={{ textAlign: "right" }}>KM Recorridos</th>
                  <th style={{ textAlign: "center" }}>Estado Viaje</th>
                </tr>
              </thead>
              <tbody>
                {data.lecturas_lineales.map((item) => {
                  const badgeClass = FUEL_BADGE_CLASS[item.combustible] || "na";
                  return (
                    <tr key={`${item.id_inspeccion}-${item.id_viajes}`}>
                      <td><strong>{item.folio}</strong></td>
                      <td>{formatDate(item.fecha_operativa)}</td>
                      <td>{item.vehiculo}</td>
                      <td>{item.conductor}</td>
                      <td style={{ textAlign: "center" }}>
                        <span className={`checklist-badge checklist-badge-${badgeClass}`}>
                          {item.combustible} ({item.combustible_porcentaje}%)
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>{formatKm(item.kilometraje_inicial)}</td>
                      <td style={{ textAlign: "right" }}>
                        <strong>{formatKm(item.kilometros_recorridos)}</strong>
                      </td>
                      <td style={{ textAlign: "center" }}>{item.estado_viaje}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}
