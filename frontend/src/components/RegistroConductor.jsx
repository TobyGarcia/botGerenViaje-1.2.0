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
    vencimientoAnio: ""
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
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

  async function handleSubmit(event) {
    event.preventDefault();
    if (savingRef.current) return;

    savingRef.current = true;
    setSaving(true);
    setError("");

    try {
      const initData = window.Telegram?.WebApp?.initData || "";
      const response = await registrarConductorTelegram(initData, form);
      onRegistered(response.data);
    } catch (requestError) {
      setError(requestError.message || "No fue posible completar el registro.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
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
          Fecha de vencimiento
          <span className="date-selects"><select value={form.vencimientoDia} onChange={e=>updateExpiry("vencimientoDia",e.target.value)} required><option value="">dd</option>{Array.from({length:31},(_,i)=>String(i+1).padStart(2,"0")).map(day=><option key={day}>{day}</option>)}</select><select value={form.vencimientoMes} onChange={e=>updateExpiry("vencimientoMes",e.target.value)} required><option value="">mm</option>{Array.from({length:12},(_,i)=>String(i+1).padStart(2,"0")).map(month=><option key={month}>{month}</option>)}</select><select value={form.vencimientoAnio} onChange={e=>updateExpiry("vencimientoAnio",e.target.value)} required><option value="">yyyy</option>{Array.from({length:16},(_,i)=>String(new Date().getFullYear()+i)).map(year=><option key={year}>{year}</option>)}</select></span>
        </label>
        <label>
          Tipo de licencia
          <input name="tipoLicencia" value={form.tipoLicencia} onChange={handleChange} maxLength="50" placeholder="Ej. Federal B" required />
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
