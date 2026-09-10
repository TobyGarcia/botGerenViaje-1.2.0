import { useEffect, useRef, useState } from "react";
import { IconCamera, IconRotate, IconAlert } from "./Icons.jsx";

export default function CameraModal({ onCapture, onClose }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [facingMode, setFacingMode] = useState("environment");
  const [cameraError, setCameraError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let activeStream = null;

    async function initCamera() {
      setLoading(true);
      setCameraError("");

      try {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
        }

        const constraints = {
          video: facingMode ? { facingMode: facingMode } : true,
          audio: false
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = stream;
        activeStream = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setLoading(false);
      } catch (err) {
        console.warn("Fallo al acceder a la cámara mediante WebRTC:", err);
        setCameraError(
          "No se pudo acceder al visor directo de cámara. Puedes seleccionar la opción de 'Elegir archivo'."
        );
        setLoading(false);
      }
    }

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      initCamera();
    } else {
      setCameraError("Tu navegador no soporta el visor directo de cámara.");
      setLoading(false);
    }

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [facingMode]);

  function stopTracks() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
  }

  function handleTakeSnapshot() {
    const video = videoRef.current;
    if (!video) return;

    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, width, height);

    canvas.toBlob(
      (blob) => {
        if (blob) {
          const file = new File([blob], `camara_${Date.now()}.jpg`, { type: "image/jpeg" });
          stopTracks();
          onCapture(file);
        }
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

  return (
    <div
      className="modal-overlay"
      style={{
        zIndex: 10000,
        backgroundColor: "rgba(0, 0, 0, 0.92)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        padding: "12px",
        boxSizing: "border-box"
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        style={{
          width: "100%",
          maxWidth: "460px",
          maxHeight: "96vh",
          background: "#0f172a",
          borderRadius: "16px",
          overflow: "hidden",
          boxShadow: "0 20px 25px -5px rgba(0,0,0,0.5)",
          display: "flex",
          flexDirection: "column",
          border: "1px solid #334155"
        }}
      >
        {/* Encabezado */}
        <div
          style={{
            padding: "12px 16px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderBottom: "1px solid #1e293b",
            background: "#0f172a"
          }}
        >
          <span style={{ color: "#f8fafc", fontWeight: "600", fontSize: "0.95rem", display: "flex", alignItems: "center", gap: "6px" }}>
            <IconCamera size={18} color="#38bdf8" /> Visor de Cámara
          </span>
          <button
            type="button"
            onClick={handleClose}
            style={{
              background: "transparent",
              border: "none",
              color: "#94a3b8",
              fontSize: "1.6rem",
              lineHeight: 1,
              cursor: "pointer",
              padding: "4px"
            }}
            aria-label="Cerrar cámara"
          >
            ×
          </button>
        </div>

        {/* Área del video / visor */}
        <div
          style={{
            position: "relative",
            width: "100%",
            aspectRatio: "4/3",
            background: "#000",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden"
          }}
        >
          {loading && (
            <p style={{ color: "#38bdf8", fontSize: "0.9rem" }}>Iniciando cámara...</p>
          )}

          {cameraError ? (
            <div style={{ padding: "20px", textAlign: "center", color: "#fca5a5" }}>
              <div style={{ marginBottom: "8px" }}><IconAlert size={32} color="#fca5a5" /></div>
              <p style={{ fontSize: "0.88rem", margin: 0 }}>{cameraError}</p>
            </div>
          ) : (
            <video
              ref={videoRef}
              playsInline
              autoPlay
              muted
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                transform: facingMode === "user" ? "scaleX(-1)" : "none"
              }}
            />
          )}
        </div>

        {/* Acciones */}
        <div
          style={{
            padding: "14px 16px",
            display: "flex",
            gap: "10px",
            justifyContent: "center",
            alignItems: "center",
            flexWrap: "wrap",
            background: "#0f172a"
          }}
        >
          {!cameraError && !loading && (
            <>
              <button
                type="button"
                onClick={toggleCameraFacing}
                style={{
                  background: "#334155",
                  color: "#f8fafc",
                  border: "none",
                  padding: "10px 14px",
                  borderRadius: "20px",
                  fontSize: "0.85rem",
                  fontWeight: "600",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px"
                }}
              >
                <IconRotate size={16} /> Voltear
              </button>

              <button
                type="button"
                onClick={handleTakeSnapshot}
                style={{
                  background: "#16a34a",
                  color: "#ffffff",
                  border: "none",
                  padding: "12px 20px",
                  borderRadius: "24px",
                  fontSize: "0.95rem",
                  fontWeight: "bold",
                  cursor: "pointer",
                  boxShadow: "0 4px 12px rgba(22, 163, 74, 0.4)",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px"
                }}
              >
                <IconCamera size={18} /> Capturar Foto
              </button>
            </>
          )}

          <button
            type="button"
            onClick={handleClose}
            style={{
              background: "#475569",
              color: "#f8fafc",
              border: "none",
              padding: "10px 16px",
              borderRadius: "20px",
              fontSize: "0.85rem",
              cursor: "pointer"
            }}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
