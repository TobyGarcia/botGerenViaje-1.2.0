import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { IconCross } from './Icons.jsx';

export default function TripOperationModal({ title, icon, busy, onClose, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const focus = document.activeElement;
    const overflow = document.body.style.overflow;
    ref.current.showModal(); document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = overflow; focus?.focus?.(); };
  }, []);
  return createPortal(<dialog ref={ref} className="trip-operation-dialog" aria-labelledby="trip-operation-modal-title" onCancel={e => {e.preventDefault(); if(!busy) onClose();}}>
    <div className="gv-trip-operations trip-operation-dialog-content"><header className="trip-operation-dialog-header"><span>{icon}</span><div><small>GESTIONAR VIAJE</small><h2 id="trip-operation-modal-title">{title}</h2></div><button type="button" disabled={busy} onClick={onClose} aria-label={`Cerrar ${title}`}><IconCross size={18}/></button></header><div className="trip-operation-dialog-body">{children}</div><footer className="trip-operation-dialog-footer"><button type="button" disabled={busy} onClick={onClose}>Listo</button></footer></div>
  </dialog>,document.body);
}
