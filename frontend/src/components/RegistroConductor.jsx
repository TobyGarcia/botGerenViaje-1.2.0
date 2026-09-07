import {
  useRef,
  useState
} from "react";

import {
  registrarConductorTelegram
} from "../services/api.js";

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
  const [licenciaFile, setLicenciaFile] = useState({ name: "", preview: "", base64: "", isPdf: false });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function handleFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setError("El archivo no debe exceder 10MB.");
      return;
    }

    const isPdf = file.type === "application/pdf" || file.name.endsWith(".pdf");
    const reader = new FileReader();

    reader.onload = () => {
      setLicenciaFile({
        name: file.name,
        preview: isPdf ? "" : reader.result,
        base64: reader.result,
        isPdf
      });
      setError("");
    };

    reader.onerror = () => {
      setError("Error al leer el archivo de licencia.");
    };

    reader.readAsDataURL(file);
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

    if (!licenciaFile.base64) {
      setError("Es obligatorio adjuntar una fotografía o archivo de tu licencia de conducir.");
      return;
    }

    savingRef.current = true;
    setSaving(true);
    setError("");

    try {
      const initData = window.Telegram?.WebApp?.initData || "";
      const payload = {
        ...form,
        licenciaArchivoBase64: licenciaFile.base64,
        licenciaNombreArchivo: licenciaFile.name
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
        <label>
          Subir Licencia (Imagen o PDF)
          <input type="file" accept="image/*,application/pdf" onChange={handleFileChange} required />
        </label>
        {licenciaFile.name && (
          <div className="license-preview-container" style={{ marginBottom: "12px" }}>
            {licenciaFile.isPdf ? (
              <p style={{ fontSize: "0.88rem", color: "#2563eb", margin: "4px 0" }}>📄 Archivo PDF seleccionado: <strong>{licenciaFile.name}</strong></p>
            ) : (
              <div style={{ marginTop: "4px" }}>
                <img src={licenciaFile.preview} alt="Vista previa licencia" style={{ maxWidth: "100%", maxHeight: "160px", borderRadius: "6px", border: "1px solid #cbd5e1", objectFit: "contain" }} />
              </div>
            )}
          </div>
        )}
        <label>
          Última Evaluación de Manejo Comentado (dd/mm/aaaa)
          <span className="date-selects"><select value={form.mcDia} onChange={e=>updateManejoComentado("mcDia",e.target.value)}><option value="">dd</option>{Array.from({length:31},(_,i)=>String(i+1).padStart(2,"0")).map(day=><option key={day}>{day}</option>)}</select><select value={form.mcMes} onChange={e=>updateManejoComentado("mcMes",e.target.value)}><option value="">mm</option>{Array.from({length:12},(_,i)=>String(i+1).padStart(2,"0")).map(month=><option key={month}>{month}</option>)}</select><select value={form.mcAnio} onChange={e=>updateManejoComentado("mcAnio",e.target.value)}><option value="">yyyy</option>{Array.from({length:10},(_,i)=>String(anioActual - 5 + i)).map(year=><option key={year}>{year}</option>)}</select></span>
        </label>
        <label>Empresa<select name="empresa" value={form.empresa} onChange={handleChange} required><option value="">Selecciona una empresa</option>{["ITZAMNA", "MCCLICK", "AQUARIO", "ASPROMEX", "BALAM", "AGROKOOL"].map(empresa=><option key={empresa}>{empresa}</option>)}</select></label>

        <button type="submit" disabled={saving}>
          {saving ? "Guardando..." : "Completar registro"}
        </button>
      </form>
      {error && <p className="message message-error" role="alert">{error}</p>}
    </main>
  );
}

