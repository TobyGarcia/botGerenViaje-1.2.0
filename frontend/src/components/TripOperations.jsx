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
  const confirmationActions = [...actions, ...names.map(name => ({ type: 'COMPANION_ADDED', name }))];
  const finalCount = projectedCount + names.length;
  function toggleRemoval(item) {
    const type=item.kind==='companion'?'COMPANION_DROPPED_OFF':'TRAILER_DETACHED';
    setActions(current=>current.some(a=>a.type===type && a.itemId===Number(item.id))?current.filter(a=>!(a.type===type && a.itemId===Number(item.id))):[...current,{type,itemId:Number(item.id),name:item.name}]);
  }
  function stageTrailer() {
    const vehicle=vehicles.find(v=>Number(v.id_vehiculos)===Number(trailer));
    setActions(current=>[...current,{type:'TRAILER_ATTACHED',itemId:Number(trailer),name:vehicle?.nombre || 'Remolque',inspectionMode:'new',inspection,warningConfirmed}]);
    setTrailer('');setInspection(null);setWarningConfirmed(false);
  }
  const activeKind = modal === 'companions' ? 'companion' : 'trailer';
  const activeItems = items.filter(i => i.kind === activeKind && !i.removed_at);
  const historyItems = items.filter(i => i.kind === activeKind && i.removed_at).sort((a, b) => new Date(b.removed_at) - new Date(a.removed_at));
  const selectedDropsCount = actions.filter(a => a.type === (activeKind === 'companion' ? 'COMPANION_DROPPED_OFF' : 'TRAILER_DETACHED')).length;
  const alerts = <>{error && <p role="alert">{error}</p>}{pending && <button type="button" disabled={busy} onClick={() => submit(pending)}>Reintentar movimiento pendiente</button>}</>;

  return <section className="gv-trip-operations trip-operation-launcher">
    <header className="trip-ops-heading"><div><span className="trip-ops-eyebrow">DURANTE EL VIAJE</span><h3>Gestionar viaje</h3></div></header>
    <div className="trip-operation-shortcuts">{[['companions','companion','Acompañantes'],['trailers','trailer','Remolques']].map(([id,kind,title]) => <button type="button" className="trip-operation-shortcut" key={id} onClick={() => setModal(id)}><span className="trip-operation-shortcut-icon">{kind === 'companion' ? <IconUsers size={22}/> : <TripTrailerIcon size={22}/>}</span><strong>{title}</strong><small>{items.filter(i => i.kind === kind && !i.removed_at).length} {kind === 'companion' ? 'a bordo' : 'enganchados'}</small><span className="trip-operation-manage">Gestionar →</span></button>)}</div>
    {!modal && alerts}
    {!modal && confirmationActions.length>0 && <button type="button" onClick={()=>setModal('companions')}>Continuar cambios pendientes</button>}
    {!modal && !loaded && !busy && <button type="button" onClick={() => refresh().catch(e => setError(e.message))}>Actualizar viaje</button>}
    {modal && !showInspection && (
      <TripOperationModal
        title={modal === 'companions' ? 'Acompañantes' : 'Remolques'}
        badge={modal === 'companions' ? `${onboardCount} / 4 a bordo` : `${attachedTrailersCount} ${attachedTrailersCount === 1 ? 'enganchado' : 'enganchados'}`}
        icon={modal === 'companions' ? <IconUsers size={22}/> : <TripTrailerIcon size={22}/>}
        busy={busy}
        onClose={() => setModal(null)}
        footer={
          <>
            <button
              type="button"
              className="trip-operation-done-btn"
              disabled={disabled}
              onClick={() => {
                setActions([]);
                setCompanionDraft(['']);
                setTrailer('');
                setInspection(null);
                setWarningConfirmed(false);
                setModal(null);
              }}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="trip-ops-primary"
              disabled={disabled || !confirmationActions.length || finalCount > 4 || finalCount < 0}
              onClick={() => submit({ type: 'CONFIRMED_ACTIONS', actions: confirmationActions })}
            >
              <span>{busy ? 'Guardando…' : 'Confirmar cambios'}</span>
              {!busy && confirmationActions.length > 0 && (
                <span className="trip-ops-confirm-count">{confirmationActions.length}</span>
              )}
            </button>
          </>
        }
      >
        {error && <p role="alert">{error}</p>}
        {pending && <button type="button" className="trip-ops-retry-btn" disabled={busy} onClick={() => submit(pending)}>Reintentar registro pendiente</button>}
        {!loaded && !busy && <button type="button" className="trip-ops-retry-btn" onClick={() => refresh().catch(e => setError(e.message))}>Cargar elementos</button>}

        <div className="trip-ops-active-section">
          <div className="trip-ops-section-header">
            <h3>{activeKind === 'companion' ? '¿Quién baja?' : '¿Qué remolque se deja?'}</h3>
            {selectedDropsCount > 0 && (
              <span className="trip-ops-section-count has-drops">
                {selectedDropsCount} {selectedDropsCount === 1 ? 'seleccionado' : 'seleccionados'}
              </span>
            )}
          </div>
          {loaded && activeItems.length === 0 && (
            <p className="trip-ops-empty">
              {activeKind === 'companion' ? 'No hay acompañantes a bordo en este momento.' : 'No hay remolques enganchados en este momento.'}
            </p>
          )}
          {activeItems.length > 0 && (
            <div className="trip-ops-list">
              {activeItems.map(item => {
                const isLeaving = actions.some(
                  a => a.itemId === Number(item.id) && a.type === (item.kind === 'companion' ? 'COMPANION_DROPPED_OFF' : 'TRAILER_DETACHED')
                );
                return (
                  <div
                    key={item.id}
                    className={`trip-ops-item ${isLeaving ? 'is-leaving' : ''}`}
                    onClick={e => {
                      if (!disabled && !e.target.closest('label')) toggleRemoval(item);
                    }}
                  >
                    <span className="trip-ops-avatar" aria-hidden="true">
                      {item.kind === 'companion' ? <IconUsers size={17}/> : <TripTrailerIcon size={18}/>}
                    </span>
                    <div className="trip-ops-item-name">
                      <strong>{item.name}</strong>
                      <span className={`trip-ops-status-tag ${isLeaving ? 'leaving' : ''}`}>
                        <i className="trip-ops-status-dot" aria-hidden="true" />
                        {item.kind === 'companion' ? 'A bordo' : 'Enganchado'}
                      </span>
                    </div>
                    <label className="trip-ops-leave-choice" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        disabled={disabled}
                        checked={isLeaving}
                        onChange={() => toggleRemoval(item)}
                        aria-label={`${item.kind === 'companion' ? 'Bajar a' : 'Dejar'} ${item.name}`}
                      />
                    </label>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {modal === 'companions' && (
          <section className="trip-companions-editor">
            <div className="trip-ops-section-header">
              <div>
                <h3>¿Quién sube?</h3>
                {(availableSeats > 0 || names.length > 0) && (
                  <p className="trip-ops-section-sub">
                    {availableSeats === 0
                      ? 'Lugares completos con la selección actual.'
                      : `${availableSeats} ${availableSeats === 1 ? 'lugar disponible' : 'lugares disponibles'} para abordar.`}
                  </p>
                )}
              </div>
              {availableSeats === 0 && names.length === 0 ? (
                <span className="trip-ops-section-count full">Cupo lleno (4/4)</span>
              ) : (
                availableSeats > 0 && (
                  <div className="trip-companion-header-actions">
                    <button
                      className="trip-companion-add"
                      type="button"
                      disabled={disabled || companionDraft.length >= availableSeats}
                      onClick={() => setCompanionDraft(values => [...values, ''])}
                    >
                      + Otro
                    </button>
                  </div>
                )
              )}
            </div>

            {availableSeats === 0 && names.length === 0 ? (
              <div className="trip-ops-empty trip-ops-full-callout">
                <p>Selecciona a un acompañante arriba para liberar un asiento.</p>
              </div>
            ) : (
              <form
                id="trip-companion-fields"
                className="trip-companion-fields"
                onSubmit={e => {
                  e.preventDefault();
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

        {finalCount>4 && <p role="alert">Solo pueden viajar cuatro acompañantes. Quita un nombre o selecciona quién baja.</p>}
        {modal === 'trailers' && actions.some(action=>action.type==='TRAILER_ATTACHED') && <section className="trip-ops-list">{actions.map((action,index)=>action.type==='TRAILER_ATTACHED' && <div className="trip-ops-item" key={index}><span className="trip-ops-item-name"><strong>{action.name}</strong><small>Listo para enganchar</small></span><button type="button" disabled={disabled} onClick={()=>setActions(current=>current.filter((_,i)=>i!==index))}>Quitar</button></div>)}</section>}
        {historyItems.length > 0 && (
          <details className="trip-ops-history">
            <summary>
              <span className="trip-ops-history-title">Historial de movimientos</span>
              <span className="trip-ops-history-meta">
                <em className="trip-ops-history-badge">{historyItems.length}</em>
                <svg className="trip-ops-history-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </span>
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
