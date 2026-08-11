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
    licenciaVencimiento: ""
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
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
          <input name="licenciaVencimiento" type="date" value={form.licenciaVencimiento} onChange={handleChange} required />
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
