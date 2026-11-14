import {useModalBack} from '../hooks/useModalBack.js';
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import "./SupervisorUpdateDialog.css";

export default function SupervisorUpdateDialog({ version, checking, message, onDownload, onLater, stage, progress, ready }) {
  const dialog = useRef(null);
  useModalBack(true,onLater,checking,90);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return createPortal(<dialog ref={dialog} className="supervisor-update-dialog" aria-labelledby="supervisor-update-title"
    aria-describedby="supervisor-update-description" onCancel={event => { event.preventDefault(); if (!checking) onLater(); }}>
    <button type="button" className="supervisor-update-close" aria-label="Cerrar actualización" disabled={checking} onClick={onLater}>×</button>
    <div className="supervisor-update-symbol" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3v12m-4-4 4 4 4-4M5 16v4a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-4" />
      </svg>
    </div>
    <span className="supervisor-update-brand">GV MOBILITY</span>
    <h2 id="supervisor-update-title">Hay una nueva versión</h2>
    <p id="supervisor-update-description">Actualiza la aplicación para contar con las últimas mejoras.</p>
    <span className="supervisor-update-version">Versión {version}</span>
    <p className="supervisor-update-hint">La instalación conserva tu cuenta. Termina cualquier revisión antes de actualizar.</p>
    {message && <p className="supervisor-update-feedback" role="alert">{message}</p>}
    {stage === "downloading" && <div className="supervisor-update-download" role="status">
      <span>{progress === null ? "Descargando actualización…" : `Descargando actualización: ${progress}%`}</span>
      <progress aria-label="Descarga de actualización" max="100" value={progress === null ? undefined : progress} />
      <span>La descarga se guarda dentro de la aplicación.</span>
    </div>}
    <button className="supervisor-update-primary" type="button" disabled={checking} onClick={onDownload} autoFocus>
      {checking ? (stage === "downloading" ? "Descargando…" : stage === "installing" ? "Preparando instalación…" : "Verificando…") : ready ? "Instalar actualización" : "Actualizar ahora"}
    </button>
    <button className="supervisor-update-later" type="button" disabled={checking} onClick={onLater}>Más tarde</button>
  </dialog>, document.body);
}
