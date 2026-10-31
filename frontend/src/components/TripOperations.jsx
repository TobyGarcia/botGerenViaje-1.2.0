import { useEffect, useState } from 'react';
import { Geolocation } from '@capacitor/geolocation';
import { getTripItems, recordTripOperation, getTrailerInspection, getVehiculos } from '../services/api.js';
import { isTrailer } from '../utils/vehicle-kind.js';
import InspeccionRemolqueModal from './InspeccionRemolqueModal.jsx';

export default function TripOperations({ tripId }) {
  const [items, setItems] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [name, setName] = useState('');
  const [trailer, setTrailer] = useState('');
  const [inspection, setInspection] = useState(null);
  const [existing, setExisting] = useState(null);
  const [mode, setMode] = useState('none');
  const [showInspection, setShowInspection] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [warningConfirmed, setWarningConfirmed] = useState(false);
  const [pending, setPending] = useState(null);
  const refresh = async () => { const r = await getTripItems(tripId); setItems(r.data || []); setLoaded(true); };
  useEffect(() => {
    setLoaded(false);
    refresh().catch(e => setError(e.message));
    getVehiculos().then(r => setVehicles(r.data || [])).catch(e => setError(e.message));
  }, [tripId]);
  async function selectTrailer(id) {
    setTrailer(id); setExisting(null); setInspection(null); setMode('none'); setWarningConfirmed(false); setError('');
    if (!id) return;
    setBusy(true);
    try { const r = await getTrailerInspection(tripId, id); setExisting(r.data); setMode(r.data ? 'existing' : 'none'); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
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
      await recordTripOperation(tripId, operation);
      setPending(null); setName(''); setTrailer(''); setInspection(null); setExisting(null); setWarningConfirmed(false);
      await refresh();
    } catch (e) { setError(e.message || 'No se pudo registrar. Comprueba conexión y permiso de ubicación.'); }
    finally { setBusy(false); }
  }
  const disabled = busy || !loaded || Boolean(pending);
  return <section className="gv-trip-operations" style={{ marginTop: 16, padding: 16, border: '1px solid #cbd5e1', borderRadius: 12 }}>
    <h3>Acompañantes y remolques</h3>
    {error && <p role="alert">{error}</p>}
    {pending && <button type="button" disabled={busy} onClick={() => submit(pending)}>Reintentar registro pendiente</button>}
    {!loaded && !busy && <button type="button" onClick={() => refresh().catch(e => setError(e.message))}>Cargar elementos</button>}
    {items.filter(i => !i.removed_at).map(item => <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
      <span>{item.name} · {item.kind === 'companion' ? 'A bordo' : 'Enganchado'}</span>
      <button type="button" disabled={disabled} onClick={() => submit({ type: item.kind === 'companion' ? 'COMPANION_DROPPED_OFF' : 'TRAILER_DETACHED', itemId: Number(item.id) })}>
        {item.kind === 'companion' ? 'Dejar' : 'Desenganchar'}
      </button>
    </div>)}
    <form onSubmit={e => { e.preventDefault(); submit({ type: 'COMPANION_ADDED', name }); }}>
      <label>Nombre del acompañante<input value={name} onChange={e => setName(e.target.value)} maxLength={200} disabled={disabled} required /></label>
      <button disabled={disabled || !name.trim()}>Agregar acompañante</button>
    </form>
    <label>Remolque<select value={trailer} disabled={disabled} onChange={e => selectTrailer(e.target.value)}>
      <option value="">Seleccionar remolque</option>
      {vehicles.filter(isTrailer).map(v => <option key={v.id_vehiculos} value={v.id_vehiculos}>{v.numero_economico} · {v.nombre}</option>)}
    </select></label>
    {trailer && <div>
      {existing && <p>Inspección disponible: {existing.estado || 'Registrada'}{existing.fecha_operativa ? ` · ${String(existing.fecha_operativa).slice(0,10)}` : ''}.</p>}
      {mode === 'none' && <p role="status">Sin inspección registrada. Puedes continuar confirmando esta advertencia.</p>}
      {mode === 'existing' && existing?.estado !== 'APROBADA' && <p role="status">La inspección no está aprobada. Puedes continuar confirmando la advertencia.</p>}
      {mode === 'new' && inspection && Object.values(inspection.checklist || {}).some(v => ['M','R'].includes(v)) && <p role="status">La inspección tiene observaciones. Puedes continuar después de revisarlas.</p>}
      <label>Inspección<select value={mode} disabled={disabled} onChange={e => { setMode(e.target.value); setWarningConfirmed(false); }}>
        {existing && <option value="existing">Usar inspección existente</option>}
        <option value="new">Realizar inspección ahora</option>
        <option value="none">Continuar sin inspección</option>
      </select></label>
      {mode === 'new' && <button type="button" disabled={disabled} onClick={() => setShowInspection(true)}>{inspection ? 'Editar inspección' : 'Realizar inspección'}</button>}
      {inspection && mode === 'new' && <p>Inspección capturada. Se guardará al enganchar.</p>}
      <label><input type="checkbox" checked={warningConfirmed} disabled={disabled} onChange={e => setWarningConfirmed(e.target.checked)} />Confirmo el estado de la inspección y continuar con el remolque.</label>
      <button type="button" disabled={disabled || !warningConfirmed || (mode === 'new' && !inspection)} onClick={() => submit({ type: 'TRAILER_ATTACHED', itemId: Number(trailer), inspectionMode: mode, inspection, warningConfirmed })}>Enganchar remolque</button>
    </div>}
    {showInspection && <InspeccionRemolqueModal vehiculos={vehicles.filter(v => Number(v.id_vehiculos) === Number(trailer))} initialData={inspection || { idRemolque: Number(trailer) }}
      onClose={() => setShowInspection(false)} onSave={data => { setInspection(data); setMode('new'); setShowInspection(false); }} />}
    {items.some(i => i.removed_at) && <details><summary>Historial</summary>{items.filter(i => i.removed_at).map(i => <p key={i.id}>{i.name} · {i.kind === 'companion' ? 'Bajó' : 'Desenganchado'} · {new Date(i.removed_at).toLocaleString('es-MX')}</p>)}</details>}
  </section>;
}
