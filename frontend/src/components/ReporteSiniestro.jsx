import { useState } from "react";
import { crearReporteSiniestro } from "../services/api.js";
import { compressImageToMaxKb } from "../utils/imageCompressor.js";
import CameraModal from "./CameraModal.jsx";
import {
  IconCamera,
  IconFolder,
  IconRefresh,
  IconCheck,
  IconMapPin,
  IconAlert
} from "./Icons.jsx";

const TIPOS_SINIESTRO = [
  { label: "💥 Choque / Colisión", value: "CHOQUE / COLISIÓN" },
  { label: "🚗 Rozón / Llegada Lateral", value: "ROZÓN / LLEGADA" },
  { label: "🛞 Ponchadura de Llanta", value: "PONCHADURA DE LLANTA" },
  { label: "🔧 Falla Mecánica Grave", value: "FALLA MECÁNICA GRAVE" },
  { label: "⚠️ Volcadura", value: "VOLCADURA" },
  { label: "⚡ Otro Incidente de Riesgo", value: "OTRO INCIDENTE" }
];

export default function ReporteSiniestro({ conductor, vehiculoAsignado, onComplete, onCancel }) {
  const [tipoSiniestro, setTipoSiniestro] = useState(TIPOS_SINIESTRO[0].value);
  const [descripcion, setDescripcion] = useState("");

  const [location, setLocation] = useState({
    latitude: null,
    longitude: null,
    altitude: null,
    accuracy: null,
    loading: false,
    error: ""
  });

  const [photos, setPhotos] = useState(
    Array.from({ length: 6 }, () => ({
      name: "",
      preview: "",
      base64: "",
      sizeKb: 0,
      compressing: false
    }))
  );

  const [activeCameraIndex, setActiveCameraIndex] = useState(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  function captureGpsLocation() {
    if (!navigator.geolocation) {
      setLocation((prev) => ({ ...prev, error: "Tu dispositivo no soporta geolocalización GPS." }));
      return;
    }

    setLocation((prev) => ({ ...prev, loading: true, error: "" }));

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          altitude: pos.coords.altitude ? Math.round(pos.coords.altitude) : null,
          accuracy: pos.coords.accuracy ? Math.round(pos.coords.accuracy) : null,
          loading: false,
          error: ""
        });
      },
      (err) => {
        console.warn("Error capturando GPS:", err);
        setLocation({
          latitude: null,
          longitude: null,
          altitude: null,
          accuracy: null,
          loading: false,
          error: "No fue posible obtener las coordenadas GPS. Verifica tus permisos de ubicación."
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0
      }
    );
  }

  async function processPhoto(index, file) {
    if (!file) return;

    setPhotos((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], compressing: true };
      return next;
    });
    setError("");

    try {
      const compressed = await compressImageToMaxKb(file, 70);
      setPhotos((prev) => {
        const next = [...prev];
        next[index] = {
          name: file.name,
          preview: compressed.base64,
          base64: compressed.base64,
          sizeKb: compressed.sizeKb,
          compressing: false
        };
        return next;
      });
    } catch (err) {
      console.error("Error al procesar foto de siniestro:", err);
      setError(`No se pudo comprimir la foto ${index + 1}.`);
      setPhotos((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], compressing: false };
        return next;
      });
    }
  }

  function handleFileChange(index, event) {
    const file = event.target.files?.[0];
    if (file) {
      void processPhoto(index, file);
    }
  }

  function handleCameraCapture(file) {
    const idx = activeCameraIndex;
    setActiveCameraIndex(null);
    if (idx !== null && file) {
      void processPhoto(idx, file);
    }
  }

  function clearPhoto(index) {
    setPhotos((prev) => {
      const next = [...prev];
      next[index] = { name: "", preview: "", base64: "", sizeKb: 0, compressing: false };
      return next;
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    if (!tipoSiniestro) {
      setError("Por favor selecciona el tipo de siniestro / incidente.");
      return;
    }

    const anyCompressing = photos.some((p) => p.compressing);
    if (anyCompressing) {
      setError("Por favor espera a que terminen de procesarse todas las imágenes.");
      return;
    }

    const activePhotos = photos
      .filter((p) => p.base64)
      .map((p) => ({ base64: p.base64, name: p.name, sizeKb: p.sizeKb }));

    setSending(true);

    try {
      const payload = {
        idVehiculo: vehiculoAsignado?.id_vehiculos || null,
        tipoSiniestro,
        descripcion: descripcion.trim(),
        latitud: location.latitude,
        longitud: location.longitude,
        altitud: location.altitude,
        fotos: activePhotos
      };

      const response = await crearReporteSiniestro(payload);
      if (response?.success) {
        setSuccessMsg("¡Reporte de siniestro registrado exitosamente! Las alertas con fotos y documento PDF han sido enviadas a supervisión.");
        if (typeof onComplete === "function") {
          setTimeout(() => {
            onComplete(response.data?.siniestro);
          }, 1500);
        }
      } else {
        setError(response?.message || "No fue posible enviar el reporte.");
      }
    } catch (err) {
      console.error("Error al enviar reporte de siniestro:", err);
      setError(err.message || "Ocurrió un error de red al transmitir la alerta de siniestro.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="siniestro-card" style={{ background: "#ffffff", borderRadius: "16px", padding: "20px", border: "2px solid #ef4444", boxShadow: "0 6px 20px rgba(239, 68, 68, 0.15)", margin: "0 auto 24px auto", maxWidth: "580px" }}>
      {/* Encabezado */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px", borderBottom: "1px solid #fee2e2", paddingBottom: "12px" }}>
        <div style={{ width: "46px", height: "46px", borderRadius: "12px", background: "#fef2f2", color: "#dc2626", display: "flex", alignItems: "center", justifyContent: "center", shrink: 0 }}>
          <IconAlert size={28} color="#dc2626" />
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: "1.2rem", color: "#991b1b", fontWeight: "800" }}>Reporte de Siniestro e Incidencias</h2>
          <small style={{ color: "#7f1d1d", fontSize: "0.82rem" }}>Reporta colisiones, ponchaduras o fallas mecánicas de emergencia.</small>
        </div>
      </div>

      <div style={{ background: "#fff7ed", border: "1px solid #ffedd5", borderRadius: "10px", padding: "10px 12px", marginBottom: "16px", fontSize: "0.84rem", color: "#c2410c", lineHeight: "1.4" }}>
        <strong>⚠️ Nota de Emergencia:</strong> Al enviar este formulario se generará automáticamente la **alerta oficial con ubicación GPS, fotos y reporte PDF** a los canales de supervisión y gerencia.
      </div>

      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", color: "#991b1b", padding: "10px 12px", borderRadius: "8px", fontSize: "0.88rem", marginBottom: "14px", fontWeight: "600" }}>
          ⚠️ {error}
        </div>
      )}

      {successMsg && (
        <div style={{ background: "#f0fdf4", border: "1px solid #86efac", color: "#166534", padding: "10px 12px", borderRadius: "8px", fontSize: "0.88rem", marginBottom: "14px", fontWeight: "700" }}>
          ✅ {successMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {/* Tipo de Siniestro */}
        <div>
          <label htmlFor="select-tipo-siniestro" style={{ display: "block", fontWeight: "700", color: "#1e293b", fontSize: "0.88rem", marginBottom: "6px" }}>
            1. Tipo de Siniestro / Incidente *
          </label>
          <select
            id="select-tipo-siniestro"
            value={tipoSiniestro}
            onChange={(e) => setTipoSiniestro(e.target.value)}
            required
            style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "2px solid #ef4444", fontSize: "0.95rem", fontWeight: "700", color: "#991b1b", background: "#fef2f2" }}
          >
            {TIPOS_SINIESTRO.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Descripción */}
        <div>
          <label htmlFor="input-desc-siniestro" style={{ display: "block", fontWeight: "700", color: "#1e293b", fontSize: "0.88rem", marginBottom: "6px" }}>
            2. Descripción del Incidente
          </label>
          <textarea
            id="input-desc-siniestro"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Describe brevemente lo sucedido (estado de ocupantes, daños visibles, causa)..."
            rows={3}
            style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.9rem", color: "#0f172a", fontFamily: "inherit" }}
          />
        </div>

        {/* Ubicación GPS y Altitud */}
        <div style={{ border: "1px solid #cbd5e1", borderRadius: "10px", padding: "12px", background: "#f8fafc" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", flexWrap: "wrap", gap: "8px" }}>
            <span style={{ fontWeight: "700", fontSize: "0.88rem", color: "#334155", display: "inline-flex", alignItems: "center", gap: "6px" }}>
              <IconMapPin size={18} color="#0284c7" /> 3. Ubicación GPS y Altitud
            </span>
            <button
              type="button"
              onClick={captureGpsLocation}
              disabled={location.loading}
              style={{ background: "#0284c7", color: "#ffffff", border: 0, padding: "6px 12px", borderRadius: "6px", fontSize: "0.8rem", fontWeight: "700", cursor: location.loading ? "wait" : "pointer", display: "inline-flex", alignItems: "center", gap: "4px" }}
            >
              {location.loading ? <IconRefresh size={14} className="spin" /> : <IconMapPin size={14} />}
              {location.loading ? "Obteniendo GPS..." : "📍 Capturar Ubicación GPS"}
            </button>
          </div>

          {location.latitude ? (
            <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: "6px", padding: "8px 10px", fontSize: "0.82rem", color: "#065f46" }}>
              <div><strong>Coordenadas:</strong> Lat {location.latitude.toFixed(6)}, Lon {location.longitude.toFixed(6)}</div>
              {location.altitude !== null && <div><strong>Altitud:</strong> ⛰️ {location.altitude} m.s.n.m.</div>}
              {location.accuracy !== null && <div><strong>Precisión:</strong> ±{location.accuracy} metros</div>}
            </div>
          ) : (
            <div style={{ fontSize: "0.8rem", color: "#64748b" }}>
              {location.error ? (
                <span style={{ color: "#dc2626", fontWeight: "600" }}>⚠️ {location.error}</span>
              ) : (
                "Presiona el botón para incluir tus coordenadas y altitud en el reporte."
              )}
            </div>
          )}
        </div>

        {/* Evidencias Fotográficas (Hasta 6 fotos) */}
        <div>
          <label style={{ display: "block", fontWeight: "700", color: "#1e293b", fontSize: "0.88rem", marginBottom: "8px" }}>
            📷 4. Evidencias Fotográficas (Máx. 6 Fotos comprimidas ≤ 70KB)
          </label>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "10px" }}>
            {photos.map((photo, idx) => (
              <div key={idx} style={{ border: "1px dashed #cbd5e1", borderRadius: "10px", padding: "8px", textAlign: "center", background: "#f8fafc", position: "relative" }}>
                <span style={{ fontSize: "0.76rem", fontWeight: "700", color: "#475569", display: "block", marginBottom: "6px" }}>
                  Foto {idx + 1} {idx < 2 ? "*" : ""}
                </span>

                {photo.compressing ? (
                  <div style={{ height: "80px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#0284c7", fontSize: "0.76rem", gap: "4px" }}>
                    <IconRefresh size={18} className="spin" />
                    <span>Comprimiendo...</span>
                  </div>
                ) : photo.base64 ? (
                  <div>
                    <img src={photo.preview} alt={`Evidencia ${idx + 1}`} style={{ width: "100%", height: "80px", objectFit: "cover", borderRadius: "6px", border: "1px solid #cbd5e1", marginBottom: "4px" }} />
                    <div style={{ fontSize: "0.72rem", color: "#166534", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center", gap: "2px" }}>
                      <IconCheck size={12} /> {photo.sizeKb} KB
                    </div>
                    <button
                      type="button"
                      onClick={() => clearPhoto(idx)}
                      style={{ background: "#ef4444", color: "#fff", border: 0, padding: "2px 6px", borderRadius: "4px", fontSize: "0.7rem", cursor: "pointer", marginTop: "4px" }}
                    >
                      Quitar
                    </button>
                  </div>
                ) : (
                  <div>
                    <div style={{ height: "60px", background: "#e2e8f0", borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: "0.74rem", marginBottom: "6px" }}>
                      Sin foto
                    </div>
                    <div style={{ display: "flex", gap: "4px", justifyContent: "center" }}>
                      <button
                        type="button"
                        onClick={() => setActiveCameraIndex(idx)}
                        style={{ flex: 1, background: "#2563eb", color: "#fff", border: 0, padding: "5px 4px", borderRadius: "4px", fontSize: "0.72rem", fontWeight: "600", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "2px" }}
                        title="Tomar foto con cámara"
                      >
                        <IconCamera size={12} /> Cámara
                      </button>
                      <label style={{ flex: 1, background: "#475569", color: "#fff", padding: "5px 4px", borderRadius: "4px", fontSize: "0.72rem", fontWeight: "600", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "2px" }}>
                        <IconFolder size={12} /> Archivo
                        <input type="file" accept="image/*" onChange={(e) => handleFileChange(idx, e)} style={{ display: "none" }} />
                      </label>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Botones de Acción */}
        <div style={{ display: "flex", gap: "10px", marginTop: "8px" }}>
          {typeof onCancel === "function" && (
            <button
              type="button"
              onClick={onCancel}
              className="secondary-button"
              style={{ flex: 1, padding: "12px", borderRadius: "8px", border: "1px solid #cbd5e1", background: "#ffffff", color: "#334155", fontWeight: "700", cursor: "pointer" }}
            >
              Cancelar
            </button>
          )}
          <button
            type="submit"
            disabled={sending || photos.some((p) => p.compressing)}
            style={{
              flex: 2,
              padding: "12px",
              borderRadius: "8px",
              border: 0,
              background: sending ? "#94a3b8" : "linear-gradient(135deg, #dc2626, #b91c1c)",
              color: "#ffffff",
              fontWeight: "800",
              fontSize: "0.98rem",
              cursor: sending ? "wait" : "pointer",
              boxShadow: "0 4px 14px rgba(220, 38, 38, 0.35)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px"
            }}
          >
            {sending ? <IconRefresh size={18} className="spin" /> : <IconAlert size={18} />}
            {sending ? "ENVIANDO REPORTE DE SINIESTRO..." : "🚨 ENVIAR REPORTE DE SINIESTRO"}
          </button>
        </div>
      </form>

      {/* Visor de Cámara */}
      {activeCameraIndex !== null && (
        <CameraModal
          onCapture={handleCameraCapture}
          onClose={() => setActiveCameraIndex(null)}
        />
      )}
    </div>
  );
}
