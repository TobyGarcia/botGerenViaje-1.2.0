import { useEffect, useRef, useState } from "react";
import { IconCamera, IconRotate, IconAlert } from "./Icons.jsx";
import { createCameraSession, cameraErrorMessage } from "../services/camera-session.js";
import { createPortal } from "react-dom";
import "./CameraModal.css";

export default function CameraModal({ onCapture, onClose }) {
  const videoRef = useRef(null);
  const dialogRef = useRef(null);
  const streamRef = useRef(null);
  const sessionRef = useRef(null);
  const mountedRef = useRef(false);
  const [facingMode, setFacingMode] = useState("environment");
  const [cameraError, setCameraError] = useState("");
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [capturing, setCapturing] = useState(false);

  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog?.showModal();
    return () => { dialog?.close(); document.body.style.overflow = previousOverflow; };
  }, []);

  useEffect(() => {
    let disposed = false;
    const session = createCameraSession(navigator.mediaDevices);
    sessionRef.current = session;

    async function initCamera() {
      setLoading(true);
      setCameraError("");

      try {
        const stream = await session.start(facingMode);
        if (!stream || disposed) return;
        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        if (!disposed) setLoading(false);
      } catch (err) {
        if (disposed) return;
        session.stop();
        setCameraError(cameraErrorMessage(err));
        setLoading(false);
      }
    }

    void initCamera();

    return () => {
      disposed = true;
      session.stop();
    };
  }, [facingMode, attempt]);

  function stopTracks() {
    sessionRef.current?.stop();
    streamRef.current = null;
  }

  function handleTakeSnapshot() {
    const video = videoRef.current;
    if (!video || capturing || loading || !video.videoWidth || !video.videoHeight || video.readyState < 2) return;
    setCapturing(true);

    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) { setCapturing(false); setCameraError("No se pudo preparar la fotografía. Vuelve a intentarlo."); return; }
    ctx.drawImage(video, 0, 0, width, height);

    canvas.toBlob(
      (blob) => {
        if (!mountedRef.current) return;
        if (blob) {
          const file = new File([blob], `camara_${Date.now()}.jpg`, { type: "image/jpeg" });
          stopTracks();
          onCapture(file);
        } else {
          setCameraError("No se pudo capturar la fotografía. Vuelve a intentarlo.");
        }
        setCapturing(false);
      },
      "image/jpeg",
      0.9
    );
  }

  function toggleCameraFacing() {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  }

  function handleClose() {
    stopTracks();
    onClose();
  }

  return createPortal(
    <dialog ref={dialogRef} className="gv-camera-dialog" aria-labelledby="gv-camera-title"
      onCancel={event => { event.preventDefault(); handleClose(); }}>
      <header className="gv-camera-header">
        <div className="gv-camera-heading">
          <span className="gv-camera-mark" aria-hidden="true"><IconCamera size={21} /></span>
          <div><h2 id="gv-camera-title">Tomar foto</h2><p>Encuadra y mantén el teléfono estable</p></div>
        </div>
        <button type="button" className="gv-camera-control gv-camera-close" onClick={handleClose} aria-label="Cerrar cámara">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
        </button>
      </header>
      <div className="gv-camera-stage">
        <video ref={videoRef} playsInline autoPlay muted className={facingMode === "user" ? "gv-camera-video gv-camera-video-front" : "gv-camera-video"}
          style={{ visibility: cameraError ? "hidden" : "visible" }} />
        {!loading && !cameraError && <span className="gv-camera-live"><span aria-hidden="true" />{facingMode === "user" ? "Cámara frontal" : "Cámara trasera"}</span>}
        {loading && <div className="gv-camera-state" role="status"><span className="gv-camera-spinner" aria-hidden="true" /><p>Abriendo cámara…</p></div>}
        {cameraError && <div className="gv-camera-state gv-camera-error" role="alert">
          <IconAlert size={30} /><h3>No pudimos abrir la cámara</h3><p>{cameraError}</p>
          <button type="button" className="gv-camera-control gv-camera-retry" onClick={() => { setCapturing(false); setAttempt(value => value + 1); }}>Volver a intentar</button>
        </div>}
      </div>
      <footer className="gv-camera-footer">
        <p className="gv-camera-hint" role="status">{capturing ? "Preparando tu fotografía…" : loading ? "Permite el acceso a la cámara para continuar" : cameraError ? "Puedes cerrar el visor y volver cuando estés listo" : "Toca el círculo para tomar la foto"}</p>
        <div className="gv-camera-controls">
          <span className="gv-camera-mode" aria-hidden="true">FOTO</span>
          <button type="button" className="gv-camera-control gv-camera-shutter" onClick={handleTakeSnapshot}
            disabled={loading || capturing || Boolean(cameraError)} aria-label={capturing ? "Capturando fotografía" : "Capturar foto"}>
            <span />
          </button>
          <button type="button" className="gv-camera-control gv-camera-flip" onClick={toggleCameraFacing}
            disabled={loading || capturing || Boolean(cameraError)} aria-label="Cambiar cámara">
            <IconRotate size={24} />
          </button>
        </div>
      </footer>
    </dialog>, document.body
  );
}
