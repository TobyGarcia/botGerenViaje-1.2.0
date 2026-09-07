import {
  useRef,
  useState
} from "react";

import {
  registrarConductorTelegram
} from "../services/api.js";
import { compressImageToMaxKb } from "../utils/imageCompressor.js";

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

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleLicenseFileChange(side, event) {
    const file = event.target.files?.[0];
    if (!file) return;

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
      onRegistered(response.data);
    } catch (requestError) {
      setError(requestError.message || "No fue posible completar el registro.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  const anioActual = new Date().getFullYear();

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
          <legend style={{ fontWeight: "600", fontSize: "0.95rem", color: "#1e293b", padding: "0 6px" }}>📷 Licencia de Conducir (Frente) *</legend>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", margin: "8px 0" }}>
            <label style={{ flex: "1", minWidth: "140px", cursor: "pointer", background: "#2563eb", color: "#fff", padding: "8px 12px", borderRadius: "6px", textAlign: "center", fontSize: "0.88rem", display: "inline-block" }}>
              📷 Tomar foto (Cámara)
              <input type="file" accept="image/*" capture="environment" onChange={(e) => handleLicenseFileChange("frente", e)} style={{ display: "none" }} />
            </label>
            <label style={{ flex: "1", minWidth: "140px", cursor: "pointer", background: "#475569", color: "#fff", padding: "8px 12px", borderRadius: "6px", textAlign: "center", fontSize: "0.88rem", display: "inline-block" }}>
              📁 Elegir archivo
              <input type="file" accept="image/*,application/pdf" onChange={(e) => handleLicenseFileChange("frente", e)} style={{ display: "none" }} />
            </label>
          </div>

          {licenciaFrente.compressing && <p style={{ fontSize: "0.85rem", color: "#0284c7" }}>⏳ Comprimiendo imagen (objetivo &le; 77KB)...</p>}

          {licenciaFrente.base64 && !licenciaFrente.compressing && (
            <div style={{ marginTop: "8px", background: "#fff", padding: "8px", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
              <p style={{ fontSize: "0.82rem", color: "#15803d", fontWeight: "600", margin: "0 0 4px 0" }}>
                ✓ Foto Frente procesada ({licenciaFrente.sizeKb} KB)
              </p>
              {licenciaFrente.isPdf ? (
                <p style={{ fontSize: "0.85rem", color: "#2563eb" }}>📄 {licenciaFrente.name}</p>
              ) : (
                <img src={licenciaFrente.preview} alt="Vista previa frente" style={{ maxWidth: "100%", maxHeight: "150px", borderRadius: "4px", objectFit: "contain", border: "1px solid #e2e8f0" }} />
              )}
            </div>
          )}
        </fieldset>

        {/* Sección Licencia Reverso */}
        <fieldset style={{ border: "1px solid #cbd5e1", borderRadius: "8px", padding: "12px 14px", marginBottom: "16px", background: "#f8fafc" }}>
          <legend style={{ fontWeight: "600", fontSize: "0.95rem", color: "#1e293b", padding: "0 6px" }}>📷 Licencia de Conducir (Reverso / Trasero)</legend>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", margin: "8px 0" }}>
            <label style={{ flex: "1", minWidth: "140px", cursor: "pointer", background: "#2563eb", color: "#fff", padding: "8px 12px", borderRadius: "6px", textAlign: "center", fontSize: "0.88rem", display: "inline-block" }}>
              📷 Tomar foto (Cámara)
              <input type="file" accept="image/*" capture="environment" onChange={(e) => handleLicenseFileChange("reverso", e)} style={{ display: "none" }} />
            </label>
            <label style={{ flex: "1", minWidth: "140px", cursor: "pointer", background: "#475569", color: "#fff", padding: "8px 12px", borderRadius: "6px", textAlign: "center", fontSize: "0.88rem", display: "inline-block" }}>
              📁 Elegir archivo
              <input type="file" accept="image/*,application/pdf" onChange={(e) => handleLicenseFileChange("reverso", e)} style={{ display: "none" }} />
            </label>
          </div>

          {licenciaReverso.compressing && <p style={{ fontSize: "0.85rem", color: "#0284c7" }}>⏳ Comprimiendo imagen (objetivo &le; 77KB)...</p>}

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
    </main>
  );
}


