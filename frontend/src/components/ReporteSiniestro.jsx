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
  IconAlert,
  IconPlus,
  IconCross
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

  const [photos, setPhotos] = useState([]);
  const [compressingNew, setCompressingNew] = useState(false);
  const [showPickerModal, setShowPickerModal] = useState(false);
  const [showCameraModal, setShowCameraModal] = useState(false);
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

  async function processAndAddPhoto(file) {
    if (!file) return;
    if (photos.length >= 6) return;

    setCompressingNew(true);
    setError("");

    try {
      const compressed = await compressImageToMaxKb(file, 70);
      setPhotos((prev) => [
        ...prev,
        {
          name: file.name || `foto_${prev.length + 1}.jpg`,
          preview: compressed.base64,
          base64: compressed.base64,
          sizeKb: compressed.sizeKb
        }
      ]);
    } catch (err) {
      console.error("Error al procesar foto de siniestro:", err);
      setError("No se pudo comprimir la foto seleccionada.");
    } finally {
      setCompressingNew(false);
    }
  }

  function handleFileSelect(event) {
    const file = event.target.files?.[0];
    if (file) {
      void processAndAddPhoto(file);
    }
    if (event.target) event.target.value = "";
  }

  function handleCameraCapture(file) {
    setShowCameraModal(false);
    if (file) {
      void processAndAddPhoto(file);
    }
  }

  function removePhoto(index) {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <label style={{ fontWeight: "700", color: "#1e293b", fontSize: "0.88rem", margin: 0 }}>
              📷 4. Evidencias Fotográficas ({photos.length}/6 Fotos)
            </label>
            <span style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: "600" }}>
              Máx. 70KB / foto
            </span>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "center" }}>
            {/* Lista de Fotos en Formato Thumbnail */}
            {photos.map((photo, idx) => (
              <div
                key={idx}
                style={{
                  width: "95px",
                  height: "95px",
                  borderRadius: "12px",
                  border: "2px solid #22c55e",
                  background: "#000000",
                  position: "relative",
                  overflow: "hidden",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
                  boxSizing: "border-box"
                }}
              >
                <img
                  src={photo.preview}
                  alt={`Evidencia ${idx + 1}`}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
                <div
                  style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    background: "rgba(0, 0, 0, 0.7)",
                    color: "#ffffff",
                    fontSize: "0.65rem",
                    fontWeight: "700",
                    textAlign: "center",
                    padding: "2px 0"
                  }}
                >
                  ✓ {photo.sizeKb} KB
                </div>
                <button
                  type="button"
                  onClick={() => removePhoto(idx)}
                  title="Eliminar foto"
                  style={{
                    position: "absolute",
                    top: "4px",
                    right: "4px",
                    width: "22px",
                    height: "22px",
                    borderRadius: "50%",
                    background: "#ef4444",
                    color: "#ffffff",
                    border: "1.5px solid #ffffff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.3)"
                  }}
                >
                  <IconCross size={12} color="#ffffff" />
                </button>
              </div>
            ))}

            {/* Thumbnail de Carga durante la compresión */}
            {compressingNew && (
              <div
                style={{
                  width: "95px",
                  height: "95px",
                  borderRadius: "12px",
                  border: "2px dashed #0284c7",
                  background: "#f0f9ff",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#0284c7",
                  fontSize: "0.7rem",
                  gap: "4px",
                  boxSizing: "border-box"
                }}
              >
                <IconRefresh size={20} className="spin" />
                <span style={{ fontWeight: "700" }}>Procesando...</span>
              </div>
            )}

            {/* Un solo Cuadro Blanco con el símbolo PLUS en medio */}
            {photos.length < 6 && !compressingNew && (
              <button
                type="button"
                onClick={() => setShowPickerModal(true)}
                style={{
                  width: "95px",
                  height: "95px",
                  borderRadius: "12px",
                  border: "2px dashed #94a3b8",
                  background: "#ffffff",
                  color: "#0284c7",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  gap: "4px",
                  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.05)",
                  boxSizing: "border-box",
                  transition: "all 0.15s ease"
                }}
              >
                <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "#e0f2fe", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <IconPlus size={20} color="#0284c7" />
                </div>
                <span style={{ fontSize: "0.72rem", fontWeight: "700", color: "#334155" }}>Agregar</span>
              </button>
            )}
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
            disabled={sending || compressingNew}
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

      {/* Modal / Selector de Origen de Foto */}
      {showPickerModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.6)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
          <div style={{ background: "#ffffff", borderRadius: "16px", padding: "20px", width: "100%", maxWidth: "340px", boxShadow: "0 10px 25px rgba(0,0,0,0.2)", textAlign: "center" }}>
            <h3 style={{ margin: "0 0 6px 0", fontSize: "1.05rem", color: "#0f172a", fontWeight: "800" }}>📷 Opciones de Evidencia</h3>
            <p style={{ margin: "0 0 16px 0", fontSize: "0.82rem", color: "#64748b" }}>Selecciona cómo deseas adjuntar la fotografía:</p>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <button
                type="button"
                onClick={() => {
                  setShowPickerModal(false);
                  setShowCameraModal(true);
                }}
                style={{ width: "100%", padding: "12px", borderRadius: "10px", border: 0, background: "#2563eb", color: "#ffffff", fontWeight: "700", fontSize: "0.9rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
              >
                <IconCamera size={18} /> Tomar Foto con Cámara
              </button>

              <label
                style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #cbd5e1", background: "#f8fafc", color: "#334155", fontWeight: "700", fontSize: "0.9rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", boxSizing: "border-box" }}
              >
                <IconFolder size={18} color="#0284c7" /> Elegir de Galería / Archivos
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    setShowPickerModal(false);
                    handleFileSelect(e);
                  }}
                  style={{ display: "none" }}
                />
              </label>

              <button
                type="button"
                onClick={() => setShowPickerModal(false)}
                style={{ width: "100%", padding: "10px", borderRadius: "10px", border: 0, background: "transparent", color: "#64748b", fontWeight: "600", fontSize: "0.85rem", cursor: "pointer", marginTop: "4px" }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Visor de Cámara */}
      {showCameraModal && (
        <CameraModal
          onCapture={handleCameraCapture}
          onClose={() => setShowCameraModal(false)}
        />
      )}
    </div>
  );
}
