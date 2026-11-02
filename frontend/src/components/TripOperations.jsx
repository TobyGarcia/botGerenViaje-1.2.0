import { useEffect, useState } from 'react';
import { Geolocation } from '@capacitor/geolocation';
import { getTripItems, recordTripOperation, getVehiculos } from '../services/api.js';
import { isTrailer } from '../utils/vehicle-kind.js';
import InspeccionRemolqueModal from './InspeccionRemolqueModal.jsx';
import './TripOperations.css';
import TripOperationModal from './TripOperationModal.jsx';
import TripTrailerIcon from './TripTrailerIcon.jsx';
import { IconUsers } from './Icons.jsx';
import { resolveOfflineTripId } from '../services/offline-trip-storage.js';
import { resolveOperationTripId } from '../utils/trip-operation-id.js';

export default function TripOperations({ tripId }) {
  const serverId = () => resolveOperationTripId(tripId, resolveOfflineTripId);
  const [items, setItems] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [companionDraft, setCompanionDraft] = useState(['']);
  const [modal, setModal] = useState(null);
  const [trailer, setTrailer] = useState('');
  const [inspection, setInspection] = useState(null);
  const [showInspection, setShowInspection] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [warningConfirmed, setWarningConfirmed] = useState(false);
  const [pending, setPending] = useState(null);
  const [actions,setActions] = useState([]);
  const refresh = async () => {
    const id = serverId();
    if (!id) { setLoaded(false); setError('El viaje está guardado en el teléfono. Sincronízalo para gestionar acompañantes y remolques.'); return; }
    const r = await getTripItems(id); setItems(r.data || []); setLoaded(true); setError('');
  };
  useEffect(() => {
    setActions([]);setPending(null);setModal(null);setTrailer('');setInspection(null);setCompanionDraft(['']);setWarningConfirmed(false);
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
      setPending(null); setActions([]); setCompanionDraft(['']); setTrailer(''); setInspection(null); setWarningConfirmed(false);
      try { await refresh(); }
      catch { setLoaded(false); setError('Las acciones se guardaron. Actualiza el viaje para ver el estado confirmado.'); }
    } catch (e) {
      if (e.status >= 400 && e.status < 500 && e.status !== 429) { setPending(null); await refresh().catch(() => {}); }
      setError(e.message || 'No se pudo registrar. Comprueba conexión y permiso de ubicación.');
    }
    finally { setBusy(false); }
  }
  const disabled = busy || !loaded || Boolean(pending);
  const names = companionDraft.map(value => value.trim()).filter(Boolean);
  const onboardCount = items.filter(item => item.kind === 'companion' && !item.removed_at).length;
  const attachedTrailersCount = items.filter(item => item.kind === 'trailer' && !item.removed_at).length;
  const projectedCount=onboardCount-actions.filter(a=>a.type==='COMPANION_DROPPED_OFF').length+actions.filter(a=>a.type==='COMPANION_ADDED').length;
  const availableSeats = Math.max(0, 4 - projectedCount);
  const actionLabels={COMPANION_ADDED:'Subirá',COMPANION_DROPPED_OFF:'Bajará',TRAILER_ATTACHED:'Se enganchará',TRAILER_DETACHED:'Se dejará'};
  function toggleRemoval(item) {
    const type=item.kind==='companion'?'COMPANION_DROPPED_OFF':'TRAILER_DETACHED';
    setActions(current=>current.some(a=>a.type===type && a.itemId===Number(item.id))?current.filter(a=>!(a.type===type && a.itemId===Number(item.id))):[...current,{type,itemId:Number(item.id),name:item.name}]);
  }
  function stageCompanions() {
    if(!names.length || names.length>availableSeats)return;
    setActions(current=>[...current,...names.map(name=>({type:'COMPANION_ADDED',name}))]);setCompanionDraft(['']);
  }
  function stageTrailer() {
    const vehicle=vehicles.find(v=>Number(v.id_vehiculos)===Number(trailer));
    setActions(current=>[...current,{type:'TRAILER_ATTACHED',itemId:Number(trailer),name:vehicle?.nombre || 'Remolque',inspectionMode:'new',inspection,warningConfirmed}]);
    setTrailer('');setInspection(null);setWarningConfirmed(false);
  }
  const activeKind = modal === 'companions' ? 'companion' : 'trailer';
  const activeItems = items.filter(i => i.kind === activeKind && !i.removed_at);
  const historyItems = items.filter(i => i.kind === activeKind && i.removed_at).sort((a, b) => new Date(b.removed_at) - new Date(a.removed_at));
  const alerts = <>{error && <p role="alert">{error}</p>}{pending && <button type="button" disabled={busy} onClick={() => submit(pending)}>Reintentar movimiento pendiente</button>}</>;

  return <section className="gv-trip-operations trip-operation-launcher">
    <header className="trip-ops-heading"><div><span className="trip-ops-eyebrow">DURANTE EL VIAJE</span><h3>Gestionar viaje</h3></div></header>
    <div className="trip-operation-shortcuts">{[['companions','companion','Acompañantes'],['trailers','trailer','Remolques']].map(([id,kind,title]) => <button type="button" className="trip-operation-shortcut" key={id} onClick={() => setModal(id)}><span className="trip-operation-shortcut-icon">{kind === 'companion' ? <IconUsers size={22}/> : <TripTrailerIcon size={22}/>}</span><strong>{title}</strong><small>{items.filter(i => i.kind === kind && !i.removed_at).length} {kind === 'companion' ? 'a bordo' : 'enganchados'}</small><span className="trip-operation-manage">Gestionar →</span></button>)}</div>
    {!modal && alerts}
    {!modal && actions.length>0 && <button type="button" onClick={()=>setModal('companions')}>Revisar {actions.length} acciones pendientes de confirmar</button>}
    {!modal && !loaded && !busy && <button type="button" onClick={() => refresh().catch(e => setError(e.message))}>Actualizar viaje</button>}
    {modal && !showInspection && (
      <TripOperationModal
        title={modal === 'companions' ? 'Acompañantes' : 'Remolques'}
        badge={modal === 'companions' ? `${onboardCount} / 4 a bordo` : `${attachedTrailersCount} ${attachedTrailersCount === 1 ? 'enganchado' : 'enganchados'}`}
        icon={modal === 'companions' ? <IconUsers size={22}/> : <TripTrailerIcon size={22}/>}
        busy={busy}
        onClose={() => setModal(null)}
        footer={actions.length>0 ? <><button type="button" className="trip-operation-done-btn" disabled={disabled} onClick={()=>{setActions([]);setCompanionDraft(['']);setTrailer('');setInspection(null);setWarningConfirmed(false);setModal(null);}}>Cancelar selección</button><button type="button" className="trip-ops-primary" disabled={disabled || projectedCount>4 || projectedCount<0} onClick={()=>submit({type:'CONFIRMED_ACTIONS',actions})}>Confirmar {actions.length} {actions.length===1?'acción':'acciones'}</button></> : undefined}
      >
        {error && <p role="alert">{error}</p>}
        {pending && <button type="button" className="trip-ops-retry-btn" disabled={busy} onClick={() => submit(pending)}>Reintentar registro pendiente</button>}
        {!loaded && !busy && <button type="button" className="trip-ops-retry-btn" onClick={() => refresh().catch(e => setError(e.message))}>Cargar elementos</button>}

        <div className="trip-ops-active-section">
          <div className="trip-ops-section-header">
            <h3>{activeKind === 'companion' ? 'A bordo' : 'Enganchados'}</h3>
            <span className="trip-ops-section-count">
              {activeKind === 'companion' ? `${onboardCount} de 4 lugares` : `${activeItems.length} ${activeItems.length === 1 ? 'activo' : 'activos'}`}
            </span>
          </div>
          {loaded && activeItems.length === 0 && (
            <p className="trip-ops-empty">
              {activeKind === 'companion' ? 'No hay acompañantes a bordo en este momento.' : 'No hay remolques enganchados en este momento.'}
            </p>
          )}
          {activeItems.length > 0 && (
            <div className="trip-ops-list">
              {activeItems.map(item => (
                <div key={item.id} className="trip-ops-item">
                  <span className="trip-ops-avatar" aria-hidden="true">
                    {item.kind === 'companion' ? <IconUsers size={18}/> : <TripTrailerIcon size={19}/>}
                  </span>
                  <div className="trip-ops-item-name">
                    <strong>{item.name}</strong>
                    <span className="trip-ops-status-tag">
                      <i className="trip-ops-status-dot" aria-hidden="true" />
                      {actions.some(a=>a.itemId===Number(item.id) && a.type===(item.kind==='companion'?'COMPANION_DROPPED_OFF':'TRAILER_DETACHED')) ? (item.kind==='companion'?'Bajada seleccionada':'Desenganche seleccionado') : item.kind === 'companion' ? 'A bordo' : 'Enganchado'}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="trip-ops-action-leave"
                    disabled={disabled}
                    aria-pressed={actions.some(a=>a.itemId===Number(item.id) && a.type===(item.kind==='companion'?'COMPANION_DROPPED_OFF':'TRAILER_DETACHED'))}
                    onClick={() => toggleRemoval(item)}
                  >
                    {actions.some(a=>a.itemId===Number(item.id) && a.type===(item.kind==='companion'?'COMPANION_DROPPED_OFF':'TRAILER_DETACHED')) ? 'Deshacer' : item.kind === 'companion' ? 'Seleccionar bajada' : 'Seleccionar desenganche'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {modal === 'companions' && (
          <section className="trip-companions-editor">
            <div className="trip-ops-section-header">
              <div>
                <h3>Agregar acompañantes</h3>
                <p className="trip-ops-section-sub">
                  {availableSeats === 0
                    ? 'Capacidad máxima alcanzada en la unidad.'
                    : `${availableSeats} ${availableSeats === 1 ? 'lugar disponible' : 'lugares disponibles'} al confirmar la selección.`}
                </p>
              </div>
              {availableSeats > 0 && (
                <div className="trip-companion-header-actions">
                  <span className="trip-companion-counter" aria-live="polite">
                    {projectedCount + names.length} / 4 máx.
                  </span>
                  <button
                    className="trip-companion-add"
                    type="button"
                    disabled={disabled || companionDraft.length >= availableSeats}
                    onClick={() => setCompanionDraft(values => [...values, ''])}
                  >
                    + Agregar
                  </button>
                </div>
              )}
            </div>

            {availableSeats === 0 ? (
              <p className="trip-ops-empty">Los 4 lugares están ocupados. Selecciona una bajada para liberar un lugar en esta confirmación.</p>
            ) : (
              <form
                id="trip-companion-fields"
                className="trip-companion-fields"
                onSubmit={e => {
                  e.preventDefault();
                  stageCompanions();
                }}
              >
                <div className="trip-companion-inputs-stack">
                  {companionDraft.map((value, index) => (
                    <div className="trip-companion-input-row" key={index}>
                      <span className="trip-companion-row-index" aria-hidden="true">{index + 1}</span>
                      <input
                        aria-label={`Nombre del acompañante ${index + 1}`}
                        placeholder={`Nombre completo del acompañante ${index + 1}`}
                        value={value}
                        maxLength={200}
                        disabled={disabled}
                        required
                        onChange={e => setCompanionDraft(values => values.map((name, i) => (i === index ? e.target.value : name)))}
                      />
                      {companionDraft.length > 1 && (
                        <button
                          className="trip-companion-remove"
                          type="button"
                          aria-label={`Quitar acompañante ${index + 1}`}
                          disabled={disabled}
                          onClick={() => setCompanionDraft(values => values.filter((_, i) => i !== index))}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  className="trip-ops-primary"
                  disabled={disabled || names.length !== companionDraft.length || names.length > availableSeats}
                >
                  Añadir {names.length || ''} {names.length === 1 ? 'acompañante' : 'acompañantes'} a la selección
                </button>
              </form>
            )}
          </section>
        )}

        {modal === 'trailers' && (
          <section className="trip-operation-add-trailer">
            <div className="trip-ops-section-header">
              <h3>Enganchar remolque</h3>
            </div>
            <div className="trip-ops-trailer-form">
              <label>
                <span>Unidad de remolque</span>
                <select value={trailer} disabled={disabled} onChange={e => selectTrailer(e.target.value)}>
                  <option value="">Seleccionar remolque disponible</option>
                  {vehicles
                    .filter(isTrailer)
                    .filter(v => !actions.some(a=>a.type==='TRAILER_ATTACHED' && a.itemId===Number(v.id_vehiculos)))
                    .filter(v => !items.some(i => i.kind === 'trailer' && !i.removed_at && Number(i.trailer_id) === Number(v.id_vehiculos) && !actions.some(a=>a.type==='TRAILER_DETACHED' && a.itemId===Number(i.id))))
                    .map(v => (
                      <option key={v.id_vehiculos} value={v.id_vehiculos}>
                        {v.numero_economico} · {v.nombre}
                      </option>
                    ))}
                </select>
              </label>
              {trailer && (
                <div className="trip-ops-trailer-inspection-box">
                  <div className="trip-ops-trailer-inspection-row">
                    <div>
                      <strong>Inspección de enganche</strong>
                      <p>{inspection ? 'Inspección capturada. Se guardará al enganchar.' : 'Se requiere una inspección nueva para este enganche.'}</p>
                    </div>
                    <button type="button" className="trip-ops-secondary-btn" disabled={disabled} onClick={() => setShowInspection(true)}>
                      {inspection ? 'Editar inspección' : 'Realizar inspección'}
                    </button>
                  </div>
                  {inspection && Object.values(inspection.checklist || {}).some(v => ['M', 'R'].includes(v)) && (
                    <p role="status">La inspección tiene observaciones. Puedes continuar después de revisarlas.</p>
                  )}
                  <label className="trip-ops-checkbox-card">
                    <input
                      type="checkbox"
                      checked={warningConfirmed}
                      disabled={disabled}
                      onChange={e => setWarningConfirmed(e.target.checked)}
                    />
                    <span>Confirmo el estado de la inspección y continuar con el remolque.</span>
                  </label>
                  <button
                    className="trip-ops-primary"
                    type="button"
                    disabled={disabled || !warningConfirmed || !inspection}
                    onClick={() => stageTrailer()}
                  >
                    Añadir enganche a la selección
                  </button>
                </div>
              )}
            </div>
          </section>
        )}

        {actions.length>0 && <section className="trip-actions-confirmation"><h3>Resumen de acciones</h3><p>Aún no se han guardado. Al confirmar se registrarán juntas como una parada y un mensaje de Telegram.</p>{projectedCount>4 && <p role="alert">La selección supera los cuatro lugares. Quita una subida o selecciona una bajada.</p>}<ul>{actions.map((action,index)=><li key={index}><span><strong>{actionLabels[action.type]}</strong> · {action.name}</span><button type="button" disabled={disabled} aria-label={`Quitar acción ${index+1}`} onClick={()=>setActions(current=>current.filter((_,i)=>i!==index))}>Quitar</button></li>)}</ul></section>}
        {historyItems.length > 0 && (
          <details className="trip-ops-history">
            <summary>
              <span>Historial de movimientos</span>
              <em className="trip-ops-history-badge">{historyItems.length}</em>
            </summary>
            <div className="trip-ops-history-list">
              {historyItems.map(i => (
                <div className="trip-ops-history-row" key={i.id}>
                  <div>
                    <strong>{i.name}</strong>
                    <span>{i.kind === 'companion' ? 'Bajó de la unidad' : 'Desenganchado'}</span>
                  </div>
                  <time>{new Date(i.removed_at).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</time>
                </div>
              ))}
            </div>
          </details>
        )}
      </TripOperationModal>
    )}
    {showInspection && <InspeccionRemolqueModal vehiculos={vehicles.filter(v => Number(v.id_vehiculos) === Number(trailer))} initialData={inspection || { idRemolque: Number(trailer) }}
      onClose={() => setShowInspection(false)} onSave={data => { setInspection({ ...data, captureId: crypto.randomUUID() }); setWarningConfirmed(false); setShowInspection(false); }} />}
  </section>;
}
