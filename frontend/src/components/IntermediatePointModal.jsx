import { useEffect, useRef, useState } from 'react';
import TripOperationModal from './TripOperationModal.jsx';
import './TripOperations.css';

export default function IntermediatePointModal({ busy, onSave, onClose }) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const input = useRef(null), submitting = useRef(false);
  useEffect(() => { input.current?.focus(); }, []);
  async function submit(event) {
    event.preventDefault();
    if (busy || submitting.current) return;
    const note = name.trim();
    if (!note) { setError('Escribe el nombre o motivo de la parada.'); return; }
    submitting.current = true; setError('');
    try { await onSave(note); }
    catch (error) { setError(error.message || 'No se pudo guardar la parada. Intenta nuevamente.'); }
    finally { submitting.current = false; }
  }
  return <TripOperationModal title="Punto intermedio" busy={busy} onClose={onClose}
    icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v10M7 12h10"/></svg>}
    footer={<>
      <button type="button" className="trip-operation-done-btn" disabled={busy} onClick={onClose}>Cancelar</button>
      <button type="submit" form="intermediate-point-form" className="trip-ops-primary" disabled={busy || !name.trim()}>{busy ? 'Guardando…' : 'Guardar parada'}</button>
    </>}>
    <form id="intermediate-point-form" onSubmit={submit}>
      <label className="trip-ops-place" htmlFor="intermediate-point-name">Nombre o motivo de la parada</label>
      <input ref={input} id="intermediate-point-name" value={name} onChange={event => { setName(event.target.value); setError(''); }}
        placeholder="Escribe el motivo de la parada" maxLength={200} required disabled={busy} autoComplete="off"
        style={{ width:'100%', boxSizing:'border-box', padding:'12px 14px', border:'1px solid #cbd5e1', borderRadius:12, font:'inherit', marginTop:8 }} />
      <p className="trip-stop-hint" style={{ marginTop:10 }}>Se guardarán la hora y la ubicación actuales.</p>
      {error && <p role="alert">{error}</p>}
    </form>
  </TripOperationModal>;
}
