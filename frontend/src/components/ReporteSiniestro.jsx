import { useState, useEffect } from "react";
import { crearReporteSiniestro } from "../services/api.js";
import { compressImageToMaxKb } from "../utils/imageCompressor.js";
import { savePendingSiniestro, countPendingSiniestros } from "../services/siniestro-storage.js";
import { syncPendingSiniestros, onSiniestroSyncEvent } from "../services/siniestro-sync.js";
import CameraModal from "./CameraModal.jsx";
import "./ReporteSiniestro.css";

const TIPOS_SINIESTRO = [
  { label: "Choque / Colisión", value: "Choque / Colisión" },
  { label: "Ponchadura de Neumático", value: "Ponchadura de Neumático" },
  { label: "Falla Mecánica de Emergencia", value: "Falla Mecánica de Emergencia" },
  { label: "Robo / Intento de Vandalismo", value: "Robo / Intento de Vandalismo" },
  { label: "Condición Climática Severa", value: "Condición Climática Severa" },
  { label: "Otro Incidente Grave", value: "Otro Incidente Grave" }
];

export default function ReporteSiniestro({ _conductor, vehiculoAsignado, onComplete, onCancel }) {
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
  const [pendingCount, setPendingCount] = useState(0);
  const [isManualSyncing, setIsManualSyncing] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadCount() {
      try {
        const c = await countPendingSiniestros();
        if (isMounted) setPendingCount(c);
      } catch {
        if (isMounted) setPendingCount(0);
      }
    }

    void loadCount();

    const unsubscribe = onSiniestroSyncEvent(() => {
      void loadCount();
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const handleManualSync = async () => {
    if (isManualSyncing || !navigator.onLine) return;
    setIsManualSyncing(true);
    try {
      const res = await syncPendingSiniestros();
      if (res.synced > 0) {
        setSuccessMsg(`✅ ¡Se sincronizaron exitosamente ${res.synced} reporte(s) guardado(s) localmente!`);
      }
      const c = await countPendingSiniestros();
      setPendingCount(c);
    } catch (err) {
      console.error("Error en sincronización manual de siniestros:", err);
    } finally {
      setIsManualSyncing(false);
    }
  };

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

    const payload = {
      idVehiculo: vehiculoAsignado?.id_vehiculos || null,
      tipoSiniestro,
      descripcion: descripcion.trim(),
      latitud: location.latitude,
      longitud: location.longitude,
      altitud: location.altitude,
      fotos: activePhotos
    };

    // Modo Offline o Conexión sin señal: Guardar directamente en caché local de la PWA
    if (!navigator.onLine) {
      try {
        await savePendingSiniestro(payload);
        const newCount = await countPendingSiniestros();
        setPendingCount(newCount);
        setSuccessMsg("📱 Reporte guardado localmente (Modo Offline). Se enviará automáticamente a supervisión en cuanto recuperes conexión a internet.");
        if (typeof onComplete === "function") {
          setTimeout(() => {
            onComplete({ ...payload, offlinePending: true });
          }, 2000);
        }
      } catch (saveErr) {
        console.error("Error guardando siniestro offline:", saveErr);
        setError("No fue posible guardar el reporte en la memoria local del teléfono.");
      } finally {
        setSending(false);
      }
      return;
    }

    // Modo En Línea: Intentar envío por API
    try {
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
      console.warn("Fallo al enviar siniestro en línea, haciendo fallback a caché local:", err);
      if (!navigator.onLine || err.code === "NETWORK_ERROR" || err.code === "NETWORK_TIMEOUT" || err.status === 0 || err.message?.includes("fetch")) {
        try {
          await savePendingSiniestro(payload);
          const newCount = await countPendingSiniestros();
          setPendingCount(newCount);
          setSuccessMsg("📶 Conexión inestable. El reporte de siniestro fue guardado de forma segura en la caché de tu teléfono y se transmitirá automáticamente cuando haya señal.");
          if (typeof onComplete === "function") {
            setTimeout(() => {
              onComplete({ ...payload, offlinePending: true });
            }, 2000);
          }
          return;
        } catch (saveErr) {
          console.error("Error guardando siniestro en fallback local:", saveErr);
        }
      }
      setError(err.message || "Ocurrió un error de red al transmitir la alerta de siniestro.");
    } finally {
      setSending(false);
    }
  }

  // Cálculos de slots en la grilla para coincidir fielmente con el diseño
  const maxSlots = 3;
  const currentTotal = photos.length + (compressingNew ? 1 : 0) + (photos.length < 6 && !compressingNew ? 1 : 0);
  const placeholderCount = Math.max(0, maxSlots - currentTotal);

  return (
    <div className="siniestro-wrapper">
      <div className="siniestro-card-container">
        {/* Encabezado: Ícono y Título */}
        <div className="siniestro-header">
          <div className="siniestro-header-icon">
            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div>
            <h2 className="siniestro-header-title">Reporte de Siniestro e Incidencias</h2>
            <p className="siniestro-header-desc">Reporta colisiones, ponchaduras o fallas mecánicas de emergencia.</p>
          </div>
        </div>

        {/* Nota de Emergencia */}
        <div className="siniestro-emergency-notice">
          <div className="siniestro-emergency-title">
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path
                d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>Nota de Emergencia</span>
          </div>
          <p className="siniestro-emergency-text">
            Al enviar este formulario se generará automáticamente la{" "}
            <strong>alerta oficial con ubicación GPS, fotos y reporte PDF</strong> a los canales de supervisión y
            gerencia. Si no tienes internet en este momento, el reporte se guardará localmente y se enviará
            automáticamente en cuanto recuperes señal.
          </p>
        </div>

        {/* Banner de Pendientes Offline */}
        {pendingCount > 0 && (
          <div className="siniestro-offline-banner">
            <div>
              <strong>📱 Reportes offline pendientes ({pendingCount})</strong>
              <div style={{ fontSize: "0.7rem", opacity: 0.9 }}>Esperando conexión para transmitirse a supervisión.</div>
            </div>
            {navigator.onLine && (
              <button
                type="button"
                className="siniestro-offline-btn"
                onClick={handleManualSync}
                disabled={isManualSyncing}
              >
                {isManualSyncing ? "Enviando..." : "⚡ Sincronizar"}
              </button>
            )}
          </div>
        )}

        {/* Alerta de Error */}
        {error && (
          <div className="siniestro-alert-error">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Alerta de Éxito */}
        {successMsg && (
          <div className="siniestro-alert-success">
            <span>✅</span>
            <span>{successMsg}</span>
          </div>
        )}

        {/* Formulario */}
        <form className="siniestro-form" onSubmit={handleSubmit}>
          {/* Campo 1: Tipo de Siniestro / Incidente */}
          <div className="siniestro-field">
            <label className="siniestro-label" htmlFor="incident-type">
              <span>1. Tipo de Siniestro / Incidente</span>
              <span className="siniestro-required">*</span>
            </label>
            <div className="siniestro-select-wrapper">
              <div className="siniestro-select-icon">
                {/* Crash/Impact Icon SVG */}
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path
                    d="M12 3v3m6.364 1.636l-2.121 2.121M21 12h-3m1.636 6.364l-2.121-2.121M12 21v-3m-6.364 1.636l2.121-2.121M3 12h3m-1.636-6.364l2.121 2.121"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <select
                id="incident-type"
                className="siniestro-select"
                value={tipoSiniestro}
                onChange={(e) => setTipoSiniestro(e.target.value)}
                required
              >
                {TIPOS_SINIESTRO.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <div className="siniestro-select-chevron">
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </div>
            </div>
          </div>

          {/* Campo 2: Descripción del Incidente */}
          <div className="siniestro-field">
            <label className="siniestro-label" htmlFor="incident-desc">
              2. Descripción del Incidente
            </label>
            <textarea
              id="incident-desc"
              className="siniestro-textarea"
              rows={3}
              placeholder="Describe brevemente lo sucedido (estado de ocupantes, daños visibles, causa)..."
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
            />
          </div>

          {/* Campo 3: Ubicación GPS y Altitud */}
          <div className="siniestro-gps-card">
            <div className="siniestro-gps-header">
              <div className="siniestro-gps-title">
                <svg width="16" height="16" fill="none" stroke="#0284c7" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round" />
                  <path
                    d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span>3. Ubicación GPS y Altitud</span>
              </div>

              {/* Status Pill */}
              {location.loading ? (
                <span className="siniestro-gps-pill loading">
                  <span className="siniestro-pill-dot loading" />
                  Obteniendo GPS...
                </span>
              ) : location.latitude ? (
                <span className="siniestro-gps-pill success">
                  <span className="siniestro-pill-dot success" />
                  GPS Capturado
                </span>
              ) : location.error ? (
                <span className="siniestro-gps-pill error">
                  <span className="siniestro-pill-dot error" />
                  Sin Coordenadas
                </span>
              ) : (
                <span className="siniestro-gps-pill ready">
                  <span className="siniestro-pill-dot ready" />
                  Listo para capturar
                </span>
              )}
            </div>

            {/* Botón de Captura GPS */}
            <button
              id="btn-capture-gps"
              type="button"
              className={`siniestro-gps-btn ${location.latitude ? "captured" : "idle"}`}
              onClick={captureGpsLocation}
              disabled={location.loading}
            >
              {location.loading ? (
                <>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    style={{ animation: "spin 1s linear infinite" }}
                  >
                    <circle opacity="0.25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path opacity="0.75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span>Obteniendo Coordenadas...</span>
                </>
              ) : location.latitude ? (
                <>
                  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  <span>
                    {location.latitude.toFixed(4)}°, {location.longitude.toFixed(4)}°
                    {location.altitude !== null ? ` (${location.altitude} m)` : ""}
                  </span>
                </>
              ) : (
                <>
                  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path
                      d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-.778.099-1.533.284-2.253"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span>Capturar Ubicación GPS</span>
                </>
              )}
            </button>

            {location.latitude ? (
              <div className="siniestro-gps-details">
                <div>
                  <strong>Coordenadas:</strong> Lat {location.latitude.toFixed(6)}, Lon {location.longitude.toFixed(6)}
                </div>
                {location.altitude !== null && (
                  <div>
                    <strong>Altitud:</strong> ⛰️ {location.altitude} m.s.n.m.
                  </div>
                )}
                {location.accuracy !== null && (
                  <div>
                    <strong>Precisión:</strong> ±{location.accuracy} metros
                  </div>
                )}
              </div>
            ) : location.error ? (
              <p className="siniestro-gps-footnote" style={{ color: "#dc2626", fontWeight: "600" }}>
                ⚠️ {location.error}
              </p>
            ) : (
              <p className="siniestro-gps-footnote">
                Presiona el botón para incluir tus coordenadas y altitud en el reporte.
              </p>
            )}
          </div>

          {/* Campo 4: Evidencias Fotográficas */}
          <div className="siniestro-photos-section">
            <div className="siniestro-photos-header">
              <label className="siniestro-label">
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path
                    d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>4. Evidencias Fotográficas</span>
                <span style={{ color: "#94a3b8", fontWeight: 600 }}>({photos.length}/6)</span>
              </label>
              <span className="siniestro-badge-max">Máx. 70KB / foto</span>
            </div>

            {/* Grilla de Fotos */}
            <div className="siniestro-photos-grid">
              {/* Fotos Capturadas */}
              {photos.map((photo, idx) => (
                <div key={idx} className="siniestro-photo-preview-item">
                  <img src={photo.preview} alt={`Evidencia ${idx + 1}`} className="siniestro-photo-img" />
                  <div className="siniestro-photo-tag">✓ {photo.sizeKb} KB</div>
                  <button
                    type="button"
                    className="siniestro-photo-delete-btn"
                    onClick={() => removePhoto(idx)}
                    title="Eliminar foto"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              ))}

              {/* Loader durante compresión */}
              {compressingNew && (
                <div className="siniestro-photo-compressing-item">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    style={{ animation: "spin 1s linear infinite" }}
                  >
                    <circle opacity="0.25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path opacity="0.75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span style={{ fontWeight: "700" }}>Procesando...</span>
                </div>
              )}

              {/* Botón Agregar Foto */}
              {photos.length < 6 && !compressingNew && (
                <button
                  type="button"
                  className="siniestro-add-photo-btn"
                  onClick={() => setShowPickerModal(true)}
                >
                  <div className="siniestro-add-icon-circle">
                    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path d="M12 4.5v15m7.5-7.5h-15" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <span className="siniestro-add-label">Agregar</span>
                </button>
              )}

              {/* Slots Vacíos Placeholder para completar la cuadrícula como en el template */}
              {Array.from({ length: placeholderCount }).map((_, pIdx) => (
                <div key={`placeholder-${pIdx}`} className="siniestro-photo-slot">
                  <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <path
                      d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              ))}
            </div>
          </div>

          {/* Botones de Acción */}
          <div className="siniestro-actions-grid">
            {typeof onCancel === "function" ? (
              <button type="button" className="siniestro-btn-cancel" onClick={onCancel}>
                Cancelar
              </button>
            ) : (
              <div />
            )}

            <button
              type="submit"
              className="siniestro-btn-submit"
              disabled={sending || compressingNew}
            >
              {sending ? (
                <>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    style={{ animation: "spin 1s linear infinite" }}
                  >
                    <circle opacity="0.25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path opacity="0.75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span>Enviando Reporte...</span>
                </>
              ) : (
                <>
                  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path
                      d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span>Enviar Reporte de Siniestro</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Modal Selector de Origen de Foto */}
      {showPickerModal && (
        <div className="siniestro-modal-overlay" onClick={() => setShowPickerModal(false)}>
          <div className="siniestro-picker-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="siniestro-picker-title">📷 Opciones de Evidencia</h3>
            <p className="siniestro-picker-subtitle">Selecciona cómo deseas adjuntar la fotografía:</p>

            <div className="siniestro-picker-options">
              <button
                type="button"
                className="siniestro-picker-btn-primary"
                onClick={() => {
                  setShowPickerModal(false);
                  setShowCameraModal(true);
                }}
              >
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path
                    d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>Tomar Foto con Cámara</span>
              </button>

              <label className="siniestro-picker-btn-secondary">
                <svg width="18" height="18" fill="none" stroke="#0284c7" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.625-1.5l-3 3m0 0l3 3m-3-3H21M3.75 6.75h16.5" />
                </svg>
                <span>Elegir de Galería / Archivos</span>
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
                className="siniestro-picker-btn-cancel"
                onClick={() => setShowPickerModal(false)}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Visor de Cámara */}
      {showCameraModal && (
        <CameraModal onCapture={handleCameraCapture} onClose={() => setShowCameraModal(false)} />
      )}
    </div>
  );
}
