import { useState, useRef, useEffect } from "react";
import { crearGerenciamientoViaje } from "../services/api.js";
import logoAQR from "../assets/logoAQR.webp";

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

    // 4. Tabuladores A-G
    ptsDistancia: 1, // <50km: 1, <100km: 2, <200km: 5, >200km: 8
    ptsClima: 2, // Seco: 2, Lluvia suave: 4, Lluvia fuerte/niebla: 8, Nieve: 10
    ptsVehiculosPersonas: 1, // 2+ veh 2+ pers: 1, 2+ veh 1+ pers: 2, 1 veh 2+ pers: 3, 1 veh 1 pers: 8
    ptsCondicionesVia: 1, // Pavimentada: 1, Mixta: 2, No pavimentada: 4
    ptsComunicaciones: 0, // Celular: 0, Sin com caravana: 2, Sin com sin caravana: 4
    ptsHorasTrabajadas: 1, // <12h: 1, <14h: 3, <16h: 6, >=16h: 16 (Bloqueante)
    ptsHoraTraslado: 1, // Día: 1, Noche: 8
  });

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

  // Canvas Initialization
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = canvas.offsetWidth || 340;
      canvas.height = 130;
      const ctx = canvas.getContext("2d");
      ctx.strokeStyle = "#1e293b";
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
    }
  }, []);

  function startDrawing(e) {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
  }

  function draw(e) {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
    setHasSignature(true);
  }

  function stopDrawing() {
    setIsDrawing(false);
  }

  function clearSignature() {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setHasSignature(false);
    }
  }

  // Risk Score Calculations
  const scoreA = Number(form.ptsDistancia);
  const scoreB = Number(form.ptsClima);
  const scoreC = Number(form.ptsVehiculosPersonas);
  const scoreD = Number(form.ptsCondicionesVia);
  const scoreE = Number(form.ptsComunicaciones);
  const scoreF = Number(form.ptsHorasTrabajadas);
  const scoreG = Number(form.ptsHoraTraslado);

  const totalScore = scoreA + scoreB + scoreC + scoreD + scoreE + scoreF + scoreG;

  const isHoursBlocked = scoreF >= 16;
  const isNightDriving = scoreG >= 8;

  let riskLevel = "BAJO";
  let riskColor = "#16a34a"; // Green
  let requiredApproval = "Supervisor Directo o QHSE";

  if (totalScore > 23) {
    riskLevel = "ALTO";
    riskColor = "#dc2626"; // Red
    requiredApproval = "Gerencia General y QHSE";
  } else if (totalScore >= 16) {
    riskLevel = "MEDIO";
    riskColor = "#ca8a04"; // Yellow
    requiredApproval = "Coordinador de Área";
  }

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }));
    setErrorMessage("");
  }

  function handleRutaChange(index, value) {
    const newRuta = [...rutaPuntos];
    newRuta[index] = value;
    setRutaPuntos(newRuta);
  }

  function addRutaPoint() {
    if (rutaPuntos.length < 4) {
      setRutaPuntos([...rutaPuntos, ""]);
    }
  }

  function removeRutaPoint(index) {
    if (rutaPuntos.length > 1) {
      setRutaPuntos(rutaPuntos.filter((_, i) => i !== index));
    }
  }

  function handleCompanionChange(index, value) {
    const newList = [...listaAcompanantes];
    newList[index] = value;
    setListaAcompanantes(newList);
  }

  function addCompanionField() {
    if (listaAcompanantes.length < maxAcompanantes) {
      setListaAcompanantes([...listaAcompanantes, ""]);
    }
  }

  function removeCompanionField(index) {
    const newList = listaAcompanantes.filter((_, i) => i !== index);
    setListaAcompanantes(newList.length === 0 ? [""] : newList);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (isHoursBlocked) {
      setErrorMessage("⚠️ HORAS TRABAJADAS + TIEMPO DE VIAJE >= 16 HRS: NO CONDUCIR. El viaje no puede registrarse por riesgo de fatiga.");
      return;
    }

    if (!hasSignature) {
      setErrorMessage("Por favor firma el documento en el recuadro digital.");
      return;
    }

    const canvas = canvasRef.current;
    const signatureDataUrl = canvas ? canvas.toDataURL("image/png") : "";

    setSubmitting(true);

    try {
      const acompanantesFinal = viajaAcompanado
        ? listaAcompanantes.map((s) => s.trim()).filter(Boolean)
        : [];

      const payload = {
        folioDocumento: "SII-MX-23-LOG-003",
        versionDocumento: "3.0",
        areaResponsable: "Logística",
        departamento: form.departamento,
        fechaEmision: new Date().toISOString().split("T")[0],
        horaSalida: form.horaSalida,
        idOrigen: form.idOrigen ? Number(form.idOrigen) : null,
        idDestino: form.idDestino ? Number(form.idDestino) : null,
        idVehiculo: form.idVehiculo ? Number(form.idVehiculo) : null,
        kilometraje: Number(form.kilometraje || 0),

        // Medical
        presionArterial: form.presionArterial,
        examenVisual: form.examenVisual,
        glucosa: form.glucosa,
        alcoholimetro: form.alcoholimetro,
        frecuenciaCardiaca: form.frecuenciaCardiaca,
        frecuenciaRespiratoria: form.frecuenciaRespiratoria,

        // General
        tipoVehiculo: form.tipoVehiculo,
        placa: form.placa,
        modelo: form.modelo,
        color: form.color,
        vehiculoEmpresa: form.vehiculoEmpresa,
        nombreContratista: form.nombreContratista,
        numeroUnidad: form.numeroUnidad,
        nombreConductor: selectedDriver.nombre,
        licenciaNumero: selectedDriver.licencia_numero || "",
        licenciaTipo: selectedDriver.tipo_licencia || "Chofer",
        licenciaVencimiento: selectedDriver.licencia_vencimiento || null,
        telefonoConductor: form.telefonoConductor,
        rutaPuntos: rutaPuntos.filter(Boolean),
        tiempoViajeHoras: Number(form.tiempoViajeHoras || 0),
        acompanantes: acompanantesFinal,

        // Checklist
        conocimientoRiesgosLocales: form.conocimientoRiesgosLocales,
        prohibidoPersonalAjeno: form.prohibidoPersonalAjeno,
        inspeccionVehiculoRealizada: form.inspeccionVehiculoRealizada,
        reunionPreCaravanaRealizada: form.reunionPreCaravanaRealizada,

        // Risk tabulators
        ptsDistancia: scoreA,
        ptsClima: scoreB,
        ptsVehiculosPersonas: scoreC,
        ptsCondicionesVia: scoreD,
        ptsComunicaciones: scoreE,
        ptsHorasTrabajadas: scoreF,
        ptsHoraTraslado: scoreG,

        firmaConductor: signatureDataUrl,
        nombreConductorFirma: selectedDriver.nombre
      };

      const res = await crearGerenciamientoViaje(payload);
      setSuccessMessage("✅ Gerenciamiento de viaje (SII-MX-23-LOG-003) registrado correctamente.");
      if (onComplete) {
        onComplete(res.data);
      }
    } catch (err) {
      setErrorMessage(err.message || "Error al guardar el gerenciamiento de viaje.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="gerenciamiento-form-wrapper" style={{ background: "#f8fafc", padding: "16px", borderRadius: "12px", border: "1px solid #cbd5e1" }}>
      {/* Encabezado Oficial con Logo AQR */}
      <header className="official-doc-header" style={{ background: "#ffffff", padding: "16px", borderRadius: "10px", border: "2px solid #0f172a", marginBottom: "20px", boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid #0f172a", paddingBottom: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <img src={logoAQR} alt="Logo AQUARIO" style={{ height: "52px", objectFit: "contain" }} />
          </div>
          <div style={{ textAlign: "right", fontSize: "0.78rem", color: "#334155", lineHeight: "1.4" }}>
            <div><strong>Emisión:</strong> Noviembre 2023</div>
            <div><strong>Versión:</strong> 3.0</div>
            <div><strong>Área:</strong> Logística</div>
            <div><strong>No. Doc:</strong> SII-MX-23-LOG-003</div>
          </div>
        </div>
        <h3 style={{ margin: "12px 0 0", textAlign: "center", fontSize: "1.05rem", color: "#1e3a8a", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: "800" }}>
          Gerenciamiento Vehicular (Viajes Fuera de la Ciudad / Estado)
        </h3>
      </header>

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: "20px" }}>
        {/* Encabezado de Campos Básicos */}
        <section className="form-section-card" style={{ background: "#ffffff", padding: "16px", borderRadius: "10px", border: "1px solid #cbd5e1" }}>
          <h4 style={{ margin: "0 0 14px", color: "#0f172a", borderBottom: "1px solid #e2e8f0", paddingBottom: "6px", fontSize: "1rem" }}>📋 Datos Generales de Salida</h4>
          
          {assignedVehicle && (
            <div style={{ backgroundColor: "#e0f2fe", color: "#0369a1", padding: "10px 14px", borderRadius: "8px", border: "1px solid #bae6fd", marginBottom: "14px", fontSize: "0.88rem", fontWeight: "bold" }}>
              📌 Unidad pre-asignada por tu supervisor: {assignedVehicle.nombre} ({assignedVehicle.numero_economico})
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "14px" }}>
            <label style={{ fontSize: "0.88rem", fontWeight: "bold", display: "grid", gap: "4px" }}>
              Departamento
              <input type="text" name="departamento" value={form.departamento} onChange={handleChange} required style={{ width: "100%", padding: "8px 10px", background: "#ffffff", color: "#0f172a", borderRadius: "6px", border: "1px solid #cbd5e1" }} />
            </label>
            <label style={{ fontSize: "0.88rem", fontWeight: "bold", display: "grid", gap: "4px" }}>
              Hora de Salida
              <input type="time" name="horaSalida" value={form.horaSalida} onChange={handleChange} required style={{ width: "100%", padding: "8px 10px", background: "#ffffff", color: "#0f172a", borderRadius: "6px", border: "1px solid #cbd5e1" }} />
            </label>
            <label style={{ fontSize: "0.88rem", fontWeight: "bold", display: "grid", gap: "4px" }}>
              Origen
              <select name="idOrigen" value={form.idOrigen} onChange={handleChange} required style={{ width: "100%", padding: "8px 10px", background: "#ffffff", color: "#0f172a", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
                <option value="">Seleccione Origen</option>
                {lugares.map((l) => (
                  <option key={l.id_lugares} value={l.id_lugares}>{l.nombre}</option>
                ))}
              </select>
            </label>
            <label style={{ fontSize: "0.88rem", fontWeight: "bold", display: "grid", gap: "4px" }}>
              Destino Final
              <select name="idDestino" value={form.idDestino} onChange={handleChange} required style={{ width: "100%", padding: "8px 10px", background: "#ffffff", color: "#0f172a", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
                <option value="">Seleccione Destino</option>
                {lugares.map((l) => (
                  <option key={l.id_lugares} value={l.id_lugares}>{l.nombre}</option>
                ))}
              </select>
            </label>
            <label style={{ fontSize: "0.88rem", fontWeight: "bold", display: "grid", gap: "4px" }}>
              Unidad / Vehículo
              <select name="idVehiculo" value={form.idVehiculo} onChange={handleChange} required style={{ width: "100%", padding: "8px 10px", background: "#ffffff", color: "#0f172a", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
                <option value="">Seleccione Unidad</option>
                {vehiculos.map((v) => (
                  <option key={v.id_vehiculos} value={v.id_vehiculos}>
                    {v.nombre} — {v.numero_economico} {String(v.id_vehiculos) === String(assignedVehicle?.id_vehiculos) ? " (Asignada)" : ""}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ fontSize: "0.88rem", fontWeight: "bold", display: "grid", gap: "4px" }}>
              Kilometraje Actual
              <input type="number" name="kilometraje" value={form.kilometraje} onChange={handleChange} required style={{ width: "100%", padding: "8px 10px", background: "#ffffff", color: "#0f172a", borderRadius: "6px", border: "1px solid #cbd5e1" }} />
            </label>
          </div>
        </section>

        {/* 1. Valoración Médica Pre-viaje */}
        <section className="form-section-card" style={{ background: "#ffffff", padding: "16px", borderRadius: "10px", border: "1px solid #cbd5e1" }}>
          <h4 style={{ margin: "0 0 14px", color: "#1e3a8a", borderBottom: "1px solid #e2e8f0", paddingBottom: "6px", fontSize: "1rem" }}>🩺 1. Valoración Médica Pre-viaje</h4>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "12px" }}>
            <label style={{ fontSize: "0.85rem", fontWeight: "bold", display: "grid", gap: "4px" }}>
              Presión Arterial
              <input type="text" name="presionArterial" value={form.presionArterial} onChange={handleChange} placeholder="Ej. 120/80" required style={{ width: "100%", padding: "8px 10px", background: "#ffffff", color: "#0f172a", borderRadius: "6px", border: "1px solid #cbd5e1" }} />
            </label>
            <label style={{ fontSize: "0.85rem", fontWeight: "bold", display: "grid", gap: "4px" }}>
              Examen Visual
              <input type="text" name="examenVisual" value={form.examenVisual} onChange={handleChange} placeholder="Ej. Normal" required style={{ width: "100%", padding: "8px 10px", background: "#ffffff", color: "#0f172a", borderRadius: "6px", border: "1px solid #cbd5e1" }} />
            </label>
            <label style={{ fontSize: "0.85rem", fontWeight: "bold", display: "grid", gap: "4px" }}>
              Glucosa
              <input type="text" name="glucosa" value={form.glucosa} onChange={handleChange} placeholder="Ej. 90 mg/dL" required style={{ width: "100%", padding: "8px 10px", background: "#ffffff", color: "#0f172a", borderRadius: "6px", border: "1px solid #cbd5e1" }} />
            </label>
            <label style={{ fontSize: "0.85rem", fontWeight: "bold", display: "grid", gap: "4px" }}>
              Frec. Cardíaca
              <input type="text" name="frecuenciaCardiaca" value={form.frecuenciaCardiaca} onChange={handleChange} placeholder="Ej. 72 bpm" required style={{ width: "100%", padding: "8px 10px", background: "#ffffff", color: "#0f172a", borderRadius: "6px", border: "1px solid #cbd5e1" }} />
            </label>
            <label style={{ fontSize: "0.85rem", fontWeight: "bold", display: "grid", gap: "4px" }}>
              Frec. Respiratoria
              <input type="text" name="frecuenciaRespiratoria" value={form.frecuenciaRespiratoria} onChange={handleChange} placeholder="Ej. 16 rpm" required style={{ width: "100%", padding: "8px 10px", background: "#ffffff", color: "#0f172a", borderRadius: "6px", border: "1px solid #cbd5e1" }} />
            </label>
            <label style={{ fontSize: "0.85rem", fontWeight: "bold", display: "grid", gap: "4px" }}>
              Alcoholímetro
              <select name="alcoholimetro" value={form.alcoholimetro ? "true" : "false"} onChange={(e) => setForm((p) => ({ ...p, alcoholimetro: e.target.value === "true" }))} style={{ width: "100%", padding: "8px 10px", background: "#ffffff", color: "#0f172a", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
                <option value="false">Negativo (0.00)</option>
                <option value="true">Positivo (+)</option>
              </select>
            </label>
          </div>
        </section>

        {/* 2. Información General */}
        <section className="form-section-card" style={{ background: "#ffffff", padding: "16px", borderRadius: "10px", border: "1px solid #cbd5e1" }}>
          <h4 style={{ margin: "0 0 14px", color: "#1e3a8a", borderBottom: "1px solid #e2e8f0", paddingBottom: "6px", fontSize: "1rem" }}>🚙 2. Información General del Traslado</h4>
          
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "12px", background: "#f8fafc", padding: "12px", borderRadius: "8px", border: "1px solid #e2e8f0", marginBottom: "16px", fontSize: "0.88rem" }}>
            <div><strong>Conductor:</strong> {selectedDriver.nombre || "No seleccionado"}</div>
            <div><strong>Licencia:</strong> {selectedDriver.licencia_numero || "N/A"}</div>
            <div><strong>Teléfono:</strong> {form.telefonoConductor}</div>
            <div><strong>Unidad No:</strong> {form.numeroUnidad || "N/A"}</div>
            <div><strong>Placa:</strong> {form.placa || "N/A"}</div>
            <div><strong>Modelo:</strong> {form.modelo || "N/A"}</div>
          </div>

          <div style={{ display: "grid", gap: "16px" }}>
            {/* Ruta a Seguir */}
            <div style={{ display: "grid", gap: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.9rem", fontWeight: "bold", color: "#0f172a" }}>Ruta a Seguir (Hasta 4 Puntos Intermedios)</span>
                {rutaPuntos.length < 4 && (
                  <button type="button" onClick={addRutaPoint} style={{ background: "#0284c7", color: "#ffffff", border: 0, padding: "6px 14px", borderRadius: "6px", cursor: "pointer", fontSize: "0.82rem", fontWeight: "bold", display: "flex", alignItems: "center", gap: "4px" }}>
                    + Añadir Punto
                  </button>
                )}
              </div>

              <div style={{ display: "grid", gap: "10px" }}>
                {rutaPuntos.map((pt, idx) => (
                  <div key={idx} style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                    <input
                      type="text"
                      placeholder={`Punto ${idx + 1} (Ej. Pocyaxum, Nahakal, Hool, Sihochac)`}
                      value={pt}
                      onChange={(e) => handleRutaChange(idx, e.target.value)}
                      style={{ flex: 1, padding: "10px 14px", background: "#ffffff", color: "#0f172a", border: "1px solid #cbd5e1", borderRadius: "6px", fontSize: "0.9rem", width: "100%" }}
                    />
                    {rutaPuntos.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeRutaPoint(idx)}
                        style={{ width: "38px", height: "38px", flexShrink: 0, background: "#ef4444", color: "#ffffff", border: 0, borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "1rem", display: "grid", placeItems: "center" }}
                        title="Eliminar punto"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "14px" }}>
              <label style={{ fontSize: "0.88rem", fontWeight: "bold", display: "grid", gap: "4px" }}>
                Tiempo de Viaje Estimado (Horas)
                <input type="number" name="tiempoViajeHoras" value={form.tiempoViajeHoras} onChange={handleChange} min="0.5" step="0.5" required style={{ width: "100%", padding: "8px 10px", background: "#ffffff", color: "#0f172a", borderRadius: "6px", border: "1px solid #cbd5e1" }} />
              </label>
            </div>

            {/* Acompañantes Dinámicos con botón (+) */}
            <div className="companions-container" style={{ background: "#f8fafc", padding: "14px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "0.9rem", fontWeight: "bold", color: "#0f172a" }}>Acompañantes</span>
                  {viajaAcompanado && (
                    <span style={{ background: "#e2e8f0", color: "#475569", padding: "2px 8px", borderRadius: "12px", fontSize: "0.78rem", fontWeight: "bold" }}>
                      {listaAcompanantes.filter((s) => s.trim() !== "").length} / {maxAcompanantes} máx.
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  {viajaAcompanado && (
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

            {/* Aviso sobre Sitios de Reporte */}
            <div style={{ background: "#e0f2fe", color: "#0369a1", padding: "10px 14px", borderRadius: "8px", border: "1px solid #bae6fd", fontSize: "0.85rem" }}>
              📌 <strong>Sitios de Reporte (Para viajes &gt; 1 hora):</strong> Los horarios de reporte por cada punto de la ruta se registrarán en tiempo real cuando el viaje esté <strong>EN CURSO</strong>.
            </div>
          </div>
        </section>

        {/* 3. Lista de Verificación de Previaje */}
        <section className="form-section-card" style={{ background: "#ffffff", padding: "16px", borderRadius: "10px", border: "1px solid #cbd5e1" }}>
          <h4 style={{ margin: "0 0 14px", color: "#1e3a8a", borderBottom: "1px solid #e2e8f0", paddingBottom: "6px", fontSize: "1rem" }}>✅ 3. Lista de Verificación de Previaje (Control SÍ / NO)</h4>
          <div style={{ display: "grid", gap: "10px" }}>
            <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.85rem", background: "#f8fafc", padding: "10px 12px", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
              <span>¿El conductor tiene conocimiento de los riesgos locales (vía, clima, peatones, animales, ciclistas)?</span>
              <select name="conocimientoRiesgosLocales" value={form.conocimientoRiesgosLocales ? "true" : "false"} onChange={(e) => setForm((p) => ({ ...p, conocimientoRiesgosLocales: e.target.value === "true" }))} style={{ fontWeight: "bold", padding: "4px 8px", background: "#ffffff", borderRadius: "4px" }}>
                <option value="true">SÍ</option>
                <option value="false">NO</option>
              </select>
            </label>

            <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.85rem", background: "#f8fafc", padding: "10px 12px", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
              <span>¿El conductor está informado que es prohibido transportar personal ajeno a la empresa?</span>
              <select name="prohibidoPersonalAjeno" value={form.prohibidoPersonalAjeno ? "true" : "false"} onChange={(e) => setForm((p) => ({ ...p, prohibidoPersonalAjeno: e.target.value === "true" }))} style={{ fontWeight: "bold", padding: "4px 8px", background: "#ffffff", borderRadius: "4px" }}>
                <option value="true">SÍ</option>
                <option value="false">NO</option>
              </select>
            </label>

            <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.85rem", background: "#f8fafc", padding: "10px 12px", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
              <span>¿Se realizó la inspección del vehículo con la lista de chequeo? (Anexar registro)</span>
              <select name="inspeccionVehiculoRealizada" value={form.inspeccionVehiculoRealizada ? "true" : "false"} onChange={(e) => setForm((p) => ({ ...p, inspeccionVehiculoRealizada: e.target.value === "true" }))} style={{ fontWeight: "bold", padding: "4px 8px", background: "#ffffff", borderRadius: "4px" }}>
                <option value="true">SÍ</option>
                <option value="false">NO</option>
              </select>
            </label>

            <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.85rem", background: "#f8fafc", padding: "10px 12px", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
              <span>¿Se realizó la reunión pre caravana? (Sólo para viajes de más de 1 vehículo incluyendo pesado)</span>
              <select name="reunionPreCaravanaRealizada" value={form.reunionPreCaravanaRealizada ? "true" : "false"} onChange={(e) => setForm((p) => ({ ...p, reunionPreCaravanaRealizada: e.target.value === "true" }))} style={{ fontWeight: "bold", padding: "4px 8px", background: "#ffffff", borderRadius: "4px" }}>
                <option value="false">NO</option>
                <option value="true">SÍ</option>
              </select>
            </label>
          </div>
        </section>

        {/* 4. Matriz de Análisis de Riesgos Interactiva */}
        <section className="form-section-card" style={{ background: "#ffffff", padding: "16px", borderRadius: "10px", border: "1px solid #cbd5e1" }}>
          <h4 style={{ margin: "0 0 14px", color: "#1e3a8a", borderBottom: "1px solid #e2e8f0", paddingBottom: "6px", fontSize: "1rem" }}>⚠️ 4. Matriz de Análisis de Riesgos (Tabuladores A al G)</h4>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px" }}>
            {/* A. Distancia */}
            <label style={{ fontSize: "0.85rem", fontWeight: "bold", display: "grid", gap: "4px" }}>
              A. Distancia a recorrer
              <select name="ptsDistancia" value={form.ptsDistancia} onChange={handleChange} style={{ width: "100%", padding: "8px", background: "#ffffff", color: "#0f172a", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
                <option value={1}>Menos de 50 Km (1 pto)</option>
                <option value={2}>Menos de 100 Km (2 ptos)</option>
                <option value={5}>Menos de 200 Km (5 ptos)</option>
                <option value={8}>Más de 200 Km (8 ptos)</option>
              </select>
            </label>

            {/* B. Clima */}
            <label style={{ fontSize: "0.85rem", fontWeight: "bold", display: "grid", gap: "4px" }}>
              B. Clima
              <select name="ptsClima" value={form.ptsClima} onChange={handleChange} style={{ width: "100%", padding: "8px", background: "#ffffff", color: "#0f172a", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
                <option value={2}>Seco / Condiciones normales (2 ptos)</option>
                <option value={4}>Lluvia suave (4 ptos)</option>
                <option value={8}>Lluvia fuerte y/o niebla (8 ptos)</option>
                <option value={10}>Nieve (10 ptos)</option>
              </select>
            </label>

            {/* C. Vehículos y personas */}
            <label style={{ fontSize: "0.85rem", fontWeight: "bold", display: "grid", gap: "4px" }}>
              C. Vehículos y Personas
              <select name="ptsVehiculosPersonas" value={form.ptsVehiculosPersonas} onChange={handleChange} style={{ width: "100%", padding: "8px", background: "#ffffff", color: "#0f172a", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
                <option value={1}>2+ Vehí. con 2+ personas/vehí (1 pto)</option>
                <option value={2}>2+ Vehí. con 1+ personas/vehí (2 ptos)</option>
                <option value={3}>1 Vehí. con 2+ personas (3 ptos)</option>
                <option value={8}>1 Vehí. con 1 persona (8 ptos)</option>
              </select>
            </label>

            {/* D. Condiciones de la vía */}
            <label style={{ fontSize: "0.85rem", fontWeight: "bold", display: "grid", gap: "4px" }}>
              D. Condiciones de la Vía
              <select name="ptsCondicionesVia" value={form.ptsCondicionesVia} onChange={handleChange} style={{ width: "100%", padding: "8px", background: "#ffffff", color: "#0f172a", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
                <option value={1}>Pavimentada (1 pto)</option>
                <option value={2}>Mixta (&lt;50% No Pavimentada) (2 ptos)</option>
                <option value={4}>No Pavimentada (4 ptos)</option>
              </select>
            </label>

            {/* E. Comunicaciones */}
            <label style={{ fontSize: "0.85rem", fontWeight: "bold", display: "grid", gap: "4px" }}>
              E. Comunicaciones Disponibles
              <select name="ptsComunicaciones" value={form.ptsComunicaciones} onChange={handleChange} style={{ width: "100%", padding: "8px", background: "#ffffff", color: "#0f172a", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
                <option value={0}>Teléfono celular (0 ptos)</option>
                <option value={2}>Sin comunicación y en caravana (2 ptos)</option>
                <option value={4}>Sin comunicación y sin caravana (4 ptos)</option>
              </select>
            </label>

            {/* F. Horas trabajadas + viaje */}
            <label style={{ fontSize: "0.85rem", fontWeight: "bold", display: "grid", gap: "4px" }}>
              F. Horas Trabajadas + Tiempo de Viaje
              <select name="ptsHorasTrabajadas" value={form.ptsHorasTrabajadas} onChange={handleChange} style={{ width: "100%", padding: "8px", background: "#ffffff", color: "#0f172a", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
                <option value={1}>Hrs trabajadas + Viaje &lt; 12 (1 pto)</option>
                <option value={3}>Hrs trabajadas + Viaje &lt; 14 (3 ptos)</option>
                <option value={6}>Hrs trabajadas + Viaje &lt; 16 (6 ptos)</option>
                <option value={16}>Hrs trabajadas + Viaje &gt;= 16 (NO CONDUCIR)</option>
              </select>
            </label>

            {/* G. Hora de traslado */}
            <label style={{ fontSize: "0.85rem", fontWeight: "bold", display: "grid", gap: "4px" }}>
              G. Hora de Traslado
              <select name="ptsHoraTraslado" value={form.ptsHoraTraslado} onChange={handleChange} style={{ width: "100%", padding: "8px", background: "#ffffff", color: "#0f172a", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
                <option value={1}>Día (06:00 - 18:00) (1 pto)</option>
                <option value={8}>Noche (18:00 - 06:00) (8 ptos)</option>
              </select>
            </label>
          </div>

          {/* Tarjeta con cálculo de puntaje en vivo y semáforo */}
          <div style={{ marginTop: "16px", background: "#f1f5f9", padding: "14px", borderRadius: "10px", borderLeft: `6px solid ${riskColor}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <span style={{ fontSize: "0.85rem", color: "#475569" }}>PUNTAJE ACUMULADO TOTAL:</span>
                <strong style={{ fontSize: "1.4rem", marginLeft: "8px", color: "#0f172a" }}>{totalScore} ptos</strong>
              </div>
              <div style={{ background: riskColor, color: "#ffffff", padding: "4px 14px", borderRadius: "20px", fontWeight: "bold", fontSize: "0.9rem" }}>
                RIESGO {riskLevel}
              </div>
            </div>

            <p style={{ margin: "8px 0 0", fontSize: "0.85rem", color: "#334155" }}>
              <strong>Nivel de Aprobación Requerido:</strong> {requiredApproval}
            </p>

            {isHoursBlocked && (
              <div style={{ background: "#fef2f2", color: "#991b1b", padding: "10px 14px", borderRadius: "6px", marginTop: "10px", border: "1px solid #fecaca", fontWeight: "bold", fontSize: "0.85rem" }}>
                ⛔ Horas de trabajo + Horas de viaje &gt;= 16 Horas: NO CONDUCIR (Riesgo Bloqueante)
              </div>
            )}

            {isNightDriving && (
              <div style={{ background: "#fefce8", color: "#854d0e", padding: "10px 14px", borderRadius: "6px", marginTop: "10px", border: "1px solid #fef08a", fontSize: "0.85rem" }}>
                🌙 Manejo Nocturno Requiere Aprobación de Gerencia General y de QHSE.
              </div>
            )}
          </div>
        </section>

        {/* 5. Firma Digital del Conductor */}
        <section className="form-section-card" style={{ background: "#ffffff", padding: "16px", borderRadius: "10px", border: "1px solid #cbd5e1" }}>
          <h4 style={{ margin: "0 0 14px", color: "#1e3a8a", borderBottom: "1px solid #e2e8f0", paddingBottom: "6px", fontSize: "1rem" }}>✍️ 5. Firma Digital del Conductor</h4>
          <p style={{ fontSize: "0.85rem", color: "#64748b", margin: "0 0 10px" }}>Dibuja tu firma en el recuadro a continuación con el dedo o puntero:</p>

          <div style={{ border: "2px dashed #94a3b8", borderRadius: "8px", background: "#ffffff", display: "inline-block", width: "100%", touchAction: "none" }}>
            <canvas
              ref={canvasRef}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
              style={{ width: "100%", height: "130px", cursor: "crosshair", borderRadius: "6px" }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px" }}>
            <small style={{ color: "#475569" }}><strong>Firmante:</strong> {selectedDriver.nombre}</small>
            <button type="button" onClick={clearSignature} style={{ background: "#e2e8f0", border: 0, padding: "6px 12px", borderRadius: "6px", cursor: "pointer", fontSize: "0.82rem", color: "#334155", fontWeight: "bold" }}>
              Borrar Firma
            </button>
          </div>
        </section>

        {errorMessage && (
          <div style={{ background: "#fef2f2", color: "#991b1b", padding: "12px 16px", borderRadius: "8px", border: "1px solid #fecaca", fontSize: "0.9rem" }} role="alert">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div style={{ background: "#f0fdf4", color: "#166534", padding: "12px 16px", borderRadius: "8px", border: "1px solid #bbf7d0", fontSize: "0.9rem" }} role="status">
            {successMessage}
          </div>
        )}

        <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", marginTop: "10px" }}>
          {onCancel && (
            <button type="button" onClick={onCancel} disabled={submitting} style={{ padding: "12px 20px", borderRadius: "8px", background: "#e2e8f0", color: "#334155", border: 0, fontWeight: "bold", cursor: "pointer" }}>
              Cancelar
            </button>
          )}
          <button
            type="submit"
            disabled={submitting || isHoursBlocked}
            style={{
              padding: "12px 24px",
              borderRadius: "8px",
              background: isHoursBlocked ? "#94a3b8" : "linear-gradient(135deg, #1e3a8a, #0284c7)",
              color: "#ffffff",
              border: 0,
              fontWeight: "bold",
              fontSize: "1rem",
              cursor: isHoursBlocked ? "not-allowed" : "pointer",
              boxShadow: "0 4px 12px rgba(2, 132, 199, 0.3)"
            }}
          >
            {submitting ? "Guardando Documento..." : "📄 Registrar Gerenciamiento de Viaje"}
          </button>
        </div>
      </form>
    </div>
  );
}
