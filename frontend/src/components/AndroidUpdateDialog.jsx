import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import "./AndroidUpdateDialog.css";

export default function AndroidUpdateDialog({ version, checking, message, onDownload, onLater }) {
  const dialog = useRef(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return createPortal(<dialog ref={dialog} className="android-update-dialog" aria-labelledby="android-update-title"
    aria-describedby="android-update-description" onCancel={event => { event.preventDefault(); if (!checking) onLater(); }}>
    <div className="android-update-symbol" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3v12m-4-4 4 4 4-4M5 16v4a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-4" />
      </svg>
    </div>
    <span className="android-update-brand">GV MOBILITY</span>
    <h2 id="android-update-title">Hay una nueva versión</h2>
    <p id="android-update-description">Actualiza la aplicación para contar con las últimas mejoras.</p>
    <span className="android-update-version">Versión {version}</span>
    <p className="android-update-hint">Si tienes un viaje activo, puedes hacerlo al terminar y sincronizar tus datos.</p>
    {message && <p className="android-update-feedback" role="alert">{message}</p>}
    <button className="android-update-primary" type="button" disabled={checking} onClick={onDownload} autoFocus>
      {checking ? "Verificando…" : "Actualizar ahora"}
    </button>
    <button className="android-update-later" type="button" disabled={checking} onClick={onLater}>Más tarde</button>
  </dialog>, document.body);
}
