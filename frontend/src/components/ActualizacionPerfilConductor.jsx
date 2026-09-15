import React, { useState } from "react";
import { actualizarPerfilConductor } from "../services/api.js";

const TIPOS_LICENCIA_OPCIONES = [
  "Tipo A (Particular / Automóvil)",
  "Tipo B (Carga / Chófer Particular)",
  "Tipo C (Servicio Público / Colectivo)",
  "Tipo D (Especial / Maquinaria)",
  "Tipo E (Maquinaria Pesada / Grúas)",
  "Licencia Federal de Conductor"
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
  const [tipoLicencia, setTipoLicencia] = useState(conductor?.tipo_licencia || TIPOS_LICENCIA_OPCIONES[0]);
  const [licenciaVencimiento, setLicenciaVencimiento] = useState(formatDateForInput(conductor?.licencia_vencimiento || conductor?.licenciaVencimiento));

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

  const isExpired = licenciaVencimiento ? new Date(`${licenciaVencimiento}T00:00:00`) < new Date(new Date().setHours(0,0,0,0)) : false;

  return (
    <div className="profile-update-card" style={{ background: "#ffffff", borderRadius: "16px", padding: "20px", border: "1px solid #cbd5e1", boxShadow: "0 4px 14px rgba(0,0,0,0.06)", margin: "0 auto 20px auto", maxWidth: "560px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px", borderBottom: "1px solid #f1f5f9", paddingBottom: "12px" }}>
        <div style={{ width: "42px", height: "42px", borderRadius: "10px", background: "#e0f2fe", color: "#0284c7", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: "1.15rem", color: "#0f172a", fontWeight: "800" }}>Actualización de Datos del Conductor</h2>
          <small style={{ color: "#64748b" }}>Modifica tu contacto de emergencia y datos de la licencia de conducir.</small>
        </div>
      </div>

      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", color: "#991b1b", padding: "10px 12px", borderRadius: "8px", fontSize: "0.88rem", marginBottom: "14px" }}>
          ⚠️ {error}
        </div>
      )}

      {message && (
        <div style={{ background: "#f0fdf4", border: "1px solid #86efac", color: "#166534", padding: "10px 12px", borderRadius: "8px", fontSize: "0.88rem", marginBottom: "14px", fontWeight: "600" }}>
          ✅ {message}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        <div>
          <label style={{ display: "block", fontWeight: "700", color: "#334155", fontSize: "0.88rem", marginBottom: "4px" }}>
            Nombre Completo
          </label>
          <input
            type="text"
            value={conductor?.nombre || ""}
            disabled
            style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", background: "#f8fafc", color: "#64748b", fontWeight: "600" }}
          />
        </div>

        <div>
          <label htmlFor="input-tel-emergencia" style={{ display: "block", fontWeight: "700", color: "#334155", fontSize: "0.88rem", marginBottom: "4px" }}>
            📞 Teléfono / Contacto de Emergencia *
          </label>
          <input
            id="input-tel-emergencia"
            type="tel"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            placeholder="Ej. 9931234567"
            required
            style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #0284c7", fontSize: "0.95rem", fontWeight: "600", color: "#0f172a" }}
          />
          <small style={{ color: "#64748b", fontSize: "0.78rem" }}>Número al cual avisar en caso de alguna incidencia durante los viajes.</small>
        </div>

        <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: "12px" }}>
          <h3 style={{ margin: "0 0 10px 0", fontSize: "0.98rem", color: "#1e293b", fontWeight: "700" }}>🪪 Datos de Licencia de Conducir</h3>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <div>
              <label htmlFor="input-lic-num" style={{ display: "block", fontWeight: "700", color: "#334155", fontSize: "0.82rem", marginBottom: "4px" }}>
                N° de Licencia *
              </label>
              <input
                id="input-lic-num"
                type="text"
                value={licenciaNumero}
                onChange={(e) => setLicenciaNumero(e.target.value)}
                placeholder="Ej. LIC-12345"
                required
                style={{ width: "100%", padding: "9px 10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.9rem", fontWeight: "600" }}
              />
            </div>

            <div>
              <label htmlFor="input-lic-venc" style={{ display: "block", fontWeight: "700", color: "#334155", fontSize: "0.82rem", marginBottom: "4px" }}>
                Vencimiento *
              </label>
              <input
                id="input-lic-venc"
                type="date"
                value={licenciaVencimiento}
                onChange={(e) => setLicenciaVencimiento(e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: "9px 10px",
                  borderRadius: "8px",
                  border: isExpired ? "2px solid #dc2626" : "1px solid #cbd5e1",
                  fontSize: "0.9rem",
                  fontWeight: "600",
                  color: isExpired ? "#dc2626" : "#0f172a"
                }}
              />
            </div>
          </div>

          {isExpired && (
            <small style={{ color: "#dc2626", fontWeight: "700", display: "block", marginTop: "4px" }}>
              ⚠️ Esta fecha indica que la licencia está vencida. Actualiza con la fecha vigente.
            </small>
          )}

          <div style={{ marginTop: "10px" }}>
            <label htmlFor="select-lic-tipo" style={{ display: "block", fontWeight: "700", color: "#334155", fontSize: "0.82rem", marginBottom: "4px" }}>
              Tipo de Licencia *
            </label>
            <select
              id="select-lic-tipo"
              value={tipoLicencia}
              onChange={(e) => setTipoLicencia(e.target.value)}
              style={{ width: "100%", padding: "9px 10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.9rem", fontWeight: "600" }}
            >
              {TIPOS_LICENCIA_OPCIONES.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Fotos de la Licencia */}
        <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: "12px" }}>
          <label style={{ display: "block", fontWeight: "700", color: "#334155", fontSize: "0.88rem", marginBottom: "8px" }}>
            📷 Fotografías de la Licencia (Frente y Reverso)
          </label>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            {/* Frente */}
            <div style={{ border: "1px dashed #cbd5e1", borderRadius: "10px", padding: "10px", textAlign: "center", background: "#f8fafc" }}>
              <span style={{ fontSize: "0.78rem", fontWeight: "700", color: "#475569", display: "block", marginBottom: "6px" }}>Frente de Licencia</span>
              {previewFrente ? (
                <div style={{ marginBottom: "6px" }}>
                  <img src={previewFrente} alt="Frente Licencia" style={{ width: "100%", maxHeight: "90px", objectFit: "cover", borderRadius: "6px", border: "1px solid #e2e8f0" }} />
                </div>
              ) : (
                <div style={{ height: "60px", background: "#e2e8f0", borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b", fontSize: "0.76rem", marginBottom: "6px" }}>
                  Sin foto cargada
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleFileChange(e, "frente")}
                style={{ fontSize: "0.75rem", width: "100%" }}
              />
            </div>

            {/* Reverso */}
            <div style={{ border: "1px dashed #cbd5e1", borderRadius: "10px", padding: "10px", textAlign: "center", background: "#f8fafc" }}>
              <span style={{ fontSize: "0.78rem", fontWeight: "700", color: "#475569", display: "block", marginBottom: "6px" }}>Reverso de Licencia</span>
              {previewReverso ? (
                <div style={{ marginBottom: "6px" }}>
                  <img src={previewReverso} alt="Reverso Licencia" style={{ width: "100%", maxHeight: "90px", objectFit: "cover", borderRadius: "6px", border: "1px solid #e2e8f0" }} />
                </div>
              ) : (
                <div style={{ height: "60px", background: "#e2e8f0", borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b", fontSize: "0.76rem", marginBottom: "6px" }}>
                  Sin foto cargada
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleFileChange(e, "reverso")}
                style={{ fontSize: "0.75rem", width: "100%" }}
              />
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
          {typeof onCancel === "function" && (
            <button
              type="button"
              onClick={onCancel}
              className="secondary-button"
              style={{ flex: 1, padding: "11px", borderRadius: "8px", border: "1px solid #cbd5e1", background: "#ffffff", color: "#334155", fontWeight: "700", cursor: "pointer" }}
            >
              Cancelar
            </button>
          )}
          <button
            type="submit"
            disabled={saving}
            className="primary-button"
            style={{
              flex: 2,
              padding: "11px",
              borderRadius: "8px",
              border: 0,
              background: saving ? "#94a3b8" : "linear-gradient(135deg, #0284c7, #0369a1)",
              color: "#ffffff",
              fontWeight: "800",
              fontSize: "0.95rem",
              cursor: saving ? "wait" : "pointer",
              boxShadow: "0 4px 12px rgba(2, 132, 199, 0.25)"
            }}
          >
            {saving ? "Guardando cambios..." : "💾 Guardar Cambios"}
          </button>
        </div>
      </form>
    </div>
  );
}
