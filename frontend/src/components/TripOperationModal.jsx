import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { IconCross } from './Icons.jsx';

export default function TripOperationModal({ title, badge, icon, busy, onClose, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const focus = document.activeElement;
    const overflow = document.body.style.overflow;
    ref.current.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
      focus?.focus?.();
    };
  }, []);

  return createPortal(
    <dialog
      ref={ref}
      className="trip-operation-dialog"
      aria-labelledby="trip-operation-modal-title"
      onCancel={e => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      onClick={e => {
        if (e.target === ref.current && !busy) onClose();
      }}
    >
      <div className="gv-trip-operations trip-operation-dialog-content">
        <header className="trip-operation-dialog-header">
          <span className="trip-operation-dialog-icon">{icon}</span>
          <div className="trip-operation-dialog-HeadingText">
            <small>GESTIONAR VIAJE</small>
            <div className="trip-operation-dialog-title-row">
              <h2 id="trip-operation-modal-title">{title}</h2>
              {badge && <span className="trip-operation-dialog-badge">{badge}</span>}
            </div>
          </div>
          <button
            type="button"
            className="trip-operation-close-btn"
            disabled={busy}
            onClick={onClose}
            aria-label={`Cerrar ${title}`}
          >
            <IconCross size={16} />
          </button>
        </header>
        <div className="trip-operation-dialog-body">{children}</div>
        <footer className="trip-operation-dialog-footer">
          <button type="button" className="trip-operation-done-btn" disabled={busy} onClick={onClose}>
            Listo
          </button>
        </footer>
      </div>
    </dialog>,
    document.body
  );
}
