import { useEffect, useRef } from 'react';
import TripOperationModal from './TripOperationModal.jsx';
import { IconAlert } from './Icons.jsx';
import './TripOperations.css';

export default function FinishTripAlert({ busy, onConfirm, onClose }) {
  const submitting = useRef(false);
  const cancel = useRef(null);
  useEffect(() => { cancel.current?.focus(); }, []);
  async function confirm() {
    if (busy || submitting.current) return;
    submitting.current = true;
    try { await onConfirm(); } finally { submitting.current = false; }
  }
  return <TripOperationModal title="¿Finalizar viaje?" role="alertdialog"
    icon={<IconAlert size={24} />} busy={busy} onClose={onClose}
    footer={<div className="finish-trip-alert-actions">
      <button type="button" className="trip-operation-done-btn" disabled={busy} ref={cancel} onClick={onClose}>Volver</button>
      <button type="button" className="trip-ops-primary finish-trip-alert-confirm" disabled={busy} onClick={confirm}>{busy ? 'Finalizando…' : 'Finalizar viaje'}</button>
    </div>}>
    <p className="finish-trip-alert-text">Se registrará tu hora de llegada y se detendrá el seguimiento GPS.</p>
  </TripOperationModal>;
}

