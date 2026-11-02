import { useEffect, useState } from 'react';
import { Geolocation } from '@capacitor/geolocation';
import { getTripItems, recordTripOperation, getVehiculos } from '../services/api.js';
import { isTrailer } from '../utils/vehicle-kind.js';
import InspeccionRemolqueModal from './InspeccionRemolqueModal.jsx';
import './TripOperations.css';
import { resolveOfflineTripId } from '../services/offline-trip-storage.js';
import { resolveOperationTripId } from '../utils/trip-operation-id.js';

export default function TripOperations({ tripId }) {
  const serverId = () => resolveOperationTripId(tripId, resolveOfflineTripId);
  const [items, setItems] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [name, setName] = useState('');
  const [trailer, setTrailer] = useState('');
  const [inspection, setInspection] = useState(null);
  const [showInspection, setShowInspection] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [warningConfirmed, setWarningConfirmed] = useState(false);
  const [pending, setPending] = useState(null);
  const refresh = async () => {
    const id = serverId();
    if (!id) { setLoaded(false); setError('El viaje está guardado en el teléfono. Sincronízalo para gestionar acompañantes y remolques.'); return; }
    const r = await getTripItems(id); setItems(r.data || []); setLoaded(true); setError('');
  };
  useEffect(() => {
    setLoaded(false);
    refresh().catch(e => setError(e.message));
    getVehiculos().then(r => setVehicles(r.data || [])).catch(e => setError(e.message));
  }, [tripId]);
  async function selectTrailer(id) {
    setTrailer(id); setInspection(null); setWarningConfirmed(false); setError('');
    if (id) setShowInspection(true);
  }
  async function submit(payload) {
    setBusy(true); setError('');
    let operation = pending;
    try {
      if (!operation) {
        const location = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
        operation = { ...payload, eventKey: crypto.randomUUID(), latitude: location.coords.latitude, longitude: location.coords.longitude };
        setPending(operation);
      }
      const resolved = serverId();
      if (!resolved) throw new Error('Sincroniza el viaje antes de registrar el movimiento.');
      await recordTripOperation(resolved, operation);
      setPending(null); setName(''); setTrailer(''); setInspection(null); setWarningConfirmed(false);
      await refresh();
    } catch (e) { setError(e.message || 'No se pudo registrar. Comprueba conexión y permiso de ubicación.'); }
    finally { setBusy(false); }
  }
  const disabled = busy || !loaded || Boolean(pending);
  const names = name.split(/\r?\n/).map(value => value.trim()).filter(Boolean);
  return <section className="gv-trip-operations">
    <header className="trip-ops-heading"><div><span className="trip-ops-eyebrow">DURANTE EL VIAJE</span><h3>Acompañantes y remolques</h3></div><span className="trip-ops-count">{items.filter(i => !i.removed_at).length} activos</span></header>
    {error && <p role="alert">{error}</p>}
    {pending && <button type="button" disabled={busy} onClick={() => submit(pending)}>Reintentar registro pendiente</button>}
    {!loaded && !busy && <button type="button" onClick={() => refresh().catch(e => setError(e.message))}>Cargar elementos</button>}
    {loaded && !items.some(i => !i.removed_at) && <p className="trip-ops-empty">Sin acompañantes ni remolques activos.</p>}
    {items.filter(i => !i.removed_at).map(item => <div key={item.id} className="trip-ops-item">
      <span className="trip-ops-avatar" aria-hidden="true">{item.kind === 'companion' ? item.name.slice(0,1).toUpperCase() : 'R'}</span>
      <div className="trip-ops-item-name"><strong>{item.name}</strong><span>{item.kind === 'companion' ? 'A bordo' : 'Enganchado'}</span></div>
      <button type="button" disabled={disabled} onClick={() => submit({ type: item.kind === 'companion' ? 'COMPANION_DROPPED_OFF' : 'TRAILER_DETACHED', itemId: Number(item.id) })}>
        {item.kind === 'companion' ? 'Dejar' : 'Desenganchar'}
      </button>
    </div>)}
    <details className="trip-ops-add"><summary><span><b>＋</b> Agregar acompañantes</span><span aria-hidden="true">⌄</span></summary>
    <form onSubmit={e => { e.preventDefault(); submit({ type: 'COMPANIONS_ADDED', names }); }}>
      <label>Nombres de los acompañantes<textarea rows={5} placeholder={'Juan Pérez\nAna López\nLuis García\nMaría Torres'} value={name} onChange={e => setName(e.target.value)} maxLength={10000} disabled={disabled} required /></label>
      <small>Escribe o pega un nombre por línea. Puedes agregar hasta 50 de una vez.</small>
      {names.some(value => value.length > 200) && <p role="alert">Cada nombre debe tener como máximo 200 caracteres.</p>}
      <button className="trip-ops-primary" disabled={disabled || !names.length || names.length > 50 || names.some(value => value.length > 200)}>Agregar {names.length || ''} {names.length === 1 ? 'acompañante' : 'acompañantes'}</button>
    </form>
    </details>
    <details className="trip-ops-add"><summary><span><b>＋</b> Enganchar remolque</span><span aria-hidden="true">⌄</span></summary>
    <div className="trip-ops-trailer-form">
    <label>Remolque<select value={trailer} disabled={disabled} onChange={e => selectTrailer(e.target.value)}>
      <option value="">Seleccionar remolque</option>
      {vehicles.filter(isTrailer).map(v => <option key={v.id_vehiculos} value={v.id_vehiculos}>{v.numero_economico} · {v.nombre}</option>)}
    </select></label>
    {trailer && <div>
      <p>Se requiere una inspección nueva para este enganche.</p>
      {inspection && Object.values(inspection.checklist || {}).some(v => ['M','R'].includes(v)) && <p role="status">La inspección tiene observaciones. Puedes continuar después de revisarlas.</p>}
      <button type="button" disabled={disabled} onClick={() => setShowInspection(true)}>{inspection ? 'Editar inspección' : 'Realizar inspección'}</button>
      {inspection && <p>Inspección capturada. Se guardará al enganchar.</p>}
      <label><input type="checkbox" checked={warningConfirmed} disabled={disabled} onChange={e => setWarningConfirmed(e.target.checked)} />Confirmo el estado de la inspección y continuar con el remolque.</label>
      <button className="trip-ops-primary" type="button" disabled={disabled || !warningConfirmed || !inspection} onClick={() => submit({ type: 'TRAILER_ATTACHED', itemId: Number(trailer), inspectionMode: 'new', inspection, warningConfirmed })}>Enganchar remolque</button>
    </div>}
    </div></details>
    {showInspection && <InspeccionRemolqueModal vehiculos={vehicles.filter(v => Number(v.id_vehiculos) === Number(trailer))} initialData={inspection || { idRemolque: Number(trailer) }}
      onClose={() => setShowInspection(false)} onSave={data => { setInspection({ ...data, captureId: crypto.randomUUID() }); setWarningConfirmed(false); setShowInspection(false); }} />}
    {items.some(i => i.removed_at) && <details className="trip-ops-history"><summary>Historial de movimientos <span>{items.filter(i => i.removed_at).length}</span></summary>{items.filter(i => i.removed_at).sort((a,b) => new Date(b.removed_at)-new Date(a.removed_at)).map(i => <div className="trip-ops-history-row" key={i.id}><div><strong>{i.name}</strong><span>{i.kind === 'companion' ? 'Acompañante · Bajó' : 'Remolque · Desenganchado'}</span></div><time dateTime={i.removed_at}>{new Date(i.removed_at).toLocaleDateString('es-MX', { day:'2-digit', month:'short' })}<br />{new Date(i.removed_at).toLocaleTimeString('es-MX', { hour:'2-digit', minute:'2-digit' })}</time></div>)}</details>}
  </section>;
}
