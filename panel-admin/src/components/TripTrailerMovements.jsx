import './TripTrailerMovements.css';

export default function TripTrailerMovements({ items = [] }) {
  if (!items.length) return null;
  const time = value => value ? new Date(value).toLocaleString('es-MX', { timeZone: 'America/Mexico_City', day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'Pendiente';
  return <section className="trip-trailer-movements" aria-label="Movimientos de remolques">
    <h3>Remolques</h3>
    {items.map(item => <article key={item.id} className="trip-trailer-movement"><span className="trip-trailer-label">Remolque</span><strong>{item.name}</strong><dl><div><dt>Hora de enganche</dt><dd>{time(item.added_at)}</dd></div><div><dt>Hora de desenganche</dt><dd>{time(item.removed_at)}</dd></div></dl></article>)}
  </section>;
}
