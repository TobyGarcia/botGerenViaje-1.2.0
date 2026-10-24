import { useEffect, useState } from "react";
import { getAuditLogs, getAuditIssues } from "../services/api.js";
import "./AuditoriaPage.css";

const empty = { folio: "", actorId: "", level: "", from: "", to: "", requestId: "" };
const date = value => new Intl.DateTimeFormat("es-MX", {
  timeZone: "America/Mexico_City", dateStyle: "short", timeStyle: "medium"
}).format(new Date(value));
const actorTypeLabel = { ADMIN: "Administrador", CONDUCTOR: "Conductor" };
function AuditActor({ row }) {
  if (row.actor_tipo === "ANONIMO") return <div className="audit-actor">
    <strong>No identificado</strong><small>Sesión ausente o inválida</small>
  </div>;
  const type = actorTypeLabel[row.actor_tipo] || row.actor_tipo;
  const name = row.actor_nombre;
  return <div className="audit-actor">
    <strong>{name || `${type} no disponible`}</strong>
    <small>{type}{row.actor_id ? ` · ID ${row.actor_id}` : ""}</small>
  </div>;
}

export default function AuditoriaPage() {
  const [draft, setDraft] = useState(empty);
  const [filters, setFilters] = useState(empty);
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [data, setData] = useState({ rows: [], total: 0 });
  const [issues, setIssues] = useState([]);
  const [notifications, setNotifications] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    let stale = false;
    setLoading(true); setError("");
    const query = { ...filters, page, limit: 30 };
    if (query.from) query.from = new Date(query.from + ":00-06:00").toISOString();
    if (query.to) query.to = new Date(query.to + ":00-06:00").toISOString();
    Promise.all([getAuditLogs(query), getAuditIssues()]).then(([logs, summary]) => {
      if (!stale) { setData(logs.data); setIssues(summary.data); setNotifications(summary.notifications?.enabled === true); }
    }).catch(() => {
      if (!stale) { setData({ rows: [], total: 0 }); setIssues([]); setError("No se pudo cargar la auditoría. Reintenta la consulta."); }
    }).finally(() => { if (!stale) setLoading(false); });
    return () => { stale = true; };
  }, [filters, page, refresh]);
  const trace = requestId => {
    const next = { ...empty, requestId };
    setDraft(next); setFilters(next); setPage(1);
  };
  return <section className="module-page audit-page">
    <header className="module-header"><div><h1>Auditoría y errores</h1>
      <p>Horarios de Ciudad de México. Los reportes del dispositivo se identifican como no verificados.</p>
    </div></header>
    <details className="audit-issues" open><summary>Errores agrupados · últimas 24 horas ({issues.length})</summary>
      <p>El conteo corresponde a eventos; una misma falla puede aparecer en varios pasos.</p>
      {!loading && !error && <p>{notifications ? 'Envío a Telegram habilitado por temas. La configuración activa no garantiza la entrega de cada aviso.' : 'Envíos a Telegram desactivados.'}</p>}
      {!loading && !error && issues.length === 0 && <p>Sin errores registrados en este periodo.</p>}
      {issues.map((issue, i) => <button type="button" key={i} onClick={() => trace(issue.request_id)}>
        {issue.paso || issue.evento} · {issue.codigo_error || "HTTP"} · {issue.cantidad} eventos · {date(issue.ultima_vez)}
      </button>)}
    </details>
    <form className="audit-filters" onSubmit={e => { e.preventDefault(); setPage(1); setFilters({ ...draft }); }}>
      <label>Folio<input value={draft.folio} onChange={e => setDraft({ ...draft, folio: e.target.value })} placeholder="VJ-20261009-0001" /></label>
      <label>ID de conductor<input type="number" min="1" value={draft.actorId} onChange={e => setDraft({ ...draft, actorId: e.target.value, actorType: e.target.value ? "CONDUCTOR" : "" })} /></label>
      <label>Nivel<select value={draft.level} onChange={e => setDraft({ ...draft, level: e.target.value })}>
        <option value="">Todos</option><option>INFO</option><option>WARN</option><option>ERROR</option>
      </select></label>
      <label>Desde<input type="datetime-local" value={draft.from} onChange={e => setDraft({ ...draft, from: e.target.value })} /></label>
      <label>Hasta<input type="datetime-local" value={draft.to} onChange={e => setDraft({ ...draft, to: e.target.value })} /></label>
      <label>Operación<input value={draft.requestId} onChange={e => setDraft({ ...draft, requestId: e.target.value })} /></label>
      <button disabled={loading}>Buscar</button>
      <button type="button" onClick={() => { setDraft(empty); setFilters(empty); setPage(1); }}>Limpiar</button>
      <button type="button" disabled={loading} onClick={() => setRefresh(n => n + 1)}>Actualizar</button>
    </form>
    {error && <p role="alert">{error}</p>}
    {loading && <p role="status">Cargando auditoría…</p>}
    <div className="audit-table-wrap"><table><thead><tr>
      <th>Fecha</th><th>Nivel</th><th>Paso / resultado</th><th>Actor / viaje</th><th>Detalle</th>
    </tr></thead><tbody>
      {data.rows.map(row => <tr key={row.id_bitacora}>
        <td>{date(row.fecha)}</td><td><strong className={"audit-" + row.nivel}>{row.nivel}</strong></td>
        <td>{row.paso || row.evento}<br />{row.resultado}<br /><small>{row.codigo_error}</small></td>
        <td><AuditActor row={row} />Viaje: {row.id_viaje || "—"}</td>
        <td><button type="button" onClick={() => trace(row.request_id)}>Ver operación</button>
          <details><summary>Datos del evento</summary>
            <p>Operación: {row.request_id}<br />Ruta: {row.ruta}<br />HTTP: {row.status_http}<br />
              Duración: {row.duracion_ms} ms<br />Versión: {row.version_app || "Anterior"}</p>
            <pre>{JSON.stringify(row.detalles, null, 2)}</pre>
          </details>
        </td>
      </tr>)}
    </tbody></table></div>
    {!loading && !data.rows.length && !error && <p>No hay eventos con estos filtros.</p>}
    <footer className="audit-pagination"><button disabled={loading || page <= 1} onClick={() => setPage(n => n - 1)}>Anterior</button>
      <span>Página {page} · {data.total} eventos</span>
      <button disabled={loading || page * 30 >= data.total} onClick={() => setPage(n => n + 1)}>Siguiente</button>
    </footer>
  </section>;
}
