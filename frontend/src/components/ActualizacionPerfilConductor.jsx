import React, { useState } from "react";
import { actualizarPerfilConductor } from "../services/api.js";
import "./ActualizacionPerfilConductor.css";

const TIPOS_LICENCIA_OPCIONES = [
  { value: "AUTOMOVILISTA", label: "AUTOMOVILISTA" },
  { value: "CHOFER", label: "CHOFER DE TRANSPORTE" },
  { value: "FEDERAL", label: "FEDERAL TIPO B" },
  { value: "MOTOCICLISTA", label: "MOTOCICLISTA" }
];

function formatDateForInput(dateStr) {
  if (!dateStr) return "";
  if (typeof dateStr === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export default function ActualizacionPerfilConductor({ conductor, onProfileUpdated, onCancel }) {
  const [telefono, setTelefono] = useState(conductor?.telefono || "");
  const [licenciaNumero, setLicenciaNumero] = useState(conductor?.licencia_numero || conductor?.licenciaNumero || "");
  const [tipoLicencia, setTipoLicencia] = useState(conductor?.tipo_licencia || "AUTOMOVILISTA");
  const [puesto, setPuesto] = useState(conductor?.puesto || "");
  const [licenciaVencimiento, setLicenciaVencimiento] = useState(
    formatDateForInput(conductor?.licencia_vencimiento || conductor?.licenciaVencimiento)
  );

  const [licenciaArchivoBase64, setLicenciaArchivoBase64] = useState("");
  const [licenciaNombreArchivo, setLicenciaNombreArchivo] = useState("");
  const [previewFrente, setPreviewFrente] = useState(conductor?.licencia_url || "");

  const [licenciaReversoBase64, setLicenciaReversoBase64] = useState("");
  const [licenciaReversoNombre, setLicenciaReversoNombre] = useState("");
  const [previewReverso, setPreviewReverso] = useState(conductor?.licencia_reverso_url || "");

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleFileChange = (e, side) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError("La imagen no debe superar los 5MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result;
      if (side === "frente") {
        setLicenciaArchivoBase64(base64);
        setLicenciaNombreArchivo(file.name);
        setPreviewFrente(base64);
      } else {
        setLicenciaReversoBase64(base64);
        setLicenciaReversoNombre(file.name);
        setPreviewReverso(base64);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!telefono.trim()) {
      setError("El número de teléfono / contacto de emergencia es obligatorio.");
      return;
    }

    if (!licenciaNumero.trim()) {
      setError("El número de licencia de conducir es obligatorio.");
      return;
    }

    if (!licenciaVencimiento) {
      setError("La fecha de vencimiento de la licencia es obligatoria.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        telefono: telefono.trim(),
        licenciaNumero: licenciaNumero.trim(),
        tipoLicencia: tipoLicencia.trim(),
        puesto: puesto.trim(),
        licenciaVencimiento,
        ...(licenciaArchivoBase64 ? { licenciaArchivoBase64, licenciaNombreArchivo } : {}),
        ...(licenciaReversoBase64 ? { licenciaReversoBase64, licenciaReversoNombre } : {})
      };

      const response = await actualizarPerfilConductor(payload);
      if (response?.success) {
        setMessage("¡Tus datos y licencia han sido actualizados exitosamente!");
        if (typeof onProfileUpdated === "function" && response.data?.conductor) {
          onProfileUpdated(response.data.conductor);
        }
      } else {
        setError(response?.message || "No se pudo actualizar el perfil.");
      }
    } catch (err) {
      console.error("Error al actualizar perfil:", err);
      setError(err.message || "Ocurrió un error al guardar los cambios.");
    } finally {
      setSaving(false);
    }
  };

  const isExpired = licenciaVencimiento
    ? new Date(`${licenciaVencimiento}T00:00:00`) < new Date(new Date().setHours(0, 0, 0, 0))
    : false;

  return (
    <div className="perfil-wrapper">
      <section className="perfil-card-container">
        {/* Encabezado: Ícono de usuario y títulos */}
        <div className="perfil-header">
          <div className="perfil-header-icon">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path
                d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div>
            <h2 className="perfil-header-title">Actualización de Datos del Conductor</h2>
            <p className="perfil-header-desc">
              Modifica tu contacto de emergencia y datos de la licencia de conducir.
            </p>
          </div>
        </div>

        {/* Alertas */}
        {error && (
          <div className="perfil-alert-error">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {message && (
          <div className="perfil-alert-success">
            <span>✅</span>
            <span>{message}</span>
          </div>
        )}

        {/* Formulario */}
        <form className="perfil-form" onSubmit={handleSubmit}>
          {/* Nombre Completo (Solo Lectura) */}
          <div className="perfil-field">
            <label className="perfil-label" htmlFor="full-name">
              Nombre Completo
            </label>
            <div className="perfil-input-wrapper">
              <input
                id="full-name"
                type="text"
                className="perfil-input-readonly"
                value={conductor?.nombre || ""}
                readOnly
              />
              <div className="perfil-input-icon-right">
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path
                    d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>
          </div>

          {/* Teléfono / Contacto de Emergencia */}
          <div className="perfil-field">
            <label className="perfil-label" htmlFor="emergency-phone">
              <svg width="14" height="14" className="text-rose-500" fill="none" stroke="#f43f5e" strokeWidth="2" viewBox="0 0 24 24">
                <path
                  d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span>Teléfono / Contacto de Emergencia</span>
              <span className="perfil-required">*</span>
            </label>
            <input
              id="emergency-phone"
              type="tel"
              className="perfil-input-primary"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder="Ej. 9811695579"
              required
            />
            <p className="perfil-helper-text">
              Número al cual avisar en caso de alguna incidencia durante los viajes.
            </p>
          </div>

          {/* Puesto / Cargo */}
          <div className="perfil-field">
            <label className="perfil-label" htmlFor="job-title">
              <svg width="14" height="14" fill="none" stroke="#64748b" strokeWidth="2" viewBox="0 0 24 24">
                <path
                  d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span>Puesto / Cargo</span>
            </label>
            <input
              id="job-title"
              type="text"
              className="perfil-input"
              value={puesto}
              onChange={(e) => setPuesto(e.target.value)}
              placeholder="Ej. Operador, Supervisor..."
              maxLength={100}
            />
          </div>

          {/* Sección de Licencia */}
          <div className="perfil-section-divider">
            <div className="perfil-section-title">
              <svg width="16" height="16" fill="none" stroke="#0284c7" strokeWidth="2" viewBox="0 0 24 24">
                <path
                  d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm1.294 6.336a6.721 6.721 0 01-3.17.789 6.721 6.721 0 01-3.168-.789 3.376 3.376 0 016.338 0z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span>Datos de Licencia de Conducir</span>
            </div>

            {/* Fila con Número y Vencimiento */}
            <div className="perfil-grid-two-cols">
              <div className="perfil-field">
                <label className="perfil-label" htmlFor="license-number">
                  <span>N° de Licencia</span>
                  <span className="perfil-required">*</span>
                </label>
                <input
                  id="license-number"
                  type="text"
                  className="perfil-input-compact"
                  value={licenciaNumero}
                  onChange={(e) => setLicenciaNumero(e.target.value)}
                  placeholder="Ej. LIC-12345"
                  required
                />
              </div>

              <div className="perfil-field">
                <label className="perfil-label" htmlFor="license-expiration">
                  <span>Vencimiento</span>
                  <span className="perfil-required">*</span>
                </label>
                <input
                  id="license-expiration"
                  type="date"
                  className={`perfil-input-compact ${isExpired ? "expired" : ""}`}
                  value={licenciaVencimiento}
                  onChange={(e) => setLicenciaVencimiento(e.target.value)}
                  required
                />
              </div>
            </div>

            {isExpired && (
              <small style={{ color: "#dc2626", fontWeight: "700", display: "block" }}>
                ⚠️ Esta fecha indica que la licencia está vencida. Actualiza con la fecha vigente.
              </small>
            )}

            {/* Tipo de Licencia */}
            <div className="perfil-field">
              <label className="perfil-label" htmlFor="license-type">
                <span>Tipo de Licencia</span>
                <span className="perfil-required">*</span>
              </label>
              <div className="perfil-select-wrapper">
                <select
                  id="license-type"
                  className="perfil-select"
                  value={tipoLicencia}
                  onChange={(e) => setTipoLicencia(e.target.value)}
                >
                  {TIPOS_LICENCIA_OPCIONES.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <div className="perfil-select-chevron">
                  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Fotografías de la Licencia (Frente y Reverso) */}
          <div className="perfil-section-divider">
            <div className="perfil-section-title">
              <svg width="16" height="16" fill="none" stroke="#0284c7" strokeWidth="2" viewBox="0 0 24 24">
                <path
                  d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>Fotografías de la Licencia (Frente y Reverso)</span>
            </div>

            <div className="perfil-upload-grid">
              {/* Frente */}
              <div className="perfil-upload-card">
                <span className="perfil-upload-card-title">Frente de Licencia</span>

                {previewFrente ? (
                  <div className="perfil-upload-preview-box">
                    <img src={previewFrente} alt="Frente Licencia" className="perfil-upload-preview-img" />
                  </div>
                ) : (
                  <div className="perfil-upload-placeholder-box">
                    <svg width="24" height="24" fill="none" stroke="#0ea5e9" strokeWidth="1.75" viewBox="0 0 24 24">
                      <path
                        d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                )}

                <label className="perfil-upload-btn-label">
                  <span>Seleccionar archivo</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileChange(e, "frente")}
                    style={{ display: "none" }}
                  />
                </label>

                <span className="perfil-upload-filename">
                  {licenciaNombreArchivo || (previewFrente ? "Cargado" : "Ningún archivo")}
                </span>
              </div>

              {/* Reverso */}
              <div className="perfil-upload-card">
                <span className="perfil-upload-card-title">Reverso de Licencia</span>

                {previewReverso ? (
                  <div className="perfil-upload-preview-box">
                    <img src={previewReverso} alt="Reverso Licencia" className="perfil-upload-preview-img" />
                  </div>
                ) : (
                  <div className="perfil-upload-placeholder-box">
                    <svg width="24" height="24" fill="none" stroke="#0ea5e9" strokeWidth="1.75" viewBox="0 0 24 24">
                      <path
                        d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                )}

                <label className="perfil-upload-btn-label">
                  <span>Seleccionar archivo</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileChange(e, "reverso")}
                    style={{ display: "none" }}
                  />
                </label>

                <span className="perfil-upload-filename">
                  {licenciaReversoNombre || (previewReverso ? "Cargado" : "Ningún archivo")}
                </span>
              </div>
            </div>
          </div>

          {/* Botones de Acción */}
          <div className="perfil-actions-row">
            {typeof onCancel === "function" ? (
              <button type="button" className="perfil-btn-cancel" onClick={onCancel}>
                Cancelar
              </button>
            ) : (
              <div style={{ width: "33.33%" }} />
            )}

            <button type="submit" disabled={saving} className="perfil-btn-submit">
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path
                  d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span>{saving ? "Guardando..." : "Guardar Cambios"}</span>
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
