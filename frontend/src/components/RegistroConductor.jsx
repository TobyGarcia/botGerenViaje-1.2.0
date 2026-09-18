import { useRef, useState } from "react";
import { registrarConductorTelegram } from "../services/api.js";
import { compressImageToMaxKb } from "../utils/imageCompressor.js";
import CameraModal from "./CameraModal.jsx";
import {
  IconCamera,
  IconFolder,
  IconClock,
  IconKey,
  IconClipboard,
  IconCheck,
  IconDocument,
  IconRefresh,
  IconPin,
  IconDownload
} from "./Icons.jsx";
import { downloadPinCardImage } from "../utils/downloadPinCard.js";
import "./RegistroConductor.css";

function getInitialName(usuario) {
  return [usuario?.firstName, usuario?.lastName].filter(Boolean).join(" ");
}

const EMPRESAS = [
  "GV Mobility S.A. de C.V.",
  "ITZAMNA",
  "MCCLICK",
  "AQUARIO",
  "ASPROMEX",
  "BALAM",
  "AGROKOOL",
  "Transportes del Norte",
  "Logística Integral del Golfo",
  "Operaciones Centrales"
];

const TIPOS_LICENCIA = [
  { value: "AUTOMOVILISTA", label: "Tipo A - Chofer Particular / Automovilista" },
  { value: "CHOFER", label: "Tipo B - Chofer de Transporte / Carga" },
  { value: "FEDERAL", label: "Licencia Federal de Conductor (Tipo B)" },
  { value: "MOTOCICLISTA", label: "Tipo M - Motociclista" }
];

export default function RegistroConductor({ telegramAuth, onRegistered, _onCancel }) {
  const savingRef = useRef(false);
  const [currentStep, setCurrentStep] = useState(1);

  const [form, setForm] = useState({
    nombre: getInitialName(telegramAuth?.usuario),
    correo: "",
    telefono: "",
    licenciaNumero: "",
    tipoLicencia: "",
    empresa: "",
    puesto: "",
    licenciaVencimiento: "",
    vencimientoDia: "",
    vencimientoMes: "",
    vencimientoAnio: "",
    fechaManejoComentado: "",
    mcDia: "",
    mcMes: "",
    mcAnio: ""
  });

  const [licenciaFrente, setLicenciaFrente] = useState({
    name: "",
    preview: "",
    base64: "",
    sizeKb: 0,
    isPdf: false,
    compressing: false
  });
  const [licenciaReverso, setLicenciaReverso] = useState({
    name: "",
    preview: "",
    base64: "",
    sizeKb: 0,
    isPdf: false,
    compressing: false
  });
  const [activeCameraSide, setActiveCameraSide] = useState(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [pendingResult, setPendingResult] = useState(null);
  const [copiedPin, setCopiedPin] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function processFile(side, file) {
    const setSideState = side === "frente" ? setLicenciaFrente : setLicenciaReverso;
    setSideState((prev) => ({ ...prev, compressing: true }));
    setError("");

    try {
      const compressed = await compressImageToMaxKb(file, 77);
      setSideState({
        name: file.name,
        preview: compressed.base64,
        base64: compressed.base64,
        sizeKb: compressed.sizeKb,
        isPdf: compressed.isPdf,
        compressing: false
      });
    } catch (err) {
      console.error("Error al procesar la imagen:", err);
      setError("No fue posible procesar y comprimir la foto de la licencia.");
      setSideState((prev) => ({ ...prev, compressing: false }));
    }
  }

  async function handleLicenseFileChange(side, event) {
    const file = event.target.files?.[0];
    if (!file) return;
    await processFile(side, file);
    if (event.target) event.target.value = "";
  }

  async function handleCameraCapture(file) {
    const side = activeCameraSide;
    setActiveCameraSide(null);
    if (side && file) {
      await processFile(side, file);
    }
  }

  function updateExpiry(part, value) {
    setForm((current) => {
      const next = { ...current, [part]: value };
      return {
        ...next,
        licenciaVencimiento:
          next.vencimientoAnio && next.vencimientoMes && next.vencimientoDia
            ? `${next.vencimientoAnio}-${next.vencimientoMes}-${next.vencimientoDia}`
            : ""
      };
    });
  }

  function updateManejoComentado(part, value) {
    setForm((current) => {
      const next = { ...current, [part]: value };
      return {
        ...next,
        fechaManejoComentado:
          next.mcAnio && next.mcMes && next.mcDia
            ? `${next.mcAnio}-${next.mcMes}-${next.mcDia}`
            : ""
      };
    });
  }

  function validateStep(step) {
    setError("");
    if (step === 1) {
      if (!form.nombre.trim()) {
        setError("Por favor ingresa tu nombre completo.");
        return false;
      }
      if (!form.correo.trim()) {
        setError("Por favor ingresa tu correo electrónico.");
        return false;
      }
      if (!form.telefono.trim()) {
        setError("Por favor ingresa tu número telefónico.");
        return false;
      }
    } else if (step === 2) {
      if (!form.licenciaNumero.trim()) {
        setError("Por favor ingresa el número de tu licencia.");
        return false;
      }
      if (!form.vencimientoDia || !form.vencimientoMes || !form.vencimientoAnio) {
        setError("Por favor selecciona la fecha de vencimiento completa de tu licencia.");
        return false;
      }
      if (!form.tipoLicencia) {
        setError("Por favor selecciona el tipo de licencia.");
        return false;
      }
      if (!licenciaFrente.base64) {
        setError("Es obligatorio adjuntar o capturar la foto frontal de tu licencia.");
        return false;
      }
      if (licenciaFrente.compressing || licenciaReverso.compressing) {
        setError("Por favor espera a que terminen de comprimirse las imágenes.");
        return false;
      }
    }
    return true;
  }

  function handleGoToStep(targetStep) {
    if (targetStep < currentStep) {
      setCurrentStep(targetStep);
      setError("");
      return;
    }
    if (targetStep > currentStep) {
      if (!validateStep(currentStep)) return;
      setCurrentStep(targetStep);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (savingRef.current) return;

    if (!validateStep(1) || !validateStep(2)) return;

    if (!form.empresa) {
      setError("Por favor selecciona la empresa a la que perteneces.");
      return;
    }

    savingRef.current = true;
    setSaving(true);
    setError("");

    try {
      const initData = window.Telegram?.WebApp?.initData || "";
      const payload = {
        ...form,
        email: form.correo,
        licenciaArchivoBase64: licenciaFrente.base64,
        licenciaNombreArchivo: licenciaFrente.name,
        licenciaReversoBase64: licenciaReverso.base64 || null,
        licenciaReversoNombre: licenciaReverso.name || null
      };
      const response = await registrarConductorTelegram(initData, payload);
      if (response?.data) {
        setPendingResult({
          pinGenerado: response.data.pinGenerado,
          conductor: response.data.conductor,
          rawResponse: response.data
        });
      } else {
        onRegistered(response?.data);
      }
    } catch (requestError) {
      setError(requestError.message || "No fue posible completar el registro.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  const anioActual = new Date().getFullYear();

  const stepTitles = {
    1: "Datos Personales",
    2: "Licencia de Conducir",
    3: "Datos Laborales"
  };

  const progressPercent = currentStep === 1 ? 33 : currentStep === 2 ? 66 : 100;

  if (pendingResult) {
    return (
      <main className="registro-wrapper" style={{ padding: "16px 12px" }}>
        <div
          style={{
            background: "#ffffff",
            borderRadius: "16px",
            border: "1px solid #e2e8f0",
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04)",
            padding: "24px 20px",
            textAlign: "center"
          }}
        >
          <div
            style={{
              width: "60px",
              height: "60px",
              background: "#fef3c7",
              color: "#d97706",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px auto"
            }}
          >
            <IconClock size={30} color="#d97706" />
          </div>

          <h2 style={{ fontSize: "1.35rem", fontWeight: "800", color: "#0f172a", margin: "0 0 8px 0" }}>
            Registro en Espera de Aprobación
          </h2>

          <p style={{ color: "#475569", fontSize: "0.875rem", lineHeight: "1.5", margin: "0 0 20px 0" }}>
            Tu registro de conductor fue recibido exitosamente. Tu cuenta se encuentra{" "}
            <strong>en espera de aprobación por la administración</strong>.
          </p>

          {pendingResult.pinGenerado ? (
            <div
              style={{
                background: "linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)",
                border: "2px dashed #3b82f6",
                borderRadius: "12px",
                padding: "16px",
                marginBottom: "20px"
              }}
            >
              <span
                style={{
                  display: "block",
                  fontSize: "0.75rem",
                  fontWeight: "700",
                  color: "#1d4ed8",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  marginBottom: "6px"
                }}
              >
                <IconKey size={15} color="#1d4ed8" style={{ marginRight: "4px" }} /> Tu PIN de Acceso de 4 Dígitos
                Asignado:
              </span>
              <div
                style={{
                  fontSize: "2.2rem",
                  fontWeight: "800",
                  fontFamily: "monospace",
                  letterSpacing: "8px",
                  color: "#1e40af",
                  margin: "6px 0"
                }}
              >
                {pendingResult.pinGenerado}
              </div>
              <div style={{ display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap", marginTop: "12px" }}>
                <button
                  type="button"
                  onClick={() => {
                    if (navigator.clipboard?.writeText) {
                      navigator.clipboard.writeText(pendingResult.pinGenerado);
                    }
                    setCopiedPin(true);
                    setTimeout(() => setCopiedPin(false), 2500);
                  }}
                  style={{
                    background: "#0284c7",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "8px",
                    padding: "8px 16px",
                    fontSize: "0.8125rem",
                    fontWeight: "600",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px"
                  }}
                >
                  {copiedPin ? <IconCheck size={16} /> : <IconClipboard size={16} />}
                  {copiedPin ? "¡PIN Copiado!" : "Copiar PIN"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    downloadPinCardImage({
                      nombre: pendingResult.conductor?.nombre || form.nombre || "Conductor",
                      pin: pendingResult.pinGenerado,
                      empresa: form.empresa || pendingResult.conductor?.empresa
                    });
                  }}
                  style={{
                    background: "#059669",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "8px",
                    padding: "8px 16px",
                    fontSize: "0.8125rem",
                    fontWeight: "600",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px"
                  }}
                  title="Descargar imagen digital con tu nombre y PIN"
                >
                  <IconDownload size={16} /> Guardar Imagen
                </button>
              </div>
            </div>
          ) : (
            <div
              style={{
                background: "#eff6ff",
                padding: "12px 16px",
                borderRadius: "8px",
                border: "1px solid #bfdbfe",
                marginBottom: "20px",
                color: "#1e40af",
                fontSize: "0.8125rem"
              }}
            >
              🔑 Tu PIN de acceso se generará y asignará automáticamente al ser aprobado por la administración.
            </div>
          )}

          <div
            style={{
              background: "#fffbeb",
              border: "1px solid #fef3c7",
              borderRadius: "8px",
              padding: "12px 14px",
              textAlign: "left",
              fontSize: "0.8125rem",
              color: "#92400e",
              lineHeight: "1.4",
              marginBottom: "20px"
            }}
          >
            <strong>
              <IconPin size={15} color="#92400e" style={{ marginRight: "4px" }} /> Importante:
            </strong>
            <ul style={{ margin: "6px 0 0 0", paddingLeft: "18px" }}>
              <li>Guarda este PIN de 4 dígitos para ingresar al sistema.</li>
              <li>Podrás realizar viajes una vez que tu cuenta sea aprobada por la administración.</li>
            </ul>
          </div>

          <button
            type="button"
            onClick={() => onRegistered(pendingResult.rawResponse)}
            style={{
              width: "100%",
              padding: "12px 16px",
              background: "#0369a1",
              color: "#ffffff",
              border: "none",
              borderRadius: "10px",
              fontSize: "0.95rem",
              fontWeight: "700",
              cursor: "pointer",
              boxShadow: "0 4px 6px -1px rgba(3, 105, 161, 0.25)"
            }}
          >
            Entendido / Ir al Inicio
          </button>
        </div>
      </main>
    );
  }

  return (
    <div className="registro-wrapper">
      {/* Page Title & Subtitle */}
      <section className="registro-page-header">
        <h1 className="registro-page-title">Registro de conductor</h1>
        <p className="registro-page-subtitle">Completa tu información una sola vez para acceder a los viajes.</p>
      </section>

      {/* Stepper Component */}
      <section className="registro-stepper-card">
        <div className="registro-stepper-grid">
          <div className="registro-stepper-line" />

          {/* Step 1 Tab */}
          <button
            type="button"
            className="registro-step-tab"
            onClick={() => handleGoToStep(1)}
          >
            <div
              className={`registro-step-icon ${
                currentStep === 1 ? "active" : currentStep > 1 ? "completed" : "inactive"
              }`}
            >
              {currentStep > 1 ? (
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              )}
            </div>
            <span
              className={`registro-step-label ${
                currentStep === 1 ? "active" : currentStep > 1 ? "completed" : "inactive"
              }`}
            >
              Datos Personales
            </span>
          </button>

          {/* Step 2 Tab */}
          <button
            type="button"
            className="registro-step-tab"
            onClick={() => handleGoToStep(2)}
          >
            <div
              className={`registro-step-icon ${
                currentStep === 2 ? "active" : currentStep > 2 ? "completed" : "inactive"
              }`}
            >
              {currentStep > 2 ? (
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <rect x="3" y="4" width="18" height="16" rx="2" />
                  <line x1="7" y1="8" x2="17" y2="8" />
                  <line x1="7" y1="12" x2="13" y2="12" />
                  <circle cx="15" cy="14" r="2" />
                </svg>
              )}
            </div>
            <span
              className={`registro-step-label ${
                currentStep === 2 ? "active" : currentStep > 2 ? "completed" : "inactive"
              }`}
            >
              Licencia
            </span>
          </button>

          {/* Step 3 Tab */}
          <button
            type="button"
            className="registro-step-tab"
            onClick={() => handleGoToStep(3)}
          >
            <div
              className={`registro-step-icon ${
                currentStep === 3 ? "active" : "inactive"
              }`}
            >
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
              </svg>
            </div>
            <span
              className={`registro-step-label ${
                currentStep === 3 ? "active" : "inactive"
              }`}
            >
              Datos Laborales
            </span>
          </button>
        </div>

        {/* Progress Bar & Text */}
        <div className="registro-progress-container">
          <div className="registro-progress-header">
            <span className="registro-progress-text">
              Paso {currentStep} de 3: {stepTitles[currentStep]}
            </span>
            <span className="registro-progress-percent">{progressPercent}%</span>
          </div>
          <div className="registro-progress-track">
            <div className="registro-progress-fill" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
      </section>

      {/* Main Registration Form Card */}
      <form className="registro-form-card" onSubmit={handleSubmit}>
        {/* ================= STEP 1: DATOS PERSONALES ================= */}
        {currentStep === 1 && (
          <div className="registro-fields-group">
            <div className="registro-section-header">
              <h2 className="registro-section-title">
                <svg width="16" height="16" className="registro-section-icon" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                <span>Información de Contacto y Perfil</span>
              </h2>
            </div>

            {/* Nombre Completo */}
            <div className="registro-field">
              <label className="registro-label" htmlFor="fullName">
                <span>Nombre completo</span> <span className="registro-required">*</span>
              </label>
              <input
                id="fullName"
                name="nombre"
                type="text"
                className="registro-input"
                value={form.nombre}
                onChange={handleChange}
                maxLength="150"
                placeholder="Ej. Juan Carlos Pérez"
                required
              />
            </div>

            {/* Correo Electrónico */}
            <div className="registro-field">
              <label className="registro-label" htmlFor="email">
                <span>Correo electrónico</span> <span className="registro-required">*</span>
              </label>
              <input
                id="email"
                name="correo"
                type="email"
                className="registro-input"
                value={form.correo}
                onChange={handleChange}
                maxLength="150"
                placeholder="ejemplo@correo.com"
                required
              />
            </div>

            {/* Teléfono */}
            <div className="registro-field">
              <label className="registro-label" htmlFor="phone">
                <span>Teléfono</span> <span className="registro-required">*</span>
              </label>
              <input
                id="phone"
                name="telefono"
                type="tel"
                className="registro-input"
                value={form.telefono}
                onChange={handleChange}
                maxLength="30"
                placeholder="Ej. 981 123 4567"
                required
              />
            </div>

            {/* Navegación Paso 1 */}
            <div className="registro-nav-single">
              <button
                type="button"
                className="registro-btn-next"
                onClick={() => {
                  if (validateStep(1)) setCurrentStep(2);
                }}
              >
                <span>Siguiente: Licencia de Conducir</span>
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* ================= STEP 2: LICENCIA DE CONDUCIR ================= */}
        {currentStep === 2 && (
          <div className="registro-fields-group">
            <div className="registro-section-header">
              <h2 className="registro-section-title">
                <svg width="16" height="16" className="registro-section-icon" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <rect x="3" y="4" width="18" height="16" rx="2" />
                  <line x1="7" y1="8" x2="17" y2="8" />
                  <line x1="7" y1="12" x2="13" y2="12" />
                  <circle cx="15" cy="14" r="2" />
                </svg>
                <span>Documentación y Vigencia de Licencia</span>
              </h2>
            </div>

            {/* Número de Licencia */}
            <div className="registro-field">
              <label className="registro-label" htmlFor="licenseNumber">
                <span>Número de licencia</span> <span className="registro-required">*</span>
              </label>
              <input
                id="licenseNumber"
                name="licenciaNumero"
                type="text"
                className="registro-input"
                value={form.licenciaNumero}
                onChange={handleChange}
                maxLength="50"
                placeholder="Ej. LIC-12345678"
                style={{ textTransform: "uppercase" }}
                required
              />
            </div>

            {/* Fecha de Vencimiento de Licencia */}
            <div className="registro-field">
              <label className="registro-label">
                <span>Fecha de vencimiento de licencia</span> <span className="registro-required">*</span>
              </label>
              <div className="registro-date-grid">
                {/* Día */}
                <div className="registro-select-wrapper">
                  <select
                    className="registro-select"
                    value={form.vencimientoDia}
                    onChange={(e) => updateExpiry("vencimientoDia", e.target.value)}
                    required
                  >
                    <option value="">dd</option>
                    {Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, "0")).map((day) => (
                      <option key={day} value={day}>
                        {day}
                      </option>
                    ))}
                  </select>
                  <div className="registro-select-chevron">
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                    </svg>
                  </div>
                </div>

                {/* Mes */}
                <div className="registro-select-wrapper">
                  <select
                    className="registro-select"
                    value={form.vencimientoMes}
                    onChange={(e) => updateExpiry("vencimientoMes", e.target.value)}
                    required
                  >
                    <option value="">mm</option>
                    <option value="01">01 (Ene)</option>
                    <option value="02">02 (Feb)</option>
                    <option value="03">03 (Mar)</option>
                    <option value="04">04 (Abr)</option>
                    <option value="05">05 (May)</option>
                    <option value="06">06 (Jun)</option>
                    <option value="07">07 (Jul)</option>
                    <option value="08">08 (Ago)</option>
                    <option value="09">09 (Sep)</option>
                    <option value="10">10 (Oct)</option>
                    <option value="11">11 (Nov)</option>
                    <option value="12">12 (Dic)</option>
                  </select>
                  <div className="registro-select-chevron">
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                    </svg>
                  </div>
                </div>

                {/* Año */}
                <div className="registro-select-wrapper">
                  <select
                    className="registro-select"
                    value={form.vencimientoAnio}
                    onChange={(e) => updateExpiry("vencimientoAnio", e.target.value)}
                    required
                  >
                    <option value="">yyyy</option>
                    {Array.from({ length: 16 }, (_, i) => String(anioActual + i)).map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                  <div className="registro-select-chevron">
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Tipo de Licencia */}
            <div className="registro-field">
              <label className="registro-label" htmlFor="licenseType">
                <span>Tipo de licencia</span> <span className="registro-required">*</span>
              </label>
              <div className="registro-select-wrapper">
                <select
                  id="licenseType"
                  name="tipoLicencia"
                  className="registro-select"
                  value={form.tipoLicencia}
                  onChange={handleChange}
                  required
                >
                  <option value="">Selecciona tipo de licencia</option>
                  {TIPOS_LICENCIA.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <div className="registro-select-chevron">
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Carga Frente de Licencia */}
            <div className="registro-upload-box">
              <div className="registro-upload-header">
                <svg width="16" height="16" fill="none" stroke="#0284c7" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
                <span>
                  Licencia de Conducir (Frente) <span className="registro-required">*</span>
                </span>
              </div>

              <div className="registro-upload-actions">
                <button
                  type="button"
                  className="registro-upload-camera-btn"
                  onClick={() => setActiveCameraSide("frente")}
                >
                  <IconCamera size={14} />
                  <span>Visor Cámara</span>
                </button>
                <label className="registro-upload-file-label">
                  <IconFolder size={14} />
                  <span>Elegir archivo</span>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => handleLicenseFileChange("frente", e)}
                    style={{ display: "none" }}
                  />
                </label>
              </div>

              {licenciaFrente.compressing && (
                <p style={{ fontSize: "0.75rem", color: "#0284c7", margin: "4px 0", display: "flex", alignItems: "center", gap: "4px" }}>
                  <IconRefresh size={14} className="spin" /> Comprimiendo imagen (&le; 77KB)...
                </p>
              )}

              {licenciaFrente.base64 && !licenciaFrente.compressing && (
                <div className="registro-photo-preview-card">
                  <p style={{ fontSize: "0.75rem", color: "#15803d", fontWeight: "700", margin: "0 0 4px 0", display: "flex", alignItems: "center", gap: "4px" }}>
                    <IconCheck size={14} color="#15803d" /> Foto Frente procesada ({licenciaFrente.sizeKb} KB)
                  </p>
                  {licenciaFrente.isPdf ? (
                    <p style={{ fontSize: "0.8rem", color: "#0284c7", margin: 0, display: "flex", alignItems: "center", gap: "4px" }}>
                      <IconDocument size={14} /> {licenciaFrente.name}
                    </p>
                  ) : (
                    <img src={licenciaFrente.preview} alt="Frente Licencia" className="registro-photo-preview-img" />
                  )}
                </div>
              )}
            </div>

            {/* Carga Reverso de Licencia */}
            <div className="registro-upload-box">
              <div className="registro-upload-header">
                <svg width="16" height="16" fill="none" stroke="#0284c7" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
                <span>Licencia de Conducir (Reverso / Trasero)</span>
              </div>

              <div className="registro-upload-actions">
                <button
                  type="button"
                  className="registro-upload-camera-btn"
                  onClick={() => setActiveCameraSide("reverso")}
                >
                  <IconCamera size={14} />
                  <span>Visor Cámara</span>
                </button>
                <label className="registro-upload-file-label">
                  <IconFolder size={14} />
                  <span>Elegir archivo</span>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => handleLicenseFileChange("reverso", e)}
                    style={{ display: "none" }}
                  />
                </label>
              </div>

              {licenciaReverso.compressing && (
                <p style={{ fontSize: "0.75rem", color: "#0284c7", margin: "4px 0", display: "flex", alignItems: "center", gap: "4px" }}>
                  <IconRefresh size={14} className="spin" /> Comprimiendo imagen (&le; 77KB)...
                </p>
              )}

              {licenciaReverso.base64 && !licenciaReverso.compressing && (
                <div className="registro-photo-preview-card">
                  <p style={{ fontSize: "0.75rem", color: "#15803d", fontWeight: "700", margin: "0 0 4px 0", display: "flex", alignItems: "center", gap: "4px" }}>
                    <IconCheck size={14} color="#15803d" /> Foto Reverso procesada ({licenciaReverso.sizeKb} KB)
                  </p>
                  {licenciaReverso.isPdf ? (
                    <p style={{ fontSize: "0.8rem", color: "#0284c7", margin: 0, display: "flex", alignItems: "center", gap: "4px" }}>
                      <IconDocument size={14} /> {licenciaReverso.name}
                    </p>
                  ) : (
                    <img src={licenciaReverso.preview} alt="Reverso Licencia" className="registro-photo-preview-img" />
                  )}
                </div>
              )}
            </div>

            {/* Navegación Paso 2 */}
            <div className="registro-nav-double">
              <button
                type="button"
                className="registro-btn-back"
                onClick={() => {
                  setError("");
                  setCurrentStep(1);
                }}
              >
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <line x1="19" y1="12" x2="5" y2="12" />
                  <polyline points="12 19 5 12 12 5" />
                </svg>
                <span>Anterior</span>
              </button>

              <button
                type="button"
                className="registro-btn-next"
                onClick={() => {
                  if (validateStep(2)) setCurrentStep(3);
                }}
              >
                <span>Siguiente: Laboral</span>
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* ================= STEP 3: DATOS LABORALES ================= */}
        {currentStep === 3 && (
          <div className="registro-fields-group">
            <div className="registro-section-header">
              <h2 className="registro-section-title">
                <svg width="16" height="16" className="registro-section-icon" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                  <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                </svg>
                <span>Asignación Corporativa y Evaluaciones</span>
              </h2>
            </div>

            {/* Última Evaluación de Manejo Comentado */}
            <div className="registro-field">
              <label className="registro-label">
                <span>Última Evaluación de Manejo Comentado (dd/mm/aaaa)</span>
              </label>
              <div className="registro-date-grid">
                {/* Día */}
                <div className="registro-select-wrapper">
                  <select
                    className="registro-select"
                    value={form.mcDia}
                    onChange={(e) => updateManejoComentado("mcDia", e.target.value)}
                  >
                    <option value="">dd</option>
                    {Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, "0")).map((day) => (
                      <option key={day} value={day}>
                        {day}
                      </option>
                    ))}
                  </select>
                  <div className="registro-select-chevron">
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                    </svg>
                  </div>
                </div>

                {/* Mes */}
                <div className="registro-select-wrapper">
                  <select
                    className="registro-select"
                    value={form.mcMes}
                    onChange={(e) => updateManejoComentado("mcMes", e.target.value)}
                  >
                    <option value="">mm</option>
                    <option value="01">01 (Ene)</option>
                    <option value="02">02 (Feb)</option>
                    <option value="03">03 (Mar)</option>
                    <option value="04">04 (Abr)</option>
                    <option value="05">05 (May)</option>
                    <option value="06">06 (Jun)</option>
                    <option value="07">07 (Jul)</option>
                    <option value="08">08 (Ago)</option>
                    <option value="09">09 (Sep)</option>
                    <option value="10">10 (Oct)</option>
                    <option value="11">11 (Nov)</option>
                    <option value="12">12 (Dic)</option>
                  </select>
                  <div className="registro-select-chevron">
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                    </svg>
                  </div>
                </div>

                {/* Año */}
                <div className="registro-select-wrapper">
                  <select
                    className="registro-select"
                    value={form.mcAnio}
                    onChange={(e) => updateManejoComentado("mcAnio", e.target.value)}
                  >
                    <option value="">yyyy</option>
                    {Array.from({ length: 10 }, (_, i) => String(anioActual - 5 + i)).map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                  <div className="registro-select-chevron">
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Empresa */}
            <div className="registro-field">
              <label className="registro-label" htmlFor="companySelect">
                <span>Empresa</span> <span className="registro-required">*</span>
              </label>
              <div className="registro-select-wrapper">
                <select
                  id="companySelect"
                  name="empresa"
                  className="registro-select"
                  value={form.empresa}
                  onChange={handleChange}
                  required
                >
                  <option value="">Selecciona una empresa</option>
                  {EMPRESAS.map((empresa) => (
                    <option key={empresa} value={empresa}>
                      {empresa}
                    </option>
                  ))}
                </select>
                <div className="registro-select-chevron">
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Puesto / Cargo */}
            <div className="registro-field">
              <label className="registro-label" htmlFor="jobTitle">
                <span>Puesto / Cargo</span>
              </label>
              <input
                id="jobTitle"
                name="puesto"
                type="text"
                className="registro-input"
                value={form.puesto}
                onChange={handleChange}
                maxLength="100"
                placeholder="Ej. Operador, Supervisor..."
              />
            </div>

            {/* Tarjeta de Confirmación de Veracidad */}
            <div className="registro-readiness-card">
              <svg width="18" height="18" fill="none" stroke="#0284c7" strokeWidth="2" viewBox="0 0 24 24" style={{ flexShrink: 0, marginTop: "2px" }}>
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
              <p className="registro-readiness-text">
                Al enviar este formulario confirmas que los datos ingresados y documentos adjuntados son verídicos y
                cumplen con las normas operativas.
              </p>
            </div>

            {/* Navegación Paso 3 */}
            <div className="registro-nav-double">
              <button
                type="button"
                className="registro-btn-back"
                onClick={() => {
                  setError("");
                  setCurrentStep(2);
                }}
              >
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <line x1="19" y1="12" x2="5" y2="12" />
                  <polyline points="12 19 5 12 12 5" />
                </svg>
                <span>Anterior</span>
              </button>

              <button
                type="submit"
                className="registro-btn-next"
                disabled={saving || licenciaFrente.compressing || licenciaReverso.compressing}
              >
                {saving ? (
                  <>
                    <IconRefresh size={16} className="spin" />
                    <span>Guardando información...</span>
                  </>
                ) : (
                  <>
                    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span>Completar registro</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Feedback de Error */}
        {error && (
          <div className="registro-alert-error" role="alert">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}
      </form>

      {/* Modal de Cámara */}
      {activeCameraSide && (
        <CameraModal onCapture={handleCameraCapture} onClose={() => setActiveCameraSide(null)} />
      )}
    </div>
  );
}
