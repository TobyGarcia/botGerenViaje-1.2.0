import TrailerInspectionContent from './TrailerInspectionContent.jsx';
import { IconCheck, IconAlerta, IconCross } from './Icons.jsx';
import '../pages/TrailerInspectionCards.css';

function renderChecklist(checklist = {}, groups = {}) {
  const entries = Object.entries(checklist);
  const categories = Object.entries(groups).map(([name,keys]) => [name,keys.filter(k => k in checklist).map(k => [k,checklist[k]])]).filter(([,items]) => items.length);
  const known = new Set(Object.values(groups).flat());
  const other = entries.filter(([k]) => !known.has(k));
  if (other.length) categories.push(['Otros elementos',other]);
  const states = [['B','good','Buen estado',IconCheck],['R','regular','Regular',IconAlerta],['M','bad','Mal estado',IconCross],['N/A','na','N/A',null]];
  return <div className="enhanced-checklist-section"><div className="checklist-summary-bar"><div className="checklist-summary-total"><strong>{entries.length}</strong> puntos verificados</div><div className="checklist-summary-tags">{states.map(([state,css,label,Icon]) => {
    const count = entries.filter(([,v]) => v === state || (state === 'N/A' && v === 'NA')).length;
    return count ? <span key={state} className={`summary-pill summary-pill-${css}`}>{Icon && <Icon size={13} />}{count} {label}</span> : null;
  })}</div></div><div className="checklist-cards-grid">{categories.map(([name,items]) => <div className="checklist-card" key={name}><div className="checklist-card-header"><span className="checklist-card-title">{name}</span><span className="checklist-card-count">{items.length} elementos</span></div><div className="checklist-card-body">{items.map(([name,value]) => <div className="checklist-item-row" key={name}><span className="checklist-item-name">{name}</span><span className={`checklist-badge checklist-badge-${value === 'B' ? 'good' : value === 'R' ? 'regular' : value === 'M' ? 'bad' : 'na'}`}>{value === 'B' ? 'BUENO' : value === 'R' ? 'REGULAR' : value === 'M' ? 'MALO' : 'N/A'}</span></div>)}</div></div>)}</div></div>;
}

export default function TrailerInspectionCards({ items = [] }) {
  if (!items.length) return null;
  const date = value => value ? new Date(value).toLocaleString('es-MX') : 'Continúa enganchado';
  return <section className="trailer-inspections-section"><h3>Inspecciones de remolques</h3><p>Una inspección independiente por cada enganche.</p>{items.map(item => <details className="trailer-inspection-card" key={item.id}><summary><strong>{item.name}</strong><span>Enganche #{item.id} · {item.removed_at ? 'Desenganchado' : 'Enganchado'}</span></summary><div className="trailer-inspection-body"><dl className="trailer-inspection-meta"><div><dt>Enganche</dt><dd>{date(item.added_at)}</dd></div><div><dt>Desenganche</dt><dd>{date(item.removed_at)}</dd></div></dl><TrailerInspectionContent data={item.inspection} renderChecklist={renderChecklist} /></div></details>)}</section>;
}
