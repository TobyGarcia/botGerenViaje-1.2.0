import { useState, useRef, useEffect } from "react";
import { crearGerenciamientoViaje } from "../services/api.js";
import logoAQR from "../assets/logoAQR.webp";

const defaultChecklistItems = {
  "Luces": "B",
  "Direccionales y Intermitentes": "B",
  "Freno y Reversa": "B",
  "Neumáticos y Llanta de Refacción": "B",
  "Frenos y Freno de Mano": "B",
  "Aceite de Motor y Niveles": "B",
  "Líquido Refrigerante / Anticongelante": "B",
  "Líquido de Frenos y Dirección": "B",
  "Cinturones de Seguridad": "B",
  "Espejos y Parabrisas": "B",
  "Extintor Carga Vigente": "B",
  "Triángulos / Botiquín / Gato": "B",
  "Limpieza Interior y Exterior": "B"
};

export default function GerenciamientoForm({ telegramAuth, conductores = [], vehiculos = [], lugares = [], onComplete, onCancel }) {
  const selectedDriver = telegramAuth?.conductor || {};

  // Buscar si el conductor tiene una unidad pre-asignada por supervisor
  const driverId = telegramAuth?.conductor?.id_conductores;
  const authAssignedId = telegramAuth?.conductor?.id_vehiculo_asignado;
  const assignedVehicle = vehiculos.find(
    (v) => (driverId && String(v.id_conductor_asignado) === String(driverId)) ||
           (authAssignedId && String(v.id_vehiculos) === String(authAssignedId))
  );

  const [form, setForm] = useState({
    departamento: "Logística",
    horaSalida: new Date().toTimeString().slice(0, 5),
    idOrigen: "",
    origenTexto: "",
    idDestino: "",
    destinoTexto: "",
    idVehiculo: assignedVehicle ? String(assignedVehicle.id_vehiculos) : "",
    kilometraje: assignedVehicle ? (assignedVehicle.kilometraje_actual ?? "") : "",

    // 1. Valoración Médica
    presionArterial: "120/80",
    examenVisual: "Normal",
    glucosa: "90 mg/dL",
    alcoholimetro: false,
    frecuenciaCardiaca: "72 bpm",
    frecuenciaRespiratoria: "16 rpm",

    // 2. Información General
    tipoVehiculo: assignedVehicle?.tipo_vehiculo || assignedVehicle?.nombre || "",
    placa: assignedVehicle?.placas || "",
    modelo: assignedVehicle?.modelo || assignedVehicle?.marca || "",
    color: assignedVehicle?.color || "Blanco",
    vehiculoEmpresa: true,
    nombreContratista: "",
    numeroUnidad: assignedVehicle?.numero_economico || "",
    telefonoConductor: selectedDriver.telefono || "",
    tiempoViajeHoras: 1,

    // 3. Lista de Verificación (SI / NO)
    conocimientoRiesgosLocales: true,
    prohibidoPersonalAjeno: true,
    inspeccionVehiculoRealizada: true,
    reunionPreCaravanaRealizada: false,

    // Inspección Vehicular Integrada
    combustible: "3/4",
    tipoAsignacion: "Base",
    observacionesVehiculo: "",

    // 4. Tabuladores A-G
    ptsDistancia: 1, // <50km: 1, <100km: 2, <200km: 5, >200km: 8
    ptsClima: 2, // Seco: 2, Lluvia suave: 4, Lluvia fuerte/niebla: 8, Nieve: 10
    ptsVehiculosPersonas: 1, // 2+ veh 2+ pers: 1, 2+ veh 1+ pers: 2, 1 veh 2+ pers: 3, 1 veh 1 pers: 8
    ptsCondicionesVia: 1, // Pavimentada: 1, Mixta: 2, No pavimentada: 4
    ptsComunicaciones: 0, // Celular: 0, Sin com caravana: 2, Sin com sin caravana: 4
    ptsHorasTrabajadas: 1, // <12h: 1, <14h: 3, <16h: 6, >=16h: 16 (Bloqueante)
    ptsHoraTraslado: 1, // Día: 1, Noche: 8
  });

  const [checklist, setChecklist] = useState(defaultChecklistItems);
  const [rutaPuntos, setRutaPuntos] = useState(["", ""]);
  const [viajaAcompanado, setViajaAcompanado] = useState(false);
  const [listaAcompanantes, setListaAcompanantes] = useState([""]);

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Signature canvas
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  // Determinar número máximo de acompañantes según tipo de vehículo
  const currentVehicleObj = vehiculos.find((v) => String(v.id_vehiculos) === String(form.idVehiculo));
  const vehicleTypeStr = String(currentVehicleObj?.tipo_vehiculo || currentVehicleObj?.nombre || "").toLowerCase();
  let maxAcompanantes = 4;
  if (vehicleTypeStr.includes("maquinaria") || vehicleTypeStr.includes("retro") || vehicleTypeStr.includes("remolque") || vehicleTypeStr.includes("mecanica") || vehicleTypeStr.includes("tractor")) {
    maxAcompanantes = 1;
  } else if (vehicleTypeStr.includes("auto") || vehicleTypeStr.includes("sedan") || vehicleTypeStr.includes("hatchback") || vehicleTypeStr.includes("automovil")) {
    maxAcompanantes = 3;
  } else if (vehicleTypeStr.includes("camioneta") || vehicleTypeStr.includes("pickup") || vehicleTypeStr.includes("suv") || vehicleTypeStr.includes("van")) {
    maxAcompanantes = 4;
  }

  // Auto-fill selected vehicle info when vehicle changes
  useEffect(() => {
    if (form.idVehiculo) {
      const v = vehiculos.find((item) => String(item.id_vehiculos) === String(form.idVehiculo));
      if (v) {
        setForm((prev) => ({
          ...prev,
          tipoVehiculo: v.tipo_vehiculo || v.nombre || "",
          placa: v.placas || "",
          modelo: v.modelo || v.marca || "",
          color: v.color || "Blanco",
          numeroUnidad: v.numero_economico || "",
          kilometraje: v.kilometraje_actual ?? prev.kilometraje
        }));
      }
    }
  }, [form.idVehiculo, vehiculos]);

  // Recalcular puntos de tabuladores automáticamente según datos seleccionados
  useEffect(() => {
    let ptsDist = 1;
    const origenObj = lugares.find((l) => String(l.id_lugares) === String(form.idOrigen));
    const destinoObj = lugares.find((l) => String(l.id_lugares) === String(form.idDestino));

    if (origenObj && destinoObj && origenObj.latitud && destinoObj.latitud) {
      const lat1 = Number(origenObj.latitud);
      const lon1 = Number(origenObj.longitud);
      const lat2 = Number(destinoObj.latitud);
      const lon2 = Number(destinoObj.longitud);

      const R = 6371;
      const dLat = (lat2 - lat1) * (Math.PI / 180);
      const dLon = (lon2 - lon1) * (Math.PI / 180);
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distKm = R * c;

      if (distKm > 200) ptsDist = 8;
      else if (distKm > 100) ptsDist = 5;
      else if (distKm > 50) ptsDist = 2;
      else ptsDist = 1;
    }

    let ptsPers = 1;
    const numAcompanantes = viajaAcompanado ? listaAcompanantes.filter((a) => a.trim()).length : 0;
    if (numAcompanantes === 0) ptsPers = 6;
    else if (numAcompanantes === 1) ptsPers = 3;
    else ptsPers = 1;

    let ptsHora = 1;
    if (form.horaSalida) {
      const hh = Number(form.horaSalida.split(":")[0]);
      if (hh < 6 || hh >= 18) ptsHora = 8;
    }

    setForm((prev) => ({
      ...prev,
      ptsDistancia: ptsDist,
      ptsVehiculosPersonas: ptsPers,
      ptsHoraTraslado: ptsHora
    }));
  }, [form.idOrigen, form.idDestino, form.horaSalida, viajaAcompanado, listaAcompanantes, lugares]);

  const puntajeTotal = form.ptsDistancia + form.ptsClima + form.ptsVehiculosPersonas + form.ptsCondicionesVia + form.ptsComunicaciones + form.ptsHorasTrabajadas + form.ptsHoraTraslado;
  let nivelRiesgo = "BAJO";
  let autorizacionRequerida = "SUPERVISOR DIRECTO O QHSE";

  if (puntajeTotal > 23) {
    nivelRiesgo = "ALTO";
    autorizacionRequerida = "GERENCIA GENERAL Y QHSE";
  } else if (puntajeTotal >= 16) {
    nivelRiesgo = "MEDIO";
    autorizacionRequerida = "COORDINACIÓN DE ÁREA";
  }

  const esBloqueante = form.ptsHorasTrabajadas >= 16;

  function handleInputChange(event) {
    const { name, value, type, checked } = event.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }));
  }

  function handleChecklistItemChange(key, value) {
    setChecklist((prev) => ({ ...prev, [key]: value }));
  }

  // Métodos para Puntos de Ruta
  function handleRoutePointChange(index, value) {
    const updated = [...rutaPuntos];
    updated[index] = value;
    setRutaPuntos(updated);
  }

  function addRoutePoint() {
    if (rutaPuntos.length < 4) {
      setRutaPuntos([...rutaPuntos, ""]);
    }
  }

  function removeRoutePoint(index) {
    if (rutaPuntos.length > 1) {
      const updated = rutaPuntos.filter((_, i) => i !== index);
      setRutaPuntos(updated);
    }
  }

  // Métodos para Acompañantes
  function handleCompanionChange(index, value) {
    const updated = [...listaAcompanantes];
    updated[index] = value;
    setListaAcompanantes(updated);
  }

  function addCompanionField() {
    if (listaAcompanantes.length < maxAcompanantes) {
      setListaAcompanantes([...listaAcompanantes, ""]);
    }
  }

  function removeCompanionField(index) {
    if (listaAcompanantes.length > 1) {
      const updated = listaAcompanantes.filter((_, i) => i !== index);
      setListaAcompanantes(updated);
    }
  }

  // Canvas Handlers
  function getCanvasPoint(e) {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height)
    };
  }

  function startDrawing(e) {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const pt = getCanvasPoint(e);
    ctx.beginPath();
    ctx.moveTo(pt.x, pt.y);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#000000";
    setIsDrawing(true);
    setHasSignature(true);
  }

  function draw(e) {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const pt = getCanvasPoint(e);
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
  }

  function stopDrawing() {
    setIsDrawing(false);
  }

  function clearSignature() {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    setHasSignature(false);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!form.idOrigen && !form.origenTexto) {
      setErrorMessage("Por favor selecciona o especifica el Origen.");
      return;
    }
    if (!form.idDestino && !form.destinoTexto) {
      setErrorMessage("Por favor selecciona o especifica el Destino.");
      return;
    }
    if (!form.idVehiculo) {
      setErrorMessage("Por favor selecciona el Vehículo que utilizarás.");
      return;
    }
    if (esBloqueante) {
      setErrorMessage("⛔ Las Horas trabajadas + Viaje resultan en >= 16h: NO CONDUCIR (Riesgo Bloqueante).");
      return;
    }
    if (!hasSignature) {
      setErrorMessage("Por favor realiza la firma digital del conductor antes de enviar.");
      return;
    }

    const canvas = canvasRef.current;
    const firmaDataUrl = canvas ? canvas.toDataURL("image/png") : "";

    const acompanantesFiltrados = viajaAcompanado ? listaAcompanantes.filter((a) => a.trim()) : [];
    const rutaFiltrada = rutaPuntos.filter((r) => r.trim());

    setSubmitting(true);

    try {
      const payload = {
        ...form,
        rutaPuntos: rutaFiltrada,
        acompanantes: acompanantesFiltrados,
        firmaConductor: firmaDataUrl,
        nombreConductorFirma: selectedDriver.nombre,
        inspeccionData: {
          combustible: form.combustible,
          tipoAsignacion: form.tipoAsignacion,
          checklist: checklist,
          danos: {},
          observaciones: form.observacionesVehiculo || null,
          firma: firmaDataUrl,
          esDiaSiguiente: false
        }
      };

      const res = await crearGerenciamientoViaje(payload);
      if (res.success) {
        setSuccessMessage("✅ Gerenciamiento e Inspección Vehicular registrados exitosamente en un solo paso. Notificando a supervisión...");
        setTimeout(() => {
          if (onComplete) onComplete(res.data);
        }, 1500);
      } else {
        setErrorMessage(res.message || "Error registrando Gerenciamiento de Viaje.");
      }
    } catch (err) {
      setErrorMessage(err.message || "Error al conectar con el servidor.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "16px", background: "#f8fafc", borderRadius: "12px", border: "1px solid #cbd5e1" }}>
      {/* Header con Logo de AQUARIO */}
      <header style={{ display: "flex", alignItems: "center", justifyBetween: "space-between", background: "#ffffff", padding: "12px 16px", borderRadius: "8px", border: "1px solid #cbd5e1", marginBottom: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <img src={logoAQR} alt="AQUARIO" style={{ height: "42px", objectFit: "contain" }} />
          <div>
            <h3 style={{ margin: 0, fontSize: "1.15rem", color: "#0f172a" }}>GERENCIAMIENTO DE VIAJE</h3>
            <p style={{ margin: 0, fontSize: "0.78rem", color: "#64748b" }}>
              CÓDIGO: SII-MX-23-LOG-003 v3.0 (Fuera de Ciudad/Estado + Inspección Vehicular Integrada)
            </p>
          </div>
        </div>
      </header>

      {errorMessage && (
        <div style={{ background: "#fee2e2", color: "#991b1b", padding: "12px", borderRadius: "8px", border: "1px solid #fca5a5", marginBottom: "16px", fontWeight: "bold", fontSize: "0.9rem" }}>
          ⚠️ {errorMessage}
        </div>
      )}

      {successMessage && (
        <div style={{ background: "#dcfce7", color: "#166534", padding: "12px", borderRadius: "8px", border: "1px solid #86efac", marginBottom: "16px", fontWeight: "bold", fontSize: "0.9rem" }}>
          {successMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: "16px" }}>
        
        {/* Datos Básicos de Viaje */}
        <section className="form-section-card" style={{ background: "#ffffff", padding: "16px", borderRadius: "10px", border: "1px solid #cbd5e1" }}>
          <h4 style={{ margin: "0 0 14px", color: "#1e3a8a", borderBottom: "1px solid #e2e8f0", paddingBottom: "6px", fontSize: "1rem" }}>📍 Origen y Destino del Traslado</h4>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
            <label style={{ fontSize: "0.85rem", fontWeight: "bold" }}>
              Origen *:
              <select
                name="idOrigen"
                value={form.idOrigen}
                onChange={handleInputChange}
                style={{ width: "100%", padding: "8px 12px", marginTop: "4px", background: "#ffffff", color: "#0f172a", border: "1px solid #cbd5e1", borderRadius: "6px", fontSize: "0.88rem" }}
              >
                <option value="">-- Selecciona Origen --</option>
                {lugares.map((l) => (
                  <option key={l.id_lugares} value={l.id_lugares}>{l.nombre}</option>
                ))}
              </select>
            </label>

            <label style={{ fontSize: "0.85rem", fontWeight: "bold" }}>
              Destino *:
              <select
                name="idDestino"
                value={form.idDestino}
                onChange={handleInputChange}
                style={{ width: "100%", padding: "8px 12px", marginTop: "4px", background: "#ffffff", color: "#0f172a", border: "1px solid #cbd5e1", borderRadius: "6px", fontSize: "0.88rem" }}
              >
                <option value="">-- Selecciona Destino --</option>
                {lugares.map((l) => (
                  <option key={l.id_lugares} value={l.id_lugares}>{l.nombre}</option>
                ))}
              </select>
            </label>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
            <label style={{ fontSize: "0.85rem", fontWeight: "bold" }}>
              Hora Salida *:
              <input
                type="time"
                name="horaSalida"
                value={form.horaSalida}
                onChange={handleInputChange}
                required
                style={{ width: "100%", padding: "8px 12px", marginTop: "4px", background: "#ffffff", color: "#0f172a", border: "1px solid #cbd5e1", borderRadius: "6px", fontSize: "0.88rem" }}
              />
            </label>

            <label style={{ fontSize: "0.85rem", fontWeight: "bold" }}>
              Seleccionar Vehículo *:
              <select
                name="idVehiculo"
                value={form.idVehiculo}
                onChange={handleInputChange}
                required
                style={{ width: "100%", padding: "8px 12px", marginTop: "4px", background: "#ffffff", color: "#0f172a", border: "1px solid #cbd5e1", borderRadius: "6px", fontSize: "0.88rem" }}
              >
                <option value="">-- Selecciona Vehículo --</option>
                {vehiculos.map((v) => (
                  <option key={v.id_vehiculos} value={v.id_vehiculos}>
                    {v.nombre} ({v.numero_economico}) - Placa: {v.placas}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ fontSize: "0.85rem", fontWeight: "bold" }}>
              Kilometraje Inicial *:
              <input
                type="number"
                name="kilometraje"
                value={form.kilometraje}
                onChange={handleInputChange}
                required
                style={{ width: "100%", padding: "8px 12px", marginTop: "4px", background: "#ffffff", color: "#0f172a", border: "1px solid #cbd5e1", borderRadius: "6px", fontSize: "0.88rem" }}
              />
            </label>
          </div>
        </section>

        {/* 1. Valoración Médica Pre-viaje */}
        <section className="form-section-card" style={{ background: "#ffffff", padding: "16px", borderRadius: "10px", border: "1px solid #cbd5e1" }}>
          <h4 style={{ margin: "0 0 14px", color: "#1e3a8a", borderBottom: "1px solid #e2e8f0", paddingBottom: "6px", fontSize: "1rem" }}>🩺 1. Valoración Médica Pre-viaje</h4>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
            <label style={{ fontSize: "0.85rem", fontWeight: "bold" }}>
              Presión Arterial:
              <input type="text" name="presionArterial" value={form.presionArterial} onChange={handleInputChange} style={{ width: "100%", padding: "8px 12px", marginTop: "4px", background: "#ffffff", color: "#0f172a", border: "1px solid #cbd5e1", borderRadius: "6px" }} />
            </label>

            <label style={{ fontSize: "0.85rem", fontWeight: "bold" }}>
              Examen Visual:
              <input type="text" name="examenVisual" value={form.examenVisual} onChange={handleInputChange} style={{ width: "100%", padding: "8px 12px", marginTop: "4px", background: "#ffffff", color: "#0f172a", border: "1px solid #cbd5e1", borderRadius: "6px" }} />
            </label>

            <label style={{ fontSize: "0.85rem", fontWeight: "bold" }}>
              Glucosa:
              <input type="text" name="glucosa" value={form.glucosa} onChange={handleInputChange} style={{ width: "100%", padding: "8px 12px", marginTop: "4px", background: "#ffffff", color: "#0f172a", border: "1px solid #cbd5e1", borderRadius: "6px" }} />
            </label>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", marginTop: "12px" }}>
            <label style={{ fontSize: "0.85rem", fontWeight: "bold" }}>
              Frecuencia Cardíaca:
              <input type="text" name="frecuenciaCardiaca" value={form.frecuenciaCardiaca} onChange={handleInputChange} style={{ width: "100%", padding: "8px 12px", marginTop: "4px", background: "#ffffff", color: "#0f172a", border: "1px solid #cbd5e1", borderRadius: "6px" }} />
            </label>

            <label style={{ fontSize: "0.85rem", fontWeight: "bold" }}>
              Frecuencia Respiratoria:
              <input type="text" name="frecuenciaRespiratoria" value={form.frecuenciaRespiratoria} onChange={handleInputChange} style={{ width: "100%", padding: "8px 12px", marginTop: "4px", background: "#ffffff", color: "#0f172a", border: "1px solid #cbd5e1", borderRadius: "6px" }} />
            </label>

            <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
              <label style={{ fontSize: "0.85rem", fontWeight: "bold", display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", background: "#f8fafc", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
                <input type="checkbox" name="alcoholimetro" checked={form.alcoholimetro} onChange={handleInputChange} style={{ width: "18px", height: "18px" }} />
                <span>Alcoholímetro Positivo</span>
              </label>
            </div>
          </div>
        </section>

        {/* 2. Información General del Vehículo y Ruta */}
        <section className="form-section-card" style={{ background: "#ffffff", padding: "16px", borderRadius: "10px", border: "1px solid #cbd5e1" }}>
          <h4 style={{ margin: "0 0 14px", color: "#1e3a8a", borderBottom: "1px solid #e2e8f0", paddingBottom: "6px", fontSize: "1rem" }}>📋 2. Información General del Traslado</h4>
          
          <div style={{ display: "grid", gap: "12px" }}>
            {/* Puntos de Ruta */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <label style={{ fontSize: "0.85rem", fontWeight: "bold" }}>Ruta a seguir (Puntos de Parada / Intermedios):</label>
                {rutaPuntos.length < 4 && (
                  <button
                    type="button"
                    onClick={addRoutePoint}
                    style={{ background: "#0284c7", color: "#ffffff", border: 0, padding: "4px 10px", borderRadius: "6px", cursor: "pointer", fontSize: "0.8rem", fontWeight: "bold" }}
                  >
                    + Agregar Punto
                  </button>
                )}
              </div>
              <div style={{ display: "grid", gap: "8px" }}>
                {rutaPuntos.map((punto, index) => (
                  <div key={index} style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <input
                      type="text"
                      value={punto}
                      onChange={(e) => handleRoutePointChange(index, e.target.value)}
                      placeholder={`Punto ${index + 1} de la ruta (Ej: Escárcega, Caseta Champotón...)`}
                      style={{ flex: 1, padding: "8px 12px", background: "#ffffff", color: "#0f172a", border: "1px solid #cbd5e1", borderRadius: "6px", fontSize: "0.88rem" }}
                    />
                    {rutaPuntos.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeRoutePoint(index)}
                        style={{ width: "38px", height: "38px", flexShrink: 0, background: "#ef4444", color: "#ffffff", border: 0, borderRadius: "6px", cursor: "pointer", fontWeight: "bold", display: "grid", placeItems: "center" }}
                        title="Eliminar punto"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Acompañantes */}
            <div style={{ background: "#f8fafc", padding: "12px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label style={{ fontSize: "0.85rem", fontWeight: "bold" }}>¿Viaja Acompañado?</label>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  {viajaAcompanado && listaAcompanantes.length < maxAcompanantes && (
                    <button
                      type="button"
                      onClick={addCompanionField}
                      disabled={listaAcompanantes.length >= maxAcompanantes}
                      style={{ background: "#0284c7", color: "#ffffff", border: 0, padding: "4px 10px", borderRadius: "6px", cursor: "pointer", fontSize: "0.8rem", fontWeight: "bold" }}
                    >
                      + Agregar
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setViajaAcompanado((prev) => {
                        const next = !prev;
                        if (!next) setListaAcompanantes([""]);
                        return next;
                      });
                    }}
                    style={{
                      background: viajaAcompanado ? "#1e3a8a" : "#cbd5e1",
                      color: "#ffffff",
                      border: 0,
                      padding: "4px 12px",
                      borderRadius: "14px",
                      fontSize: "0.8rem",
                      fontWeight: "bold",
                      cursor: "pointer"
                    }}
                  >
                    {viajaAcompanado ? "SÍ" : "NO"}
                  </button>
                </div>
              </div>

              {viajaAcompanado && (
                <div style={{ display: "grid", gap: "8px", marginTop: "8px" }}>
                  <small style={{ color: "#64748b", fontSize: "0.78rem" }}>
                    {maxAcompanantes === 4 ? "Camioneta: Máximo 4 acompañantes." : maxAcompanantes === 3 ? "Auto: Máximo 3 acompañantes." : "Maquinaria: Máximo 1 acompañante."}
                  </small>
                  {listaAcompanantes.map((nombre, index) => (
                    <div key={index} style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      <input
                        type="text"
                        value={nombre}
                        onChange={(e) => handleCompanionChange(index, e.target.value)}
                        placeholder={`Nombre del acompañante ${index + 1}`}
                        required={index === 0}
                        style={{ flex: 1, padding: "8px 12px", background: "#ffffff", color: "#0f172a", border: "1px solid #cbd5e1", borderRadius: "6px", fontSize: "0.88rem" }}
                      />
                      {listaAcompanantes.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeCompanionField(index)}
                          style={{ width: "36px", height: "36px", flexShrink: 0, background: "#ef4444", color: "#ffffff", border: 0, borderRadius: "6px", cursor: "pointer", fontWeight: "bold", display: "grid", placeItems: "center" }}
                          title="Quitar acompañante"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* 3. Lista de Verificación de Previaje e INSPECCIÓN VEHICULAR INTEGRADA */}
        <section className="form-section-card" style={{ background: "#ffffff", padding: "16px", borderRadius: "10px", border: "1px solid #cbd5e1" }}>
          <h4 style={{ margin: "0 0 14px", color: "#1e3a8a", borderBottom: "1px solid #e2e8f0", paddingBottom: "6px", fontSize: "1rem" }}>🔍 3. Lista de Verificación e Inspección Vehicular Integrada</h4>
          
          <div style={{ display: "grid", gap: "10px", marginBottom: "16px" }}>
            <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.85rem", background: "#f8fafc", padding: "8px 12px", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
              <span>1. ¿El conductor conoce los riesgos locales (vía, clima, peatones)?</span>
              <select name="conocimientoRiesgosLocales" value={form.conocimientoRiesgosLocales ? "true" : "false"} onChange={(e) => setForm((p) => ({ ...p, conocimientoRiesgosLocales: e.target.value === "true" }))} style={{ fontWeight: "bold", padding: "4px 8px", background: "#ffffff", borderRadius: "4px" }}>
                <option value="true">SÍ</option>
                <option value="false">NO</option>
              </select>
            </label>

            <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.85rem", background: "#f8fafc", padding: "8px 12px", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
              <span>2. ¿El conductor está informado que está prohibido llevar personal ajeno?</span>
              <select name="prohibidoPersonalAjeno" value={form.prohibidoPersonalAjeno ? "true" : "false"} onChange={(e) => setForm((p) => ({ ...p, prohibidoPersonalAjeno: e.target.value === "true" }))} style={{ fontWeight: "bold", padding: "4px 8px", background: "#ffffff", borderRadius: "4px" }}>
                <option value="true">SÍ</option>
                <option value="false">NO</option>
              </select>
            </label>
          </div>

          {/* INSPECCIÓN VEHICULAR CHECKLIST COMPACTO */}
          <div style={{ background: "#f1f5f9", padding: "12px", borderRadius: "8px", border: "1px solid #cbd5e1" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
              <strong style={{ fontSize: "0.9rem", color: "#0f172a" }}>🚗 Chequeo Vehicular Previaje (Bueno / Regular / Malo / NA)</strong>
              <label style={{ fontSize: "0.82rem", fontWeight: "bold", display: "flex", alignItems: "center", gap: "6px" }}>
                Combustible:
                <select name="combustible" value={form.combustible} onChange={handleInputChange} style={{ padding: "4px 8px", borderRadius: "4px", border: "1px solid #cbd5e1", background: "#ffffff", fontWeight: "bold" }}>
                  <option value="E">E (Vacío)</option>
                  <option value="1/4">1/4</option>
                  <option value="1/2">1/2</option>
                  <option value="3/4">3/4</option>
                  <option value="F">F (Lleno)</option>
                </select>
              </label>
            </div>

            <div style={{ display: "grid", gap: "6px", maxHeight: "240px", overflowY: "auto", paddingRight: "4px" }}>
              {Object.entries(checklist).map(([item, stateVal]) => (
                <div key={item} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#ffffff", padding: "6px 10px", borderRadius: "4px", border: "1px solid #e2e8f0", fontSize: "0.82rem" }}>
                  <span>{item}</span>
                  <div style={{ display: "flex", gap: "4px" }}>
                    {["B", "R", "M", "N/A"].map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => handleChecklistItemChange(item, opt)}
                        style={{
                          padding: "2px 8px",
                          borderRadius: "3px",
                          border: 0,
                          fontSize: "0.72rem",
                          fontWeight: "bold",
                          cursor: "pointer",
                          background: stateVal === opt ? (opt === "B" ? "#16a34a" : opt === "R" ? "#ca8a04" : opt === "M" ? "#dc2626" : "#64748b") : "#e2e8f0",
                          color: stateVal === opt ? "#ffffff" : "#334155"
                        }}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <label style={{ fontSize: "0.82rem", fontWeight: "bold", display: "block", marginTop: "10px" }}>
              Observaciones de la Unidad:
              <input
                type="text"
                name="observacionesVehiculo"
                value={form.observacionesVehiculo}
                onChange={handleInputChange}
                placeholder="Indica detalles si algún componente está en Regular o Malo"
                style={{ width: "100%", padding: "6px 10px", marginTop: "2px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: "4px", fontSize: "0.82rem" }}
              />
            </label>
          </div>
        </section>

        {/* 4. Tabuladores de Riesgo (A-G) */}
        <section className="form-section-card" style={{ background: "#ffffff", padding: "16px", borderRadius: "10px", border: "1px solid #cbd5e1" }}>
          <h4 style={{ margin: "0 0 14px", color: "#1e3a8a", borderBottom: "1px solid #e2e8f0", paddingBottom: "6px", fontSize: "1rem" }}>⚠️ 4. Análisis de Riesgos de la Ruta</h4>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <label style={{ fontSize: "0.85rem", fontWeight: "bold" }}>
              B. Clima Esperado:
              <select name="ptsClima" value={form.ptsClima} onChange={handleInputChange} style={{ width: "100%", padding: "8px", marginTop: "4px", background: "#ffffff", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
                <option value={2}>Seco / Condiciones Normales (2 ptos)</option>
                <option value={4}>Lluvia suave (4 ptos)</option>
                <option value={8}>Lluvia fuerte / Niebla (8 ptos)</option>
                <option value={10}>Nieve / Tormenta extrema (10 ptos)</option>
              </select>
            </label>

            <label style={{ fontSize: "0.85rem", fontWeight: "bold" }}>
              D. Condiciones de la Vía:
              <select name="ptsCondicionesVia" value={form.ptsCondicionesVia} onChange={handleInputChange} style={{ width: "100%", padding: "8px", marginTop: "4px", background: "#ffffff", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
                <option value={1}>Pavimentada (1 pto)</option>
                <option value={2}>Mixta (&lt;50% No Pavimentada) (2 ptos)</option>
                <option value={4}>No Pavimentada / Terregal (4 ptos)</option>
              </select>
            </label>

            <label style={{ fontSize: "0.85rem", fontWeight: "bold" }}>
              E. Cobertura Comunicaciones:
              <select name="ptsComunicaciones" value={form.ptsComunicaciones} onChange={handleInputChange} style={{ width: "100%", padding: "8px", marginTop: "4px", background: "#ffffff", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
                <option value={0}>Teléfono Celular con Señal (0 ptos)</option>
                <option value={2}>Sin comunicación y Viaje en Caravana (2 ptos)</option>
                <option value={4}>Sin comunicación y Viaje en Solitario (4 ptos)</option>
              </select>
            </label>

            <label style={{ fontSize: "0.85rem", fontWeight: "bold" }}>
              F. Horas Trabajadas + Viaje:
              <select name="ptsHorasTrabajadas" value={form.ptsHorasTrabajadas} onChange={handleInputChange} style={{ width: "100%", padding: "8px", marginTop: "4px", background: "#ffffff", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
                <option value={1}>Menos de 12 horas acumuladas (1 pto)</option>
                <option value={3}>Menos de 14 horas acumuladas (3 ptos)</option>
                <option value={6}>Menos de 16 horas acumuladas (6 ptos)</option>
                <option value={16}>≥ 16 horas (BLOQUEANTE - NO CONDUCIR)</option>
              </select>
            </label>
          </div>

          {/* Badge Resultado de Riesgo */}
          <div style={{ marginTop: "14px", padding: "12px", borderRadius: "8px", background: nivelRiesgo === "ALTO" ? "#fee2e2" : nivelRiesgo === "MEDIO" ? "#fef9c3" : "#dcfce7", border: `1px solid ${nivelRiesgo === "ALTO" ? "#fca5a5" : nivelRiesgo === "MEDIO" ? "#fde047" : "#86efac"}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <strong style={{ fontSize: "1rem", color: nivelRiesgo === "ALTO" ? "#991b1b" : nivelRiesgo === "MEDIO" ? "#854d0e" : "#166534" }}>
                EVALUACIÓN DE RIESGO: {nivelRiesgo} ({puntajeTotal} ptos)
              </strong>
              <div style={{ fontSize: "0.8rem", marginTop: "2px", color: "#334155" }}>
                Autorización Requerida: <strong>{autorizacionRequerida}</strong>
              </div>
            </div>
            {esBloqueante && (
              <span style={{ background: "#dc2626", color: "#fff", padding: "4px 10px", borderRadius: "6px", fontSize: "0.8rem", fontWeight: "bold" }}>
                ⛔ BLOQUEANTE
              </span>
            )}
          </div>
        </section>

        {/* 5. Firma Digital Conductor */}
        <section className="form-section-card" style={{ background: "#ffffff", padding: "16px", borderRadius: "10px", border: "1px solid #cbd5e1" }}>
          <h4 style={{ margin: "0 0 10px", color: "#1e3a8a", fontSize: "1rem" }}>✍️ 5. Firma Digital del Conductor *</h4>
          <p style={{ margin: "0 0 8px", fontSize: "0.8rem", color: "#64748b" }}>
            Al firmar confirmas que la valoración médica y la inspección vehicular son verídicas y estás apto para conducir.
          </p>

          <div style={{ border: "2px dashed #94a3b8", borderRadius: "8px", background: "#ffffff", padding: "4px", textAlign: "center" }}>
            <canvas
              ref={canvasRef}
              width={640}
              height={150}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
              style={{ width: "100%", height: "130px", touchAction: "none", cursor: "crosshair" }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "6px" }}>
            <small style={{ color: hasSignature ? "#166534" : "#64748b", fontWeight: "bold" }}>
              {hasSignature ? "✓ Firma digital capturada" : "Dibuja tu firma con tu dedo o ratón"}
            </small>
            <button
              type="button"
              onClick={clearSignature}
              disabled={!hasSignature}
              style={{ background: "#e2e8f0", border: 0, padding: "4px 10px", borderRadius: "4px", cursor: "pointer", fontSize: "0.78rem" }}
            >
              Limpiar Firma
            </button>
          </div>
        </section>

        {/* Botones de Envío */}
        <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={submitting}
              style={{ background: "#e2e8f0", color: "#334155", border: 0, padding: "12px 20px", borderRadius: "8px", fontWeight: "bold", cursor: "pointer" }}
            >
              Cancelar
            </button>
          )}

          <button
            type="submit"
            disabled={submitting || esBloqueante}
            style={{
              background: esBloqueante ? "#94a3b8" : "#16a34a",
              color: "#ffffff",
              border: 0,
              padding: "12px 28px",
              borderRadius: "8px",
              fontWeight: "bold",
              fontSize: "0.95rem",
              cursor: esBloqueante ? "not-allowed" : "pointer",
              boxShadow: esBloqueante ? "none" : "0 4px 12px rgba(22, 163, 74, 0.3)"
            }}
          >
            {submitting ? "Enviando Solicitud..." : "🚀 Registrar Gerenciamiento e Inspección"}
          </button>
        </div>

      </form>
    </div>
  );
}
