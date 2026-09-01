import { useState, useRef, useEffect } from "react";
import { crearGerenciamientoViaje } from "../services/api.js";
import logoAQR from "../assets/logoAQR.webp";
import InspeccionVehicular from "./InspeccionVehicular.jsx";

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

    // 3. Lista de Verificación (Preguntas de Control 1-6)
    conocimientoRiesgosLocales: true,
    medicamentosSomnolencia: false,
    dormidoAdecuadamente: true,
    prohibidoPersonalAjeno: true,
    inspeccionVehiculoRealizada: false,
    reunionPreCaravanaRealizada: false,

    // Inspección Vehicular Integrada
    combustible: "3/4",
    tipoAsignacion: "Base",
    observacionesVehiculo: "",

    // 4. Tabuladores de Riesgo (A a G)
    ptsDistancia: 1,         // A. Distancia
    ptsClima: 2,             // B. Clima
    ptsVehiculosPersonas: 1, // C. Vehículos y Personas
    ptsCondicionesVia: 1,    // D. Condiciones de la Vía
    ptsComunicaciones: 0,   // E. Comunicaciones
    ptsHorasTrabajadas: 1,   // F. Horas trabajadas + Viaje
    ptsHoraTraslado: 1,      // G. Hora del traslado
  });

  const [checklist, setChecklist] = useState(defaultChecklistItems);
  const [rutaPuntos, setRutaPuntos] = useState(["", ""]);
  const [viajaAcompanado, setViajaAcompanado] = useState(false);
  const [listaAcompanantes, setListaAcompanantes] = useState([""]);

  // Modal de Inspección Vehicular
  const [showInspectionModal, setShowInspectionModal] = useState(false);
  const [inspeccionCompleted, setInspeccionCompleted] = useState(false);
  const [inspeccionData, setInspeccionData] = useState(null);

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

  // Recalcular sugerencia de tabuladores A, C, G automáticamente
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

  const puntajeTotal = Number(form.ptsDistancia) + Number(form.ptsClima) + Number(form.ptsVehiculosPersonas) + Number(form.ptsCondicionesVia) + Number(form.ptsComunicaciones) + Number(form.ptsHorasTrabajadas) + Number(form.ptsHoraTraslado);
  let nivelRiesgo = "BAJO";
  let autorizacionRequerida = "SUPERVISOR DIRECTO O QHSE";

  if (puntajeTotal > 23) {
    nivelRiesgo = "ALTO";
    autorizacionRequerida = "GERENCIA GENERAL Y QHSE";
  } else if (puntajeTotal >= 16) {
    nivelRiesgo = "MEDIO";
    autorizacionRequerida = "COORDINACIÓN DE ÁREA";
  }

  const esBloqueante = Number(form.ptsHorasTrabajadas) >= 16;

  function handleInputChange(event) {
    const { name, value, type, checked } = event.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : (type === "number" || name.startsWith("pts") ? Number(value) : value)
    }));
  }

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

  // Manejador del resultado de la Inspección Vehicular Interactiva
  function handleInspectionCompleted(inspData) {
    setInspeccionData(inspData);
    setInspeccionCompleted(true);
    setShowInspectionModal(false);
    setForm((prev) => ({
      ...prev,
      combustible: inspData.combustible || prev.combustible,
      inspeccionVehiculoRealizada: true,
      observacionesVehiculo: inspData.observaciones || prev.observacionesVehiculo
    }));
    if (inspData.firma) {
      setHasSignature(true);
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
    if (!hasSignature && !inspeccionData?.firma) {
      setErrorMessage("Por favor realiza la firma digital del conductor antes de enviar.");
      return;
    }

    const canvas = canvasRef.current;
    const firmaDataUrl = (canvas && hasSignature) ? canvas.toDataURL("image/png") : (inspeccionData?.firma || "");

    const acompanantesFiltrados = viajaAcompanado ? listaAcompanantes.filter((a) => a.trim()) : [];
    const rutaFiltrada = rutaPuntos.filter((r) => r.trim());

    setSubmitting(true);

    try {
      const finalInspData = inspeccionData || {
        combustible: form.combustible,
        tipoAsignacion: form.tipoAsignacion,
        checklist: checklist,
        danos: {},
        observaciones: form.observacionesVehiculo || null,
        firma: firmaDataUrl,
        esDiaSiguiente: false
      };

      const payload = {
        ...form,
        rutaPuntos: rutaFiltrada,
        acompanantes: acompanantesFiltrados,
        firmaConductor: firmaDataUrl,
        nombreConductorFirma: selectedDriver.nombre,
        inspeccionData: finalInspData
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

  // Objeto contexto para el componente InspeccionVehicular
  const selectedVehicleObj = vehiculos.find((v) => String(v.id_vehiculos) === String(form.idVehiculo)) || assignedVehicle || {};
  const inspectionContextObj = {
    folio: "GEREN-PREVIAJE",
    numero_economico: selectedVehicleObj.numero_economico || form.numeroUnidad || "N/A",
    marca: selectedVehicleObj.marca || form.modelo || "",
    modelo: selectedVehicleObj.modelo || "",
    tipo_vehiculo: selectedVehicleObj.tipo_vehiculo || form.tipoVehiculo || "PickUp",
    conductor: selectedDriver.nombre || form.nombreConductor || "Conductor",
    licencia_numero: selectedDriver.licencia_numero || "N/A",
    tipo_licencia: selectedDriver.licencia_tipo || "Chofer",
    numero_serie: selectedVehicleObj.numero_serie || "N/A",
    numero_poliza: selectedVehicleObj.numero_poliza || "N/A",
    seguro_vencimiento: selectedVehicleObj.seguro_vencimiento || "N/A",
    placas: selectedVehicleObj.placas || form.placa || "N/A",
    kilometraje_actual: form.kilometraje || selectedVehicleObj.kilometraje_actual || 0
  };

  return (
    <div className="geren-container">
      {/* Header con Logo de AQUARIO */}
      <header className="geren-header">
        <img src={logoAQR} alt="AQUARIO" style={{ height: "42px", objectFit: "contain" }} />
        <div>
          <h3 style={{ margin: 0, fontSize: "1.15rem", color: "#0f172a", fontWeight: 800 }}>GERENCIAMIENTO DE VIAJE</h3>
          <p style={{ margin: 0, fontSize: "0.78rem", color: "#64748b" }}>
            CÓDIGO: SII-MX-23-LOG-003 v3.0 (Fuera de Ciudad/Estado + Inspección Vehicular Integrada)
          </p>
        </div>
      </header>

      {errorMessage && (
        <div style={{ background: "#fee2e2", color: "#991b1b", padding: "12px 16px", borderRadius: "10px", border: "1px solid #fca5a5", marginBottom: "16px", fontWeight: "bold", fontSize: "0.9rem" }}>
          ⚠️ {errorMessage}
        </div>
      )}

      {successMessage && (
        <div style={{ background: "#dcfce7", color: "#166534", padding: "12px 16px", borderRadius: "10px", border: "1px solid #86efac", marginBottom: "16px", fontWeight: "bold", fontSize: "0.9rem" }}>
          {successMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ padding: 0, background: "transparent", border: 0, boxShadow: "none", display: "grid", gap: "16px" }}>
        
        {/* Datos Básicos de Viaje */}
        <section className="geren-card">
          <h4 className="geren-card-title">📍 Origen y Destino del Traslado</h4>

          <div className="geren-grid-2" style={{ marginBottom: "14px" }}>
            <div className="geren-field">
              <label className="geren-field-label">Origen *</label>
              <select
                name="idOrigen"
                value={form.idOrigen}
                onChange={handleInputChange}
                className="geren-field-select"
              >
                <option value="">-- Selecciona Origen --</option>
                {lugares.map((l) => (
                  <option key={l.id_lugares} value={l.id_lugares}>{l.nombre}</option>
                ))}
              </select>
            </div>

            <div className="geren-field">
              <label className="geren-field-label">Destino *</label>
              <select
                name="idDestino"
                value={form.idDestino}
                onChange={handleInputChange}
                className="geren-field-select"
              >
                <option value="">-- Selecciona Destino --</option>
                {lugares.map((l) => (
                  <option key={l.id_lugares} value={l.id_lugares}>{l.nombre}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="geren-grid-3">
            <div className="geren-field">
              <label className="geren-field-label">Hora Salida *</label>
              <input
                type="time"
                name="horaSalida"
                value={form.horaSalida}
                onChange={handleInputChange}
                required
                className="geren-field-input"
              />
            </div>

            <div className="geren-field">
              <label className="geren-field-label">Seleccionar Vehículo *</label>
              <select
                name="idVehiculo"
                value={form.idVehiculo}
                onChange={handleInputChange}
                required
                className="geren-field-select"
              >
                <option value="">-- Selecciona Vehículo --</option>
                {vehiculos.map((v) => (
                  <option key={v.id_vehiculos} value={v.id_vehiculos}>
                    {v.nombre} ({v.numero_economico}) - Placa: {v.placas}
                  </option>
                ))}
              </select>
            </div>

            <div className="geren-field">
              <label className="geren-field-label">Kilometraje Inicial *</label>
              <input
                type="number"
                name="kilometraje"
                value={form.kilometraje}
                onChange={handleInputChange}
                required
                className="geren-field-input"
              />
            </div>
          </div>
        </section>

        {/* 1. Valoración Médica Pre-viaje */}
        <section className="geren-card">
          <h4 className="geren-card-title">🩺 1. Valoración Médica Pre-viaje</h4>

          <div className="geren-grid-3" style={{ marginBottom: "14px" }}>
            <div className="geren-field">
              <label className="geren-field-label">Presión Arterial</label>
              <input type="text" name="presionArterial" value={form.presionArterial} onChange={handleInputChange} className="geren-field-input" />
            </div>

            <div className="geren-field">
              <label className="geren-field-label">Examen Visual</label>
              <input type="text" name="examenVisual" value={form.examenVisual} onChange={handleInputChange} className="geren-field-input" />
            </div>

            <div className="geren-field">
              <label className="geren-field-label">Glucosa</label>
              <input type="text" name="glucosa" value={form.glucosa} onChange={handleInputChange} className="geren-field-input" />
            </div>
          </div>

          <div className="geren-grid-3">
            <div className="geren-field">
              <label className="geren-field-label">Frecuencia Cardíaca</label>
              <input type="text" name="frecuenciaCardiaca" value={form.frecuenciaCardiaca} onChange={handleInputChange} className="geren-field-input" />
            </div>

            <div className="geren-field">
              <label className="geren-field-label">Frecuencia Respiratoria</label>
              <input type="text" name="frecuenciaRespiratoria" value={form.frecuenciaRespiratoria} onChange={handleInputChange} className="geren-field-input" />
            </div>

            <div className="geren-field" style={{ justifyContent: "flex-end" }}>
              <label className="alcoholimetro-card">
                <input type="checkbox" name="alcoholimetro" checked={form.alcoholimetro} onChange={handleInputChange} style={{ width: "18px", height: "18px" }} />
                <span>Alcoholímetro Positivo</span>
              </label>
            </div>
          </div>
        </section>

        {/* 2. Información General del Vehículo y Ruta */}
        <section className="geren-card">
          <h4 className="geren-card-title">📋 2. Información General del Traslado</h4>
          
          <div style={{ display: "grid", gap: "14px" }}>
            {/* Puntos de Ruta */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <label className="geren-field-label">Ruta a seguir (Puntos de Parada / Intermedios):</label>
                {rutaPuntos.length < 4 && (
                  <button
                    type="button"
                    onClick={addRoutePoint}
                    style={{ background: "#0284c7", color: "#ffffff", border: 0, padding: "6px 12px", borderRadius: "6px", cursor: "pointer", fontSize: "0.82rem", fontWeight: "bold" }}
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
                      className="geren-field-input"
                    />
                    {rutaPuntos.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeRoutePoint(index)}
                        style={{ width: "42px", height: "42px", flexShrink: 0, background: "#ef4444", color: "#ffffff", border: 0, borderRadius: "8px", cursor: "pointer", fontWeight: "bold", display: "grid", placeItems: "center" }}
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
            <div style={{ background: "#f8fafc", padding: "14px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label className="geren-field-label">¿Viaja Acompañado?</label>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  {viajaAcompanado && listaAcompanantes.length < maxAcompanantes && (
                    <button
                      type="button"
                      onClick={addCompanionField}
                      disabled={listaAcompanantes.length >= maxAcompanantes}
                      style={{ background: "#0284c7", color: "#ffffff", border: 0, padding: "6px 12px", borderRadius: "6px", cursor: "pointer", fontSize: "0.82rem", fontWeight: "bold" }}
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
                      padding: "6px 14px",
                      borderRadius: "14px",
                      fontSize: "0.85rem",
                      fontWeight: "bold",
                      cursor: "pointer"
                    }}
                  >
                    {viajaAcompanado ? "SÍ" : "NO"}
                  </button>
                </div>
              </div>

              {viajaAcompanado && (
                <div style={{ display: "grid", gap: "8px", marginTop: "10px" }}>
                  <small style={{ color: "#64748b", fontSize: "0.8rem" }}>
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
                        className="geren-field-input"
                      />
                      {listaAcompanantes.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeCompanionField(index)}
                          style={{ width: "42px", height: "42px", flexShrink: 0, background: "#ef4444", color: "#ffffff", border: 0, borderRadius: "8px", cursor: "pointer", fontWeight: "bold", display: "grid", placeItems: "center" }}
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

        {/* 3. Lista de Verificación e INSPECCIÓN VEHICULAR INTEGRADA CON MODAL */}
        <section className="geren-card">
          <h4 className="geren-card-title">🔍 3. Lista de Verificación Previaje (Preguntas de Control 1-6)</h4>
          
          {/* BANNER / BOTÓN PARA ACTIVAR LA VENTANA INTERACTIVA DE INSPECCIÓN VEHICULAR */}
          <div style={{ background: inspeccionCompleted ? "#dcfce7" : "#fff7ed", padding: "14px 16px", borderRadius: "10px", border: `1.5px solid ${inspeccionCompleted ? "#86efac" : "#fdba74"}`, marginBottom: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
              <div>
                <strong style={{ color: inspeccionCompleted ? "#166534" : "#c2410c", fontSize: "0.95rem" }}>
                  {inspeccionCompleted ? "✅ Inspección Vehicular Diaria Realizada" : "⚠️ Inspección Vehicular Obligatoria Integrada"}
                </strong>
                <p style={{ margin: "4px 0 0", fontSize: "0.82rem", color: "#475569" }}>
                  {inspeccionCompleted
                    ? `Combustible: ${inspeccionData?.combustible || "3/4"} | Chequeo de componentes OK | Firma de Conductor Capturada`
                    : "Primero se realiza la Inspección Vehicular interactiva (nivel combustible, diagrama de daños y checklist completo)."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!form.idVehiculo) {
                    alert("Por favor selecciona primero la Unidad/Vehículo en la primera sección.");
                    return;
                  }
                  setShowInspectionModal(true);
                }}
                style={{
                  background: inspeccionCompleted ? "#15803d" : "#ea580c",
                  color: "#ffffff",
                  border: 0,
                  padding: "10px 18px",
                  borderRadius: "8px",
                  fontWeight: "bold",
                  fontSize: "0.88rem",
                  cursor: "pointer",
                  boxShadow: "0 4px 10px rgba(0,0,0,0.12)"
                }}
              >
                {inspeccionCompleted ? "🔄 Ver / Editar Inspección" : "🚗 Abrir Inspección Vehicular Interactiva"}
              </button>
            </div>
          </div>

          <div style={{ display: "grid", gap: "10px" }}>
            <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.85rem", background: "#f8fafc", padding: "10px 12px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
              <span>1. ¿El conductor conoce los riesgos locales (vía, clima, peatones, animales)?</span>
              <select name="conocimientoRiesgosLocales" value={form.conocimientoRiesgosLocales ? "true" : "false"} onChange={(e) => setForm((p) => ({ ...p, conocimientoRiesgosLocales: e.target.value === "true" }))} style={{ fontWeight: "bold", padding: "6px 10px", background: "#ffffff", borderRadius: "6px" }}>
                <option value="true">SÍ</option>
                <option value="false">NO</option>
              </select>
            </label>

            <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.85rem", background: "#f8fafc", padding: "10px 12px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
              <span>2. ¿El conductor ha consumido medicamentos que producen somnolencia?</span>
              <select name="medicamentosSomnolencia" value={form.medicamentosSomnolencia ? "true" : "false"} onChange={(e) => setForm((p) => ({ ...p, medicamentosSomnolencia: e.target.value === "true" }))} style={{ fontWeight: "bold", padding: "6px 10px", background: "#ffffff", borderRadius: "6px" }}>
                <option value="false">NO (Normal)</option>
                <option value="true">SÍ (Somnolencia)</option>
              </select>
            </label>

            <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.85rem", background: "#f8fafc", padding: "10px 12px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
              <span>3. ¿El conductor ha dormido adecuadamente?</span>
              <select name="dormidoAdecuadamente" value={form.dormidoAdecuadamente ? "true" : "false"} onChange={(e) => setForm((p) => ({ ...p, dormidoAdecuadamente: e.target.value === "true" }))} style={{ fontWeight: "bold", padding: "6px 10px", background: "#ffffff", borderRadius: "6px" }}>
                <option value="true">SÍ</option>
                <option value="false">NO</option>
              </select>
            </label>

            <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.85rem", background: "#f8fafc", padding: "10px 12px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
              <span>4. ¿El conductor está informado que está prohibido llevar personal ajeno?</span>
              <select name="prohibidoPersonalAjeno" value={form.prohibidoPersonalAjeno ? "true" : "false"} onChange={(e) => setForm((p) => ({ ...p, prohibidoPersonalAjeno: e.target.value === "true" }))} style={{ fontWeight: "bold", padding: "6px 10px", background: "#ffffff", borderRadius: "6px" }}>
                <option value="true">SÍ</option>
                <option value="false">NO</option>
              </select>
            </label>

            <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.85rem", background: "#f8fafc", padding: "10px 12px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
              <span>5. ¿Se realizó la inspección del vehículo con la lista de chequeo? (Anexar registro)</span>
              <select name="inspeccionVehiculoRealizada" value={form.inspeccionVehiculoRealizada ? "true" : "false"} onChange={(e) => setForm((p) => ({ ...p, inspeccionVehiculoRealizada: e.target.value === "true" }))} style={{ fontWeight: "bold", padding: "6px 10px", background: "#ffffff", borderRadius: "6px" }}>
                <option value="true">SÍ</option>
                <option value="false">NO</option>
              </select>
            </label>

            <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.85rem", background: "#f8fafc", padding: "10px 12px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
              <span>6. ¿Se realizó la reunión pre caravana? (Solo si viajan &gt;1 vehículo)</span>
              <select name="reunionPreCaravanaRealizada" value={form.reunionPreCaravanaRealizada ? "true" : "false"} onChange={(e) => setForm((p) => ({ ...p, reunionPreCaravanaRealizada: e.target.value === "true" }))} style={{ fontWeight: "bold", padding: "6px 10px", background: "#ffffff", borderRadius: "6px" }}>
                <option value="false">NO</option>
                <option value="true">SÍ</option>
              </select>
            </label>
          </div>
        </section>

        {/* 4. Tabuladores de Riesgo (COMPLETOS A, B, C, D, E, F, G) */}
        <section className="geren-card">
          <h4 className="geren-card-title">⚠️ 4. Análisis de Riesgos de la Ruta (Tabuladores A al G)</h4>

          <div className="geren-grid-2">
            <div className="geren-field">
              <label className="geren-field-label">A. Distancia a Recorrer</label>
              <select name="ptsDistancia" value={form.ptsDistancia} onChange={handleInputChange} className="geren-field-select">
                <option value={1}>Menos de 50 Km (1 pto)</option>
                <option value={2}>Menos de 100 Km (2 ptos)</option>
                <option value={5}>Menos de 200 Km (5 ptos)</option>
                <option value={8}>Más de 200 Km (8 ptos)</option>
              </select>
            </div>

            <div className="geren-field">
              <label className="geren-field-label">B. Clima Esperado</label>
              <select name="ptsClima" value={form.ptsClima} onChange={handleInputChange} className="geren-field-select">
                <option value={2}>Seco / Condiciones Normales (2 ptos)</option>
                <option value={4}>Lluvia suave (4 ptos)</option>
                <option value={8}>Lluvia fuerte / Niebla (8 ptos)</option>
                <option value={10}>Nieve / Tormenta extrema (10 ptos)</option>
              </select>
            </div>

            <div className="geren-field">
              <label className="geren-field-label">C. Vehículos y Personas</label>
              <select name="ptsVehiculosPersonas" value={form.ptsVehiculosPersonas} onChange={handleInputChange} className="geren-field-select">
                <option value={1}>2+ Vehículos y 2+ Personas (1 pto)</option>
                <option value={2}>2+ Vehículos y 1+ Persona (2 ptos)</option>
                <option value={3}>1 Vehículo y 2+ Personas (3 ptos)</option>
                <option value={6}>1 Vehículo y 1 Persona (Solitario) (6 ptos)</option>
              </select>
            </div>

            <div className="geren-field">
              <label className="geren-field-label">D. Condiciones de la Vía</label>
              <select name="ptsCondicionesVia" value={form.ptsCondicionesVia} onChange={handleInputChange} className="geren-field-select">
                <option value={1}>Pavimentada (1 pto)</option>
                <option value={2}>Mixta (&lt;50% No Pavimentada) (2 ptos)</option>
                <option value={4}>No Pavimentada / Terregal (4 ptos)</option>
              </select>
            </div>

            <div className="geren-field">
              <label className="geren-field-label">E. Cobertura Comunicaciones</label>
              <select name="ptsComunicaciones" value={form.ptsComunicaciones} onChange={handleInputChange} className="geren-field-select">
                <option value={0}>Teléfono Celular con Señal (0 ptos)</option>
                <option value={2}>Sin comunicación y Viaje en Caravana (2 ptos)</option>
                <option value={4}>Sin comunicación y Viaje en Solitario (4 ptos)</option>
              </select>
            </div>

            <div className="geren-field">
              <label className="geren-field-label">F. Horas Trabajadas + Viaje</label>
              <select name="ptsHorasTrabajadas" value={form.ptsHorasTrabajadas} onChange={handleInputChange} className="geren-field-select">
                <option value={1}>Menos de 12 horas acumuladas (1 pto)</option>
                <option value={3}>Menos de 14 horas acumuladas (3 ptos)</option>
                <option value={6}>Menos de 16 horas acumuladas (6 ptos)</option>
                <option value={16}>≥ 16 horas (BLOQUEANTE - NO CONDUCIR)</option>
              </select>
            </div>

            <div className="geren-field">
              <label className="geren-field-label">G. Hora del Traslado</label>
              <select name="ptsHoraTraslado" value={form.ptsHoraTraslado} onChange={handleInputChange} className="geren-field-select">
                <option value={1}>Día (06:00 a 18:00 hrs) (1 pto)</option>
                <option value={8}>Noche (18:00 a 06:00 hrs) (8 ptos)</option>
              </select>
            </div>
          </div>

          {/* Badge Resultado de Riesgo */}
          <div style={{ marginTop: "16px", padding: "14px 16px", borderRadius: "10px", background: nivelRiesgo === "ALTO" ? "#fee2e2" : nivelRiesgo === "MEDIO" ? "#fef9c3" : "#dcfce7", border: `1px solid ${nivelRiesgo === "ALTO" ? "#fca5a5" : nivelRiesgo === "MEDIO" ? "#fde047" : "#86efac"}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <strong style={{ fontSize: "1rem", color: nivelRiesgo === "ALTO" ? "#991b1b" : nivelRiesgo === "MEDIO" ? "#854d0e" : "#166534" }}>
                EVALUACIÓN DE RIESGO: {nivelRiesgo} ({puntajeTotal} ptos)
              </strong>
              <div style={{ fontSize: "0.82rem", marginTop: "2px", color: "#334155" }}>
                Autorización Requerida: <strong>{autorizacionRequerida}</strong>
              </div>
            </div>
            {esBloqueante && (
              <span style={{ background: "#dc2626", color: "#fff", padding: "6px 12px", borderRadius: "6px", fontSize: "0.8rem", fontWeight: "bold" }}>
                ⛔ BLOQUEANTE
              </span>
            )}
          </div>
        </section>

        {/* 5. Firma Digital Conductor */}
        <section className="geren-card">
          <h4 className="geren-card-title">✍️ 5. Firma Digital del Conductor *</h4>
          <p style={{ margin: "0 0 10px", fontSize: "0.82rem", color: "#64748b" }}>
            Al firmar confirmas que la valoración médica y la inspección vehicular son verídicas y estás apto para conducir.
          </p>

          <div style={{ border: "2px dashed #cbd5e1", borderRadius: "10px", background: "#ffffff", padding: "4px", textAlign: "center" }}>
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

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px" }}>
            <small style={{ color: hasSignature ? "#166534" : "#64748b", fontWeight: "bold" }}>
              {hasSignature ? "✓ Firma digital capturada" : "Dibuja tu firma con tu dedo o ratón"}
            </small>
            <button
              type="button"
              onClick={clearSignature}
              disabled={!hasSignature}
              style={{ background: "#e2e8f0", border: 0, padding: "6px 12px", borderRadius: "6px", cursor: "pointer", fontSize: "0.8rem", fontWeight: "bold" }}
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
              style={{ background: "#e2e8f0", color: "#334155", border: 0, padding: "12px 22px", borderRadius: "10px", fontWeight: "bold", cursor: "pointer" }}
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
              padding: "14px 32px",
              borderRadius: "10px",
              fontWeight: "bold",
              fontSize: "0.98rem",
              cursor: esBloqueante ? "not-allowed" : "pointer",
              boxShadow: esBloqueante ? "none" : "0 4px 14px rgba(22, 163, 74, 0.3)"
            }}
          >
            {submitting ? "Enviando Solicitud..." : "🚀 Registrar Gerenciamiento e Inspección"}
          </button>
        </div>

      </form>

      {/* VENTANA OVERLAY DE INSPECCIÓN VEHICULAR INTERACTIVA */}
      {showInspectionModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.85)", zIndex: 99999, display: "grid", placeItems: "center", padding: "12px", overflowY: "auto" }}>
          <div style={{ width: "100%", maxWidth: "720px", maxHeight: "94vh", overflowY: "auto" }}>
            <InspeccionVehicular
              context={inspectionContextObj}
              estado="NUEVA"
              onSubmit={handleInspectionCompleted}
              onClose={() => setShowInspectionModal(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
