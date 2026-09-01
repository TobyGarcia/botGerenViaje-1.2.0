import { useState, useRef, useEffect } from "react";
import { crearGerenciamientoViaje } from "../services/api.js";

export default function GerenciamientoForm({ telegramAuth, conductores = [], vehiculos = [], lugares = [], onComplete, onCancel }) {
  const selectedDriver = telegramAuth?.conductor || {};

  const [form, setForm] = useState({
    departamento: "Logística",
    horaSalida: new Date().toTimeString().slice(0, 5),
    idOrigen: "",
    origenTexto: "",
    idDestino: "",
    destinoTexto: "",
    kilometraje: "",

    // 1. Valoración Médica
    presionArterial: "120/80",
    examenVisual: "Normal",
    glucosa: "90 mg/dL",
    alcoholimetro: false,
    frecuenciaCardiaca: "72 bpm",
    frecuenciaRespiratoria: "16 rpm",

    // 2. Información General
    idVehiculo: "",
    tipoVehiculo: "",
    placa: "",
    modelo: "",
    color: "Blanco",
    vehiculoEmpresa: true,
    nombreContratista: "",
    numeroUnidad: "",
    telefonoConductor: selectedDriver.telefono || "",
    tiempoViajeHoras: 1,
    acompanantes: "",

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
  const [sitiosReporte, setSitiosReporte] = useState([
    { punto: "", hora: "" },
    { punto: "", hora: "" }
  ]);

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Signature canvas
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  // Auto-fill selected vehicle info
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

  // Setup Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = canvas.offsetWidth || 340;
      canvas.height = 140;
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
  let riskBadgeClass = "badge-low-risk";
  let requiredApproval = "Supervisor Directo o QHSE";

  if (totalScore > 23) {
    riskLevel = "ALTO";
    riskColor = "#dc2626"; // Red
    riskBadgeClass = "badge-high-risk";
    requiredApproval = "Gerencia General y QHSE";
  } else if (totalScore >= 16) {
    riskLevel = "MEDIO";
    riskColor = "#ca8a04"; // Yellow
    riskBadgeClass = "badge-med-risk";
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

    // Sync default report sites names
    const newSitios = [...sitiosReporte];
    if (newSitios[index]) {
      newSitios[index].punto = value;
    } else {
      newSitios.push({ punto: value, hora: "" });
    }
    setSitiosReporte(newSitios);
  }

  function addRutaPoint() {
    if (rutaPuntos.length < 4) {
      setRutaPuntos([...rutaPuntos, ""]);
      setSitiosReporte([...sitiosReporte, { punto: "", hora: "" }]);
    }
  }

  function removeRutaPoint(index) {
    if (rutaPuntos.length > 1) {
      setRutaPuntos(rutaPuntos.filter((_, i) => i !== index));
      setSitiosReporte(sitiosReporte.filter((_, i) => i !== index));
    }
  }

  function handleSitioHoraChange(index, horaVal) {
    const newSitios = [...sitiosReporte];
    if (newSitios[index]) {
      newSitios[index].hora = horaVal;
      setSitiosReporte(newSitios);
    }
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
      const payload = {
        folioDocumento: "SII-MX-23-LOG-003",
        versionDocumento: "3.0",
        areaResponsable: "Logística",
        departamento: form.departamento,
        fechaEmision: new Date().toISOString().split("T")[0],
        horaSalida: form.horaSalida,
        idOrigen: form.idOrigen ? Number(form.idOrigen) : null,
        idDestino: form.idDestino ? Number(form.idDestino) : null,
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
        acompanantes: form.acompanantes ? form.acompanantes.split(",").map((s) => s.trim()).filter(Boolean) : [],
        sitiosReporte: sitiosReporte.filter((s) => s.punto),

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
      {/* Encabezado Oficial */}
      <header className="official-doc-header" style={{ background: "#ffffff", padding: "14px", borderRadius: "8px", border: "2px solid #0f172a", marginBottom: "16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid #0f172a", paddingBottom: "8px" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.1rem", color: "#0f172a", fontWeight: "900" }}>Itzamná Oil & Gas</h2>
            <small style={{ color: "#475569", fontWeight: "bold" }}>Servicios Industriales y de Ingeniería Itzamná</small>
          </div>
          <div style={{ textAlign: "right", fontSize: "0.75rem", color: "#334155" }}>
            <div><strong>Emisión:</strong> Noviembre 2023</div>
            <div><strong>Versión:</strong> 3.0</div>
            <div><strong>Área:</strong> Logística</div>
            <div><strong>No. Doc:</strong> SII-MX-23-LOG-003</div>
          </div>
        </div>
        <h3 style={{ margin: "10px 0 0", textAlign: "center", fontSize: "1.05rem", color: "#1e3a8a", textTransform: "uppercase", letterSpacing: "0.5px" }}>
          Gerenciamiento Vehicular (Viajes Fuera de la Ciudad / Estado)
        </h3>
      </header>

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: "16px" }}>
        {/* Encabezado de Campos Básicos */}
        <section className="form-section-card" style={{ background: "#ffffff", padding: "14px", borderRadius: "8px", border: "1px solid #cbd5e1" }}>
          <h4 style={{ margin: "0 0 10px", color: "#0f172a", borderBottom: "1px solid #e2e8f0", paddingBottom: "4px" }}>📋 Datos Generales de Salida</h4>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "10px" }}>
            <label style={{ fontSize: "0.85rem", fontWeight: "bold" }}>
              Departamento
              <input type="text" name="departamento" value={form.departamento} onChange={handleChange} required style={{ width: "100%", padding: "6px", borderRadius: "4px", border: "1px solid #cbd5e1" }} />
            </label>
            <label style={{ fontSize: "0.85rem", fontWeight: "bold" }}>
              Hora de Salida
              <input type="time" name="horaSalida" value={form.horaSalida} onChange={handleChange} required style={{ width: "100%", padding: "6px", borderRadius: "4px", border: "1px solid #cbd5e1" }} />
            </label>
            <label style={{ fontSize: "0.85rem", fontWeight: "bold" }}>
              Origen
              <select name="idOrigen" value={form.idOrigen} onChange={handleChange} required style={{ width: "100%", padding: "6px", borderRadius: "4px", border: "1px solid #cbd5e1" }}>
                <option value="">Seleccione Origen</option>
                {lugares.map((l) => (
                  <option key={l.id_lugares} value={l.id_lugares}>{l.nombre}</option>
                ))}
              </select>
            </label>
            <label style={{ fontSize: "0.85rem", fontWeight: "bold" }}>
              Destino Final
              <select name="idDestino" value={form.idDestino} onChange={handleChange} required style={{ width: "100%", padding: "6px", borderRadius: "4px", border: "1px solid #cbd5e1" }}>
                <option value="">Seleccione Destino</option>
                {lugares.map((l) => (
                  <option key={l.id_lugares} value={l.id_lugares}>{l.nombre}</option>
                ))}
              </select>
            </label>
            <label style={{ fontSize: "0.85rem", fontWeight: "bold" }}>
              Unidad / Vehículo
              <select name="idVehiculo" value={form.idVehiculo} onChange={handleChange} required style={{ width: "100%", padding: "6px", borderRadius: "4px", border: "1px solid #cbd5e1" }}>
                <option value="">Seleccione Unidad</option>
                {vehiculos.map((v) => (
                  <option key={v.id_vehiculos} value={v.id_vehiculos}>{v.nombre} ({v.numero_economico})</option>
                ))}
              </select>
            </label>
            <label style={{ fontSize: "0.85rem", fontWeight: "bold" }}>
              Kilometraje Actual
              <input type="number" name="kilometraje" value={form.kilometraje} onChange={handleChange} required style={{ width: "100%", padding: "6px", borderRadius: "4px", border: "1px solid #cbd5e1" }} />
            </label>
          </div>
        </section>

        {/* 1. Valoración Médica Pre-viaje */}
        <section className="form-section-card" style={{ background: "#ffffff", padding: "14px", borderRadius: "8px", border: "1px solid #cbd5e1" }}>
          <h4 style={{ margin: "0 0 10px", color: "#1e3a8a", borderBottom: "1px solid #e2e8f0", paddingBottom: "4px" }}>🩺 1. Valoración Médica Pre-viaje</h4>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "10px" }}>
            <label style={{ fontSize: "0.82rem", fontWeight: "bold" }}>
              Presión Arterial
              <input type="text" name="presionArterial" value={form.presionArterial} onChange={handleChange} placeholder="Ej. 120/80" required style={{ width: "100%", padding: "6px", borderRadius: "4px", border: "1px solid #cbd5e1" }} />
            </label>
            <label style={{ fontSize: "0.82rem", fontWeight: "bold" }}>
              Examen Visual
              <input type="text" name="examenVisual" value={form.examenVisual} onChange={handleChange} placeholder="Ej. Normal" required style={{ width: "100%", padding: "6px", borderRadius: "4px", border: "1px solid #cbd5e1" }} />
            </label>
            <label style={{ fontSize: "0.82rem", fontWeight: "bold" }}>
              Glucosa
              <input type="text" name="glucosa" value={form.glucosa} onChange={handleChange} placeholder="Ej. 90 mg/dL" required style={{ width: "100%", padding: "6px", borderRadius: "4px", border: "1px solid #cbd5e1" }} />
            </label>
            <label style={{ fontSize: "0.82rem", fontWeight: "bold" }}>
              Frec. Cardíaca
              <input type="text" name="frecuenciaCardiaca" value={form.frecuenciaCardiaca} onChange={handleChange} placeholder="Ej. 72 bpm" required style={{ width: "100%", padding: "6px", borderRadius: "4px", border: "1px solid #cbd5e1" }} />
            </label>
            <label style={{ fontSize: "0.82rem", fontWeight: "bold" }}>
              Frec. Respiratoria
              <input type="text" name="frecuenciaRespiratoria" value={form.frecuenciaRespiratoria} onChange={handleChange} placeholder="Ej. 16 rpm" required style={{ width: "100%", padding: "6px", borderRadius: "4px", border: "1px solid #cbd5e1" }} />
            </label>
            <label style={{ fontSize: "0.82rem", fontWeight: "bold" }}>
              Alcoholímetro
              <select name="alcoholimetro" value={form.alcoholimetro ? "true" : "false"} onChange={(e) => setForm((p) => ({ ...p, alcoholimetro: e.target.value === "true" }))} style={{ width: "100%", padding: "6px", borderRadius: "4px", border: "1px solid #cbd5e1" }}>
                <option value="false">Negativo (0.00)</option>
                <option value="true">Positivo (+)</option>
              </select>
            </label>
          </div>
        </section>

        {/* 2. Información General */}
        <section className="form-section-card" style={{ background: "#ffffff", padding: "14px", borderRadius: "8px", border: "1px solid #cbd5e1" }}>
          <h4 style={{ margin: "0 0 10px", color: "#1e3a8a", borderBottom: "1px solid #e2e8f0", paddingBottom: "4px" }}>🚙 2. Información General del Traslado</h4>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "10px", marginBottom: "12px" }}>
            <div><strong>Conductor:</strong> {selectedDriver.nombre || "No seleccionado"}</div>
            <div><strong>Licencia:</strong> {selectedDriver.licencia_numero || "N/A"}</div>
            <div><strong>Teléfono:</strong> {form.telefonoConductor}</div>
            <div><strong>Unidad No:</strong> {form.numeroUnidad || "N/A"}</div>
            <div><strong>Placa:</strong> {form.placa || "N/A"}</div>
            <div><strong>Modelo:</strong> {form.modelo || "N/A"}</div>
          </div>

          <div style={{ display: "grid", gap: "10px" }}>
            <div>
              <label style={{ fontSize: "0.85rem", fontWeight: "bold", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>Ruta a Seguir (Hasta 4 Puntos Intermedios)</span>
                {rutaPuntos.length < 4 && (
                  <button type="button" onClick={addRutaPoint} style={{ background: "#0284c7", color: "#fff", border: 0, padding: "2px 8px", borderRadius: "4px", cursor: "pointer", fontSize: "0.8rem" }}>
                    + Añadir Punto
                  </button>
                )}
              </label>
              <div style={{ display: "grid", gap: "6px", marginTop: "6px" }}>
                {rutaPuntos.map((pt, idx) => (
                  <div key={idx} style={{ display: "flex", gap: "6px" }}>
                    <input
                      type="text"
                      placeholder={`Punto ${idx + 1} (Ej. Pocyaxum, Nahakal, Hool, Sihochac)`}
                      value={pt}
                      onChange={(e) => handleRutaChange(idx, e.target.value)}
                      style={{ flex: 1, padding: "6px", borderRadius: "4px", border: "1px solid #cbd5e1" }}
                    />
                    {rutaPuntos.length > 1 && (
                      <button type="button" onClick={() => removeRutaPoint(idx)} style={{ background: "#ef4444", color: "#fff", border: 0, padding: "4px 8px", borderRadius: "4px" }}>
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <label style={{ fontSize: "0.85rem", fontWeight: "bold" }}>
                Tiempo de Viaje Estimado (Horas)
                <input type="number" name="tiempoViajeHoras" value={form.tiempoViajeHoras} onChange={handleChange} min="0.5" step="0.5" required style={{ width: "100%", padding: "6px", borderRadius: "4px", border: "1px solid #cbd5e1" }} />
              </label>

              <label style={{ fontSize: "0.85rem", fontWeight: "bold" }}>
                Acompañantes (Separados por coma)
                <input type="text" name="acompanantes" value={form.acompanantes} onChange={handleChange} placeholder="Ej. Gabriela Méndez, Juan Pérez" style={{ width: "100%", padding: "6px", borderRadius: "4px", border: "1px solid #cbd5e1" }} />
              </label>
            </div>

            {/* Sitios de reporte para viajes > 1 hora */}
            {Number(form.tiempoViajeHoras) >= 1 && (
              <div style={{ background: "#f1f5f9", padding: "10px", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
                <h5 style={{ margin: "0 0 6px", fontSize: "0.85rem", color: "#334155" }}>📌 Sitios de Reporte (Obligatorio para viajes &gt; 1 hora)</h5>
                <div style={{ display: "grid", gap: "6px" }}>
                  {sitiosReporte.map((sitio, idx) => (
                    <div key={idx} style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      <span style={{ fontSize: "0.8rem", width: "70px", fontWeight: "bold" }}>Punto {idx + 1}:</span>
                      <input type="text" value={sitio.punto} readOnly placeholder="Punto de la ruta" style={{ flex: 1, padding: "4px", borderRadius: "4px", border: "1px solid #cbd5e1", background: "#e2e8f0" }} />
                      <input type="time" value={sitio.hora} onChange={(e) => handleSitioHoraChange(idx, e.target.value)} placeholder="Hora estimado" style={{ width: "110px", padding: "4px", borderRadius: "4px", border: "1px solid #cbd5e1" }} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* 3. Lista de Verificación de Previaje */}
        <section className="form-section-card" style={{ background: "#ffffff", padding: "14px", borderRadius: "8px", border: "1px solid #cbd5e1" }}>
          <h4 style={{ margin: "0 0 10px", color: "#1e3a8a", borderBottom: "1px solid #e2e8f0", paddingBottom: "4px" }}>✅ 3. Lista de Verificación de Previaje (Control SÍ / NO)</h4>
          <div style={{ display: "grid", gap: "10px" }}>
            <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.83rem", background: "#f8fafc", padding: "8px", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
              <span>¿El conductor tiene conocimiento de los riesgos locales (vía, clima, peatones, animales, ciclistas)?</span>
              <select name="conocimientoRiesgosLocales" value={form.conocimientoRiesgosLocales ? "true" : "false"} onChange={(e) => setForm((p) => ({ ...p, conocimientoRiesgosLocales: e.target.value === "true" }))} style={{ fontWeight: "bold" }}>
                <option value="true">SÍ</option>
                <option value="false">NO</option>
              </select>
            </label>

            <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.83rem", background: "#f8fafc", padding: "8px", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
              <span>¿El conductor está informado que es prohibido transportar personal ajeno a la empresa?</span>
              <select name="prohibidoPersonalAjeno" value={form.prohibidoPersonalAjeno ? "true" : "false"} onChange={(e) => setForm((p) => ({ ...p, prohibidoPersonalAjeno: e.target.value === "true" }))} style={{ fontWeight: "bold" }}>
                <option value="true">SÍ</option>
                <option value="false">NO</option>
              </select>
            </label>

            <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.83rem", background: "#f8fafc", padding: "8px", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
              <span>¿Se realizó la inspección del vehículo con la lista de chequeo? (Anexar registro)</span>
              <select name="inspeccionVehiculoRealizada" value={form.inspeccionVehiculoRealizada ? "true" : "false"} onChange={(e) => setForm((p) => ({ ...p, inspeccionVehiculoRealizada: e.target.value === "true" }))} style={{ fontWeight: "bold" }}>
                <option value="true">SÍ</option>
                <option value="false">NO</option>
              </select>
            </label>

            <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.83rem", background: "#f8fafc", padding: "8px", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
              <span>¿Se realizó la reunión pre caravana? (Sólo para viajes de más de 1 vehículo incluyendo pesado)</span>
              <select name="reunionPreCaravanaRealizada" value={form.reunionPreCaravanaRealizada ? "true" : "false"} onChange={(e) => setForm((p) => ({ ...p, reunionPreCaravanaRealizada: e.target.value === "true" }))} style={{ fontWeight: "bold" }}>
                <option value="false">NO</option>
                <option value="true">SÍ</option>
              </select>
            </label>
          </div>
        </section>

        {/* 4. Matriz de Análisis de Riesgos Interactiva */}
        <section className="form-section-card" style={{ background: "#ffffff", padding: "14px", borderRadius: "8px", border: "1px solid #cbd5e1" }}>
          <h4 style={{ margin: "0 0 10px", color: "#1e3a8a", borderBottom: "1px solid #e2e8f0", paddingBottom: "4px" }}>⚠️ 4. Matriz de Análisis de Riesgos (Tabuladores A al G)</h4>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "10px" }}>
            {/* A. Distancia */}
            <label style={{ fontSize: "0.82rem", fontWeight: "bold" }}>
              A. Distancia a recorrer
              <select name="ptsDistancia" value={form.ptsDistancia} onChange={handleChange} style={{ width: "100%", padding: "6px", borderRadius: "4px", border: "1px solid #cbd5e1" }}>
                <option value={1}>Menos de 50 Km (1 pto)</option>
                <option value={2}>Menos de 100 Km (2 ptos)</option>
                <option value={5}>Menos de 200 Km (5 ptos)</option>
                <option value={8}>Más de 200 Km (8 ptos)</option>
              </select>
            </label>

            {/* B. Clima */}
            <label style={{ fontSize: "0.82rem", fontWeight: "bold" }}>
              B. Clima
              <select name="ptsClima" value={form.ptsClima} onChange={handleChange} style={{ width: "100%", padding: "6px", borderRadius: "4px", border: "1px solid #cbd5e1" }}>
                <option value={2}>Seco / Condiciones normales (2 ptos)</option>
                <option value={4}>Lluvia suave (4 ptos)</option>
                <option value={8}>Lluvia fuerte y/o niebla (8 ptos)</option>
                <option value={10}>Nieve (10 ptos)</option>
              </select>
            </label>

            {/* C. Vehículos y personas */}
            <label style={{ fontSize: "0.82rem", fontWeight: "bold" }}>
              C. Vehículos y Personas
              <select name="ptsVehiculosPersonas" value={form.ptsVehiculosPersonas} onChange={handleChange} style={{ width: "100%", padding: "6px", borderRadius: "4px", border: "1px solid #cbd5e1" }}>
                <option value={1}>2+ Vehí. con 2+ personas/vehí (1 pto)</option>
                <option value={2}>2+ Vehí. con 1+ personas/vehí (2 ptos)</option>
                <option value={3}>1 Vehí. con 2+ personas (3 ptos)</option>
                <option value={8}>1 Vehí. con 1 persona (8 ptos)</option>
              </select>
            </label>

            {/* D. Condiciones de la vía */}
            <label style={{ fontSize: "0.82rem", fontWeight: "bold" }}>
              D. Condiciones de la Vía
              <select name="ptsCondicionesVia" value={form.ptsCondicionesVia} onChange={handleChange} style={{ width: "100%", padding: "6px", borderRadius: "4px", border: "1px solid #cbd5e1" }}>
                <option value={1}>Pavimentada (1 pto)</option>
                <option value={2}>Mixta (&lt;50% No Pavimentada) (2 ptos)</option>
                <option value={4}>No Pavimentada (4 ptos)</option>
              </select>
            </label>

            {/* E. Comunicaciones */}
            <label style={{ fontSize: "0.82rem", fontWeight: "bold" }}>
              E. Comunicaciones Disponibles
              <select name="ptsComunicaciones" value={form.ptsComunicaciones} onChange={handleChange} style={{ width: "100%", padding: "6px", borderRadius: "4px", border: "1px solid #cbd5e1" }}>
                <option value={0}>Teléfono celular (0 ptos)</option>
                <option value={2}>Sin comunicación y en caravana (2 ptos)</option>
                <option value={4}>Sin comunicación y sin caravana (4 ptos)</option>
              </select>
            </label>

            {/* F. Horas trabajadas + viaje */}
            <label style={{ fontSize: "0.82rem", fontWeight: "bold" }}>
              F. Horas Trabajadas + Tiempo de Viaje
              <select name="ptsHorasTrabajadas" value={form.ptsHorasTrabajadas} onChange={handleChange} style={{ width: "100%", padding: "6px", borderRadius: "4px", border: "1px solid #cbd5e1" }}>
                <option value={1}>Hrs trabajadas + Viaje &lt; 12 (1 pto)</option>
                <option value={3}>Hrs trabajadas + Viaje &lt; 14 (3 ptos)</option>
                <option value={6}>Hrs trabajadas + Viaje &lt; 16 (6 ptos)</option>
                <option value={16}>Hrs trabajadas + Viaje &gt;= 16 (NO CONDUCIR)</option>
              </select>
            </label>

            {/* G. Hora de traslado */}
            <label style={{ fontSize: "0.82rem", fontWeight: "bold" }}>
              G. Hora de Traslado
              <select name="ptsHoraTraslado" value={form.ptsHoraTraslado} onChange={handleChange} style={{ width: "100%", padding: "6px", borderRadius: "4px", border: "1px solid #cbd5e1" }}>
                <option value={1}>Día (06:00 - 18:00) (1 pto)</option>
                <option value={8}>Noche (18:00 - 06:00) (8 ptos)</option>
              </select>
            </label>
          </div>

          {/* Tarjeta con cálculo de puntaje en vivo y semáforo */}
          <div style={{ marginTop: "14px", background: "#f1f5f9", padding: "12px", borderRadius: "8px", borderLeft: `6px solid ${riskColor}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <span style={{ fontSize: "0.85rem", color: "#475569" }}>PUNTAJE ACUMULADO TOTAL:</span>
                <strong style={{ fontSize: "1.4rem", marginLeft: "8px", color: "#0f172a" }}>{totalScore} ptos</strong>
              </div>
              <div style={{ background: riskColor, color: "#ffffff", padding: "4px 12px", borderRadius: "20px", fontWeight: "bold", fontSize: "0.9rem" }}>
                RIESGO {riskLevel}
              </div>
            </div>

            <p style={{ margin: "6px 0 0", fontSize: "0.82rem", color: "#334155" }}>
              <strong>Nivel de Aprobación Requerido:</strong> {requiredApproval}
            </p>

            {isHoursBlocked && (
              <div style={{ background: "#fef2f2", color: "#991b1b", padding: "8px 12px", borderRadius: "6px", marginTop: "8px", border: "1px solid #fecaca", fontWeight: "bold", fontSize: "0.85rem" }}>
                ⛔ Horas de trabajo + Horas de viaje &gt;= 16 Horas: NO CONDUCIR (Riesgo Bloqueante)
              </div>
            )}

            {isNightDriving && (
              <div style={{ background: "#fefce8", color: "#854d0e", padding: "8px 12px", borderRadius: "6px", marginTop: "8px", border: "1px solid #fef08a", fontSize: "0.82rem" }}>
                🌙 Manejo Nocturno Requiere Aprobación de Gerencia General y de QHSE.
              </div>
            )}
          </div>
        </section>

        {/* 5. Firma Digital del Conductor */}
        <section className="form-section-card" style={{ background: "#ffffff", padding: "14px", borderRadius: "8px", border: "1px solid #cbd5e1" }}>
          <h4 style={{ margin: "0 0 10px", color: "#1e3a8a", borderBottom: "1px solid #e2e8f0", paddingBottom: "4px" }}>✍️ 5. Firma Digital del Conductor</h4>
          <p style={{ fontSize: "0.82rem", color: "#64748b", margin: "0 0 8px" }}>Dibuja tu firma en el recuadro a continuación con el dedo o puntero:</p>

          <div style={{ border: "2px dashed #94a3b8", borderRadius: "8px", background: "#f8fafc", display: "inline-block", width: "100%", touchAction: "none" }}>
            <canvas
              ref={canvasRef}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
              style={{ width: "100%", height: "140px", cursor: "crosshair", borderRadius: "6px" }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "6px" }}>
            <small style={{ color: "#475569" }}><strong>Firmante:</strong> {selectedDriver.nombre}</small>
            <button type="button" onClick={clearSignature} style={{ background: "#e2e8f0", border: 0, padding: "4px 10px", borderRadius: "4px", cursor: "pointer", fontSize: "0.8rem", color: "#334155" }}>
              Borrar Firma
            </button>
          </div>
        </section>

        {errorMessage && (
          <div style={{ background: "#fef2f2", color: "#991b1b", padding: "10px 14px", borderRadius: "8px", border: "1px solid #fecaca", fontSize: "0.9rem" }} role="alert">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div style={{ background: "#f0fdf4", color: "#166534", padding: "10px 14px", borderRadius: "8px", border: "1px solid #bbf7d0", fontSize: "0.9rem" }} role="status">
            {successMessage}
          </div>
        )}

        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "10px" }}>
          {onCancel && (
            <button type="button" onClick={onCancel} disabled={submitting} style={{ padding: "10px 16px", borderRadius: "8px", background: "#e2e8f0", color: "#334155", border: 0, fontWeight: "bold", cursor: "pointer" }}>
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
