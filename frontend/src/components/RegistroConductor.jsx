import {
  useRef,
  useState
} from "react";

import {
  registrarConductorTelegram
} from "../services/api.js";
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

function getInitialName(usuario) {
  return [usuario?.firstName, usuario?.lastName]
    .filter(Boolean)
    .join(" ");
}

export default function RegistroConductor({ telegramAuth, onRegistered }) {
  const savingRef = useRef(false);
  const [form, setForm] = useState({
    nombre: getInitialName(telegramAuth?.usuario),
    telefono: "",
    licenciaNumero: "",
    tipoLicencia: "",
    empresa: "",
    licenciaVencimiento: "",
    vencimientoDia: "",
    vencimientoMes: "",
    vencimientoAnio: "",
    fechaManejoComentado: "",
    mcDia: "",
    mcMes: "",
    mcAnio: ""
  });

  const [licenciaFrente, setLicenciaFrente] = useState({ name: "", preview: "", base64: "", sizeKb: 0, isPdf: false, compressing: false });
  const [licenciaReverso, setLicenciaReverso] = useState({ name: "", preview: "", base64: "", sizeKb: 0, isPdf: false, compressing: false });
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
        licenciaVencimiento: next.vencimientoAnio && next.vencimientoMes && next.vencimientoDia
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
        fechaManejoComentado: next.mcAnio && next.mcMes && next.mcDia
          ? `${next.mcAnio}-${next.mcMes}-${next.mcDia}`
          : ""
      };
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (savingRef.current) return;

    if (!licenciaFrente.base64) {
      setError("Es obligatorio tomar o adjuntar la foto frontal de tu licencia de conducir.");
      return;
    }

    if (licenciaFrente.compressing || licenciaReverso.compressing) {
      setError("Espera a que termine de procesarse la foto.");
      return;
    }

    savingRef.current = true;
    setSaving(true);
    setError("");

    try {
      const initData = window.Telegram?.WebApp?.initData || "";
      const payload = {
        ...form,
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
        onRegistered(response.data);
      }
    } catch (requestError) {
      setError(requestError.message || "No fue posible completar el registro.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  const anioActual = new Date().getFullYear();

  if (pendingResult) {
    return (
      <main className="container" style={{ padding: "24px 16px", maxWidth: "520px", margin: "0 auto" }}>
        <div
          style={{
            background: "#ffffff",
            borderRadius: "16px",
            border: "1px solid #e2e8f0",
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
            padding: "28px 20px",
            textAlign: "center"
          }}
        >
          <div
            style={{
              width: "64px",
              height: "64px",
              background: "#fef3c7",
              color: "#d97706",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px auto"
            }}
          >
            <IconClock size={32} color="#d97706" />
          </div>

          <h2 style={{ fontSize: "1.4rem", fontWeight: "700", color: "#1e293b", margin: "0 0 8px 0" }}>
            Registro en Espera de Aprobación
          </h2>

          <p style={{ color: "#475569", fontSize: "0.95rem", lineHeight: "1.5", margin: "0 0 20px 0" }}>
            Tu registro de conductor fue recibido exitosamente. Tu cuenta se encuentra <strong>en espera de aprobación por el administrador</strong>.
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
              <span style={{ display: "block", fontSize: "0.82rem", fontWeight: "600", color: "#1d4ed8", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px" }}>
                <IconKey size={16} color="#1d4ed8" style={{ marginRight: "4px" }} /> Tu PIN de Acceso de 4 Dígitos Asignado:
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
              <div style={{ display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap", marginTop: "10px" }}>
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
                    background: "#2563eb",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "6px",
                    padding: "8px 16px",
                    fontSize: "0.85rem",
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
                    borderRadius: "6px",
                    padding: "8px 16px",
                    fontSize: "0.85rem",
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
            <div style={{ background: "#eff6ff", padding: "12px 16px", borderRadius: "8px", border: "1px solid #bfdbfe", marginBottom: "20px", color: "#1e40af", fontSize: "0.85rem" }}>
              🔑 Tu PIN de acceso se generará y asignará automáticamente al ser aprobado por el administrador.
            </div>
          )}

          <div
            style={{
              background: "#fffbeb",
              border: "1px solid #fef3c7",
              borderRadius: "8px",
              padding: "12px 14px",
              textAlign: "left",
              fontSize: "0.88rem",
              color: "#92400e",
              lineHeight: "1.4",
              marginBottom: "24px"
            }}
          >
            <strong><IconPin size={16} color="#92400e" style={{ marginRight: "4px" }} /> Importante:</strong>
            <ul style={{ margin: "6px 0 0 0", paddingLeft: "20px" }}>
              <li>Guarda este PIN de 4 dígitos para ingresar al sistema.</li>
              <li>Solo podrás acceder a la aplicación y realizar viajes una vez que tu cuenta sea aprobada por la administración.</li>
            </ul>
          </div>

          <button
            type="button"
            onClick={() => onRegistered(pendingResult.rawResponse)}
            style={{
              width: "100%",
              padding: "12px 16px",
              background: "#0284c7",
              color: "#ffffff",
              border: "none",
              borderRadius: "8px",
              fontSize: "1rem",
              fontWeight: "700",
              cursor: "pointer",
              boxShadow: "0 4px 6px -1px rgba(2, 132, 199, 0.2)"
            }}
          >
            Entendido / Ir al Inicio
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="container">
      <h1>Registro de conductor</h1>
      <p>Completa tu información una sola vez para acceder a los viajes.</p>
      <form onSubmit={handleSubmit}>
        <label>
          Nombre completo
          <input name="nombre" value={form.nombre} onChange={handleChange} maxLength="150" required />
        </label>
        <label>
          Teléfono
          <input name="telefono" type="tel" value={form.telefono} onChange={handleChange} maxLength="30" required />
        </label>
        <label>
          Número de licencia
          <input name="licenciaNumero" value={form.licenciaNumero} onChange={handleChange} maxLength="50" required />
        </label>
        <label>
          Fecha de vencimiento de licencia
          <span className="date-selects"><select value={form.vencimientoDia} onChange={e=>updateExpiry("vencimientoDia",e.target.value)} required><option value="">dd</option>{Array.from({length:31},(_,i)=>String(i+1).padStart(2,"0")).map(day=><option key={day}>{day}</option>)}</select><select value={form.vencimientoMes} onChange={e=>updateExpiry("vencimientoMes",e.target.value)} required><option value="">mm</option>{Array.from({length:12},(_,i)=>String(i+1).padStart(2,"0")).map(month=><option key={month}>{month}</option>)}</select><select value={form.vencimientoAnio} onChange={e=>updateExpiry("vencimientoAnio",e.target.value)} required><option value="">yyyy</option>{Array.from({length:16},(_,i)=>String(anioActual+i)).map(year=><option key={year}>{year}</option>)}</select></span>
        </label>
        <label>
          Tipo de licencia
          <input name="tipoLicencia" value={form.tipoLicencia} onChange={handleChange} maxLength="50" placeholder="Ej. Federal B" required />
        </label>

        {/* Sección Licencia Frente */}
        <fieldset style={{ border: "1px solid #cbd5e1", borderRadius: "8px", padding: "12px 14px", marginBottom: "16px", background: "#f8fafc" }}>
          <legend style={{ fontWeight: "600", fontSize: "0.95rem", color: "#1e293b", padding: "0 6px", display: "inline-flex", alignItems: "center", gap: "6px" }}><IconCamera size={16} color="#1e293b" /> Licencia de Conducir (Frente) *</legend>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", margin: "8px 0" }}>
            <button
              type="button"
              onClick={() => setActiveCameraSide("frente")}
              style={{ flex: "1", minWidth: "140px", cursor: "pointer", background: "#2563eb", color: "#fff", border: "none", padding: "10px 12px", borderRadius: "6px", textAlign: "center", fontSize: "0.88rem", fontWeight: "600", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
            >
              <IconCamera size={16} /> Visor Cámara Directa
            </button>
            <label style={{ flex: "1", minWidth: "140px", cursor: "pointer", background: "#475569", color: "#fff", padding: "10px 12px", borderRadius: "6px", textAlign: "center", fontSize: "0.88rem", fontWeight: "600", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
              <IconFolder size={16} /> Elegir archivo
              <input type="file" accept="image/*,application/pdf" onChange={(e) => handleLicenseFileChange("frente", e)} style={{ display: "none" }} />
            </label>
          </div>

          {licenciaFrente.compressing && <p style={{ fontSize: "0.85rem", color: "#0284c7", display: "inline-flex", alignItems: "center", gap: "6px" }}><IconRefresh size={14} className="spin" /> Comprimiendo imagen (objetivo &le; 77KB)...</p>}

          {licenciaFrente.base64 && !licenciaFrente.compressing && (
            <div style={{ marginTop: "8px", background: "#fff", padding: "8px", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
              <p style={{ fontSize: "0.82rem", color: "#15803d", fontWeight: "600", margin: "0 0 4px 0", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                <IconCheck size={14} color="#15803d" /> Foto Frente procesada ({licenciaFrente.sizeKb} KB)
              </p>
              {licenciaFrente.isPdf ? (
                <p style={{ fontSize: "0.85rem", color: "#2563eb", display: "inline-flex", alignItems: "center", gap: "6px" }}><IconDocument size={16} /> {licenciaFrente.name}</p>
              ) : (
                <img src={licenciaFrente.preview} alt="Vista previa frente" style={{ maxWidth: "100%", maxHeight: "150px", borderRadius: "4px", objectFit: "contain", border: "1px solid #e2e8f0" }} />
              )}
            </div>
          )}
        </fieldset>

        {/* Sección Licencia Reverso */}
        <fieldset style={{ border: "1px solid #cbd5e1", borderRadius: "8px", padding: "12px 14px", marginBottom: "16px", background: "#f8fafc" }}>
          <legend style={{ fontWeight: "600", fontSize: "0.95rem", color: "#1e293b", padding: "0 6px", display: "inline-flex", alignItems: "center", gap: "6px" }}><IconCamera size={16} color="#1e293b" /> Licencia de Conducir (Reverso / Trasero)</legend>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", margin: "8px 0" }}>
            <button
              type="button"
              onClick={() => setActiveCameraSide("reverso")}
              style={{ flex: "1", minWidth: "140px", cursor: "pointer", background: "#2563eb", color: "#fff", border: "none", padding: "10px 12px", borderRadius: "6px", textAlign: "center", fontSize: "0.88rem", fontWeight: "600", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
            >
              <IconCamera size={16} /> Visor Cámara Directa
            </button>
            <label style={{ flex: "1", minWidth: "140px", cursor: "pointer", background: "#475569", color: "#fff", padding: "10px 12px", borderRadius: "6px", textAlign: "center", fontSize: "0.88rem", fontWeight: "600", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
              <IconFolder size={16} /> Elegir archivo
              <input type="file" accept="image/*,application/pdf" onChange={(e) => handleLicenseFileChange("reverso", e)} style={{ display: "none" }} />
            </label>
          </div>

          {licenciaReverso.compressing && <p style={{ fontSize: "0.85rem", color: "#0284c7", display: "inline-flex", alignItems: "center", gap: "6px" }}><IconRefresh size={14} className="spin" /> Comprimiendo imagen (objetivo &le; 77KB)...</p>}

          {licenciaReverso.base64 && !licenciaReverso.compressing && (
            <div style={{ marginTop: "8px", background: "#fff", padding: "8px", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
              <p style={{ fontSize: "0.82rem", color: "#15803d", fontWeight: "600", margin: "0 0 4px 0" }}>
                ✓ Foto Reverso procesada ({licenciaReverso.sizeKb} KB)
              </p>
              {licenciaReverso.isPdf ? (
                <p style={{ fontSize: "0.85rem", color: "#2563eb" }}>📄 {licenciaReverso.name}</p>
              ) : (
                <img src={licenciaReverso.preview} alt="Vista previa reverso" style={{ maxWidth: "100%", maxHeight: "150px", borderRadius: "4px", objectFit: "contain", border: "1px solid #e2e8f0" }} />
              )}
            </div>
          )}
        </fieldset>

        <label>
          Última Evaluación de Manejo Comentado (dd/mm/aaaa)
          <span className="date-selects"><select value={form.mcDia} onChange={e=>updateManejoComentado("mcDia",e.target.value)}><option value="">dd</option>{Array.from({length:31},(_,i)=>String(i+1).padStart(2,"0")).map(day=><option key={day}>{day}</option>)}</select><select value={form.mcMes} onChange={e=>updateManejoComentado("mcMes",e.target.value)}><option value="">mm</option>{Array.from({length:12},(_,i)=>String(i+1).padStart(2,"0")).map(month=><option key={month}>{month}</option>)}</select><select value={form.mcAnio} onChange={e=>updateManejoComentado("mcAnio",e.target.value)}><option value="">yyyy</option>{Array.from({length:10},(_,i)=>String(anioActual - 5 + i)).map(year=><option key={year}>{year}</option>)}</select></span>
        </label>
        <label>Empresa<select name="empresa" value={form.empresa} onChange={handleChange} required><option value="">Selecciona una empresa</option>{["ITZAMNA", "MCCLICK", "AQUARIO", "ASPROMEX", "BALAM", "AGROKOOL"].map(empresa=><option key={empresa}>{empresa}</option>)}</select></label>

        <button type="submit" disabled={saving || licenciaFrente.compressing || licenciaReverso.compressing}>
          {saving ? "Guardando..." : "Completar registro"}
        </button>
      </form>

      {error && <p className="message message-error" role="alert">{error}</p>}

      {activeCameraSide && (
        <CameraModal
          onCapture={handleCameraCapture}
          onClose={() => setActiveCameraSide(null)}
        />
      )}
    </main>
  );
}



