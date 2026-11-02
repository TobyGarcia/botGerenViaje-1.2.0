import { useState } from 'react';
import frontal from '../assets/inspection-diagrams/remolque_frontal.png';
import derecha from '../assets/inspection-diagrams/remolque_derecha.png';
import trasera from '../assets/inspection-diagrams/remolque_trasera.png';
import izquierdo from '../assets/inspection-diagrams/remolque_izquierdo.png';
import { trailerChecklistGroups } from '../utils/trailer-checklist-groups.js';

const views = [['frontal','Frontal',frontal],['derecha','Lateral derecho',derecha],['trasera','Trasera',trasera],['izquierda','Lateral izquierdo',izquierdo]];
export default function TrailerInspectionContent({ data = {}, renderChecklist }) {
  const [section, setSection] = useState('images');
  const [view, setView] = useState('frontal');
  let value = data?.data || data?.inspeccion_remolque || data || {};
  if (typeof value === 'string') { try { value = JSON.parse(value); } catch { value = {}; } }
  const damages = value.danos || {};
  const [key,label,image] = views.find(v => v[0] === view);
  const points = Array.isArray(damages[key]) ? damages[key] : [];
  const count = Object.values(damages).reduce((sum, p) => sum + (Array.isArray(p) ? p.length : 0), 0);
  return <div className="trailer-review">
    <nav className="trailer-review-nav" aria-label="Secciones de la inspección del remolque">
      {[['images',`Vistas y daños (${count})`],['checklist',`Checklist (${Object.keys(value.checklist || {}).length})`],['notes','Observaciones']].map(([id,text]) => <button type="button" key={id} aria-pressed={section === id} onClick={() => setSection(id)}>{text}</button>)}
    </nav>
    {section === 'images' && <section aria-label="Diagramas del remolque">
      <div className="trailer-view-options">{views.map(([id,title,src]) => <button type="button" key={id} aria-pressed={view === id} onClick={() => setView(id)}><img src={src} alt="" /><span>{title}</span></button>)}</div>
      <div className="trailer-view-title"><strong>{label}</strong><span>{points.length ? `${points.length} daños marcados` : 'Sin daños marcados en esta vista'}</span></div>
      <div className="trailer-diagram"><img src={image} alt={`Diagrama del remolque: ${label}`} />{points.filter(p => Number.isFinite(p.x) && Number.isFinite(p.y)).map((p,index) => <span className="trailer-damage-point" key={index} style={{left:`${p.x}%`,top:`${p.y}%`}} aria-label={`Daño ${index+1}`} title={`Daño ${index+1}`}>{index+1}</span>)}</div>
      <p className="trailer-review-hint">Selecciona una vista para revisar sus marcas. Los círculos rojos indican daños registrados.</p>
    </section>}
    {section === 'checklist' && renderChecklist(value.checklist || {}, trailerChecklistGroups)}
    {section === 'notes' && <section className="trailer-review-notes"><h4>Observaciones de esta captura</h4><p>{value.observaciones || 'Sin observaciones registradas.'}</p></section>}
  </div>;
}
