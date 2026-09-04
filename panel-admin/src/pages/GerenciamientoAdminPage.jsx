import { useEffect, useRef, useState } from "react";
import logoAQR from "../assets/LoginAssets/logoAQR.webp";
import { getAdminUsuarios } from "../services/api.js";
import DamageViewer from "../components/DamageViewer.jsx";

function ApprovalSignature({ onChange }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const [hasSignature, setHasSignature] = useState(false);

  function point(event) {
    const canvas = canvasRef.current;
    const bounds = canvas.getBoundingClientRect();
    return [
      (event.clientX - bounds.left) * (canvas.width / bounds.width),
      (event.clientY - bounds.top) * (canvas.height / bounds.height)
    ];
  }

  function start(event) {
    const [x, y] = point(event);
    const context = canvasRef.current.getContext("2d");
    context.beginPath();
    context.moveTo(x, y);
    context.lineWidth = 2.5;
    context.lineCap = "round";
    drawing.current = true;
    canvasRef.current.setPointerCapture?.(event.pointerId);
    setHasSignature(true);
  }

  function draw(event) {
    if (!drawing.current) return;
    const [x, y] = point(event);
    const context = canvasRef.current.getContext("2d");
    context.lineTo(x, y);
    context.stroke();
  }

  function stop() {
    if (!drawing.current) return;
    drawing.current = false;
    onChange(canvasRef.current.toDataURL("image/png"));
  }

  function clear() {
    if (canvasRef.current) {
      canvasRef.current.getContext("2d").clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
    setHasSignature(false);
    onChange("");
  }

  return (
    <div style={{ marginTop: "6px" }}>
      <label style={{ fontSize: "0.82rem", fontWeight: "bold", display: "block", marginBottom: "4px" }}>
        Firma Digital del Autorizador *
      </label>
      <div style={{ border: "1.5px dashed #000000", borderRadius: "4px", background: "#ffffff", padding: "2px" }}>
        <canvas
          ref={canvasRef}
          width="640"
          height="140"
          style={{ width: "100%", height: "110px", cursor: "crosshair", touchAction: "none" }}
          onPointerDown={start}
          onPointerMove={draw}
          onPointerUp={stop}
          onPointerLeave={stop}
        />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "4px" }}>
        <small style={{ color: hasSignature ? "#166534" : "#64748b", fontWeight: "bold" }}>
          {hasSignature ? "✓ Firma capturada." : "Dibuja tu firma con ratón o pantalla táctil."}
        </small>
        <button
          type="button"
          disabled={!hasSignature}
          onClick={clear}
          style={{ background: "#e2e8f0", border: 0, padding: "3px 8px", borderRadius: "3px", cursor: "pointer", fontSize: "0.75rem" }}
        >
          Limpiar Firma
        </button>
      </div>
    </div>
  );
}

export default function GerenciamientoAdminPage({ user }) {
  const [list, setList] = useState([]);
  const [usuariosAdmin, setUsuariosAdmin] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterRiesgo, setFilterRiesgo] = useState("");
  const [filterEstado, setFilterEstado] = useState("");
  const [selectedDoc, setSelectedDoc] = useState(null);

  // Approval modal state
  const [approving, setApproving] = useState(false);
  const [autorizadorId, setAutorizadorId] = useState("");
  const [autorizadorNombre, setAutorizadorNombre] = useState(user?.nombre || user?.username || "");
  const [firmaAutorizador, setFirmaAutorizador] = useState("");
  const [observaciones, setObservaciones] = useState("");

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      let url = `${API_BASE_URL}/gerenciamiento-viajes?`;
      if (filterRiesgo) url += `riesgo=${filterRiesgo}&`;
      if (filterEstado) url += `estado=${filterEstado}&`;

      const [gerenRes, usersRes] = await Promise.all([
        fetch(url, { headers: { Authorization: `Bearer ${localStorage.getItem("adminToken")}` } }),
        getAdminUsuarios().catch(() => ({ data: [] }))
      ]);

      if (!gerenRes.ok) throw new Error("Error cargando gerenciamientos de viaje.");
      const gerenData = await gerenRes.json();
      setList(gerenData.data || []);
      setUsuariosAdmin(usersRes.data || []);
    } catch (err) {
      setError(err.message || "Error conectando con el servidor.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [filterRiesgo, filterEstado]);

  function handleSelectAutorizador(idStr) {
    setAutorizadorId(idStr);
    const found = usuariosAdmin.find((u) => String(u.id_usuarios_admin) === String(idStr));
    if (found) {
      setAutorizadorNombre(found.nombre || found.username);
    }
  }

  async function handleDecide(nuevoEstado) {
    if (nuevoEstado === "APROBADO" && !firmaAutorizador) {
      alert("Por favor realiza tu firma digital antes de aprobar.");
      return;
    }

    setApproving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/gerenciamiento-viajes/${selectedDoc.id_gerenciamiento}/decision`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("adminToken")}`
        },
        body: JSON.stringify({
          estado: nuevoEstado,
          idUsuarioAdmin: autorizadorId || user?.id_usuarios_admin || 1,
          nombreAutorizador: autorizadorNombre,
          firmaAutorizador: firmaAutorizador,
          observaciones: observaciones
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Error procesando solicitud.");

      alert(`Gerenciamiento de viaje ${nuevoEstado.toLowerCase()} exitosamente.`);
      setSelectedDoc(null);
      loadData();
    } catch (err) {
      alert(err.message);
    } finally {
      setApproving(false);
    }
  }

  // Generador del Formato Ajustado Exactamente a 1 Hoja Tamaña Carta (Letter Vertical)
  function openGerenciamientoPdfPreview(doc, autoPrint = true) {
    const printWindow = window.open("", "_blank", "width=980,height=1100");
    if (!printWindow) {
      alert("Habilita las ventanas emergentes en tu navegador para ver o descargar el PDF.");
      return;
    }

    const fechaPartes = String(doc.fecha_emision || "").split("T")[0].split("-");
    const anio = fechaPartes[0] || "2026";
    const mes = fechaPartes[1] || "09";
    const dia = fechaPartes[2] || "01";

    const horaPartes = String(doc.hora_salida || "08:00").split(":");
    const horaHH = horaPartes[0] || "08";
    const horaMM = horaPartes[1] || "00";

    const showSigQHSE = doc.firma_autorizador && (doc.nivel_riesgo === "BAJO" || !doc.nivel_riesgo);
    const showSigCoordinador = doc.firma_autorizador && doc.nivel_riesgo === "MEDIO";
    const showSigGerente = doc.firma_autorizador && doc.nivel_riesgo === "ALTO";

    const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>GERENCIAMIENTO DE VIAJE - ${doc.folio_documento || "SII-MX-23-LOG-003"}</title>
  <style>
    @page {
      size: letter portrait;
      margin: 4mm 5mm;
    }
    * { box-sizing: border-box; }
    html, body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 8.5px;
      color: #000;
      margin: 0;
      padding: 2px;
      line-height: 1.12;
      background: #fff;
    }
    .sheet-container {
      border: 1.5px solid #000;
      padding: 3px;
      width: 100%;
      max-width: 800px;
      margin: 0 auto;
      background: #fff;
    }

    /* Encabezado */
    .header-table { width: 100%; border-collapse: collapse; margin-bottom: 0; }
    .header-table td { border: 1px solid #000; padding: 2px 4px; text-align: center; vertical-align: middle; }
    .logo-cell { width: 22%; }
    .title-cell { width: 53%; font-weight: bold; font-size: 10.5px; }
    .meta-cell { width: 25%; font-size: 8px; text-align: left; }

    .banner-title {
      background: #d1d5db;
      font-weight: bold;
      text-align: center;
      font-size: 10.5px;
      padding: 2.5px;
      border: 1px solid #000;
      border-top: 0;
      text-transform: uppercase;
    }

    /* Tablas Generales */
    table.data-table { width: 100%; border-collapse: collapse; margin-bottom: 0; font-size: 8px; }
    table.data-table td, table.data-table th { border: 1px solid #000; padding: 1.8px 3.5px; text-align: left; }
    table.data-table th { background: #f3f4f6; font-weight: bold; }

    .section-header {
      background: #e5e7eb;
      font-weight: bold;
      text-align: center;
      font-size: 9px;
      padding: 2px;
      border: 1px solid #000;
      border-top: 0;
      text-transform: uppercase;
    }

    /* Tabuladores Grid 3 columnas */
    .risk-grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1.12fr;
      border: 1px solid #000;
      border-top: 0;
      font-size: 8px;
    }
    .risk-col { border-right: 1px solid #000; }
    .risk-col:last-child { border-right: 0; }

    .risk-header-bar {
      background: #fbbf24;
      font-weight: bold;
      text-align: center;
      border-bottom: 1px solid #000;
      padding: 1px;
      font-size: 8px;
    }

    .item-row {
      display: flex;
      justify-content: space-between;
      border-bottom: 1px solid #e5e7eb;
      padding: 1.2px 3px;
      font-size: 7.8px;
    }
    .item-row.selected { background: #fef08a; font-weight: bold; }

    /* Banner Clasificación */
    .class-banner {
      background: #fee2e2;
      border: 1px solid #000;
      border-top: 0;
      text-align: center;
      font-weight: bold;
      font-size: 7.5px;
      padding: 1.5px;
    }
    .class-grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      border: 1px solid #000;
      border-top: 0;
      font-size: 8px;
      text-align: center;
    }
    .class-box { border-right: 1px solid #000; padding: 2px; }
    .class-box:last-child { border-right: 0; }
    .class-box.green { background: #dcfce7; }
    .class-box.yellow { background: #fef9c3; }
    .class-box.red { background: #fee2e2; }
    .class-box.selected { border: 2px solid #000; font-weight: bold; }

    /* Firmas */
    .signatures-container { border: 1px solid #000; border-top: 0; padding: 3px; }
    .driver-sig-box { text-align: center; margin-bottom: 4px; }
    .authorizers-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px; text-align: center; margin-top: 2px; }
    .sig-line { border-top: 1px solid #000; width: 75%; margin: 2px auto 1px auto; font-weight: bold; font-size: 8px; }

    .footer-note { font-size: 7px; color: #dc2626; font-weight: bold; text-align: center; margin-top: 2px; }

    @media print {
      body { margin: 0; padding: 0; background: #fff; }
      .sheet-container { border: 1px solid #000; padding: 2px; width: 100% !important; max-width: 100% !important; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom: 8px; text-align: right; max-width: 800px; margin-left: auto; margin-right: auto;">
    <button onclick="window.print()" style="padding: 6px 14px; background: #0284c7; color: #fff; border: 0; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 12px;">
      🖨️ Imprimir / Guardar PDF (Hoja Carta Vertical)
    </button>
  </div>

  <div class="sheet-container">
    <!-- Encabezado Oficial -->
    <table class="header-table">
      <tr>
        <td class="logo-cell">
          <img src="${logoAQR}" alt="AQUARIO" style="max-height: 34px; object-fit: contain;" />
        </td>
        <td class="title-cell">
          CÓDIGO<br />
          R2PLOG1 / ${doc.folio_documento || "SII-MX-23-LOG-003"}
        </td>
        <td class="meta-cell">
          <strong>Sistema:</strong> SGI<br />
          <strong>Versión:</strong> ${doc.version_documento || "3.0"}<br />
          <strong>Página:</strong> 1 de 1
        </td>
      </tr>
    </table>

    <div class="banner-title">
      GERENCIAMIENTO DE VIAJE (FECHA DE EMISIÓN: ${dia}/${mes}/${anio})
    </div>

    <!-- DATOS DE ENCABEZADO -->
    <table class="data-table">
      <tr>
        <th style="width: 12%;">FECHA</th>
        <td style="width: 25%;">DÍA: <strong>${dia}</strong> / MES: <strong>${mes}</strong> / AÑO: <strong>${anio}</strong></td>
        <th style="width: 15%;">HORA DE SALIDA</th>
        <td style="width: 20%;">HORA: <strong>${horaHH}</strong> : <strong>${horaMM}</strong></td>
        <th style="width: 10%;">FOLIO</th>
        <td style="width: 18%;"><strong>${doc.folio_documento || "SII-MX-23-LOG-003"}</strong></td>
      </tr>
      <tr>
        <th>ORIGEN</th>
        <td colspan="2"><strong>${doc.origen_nombre || doc.origen_texto || "N/A"}</strong></td>
        <th>DESTINO</th>
        <td colspan="2"><strong>${doc.destino_nombre || doc.destino_texto || "N/A"}</strong></td>
      </tr>
      <tr>
        <th>DEPARTAMENTO</th>
        <td colspan="2">${doc.departamento || "Logística"}</td>
        <th>KILOMETRAJE</th>
        <td colspan="2"><strong>${doc.kilometraje || 0} km</strong></td>
      </tr>
    </table>

    <!-- 1. INFORMACIÓN GENERAL -->
    <div class="section-header">1. INFORMACIÓN GENERAL</div>
    <table class="data-table">
      <tr>
        <th style="width: 15%;">Tipo de vehículo</th>
        <td style="width: 25%;">${doc.tipo_vehiculo || "PickUp"}</td>
        <th style="width: 10%;">Placa</th>
        <td style="width: 15%;">${doc.placa || "N/A"}</td>
        <th style="width: 10%;">Modelo</th>
        <td style="width: 12%;">${doc.modelo || "N/A"}</td>
        <th style="width: 8%;">Color</th>
        <td style="width: 5%;">${doc.color || "N/A"}</td>
      </tr>
      <tr>
        <th>Vehículo empresa</th>
        <td>
          <span style="font-weight: bold;">[ ${doc.vehiculo_empresa !== false ? "X" : " "} ] SÍ</span> &nbsp;&nbsp;
          <span style="font-weight: bold;">[ ${doc.vehiculo_empresa === false ? "X" : " "} ] NO</span>
        </td>
        <th colspan="2">Nombre empresa contratista</th>
        <td colspan="2">${doc.nombre_contratista || "N/A (AQUARIO)"}</td>
        <th>No. Unidad</th>
        <td><strong>${doc.numero_unidad || "N/A"}</strong></td>
      </tr>
      <tr>
        <th>Conductor</th>
        <td colspan="3"><strong>${doc.nombre_conductor || doc.conductor_nombre}</strong></td>
        <th colspan="2">Tel. Celular</th>
        <td colspan="2">${doc.telefono_conductor || "N/A"}</td>
      </tr>
      <tr>
        <th>Número licencia</th>
        <td>${doc.licencia_numero || "N/A"}</td>
        <th>Tipo</th>
        <td>${doc.licencia_tipo || "Chofer"}</td>
        <th colspan="2">Fecha vencimiento</th>
        <td colspan="2">${doc.licencia_vencimiento ? String(doc.licencia_vencimiento).split("T")[0] : "N/A"}</td>
      </tr>
      <tr>
        <th>Ruta a seguir</th>
        <td colspan="4"><strong>${Array.isArray(doc.ruta_puntos) ? doc.ruta_puntos.join(" ➔ ") : (doc.ruta_puntos || "N/A")}</strong></td>
        <th colspan="2">Tiempo Viaje</th>
        <td>${doc.tiempo_viaje_horas || 1} hrs</td>
      </tr>
      <tr>
        <th>Acompañante(s)</th>
        <td colspan="7">${Array.isArray(doc.acompanantes) && doc.acompanantes.length ? doc.acompanantes.join(", ") : "Sin acompañantes"}</td>
      </tr>
    </table>

    <!-- Sitios de reporte -->
    <div style="background: #f9fafb; font-weight: bold; border: 1px solid #000; border-top: 0; padding: 1.5px 3px; font-size: 7.5px;">
      Sitios de reporte (para viajes superiores a 1 hora)
    </div>
    <table class="data-table">
      <tr>
        <th style="width: 10%;">Punto 1</th>
        <td style="width: 35%;">${doc.sitios_reporte?.[0]?.punto || "N/A"}</td>
        <th style="width: 8%;">Hora</th>
        <td style="width: 12%;">${doc.sitios_reporte?.[0]?.horaReportada || "--:--"}</td>
        <th style="width: 10%;">Punto 3</th>
        <td style="width: 35%;">${doc.sitios_reporte?.[2]?.punto || "N/A"}</td>
        <th style="width: 8%;">Hora</th>
        <td style="width: 12%;">${doc.sitios_reporte?.[2]?.horaReportada || "--:--"}</td>
      </tr>
      <tr>
        <th>Punto 2</th>
        <td>${doc.sitios_reporte?.[1]?.punto || "N/A"}</td>
        <th>Hora</th>
        <td>${doc.sitios_reporte?.[1]?.horaReportada || "--:--"}</td>
        <th>Punto 4</th>
        <td>${doc.sitios_reporte?.[3]?.punto || "N/A"}</td>
        <th>Hora</th>
        <td>${doc.sitios_reporte?.[3]?.horaReportada || "--:--"}</td>
      </tr>
    </table>

    <!-- 2. LISTA VERIFICACIÓN DE PREVIAJE -->
    <div class="section-header">2. LISTA VERIFICACIÓN DE PREVIAJE</div>
    <table class="data-table">
      <thead>
        <tr>
          <th style="width: 86%;">Pregunta de Control</th>
          <th style="width: 7%; text-align: center;">SI</th>
          <th style="width: 7%; text-align: center;">NO</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>1. ¿El conductor tiene conocimiento de los riesgos locales (vía, clima, peatones, animales)?</td>
          <td style="text-align: center; font-weight: bold;">${doc.conocimiento_riesgos_locales !== false ? "X" : ""}</td>
          <td style="text-align: center; font-weight: bold;">${doc.conocimiento_riesgos_locales === false ? "X" : ""}</td>
        </tr>
        <tr>
          <td>2. ¿El conductor ha consumido medicamentos que producen somnolencia o presenta padecimiento del sueño?</td>
          <td style="text-align: center; font-weight: bold;">${doc.medicamentos_somnolencia ? "X" : ""}</td>
          <td style="text-align: center; font-weight: bold;">${!doc.medicamentos_somnolencia ? "X" : ""}</td>
        </tr>
        <tr>
          <td>3. ¿El conductor ha dormido adecuadamente?</td>
          <td style="text-align: center; font-weight: bold;">${doc.dormido_adecuadamente !== false ? "X" : ""}</td>
          <td style="text-align: center; font-weight: bold;">${doc.dormido_adecuadamente === false ? "X" : ""}</td>
        </tr>
        <tr>
          <td>4. ¿El conductor está informado que es prohibido transportar personal ajeno a la empresa?</td>
          <td style="text-align: center; font-weight: bold;">${doc.prohibido_personal_ajeno !== false ? "X" : ""}</td>
          <td style="text-align: center; font-weight: bold;">${doc.prohibido_personal_ajeno === false ? "X" : ""}</td>
        </tr>
        <tr>
          <td>5. ¿Se realizó la inspección del vehículo con la lista de chequeo? (Anexar registro)</td>
          <td style="text-align: center; font-weight: bold;">${doc.inspeccion_vehiculo_realizada !== false ? "X" : ""}</td>
          <td style="text-align: center; font-weight: bold;">${doc.inspeccion_vehiculo_realizada === false ? "X" : ""}</td>
        </tr>
        <tr>
          <td>6. ¿Se realizó la reunión pre caravana? (Anexar registro) *Sólo para viajes de más de 1 vehículo</td>
          <td style="text-align: center; font-weight: bold;">${doc.reunion_pre_caravana_realizada ? "X" : ""}</td>
          <td style="text-align: center; font-weight: bold;">${!doc.reunion_pre_caravana_realizada ? "X" : ""}</td>
        </tr>
      </tbody>
    </table>

    <!-- 3. ANÁLISIS DE RIESGOS -->
    <div class="section-header">3. EVALUACIÓN DE RIESGO DE LA RUTA</div>
    <div class="risk-grid">
      <!-- Columna 1: A, D, G -->
      <div class="risk-col">
        <div class="risk-header-bar">A. Distancia a Recorrer / Ptos</div>
        <div class="item-row ${doc.pts_distancia === 1 ? 'selected' : ''}"><span>Menos de 50 Km</span><span>1</span></div>
        <div class="item-row ${doc.pts_distancia === 2 ? 'selected' : ''}"><span>Menos de 100 Km</span><span>2</span></div>
        <div class="item-row ${doc.pts_distancia === 5 ? 'selected' : ''}"><span>Menos de 200 Km</span><span>5</span></div>
        <div class="item-row ${doc.pts_distancia === 8 ? 'selected' : ''}"><span>Más de 200 Km</span><span>8</span></div>

        <div class="risk-header-bar" style="border-top: 1px solid #000;">D. Condiciones de la Vía / Ptos</div>
        <div class="item-row ${doc.pts_condiciones_via === 1 ? 'selected' : ''}"><span>Pavimentada</span><span>1</span></div>
        <div class="item-row ${doc.pts_condiciones_via === 2 ? 'selected' : ''}"><span>Mixta (&lt;50% No Pav.)</span><span>2</span></div>
        <div class="item-row ${doc.pts_condiciones_via === 4 ? 'selected' : ''}"><span>No Pavimentada</span><span>4</span></div>

        <div class="risk-header-bar" style="border-top: 1px solid #000;">G. Hora del Traslado / Ptos</div>
        <div class="item-row ${doc.pts_hora_traslado === 1 ? 'selected' : ''}"><span>Día (06:00 a 18:00 h)</span><span>1</span></div>
        <div class="item-row ${doc.pts_hora_traslado === 8 ? 'selected' : ''}"><span>Noche (18:00 a 06:00 h)</span><span>8</span></div>
      </div>

      <!-- Columna 2: B, E, Bloqueos -->
      <div class="risk-col">
        <div class="risk-header-bar">B. Clima / Ptos</div>
        <div class="item-row ${doc.pts_clima === 2 ? 'selected' : ''}"><span>Seco / Cond. normales</span><span>2</span></div>
        <div class="item-row ${doc.pts_clima === 4 ? 'selected' : ''}"><span>Lluvia suave</span><span>4</span></div>
        <div class="item-row ${doc.pts_clima === 8 ? 'selected' : ''}"><span>Lluvia fuerte/niebla</span><span>8</span></div>
        <div class="item-row ${doc.pts_clima === 10 ? 'selected' : ''}"><span>Nieve</span><span>10</span></div>

        <div class="risk-header-bar" style="border-top: 1px solid #000;">E. Comunicaciones / Ptos</div>
        <div class="item-row ${doc.pts_comunicaciones === 0 ? 'selected' : ''}"><span>Teléfono celular</span><span>0</span></div>
        <div class="item-row ${doc.pts_comunicaciones === 2 ? 'selected' : ''}"><span>Sin com. y caravana</span><span>2</span></div>
        <div class="item-row ${doc.pts_comunicaciones === 4 ? 'selected' : ''}"><span>Sin com. sin caravana</span><span>4</span></div>

        <div style="padding: 2px; background: #fee2e2; border-top: 1px solid #000; font-size: 7.5px; text-align: center;">
          <strong>Horas trabajo + Viaje &gt; 16h = NO CONDUCIR</strong>
        </div>
        <div style="padding: 2px; background: #fff3cd; font-size: 7.5px; border-top: 1px solid #000;">
          Manejo Nocturno (&gt;18h) requiere Aprobación GCO/QHSE.<br />
          <em>Obs: ${doc.observaciones || "Sin notas."}</em>
        </div>
      </div>

      <!-- Columna 3: C, F, EVALUACIÓN TOTAL -->
      <div class="risk-col">
        <div class="risk-header-bar">C. Vehículos y personas / Ptos</div>
        <div class="item-row ${doc.pts_vehiculos_personas === 1 ? 'selected' : ''}"><span>2+ Vehi. 2+ pers.</span><span>1</span></div>
        <div class="item-row ${doc.pts_vehiculos_personas === 2 ? 'selected' : ''}"><span>2+ Vehi. 1+ pers.</span><span>2</span></div>
        <div class="item-row ${doc.pts_vehiculos_personas === 3 ? 'selected' : ''}"><span>1Vehi. 2+ pers.</span><span>3</span></div>
        <div class="item-row ${doc.pts_vehiculos_personas === 6 ? 'selected' : ''}"><span>1Vehi. 1 pers.</span><span>6</span></div>

        <div class="risk-header-bar" style="border-top: 1px solid #000;">F. Hrs. trabajadas + Viaje / Ptos</div>
        <div class="item-row ${doc.pts_horas_trabajadas === 1 ? 'selected' : ''}"><span>Hrs. trab. + Viaje =&lt;12</span><span>1</span></div>
        <div class="item-row ${doc.pts_horas_trabajadas === 3 ? 'selected' : ''}"><span>Hrs. trab. + Viaje =&lt;14</span><span>3</span></div>
        <div class="item-row ${doc.pts_horas_trabajadas === 6 ? 'selected' : ''}"><span>Hrs. Trab. + Viaje =&lt;16</span><span>6</span></div>

        <div style="background: #e5e7eb; font-weight: bold; text-align: center; border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 1.5px; font-size: 8px;">
          EVALUACIÓN DEL VIAJE
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; padding: 2px; font-size: 7.5px; background: #ffffff;">
          <div>
            <div>A: ${doc.pts_distancia || 1}</div>
            <div>B: ${doc.pts_clima || 2}</div>
            <div>C: ${doc.pts_vehiculos_personas || 1}</div>
            <div>D: ${doc.pts_condiciones_via || 1}</div>
            <div>E: ${doc.pts_comunicaciones || 0}</div>
            <div>F: ${doc.pts_horas_trabajadas || 1}</div>
            <div>G: ${doc.pts_hora_traslado || 1}</div>
          </div>
          <div style="display: flex; flex-direction: column; justify-content: center; align-items: center; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 3px; padding: 2px;">
            <strong style="font-size: 0.9rem;">${doc.puntaje_total} pts</strong>
            <span style="padding: 1px 4px; border-radius: 8px; color: #fff; font-size: 0.62rem; font-weight: bold; background: ${doc.nivel_riesgo === 'ALTO' ? '#dc2626' : doc.nivel_riesgo === 'MEDIO' ? '#ca8a04' : '#16a34a'};">
              RIESGO ${doc.nivel_riesgo}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Banner Clasificación -->
    <div class="class-banner">
      NOTA: DE ACUERDO AL PUNTAJE OBTENIDO SE DEBE SOLICITAR LA APROBACIÓN CORRESPONDIENTE SEGÚN LA SIGUIENTE CLASIFICACIÓN
    </div>
    <div class="class-grid">
      <div class="class-box green ${doc.nivel_riesgo === 'BAJO' ? 'selected' : ''}">
        <strong>RIESGO BAJO (0 A 15 PUNTOS)</strong><br />
        AUTORIZA SUPERVISOR DIRECTO Y QHSE
      </div>
      <div class="class-box yellow ${doc.nivel_riesgo === 'MEDIO' ? 'selected' : ''}">
        <strong>RIESGO MEDIO (16 A 22 PUNTOS)</strong><br />
        COORDINACIONES DE AREA
      </div>
      <div class="class-box red ${doc.nivel_riesgo === 'ALTO' ? 'selected' : ''}">
        <strong>RIESGO ALTO (&gt; 23 PUNTOS)</strong><br />
        AUTORIZA GERENCIA GENERAL
      </div>
    </div>

    <!-- FIRMAS Y AUTORIZACIONES (SOLO 1 FIRMA SEGÚN RIESGO) -->
    <div class="signatures-container">
      <div class="driver-sig-box">
        ${doc.firma_conductor ? `<img src="${doc.firma_conductor}" style="max-height: 36px; display: block; margin: 0 auto;" alt="Firma Conductor" />` : '<div style="height: 30px;">[Sin Firma Conductor]</div>'}
        <div class="sig-line">${doc.nombre_conductor_firma || doc.nombre_conductor || "NOMBRE Y FIRMA CONDUCTOR"}</div>
        <small style="font-weight: bold;">CONDUCTOR</small>
      </div>

      <div class="authorizers-grid">
        <div>
          ${showSigQHSE ? `<img src="${doc.firma_autorizador}" style="max-height: 32px; display: block; margin: 0 auto;" alt="Firma QHSE" /><div class="sig-line">${doc.nombre_autorizador_firma || "NOMBRE Y FIRMA"}</div>` : '<div style="height: 30px;"></div><div class="sig-line">NOMBRE Y FIRMA</div>'}
          <small style="font-weight: bold;">SUPERVISOR DIRECTO / QHSE</small>
        </div>
        <div>
          ${showSigCoordinador ? `<img src="${doc.firma_autorizador}" style="max-height: 32px; display: block; margin: 0 auto;" alt="Firma Coordinador" /><div class="sig-line">${doc.nombre_autorizador_firma || "NOMBRE Y FIRMA"}</div>` : '<div style="height: 30px;"></div><div class="sig-line">NOMBRE Y FIRMA</div>'}
          <small style="font-weight: bold;">AUTORIDAD DE ÁREA / COORDINACIÓN</small>
        </div>
        <div>
          ${showSigGerente ? `<img src="${doc.firma_autorizador}" style="max-height: 32px; display: block; margin: 0 auto;" alt="Firma Gerente" /><div class="sig-line">${doc.nombre_autorizador_firma || "NOMBRE Y FIRMA"}</div>` : '<div style="height: 30px;"></div><div class="sig-line">NOMBRE Y FIRMA</div>'}
          <small style="font-weight: bold;">GERENTE DE ÁREA</small>
        </div>
      </div>
    </div>

    <div class="footer-note">
      NOTA: Un Gerenciamiento de Viajes debe ser preparado para todos los viajes: Superiores a 50 Km, en áreas remotas o bajo condiciones adversas, hacia o desde locaciones en campo con el cliente.
    </div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        ${autoPrint ? "window.print();" : ""}
      }, 300);
    };
  </script>
</body>
</html>
`;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  }

  function formatDate(value) {
    return value ? new Date(value).toLocaleString("es-MX") : "—";
  }

  return (
    <>
      {/* Filtros idénticos al diseño del proyecto */}
      <div style={{ display: "flex", gap: "14px", background: "#ffffff", padding: "12px 16px", borderRadius: "8px", border: "1px solid #e2e8f0", marginBottom: "16px" }}>
        <label style={{ fontSize: "0.85rem", fontWeight: "bold", display: "flex", alignItems: "center", gap: "8px" }}>
          Nivel de Riesgo:
          <select value={filterRiesgo} onChange={(e) => setFilterRiesgo(e.target.value)} style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
            <option value="">Todos los Riesgos</option>
            <option value="BAJO">🟢 Riesgo Bajo (0-15)</option>
            <option value="MEDIO">🟡 Riesgo Medio (16-22)</option>
            <option value="ALTO">🔴 Riesgo Alto (&gt;23)</option>
          </select>
        </label>

        <label style={{ fontSize: "0.85rem", fontWeight: "bold", display: "flex", alignItems: "center", gap: "8px" }}>
          Estado:
          <select value={filterEstado} onChange={(e) => setFilterEstado(e.target.value)} style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
            <option value="">Todos los Estados</option>
            <option value="PENDIENTE">⏳ Pendientes</option>
            <option value="APROBADO">✅ Aprobados</option>
            <option value="RECHAZADO">❌ Rechazados</option>
          </select>
        </label>

        <button onClick={loadData} className="secondary-button" style={{ marginLeft: "auto" }}>
          🔄 Actualizar
        </button>
      </div>

      <section className="table-panel">
        {loading ? (
          <p className="table-status">Cargando gerenciamientos...</p>
        ) : error ? (
          <p style={{ color: "#dc2626", padding: "16px" }}>{error}</p>
        ) : list.length === 0 ? (
          <p className="table-status">No se encontraron documentos de gerenciamiento de viaje registrados.</p>
        ) : (
          <div className="table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Folio</th>
                  <th>Unidad</th>
                  <th>Conductor</th>
                  <th>Enviado</th>
                  <th>Estado</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {list.map((item) => {
                  const estadoNormalized = item.estado === "APROBADO" ? "aprobada" : item.estado === "RECHAZADO" ? "rechazada" : "pendiente_aprobacion";

                  return (
                    <tr key={item.id_gerenciamiento}>
                      <td>
                        <strong>{item.folio_documento} #{item.id_gerenciamiento}</strong>
                        <small style={{ display: "block", color: "#64748b" }}>
                          Ruta: {item.origen_nombre || item.origen_texto || "Origen"} ➔ {item.destino_nombre || item.destino_texto || "Destino"}
                        </small>
                      </td>
                      <td>
                        {item.tipo_vehiculo || "Vehículo"}
                        <small style={{ display: "block" }}>{item.numero_unidad || item.placa || "N/A"}</small>
                      </td>
                      <td>{item.nombre_conductor || item.conductor_nombre}</td>
                      <td>{formatDate(item.creado_en || item.fecha_emision)}</td>
                      <td>
                        <span className={`inspection-status inspection-status-${estadoNormalized}`}>
                          {item.estado === "APROBADO" ? "APROBADO" : item.estado === "RECHAZADO" ? "RECHAZADO" : "PENDIENTE"}
                        </span>
                        <small style={{ display: "block", fontSize: "0.72rem", color: "#475569", marginTop: "2px" }}>
                          {item.nivel_riesgo} ({item.puntaje_total} pts)
                        </small>
                      </td>
                      <td style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                        <button className="secondary-button" onClick={() => { setSelectedDoc(item); setFirmaAutorizador(""); setObservaciones(item.observaciones || ""); setAutorizadorNombre(item.nombre_autorizador_firma || user?.nombre || user?.username || ""); }}>
                          Ver revisión
                        </button>
                        <button className="secondary-button" onClick={() => openGerenciamientoPdfPreview(item, true)}>
                          PDF
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Modal con Hoja Completa Oficial SII-MX-23-LOG-003 */}
      {selectedDoc && (
        <div className="modal-overlay" onMouseDown={() => setSelectedDoc(null)}>
          <section className="modal-card inspection-detail-modal" onMouseDown={(e) => e.stopPropagation()} style={{ maxWidth: "860px", width: "100%", maxHeight: "94vh", overflowY: "auto" }}>
            <div className="form-panel-header">
              <div>
                <h2>Gerenciamiento {selectedDoc.folio_documento}</h2>
                <p>{selectedDoc.nombre_conductor} · {selectedDoc.tipo_vehiculo} ({selectedDoc.numero_unidad || selectedDoc.placa})</p>
              </div>
              <button className="close-button" onClick={() => setSelectedDoc(null)}>×</button>
            </div>

            {/* HOJA COMPLETA SII-MX-23-LOG-003 v3.0 EN EL MODAL */}
            <div style={{ border: "1.5px solid #000", padding: "6px", background: "#ffffff", fontSize: "0.78rem", marginBottom: "16px" }}>
              
              {/* Encabezado */}
              <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 0 }}>
                <tbody>
                  <tr>
                    <td style={{ border: "1px solid #000", padding: "4px", width: "22%", textAlign: "center" }}>
                      <img src={logoAQR} alt="AQUARIO" style={{ maxHeight: "34px" }} />
                    </td>
                    <td style={{ border: "1px solid #000", padding: "4px", width: "53%", textAlign: "center", fontWeight: "bold", fontSize: "0.9rem" }}>
                      CÓDIGO R2PLOG1 / {selectedDoc.folio_documento}
                    </td>
                    <td style={{ border: "1px solid #000", padding: "4px", width: "25%", fontSize: "0.72rem" }}>
                      <strong>Sistema:</strong> SGI<br />
                      <strong>Versión:</strong> {selectedDoc.version_documento || "3.0"}<br />
                      <strong>Página:</strong> 1 de 1
                    </td>
                  </tr>
                </tbody>
              </table>

              <div style={{ background: "#d1d5db", fontWeight: "bold", textAlign: "center", fontSize: "0.85rem", padding: "3px", border: "1px solid #000", borderTop: 0, textTransform: "uppercase" }}>
                GERENCIAMIENTO DE VIAJE (FECHA DE EMISIÓN: {String(selectedDoc.fecha_emision || "").split("T")[0]})
              </div>

              {/* Metadata */}
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.72rem" }}>
                <tbody>
                  <tr>
                    <th style={{ border: "1px solid #000", background: "#f3f4f6", padding: "2px 4px" }}>Origen</th>
                    <td style={{ border: "1px solid #000", padding: "2px 4px" }} colSpan={2}><strong>{selectedDoc.origen_nombre || selectedDoc.origen_texto}</strong></td>
                    <th style={{ border: "1px solid #000", background: "#f3f4f6", padding: "2px 4px" }}>Destino</th>
                    <td style={{ border: "1px solid #000", padding: "2px 4px" }} colSpan={2}><strong>{selectedDoc.destino_nombre || selectedDoc.destino_texto}</strong></td>
                  </tr>
                  <tr>
                    <th style={{ border: "1px solid #000", background: "#f3f4f6", padding: "2px 4px" }}>Departamento</th>
                    <td style={{ border: "1px solid #000", padding: "2px 4px" }} colSpan={2}>{selectedDoc.departamento || "Logística"}</td>
                    <th style={{ border: "1px solid #000", background: "#f3f4f6", padding: "2px 4px" }}>Kilometraje</th>
                    <td style={{ border: "1px solid #000", padding: "2px 4px" }} colSpan={2}><strong>{selectedDoc.kilometraje || 0} km</strong></td>
                  </tr>
                </tbody>
              </table>

              {/* 1. INFORMACIÓN GENERAL */}
              <div style={{ background: "#e5e7eb", fontWeight: "bold", textAlign: "center", fontSize: "0.78rem", padding: "2px", border: "1px solid #000", borderTop: 0 }}>
                1. INFORMACIÓN GENERAL
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.72rem" }}>
                <tbody>
                  <tr>
                    <th style={{ border: "1px solid #000", background: "#f3f4f6", padding: "2px 4px" }}>Tipo de vehículo</th>
                    <td style={{ border: "1px solid #000", padding: "2px 4px" }}>{selectedDoc.tipo_vehiculo || "PickUp"}</td>
                    <th style={{ border: "1px solid #000", background: "#f3f4f6", padding: "2px 4px" }}>Placa</th>
                    <td style={{ border: "1px solid #000", padding: "2px 4px" }}>{selectedDoc.placa || "N/A"}</td>
                    <th style={{ border: "1px solid #000", background: "#f3f4f6", padding: "2px 4px" }}>Modelo</th>
                    <td style={{ border: "1px solid #000", padding: "2px 4px" }}>{selectedDoc.modelo || "N/A"}</td>
                    <th style={{ border: "1px solid #000", background: "#f3f4f6", padding: "2px 4px" }}>Color</th>
                    <td style={{ border: "1px solid #000", padding: "2px 4px" }}>{selectedDoc.color || "N/A"}</td>
                  </tr>
                  <tr>
                    <th style={{ border: "1px solid #000", background: "#f3f4f6", padding: "2px 4px" }}>Vehículo empresa</th>
                    <td style={{ border: "1px solid #000", padding: "2px 4px" }}>
                      <strong>[{selectedDoc.vehiculo_empresa !== false ? "X" : " "}] SÍ</strong> &nbsp;
                      <strong>[{selectedDoc.vehiculo_empresa === false ? "X" : " "}] NO</strong>
                    </td>
                    <th style={{ border: "1px solid #000", background: "#f3f4f6", padding: "2px 4px" }} colSpan={2}>Nombre empresa contratista</th>
                    <td style={{ border: "1px solid #000", padding: "2px 4px" }} colSpan={2}>{selectedDoc.nombre_contratista || "N/A (AQUARIO)"}</td>
                    <th style={{ border: "1px solid #000", background: "#f3f4f6", padding: "2px 4px" }}>No. Unidad</th>
                    <td style={{ border: "1px solid #000", padding: "2px 4px" }}><strong>{selectedDoc.numero_unidad || "N/A"}</strong></td>
                  </tr>
                  <tr>
                    <th style={{ border: "1px solid #000", background: "#f3f4f6", padding: "2px 4px" }}>Conductor</th>
                    <td style={{ border: "1px solid #000", padding: "2px 4px" }} colSpan={3}><strong>{selectedDoc.nombre_conductor || selectedDoc.conductor_nombre}</strong></td>
                    <th style={{ border: "1px solid #000", background: "#f3f4f6", padding: "2px 4px" }} colSpan={2}>Tel. Celular</th>
                    <td style={{ border: "1px solid #000", padding: "2px 4px" }} colSpan={2}>{selectedDoc.telefono_conductor || "N/A"}</td>
                  </tr>
                  <tr>
                    <th style={{ border: "1px solid #000", background: "#f3f4f6", padding: "2px 4px" }}>Número licencia</th>
                    <td style={{ border: "1px solid #000", padding: "2px 4px" }}>{selectedDoc.licencia_numero || "N/A"}</td>
                    <th style={{ border: "1px solid #000", background: "#f3f4f6", padding: "2px 4px" }}>Tipo</th>
                    <td style={{ border: "1px solid #000", padding: "2px 4px" }}>{selectedDoc.licencia_tipo || "Chofer"}</td>
                    <th style={{ border: "1px solid #000", background: "#f3f4f6", padding: "2px 4px" }} colSpan={2}>Fecha vencimiento</th>
                    <td style={{ border: "1px solid #000", padding: "2px 4px" }} colSpan={2}>{selectedDoc.licencia_vencimiento ? String(selectedDoc.licencia_vencimiento).split("T")[0] : "N/A"}</td>
                  </tr>
                  <tr>
                    <th style={{ border: "1px solid #000", background: "#f3f4f6", padding: "2px 4px" }}>Ruta a seguir</th>
                    <td style={{ border: "1px solid #000", padding: "2px 4px" }} colSpan={4}><strong>{Array.isArray(selectedDoc.ruta_puntos) ? selectedDoc.ruta_puntos.join(" ➔ ") : (selectedDoc.ruta_puntos || "N/A")}</strong></td>
                    <th style={{ border: "1px solid #000", background: "#f3f4f6", padding: "2px 4px" }} colSpan={2}>Tiempo Viaje</th>
                    <td style={{ border: "1px solid #000", padding: "2px 4px" }}>{selectedDoc.tiempo_viaje_horas || 1} hrs</td>
                  </tr>
                  <tr>
                    <th style={{ border: "1px solid #000", background: "#f3f4f6", padding: "2px 4px" }}>Acompañante(s)</th>
                    <td style={{ border: "1px solid #000", padding: "2px 4px" }} colSpan={7}>{Array.isArray(selectedDoc.acompanantes) && selectedDoc.acompanantes.length ? selectedDoc.acompanantes.join(", ") : "Sin acompañantes"}</td>
                  </tr>
                </tbody>
              </table>

              {/* Sitios de reporte */}
              <div style={{ background: "#f9fafb", fontWeight: "bold", border: "1px solid #000", borderTop: 0, padding: "2px 4px", fontSize: "0.7rem" }}>
                Sitios de reporte (para viajes superiores a 1 hora)
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.7rem" }}>
                <tbody>
                  <tr>
                    <th style={{ border: "1px solid #000", background: "#f3f4f6", padding: "2px 4px" }}>Punto 1</th>
                    <td style={{ border: "1px solid #000", padding: "2px 4px" }}>{selectedDoc.sitios_reporte?.[0]?.punto || "N/A"}</td>
                    <th style={{ border: "1px solid #000", background: "#f3f4f6", padding: "2px 4px" }}>Hora</th>
                    <td style={{ border: "1px solid #000", padding: "2px 4px" }}>{selectedDoc.sitios_reporte?.[0]?.horaReportada || "--:--"}</td>
                    <th style={{ border: "1px solid #000", background: "#f3f4f6", padding: "2px 4px" }}>Punto 3</th>
                    <td style={{ border: "1px solid #000", padding: "2px 4px" }}>{selectedDoc.sitios_reporte?.[2]?.punto || "N/A"}</td>
                    <th style={{ border: "1px solid #000", background: "#f3f4f6", padding: "2px 4px" }}>Hora</th>
                    <td style={{ border: "1px solid #000", padding: "2px 4px" }}>{selectedDoc.sitios_reporte?.[2]?.horaReportada || "--:--"}</td>
                  </tr>
                  <tr>
                    <th style={{ border: "1px solid #000", background: "#f3f4f6", padding: "2px 4px" }}>Punto 2</th>
                    <td style={{ border: "1px solid #000", padding: "2px 4px" }}>{selectedDoc.sitios_reporte?.[1]?.punto || "N/A"}</td>
                    <th style={{ border: "1px solid #000", background: "#f3f4f6", padding: "2px 4px" }}>Hora</th>
                    <td style={{ border: "1px solid #000", padding: "2px 4px" }}>{selectedDoc.sitios_reporte?.[1]?.horaReportada || "--:--"}</td>
                    <th style={{ border: "1px solid #000", background: "#f3f4f6", padding: "2px 4px" }}>Punto 4</th>
                    <td style={{ border: "1px solid #000", padding: "2px 4px" }}>{selectedDoc.sitios_reporte?.[3]?.punto || "N/A"}</td>
                    <th style={{ border: "1px solid #000", background: "#f3f4f6", padding: "2px 4px" }}>Hora</th>
                    <td style={{ border: "1px solid #000", padding: "2px 4px" }}>{selectedDoc.sitios_reporte?.[3]?.horaReportada || "--:--"}</td>
                  </tr>
                </tbody>
              </table>

              {/* 2. LISTA VERIFICACIÓN DE PREVIAJE */}
              <div style={{ background: "#e5e7eb", fontWeight: "bold", textAlign: "center", padding: "2px", border: "1px solid #000", borderTop: 0, fontSize: "0.78rem" }}>
                2. LISTA VERIFICACIÓN DE PREVIAJE
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.7rem" }}>
                <thead>
                  <tr>
                    <th style={{ border: "1px solid #000", background: "#f3f4f6", padding: "2px 4px", textAlign: "left" }}>Pregunta de Control</th>
                    <th style={{ border: "1px solid #000", background: "#f3f4f6", padding: "2px 4px", width: "8%", textAlign: "center" }}>SI</th>
                    <th style={{ border: "1px solid #000", background: "#f3f4f6", padding: "2px 4px", width: "8%", textAlign: "center" }}>NO</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ border: "1px solid #000", padding: "2px 4px" }}>1. ¿El conductor tiene conocimiento de los riesgos locales (vía, clima, peatones, animales)?</td>
                    <td style={{ border: "1px solid #000", padding: "2px 4px", textAlign: "center", fontWeight: "bold" }}>{selectedDoc.conocimiento_riesgos_locales !== false ? "X" : ""}</td>
                    <td style={{ border: "1px solid #000", padding: "2px 4px", textAlign: "center", fontWeight: "bold" }}>{selectedDoc.conocimiento_riesgos_locales === false ? "X" : ""}</td>
                  </tr>
                  <tr>
                    <td style={{ border: "1px solid #000", padding: "2px 4px" }}>2. ¿El conductor ha consumido medicamentos que producen somnolencia o presenta padecimiento del sueño?</td>
                    <td style={{ border: "1px solid #000", padding: "2px 4px", textAlign: "center", fontWeight: "bold" }}>{selectedDoc.medicamentos_somnolencia ? "X" : ""}</td>
                    <td style={{ border: "1px solid #000", padding: "2px 4px", textAlign: "center", fontWeight: "bold" }}>{!selectedDoc.medicamentos_somnolencia ? "X" : ""}</td>
                  </tr>
                  <tr>
                    <td style={{ border: "1px solid #000", padding: "2px 4px" }}>3. ¿El conductor ha dormido adecuadamente?</td>
                    <td style={{ border: "1px solid #000", padding: "2px 4px", textAlign: "center", fontWeight: "bold" }}>{selectedDoc.dormido_adecuadamente !== false ? "X" : ""}</td>
                    <td style={{ border: "1px solid #000", padding: "2px 4px", textAlign: "center", fontWeight: "bold" }}>{selectedDoc.dormido_adecuadamente === false ? "X" : ""}</td>
                  </tr>
                  <tr>
                    <td style={{ border: "1px solid #000", padding: "2px 4px" }}>4. ¿El conductor está informado que es prohibido transportar personal ajeno a la empresa?</td>
                    <td style={{ border: "1px solid #000", padding: "2px 4px", textAlign: "center", fontWeight: "bold" }}>{selectedDoc.prohibido_personal_ajeno !== false ? "X" : ""}</td>
                    <td style={{ border: "1px solid #000", padding: "2px 4px", textAlign: "center", fontWeight: "bold" }}>{selectedDoc.prohibido_personal_ajeno === false ? "X" : ""}</td>
                  </tr>
                  <tr>
                    <td style={{ border: "1px solid #000", padding: "2px 4px" }}>5. ¿Se realizó la inspección del vehículo con la lista de chequeo? (Anexar registro)</td>
                    <td style={{ border: "1px solid #000", padding: "2px 4px", textAlign: "center", fontWeight: "bold" }}>{selectedDoc.inspeccion_vehiculo_realizada !== false ? "X" : ""}</td>
                    <td style={{ border: "1px solid #000", padding: "2px 4px", textAlign: "center", fontWeight: "bold" }}>{selectedDoc.inspeccion_vehiculo_realizada === false ? "X" : ""}</td>
                  </tr>
                  <tr>
                    <td style={{ border: "1px solid #000", padding: "2px 4px" }}>6. ¿Se realizó la reunión pre caravana? (Anexar registro) *Sólo para viajes de más de 1 vehículo</td>
                    <td style={{ border: "1px solid #000", padding: "2px 4px", textAlign: "center", fontWeight: "bold" }}>{selectedDoc.reunion_pre_caravana_realizada ? "X" : ""}</td>
                    <td style={{ border: "1px solid #000", padding: "2px 4px", textAlign: "center", fontWeight: "bold" }}>{!selectedDoc.reunion_pre_caravana_realizada ? "X" : ""}</td>
                  </tr>
                </tbody>
              </table>

              {/* 3. EVALUACIÓN DE RIESGO DE LA RUTA */}
              <div style={{ background: "#e5e7eb", fontWeight: "bold", textAlign: "center", padding: "2px", border: "1px solid #000", borderTop: 0, fontSize: "0.78rem" }}>
                3. EVALUACIÓN DE RIESGO DE LA RUTA
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.15fr", border: "1px solid #000", borderTop: 0, fontSize: "0.7rem" }}>
                {/* Columna A, D, G */}
                <div style={{ borderRight: "1px solid #000" }}>
                  <div style={{ background: "#fbbf24", fontWeight: "bold", textAlign: "center", padding: "1.5px", borderBottom: "1px solid #000" }}>A. Distancia a Recorrer / Ptos</div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "1.5px 3px", background: selectedDoc.pts_distancia === 1 ? "#fef08a" : "transparent" }}><span>Menos de 50 Km</span><span>1</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "1.5px 3px", background: selectedDoc.pts_distancia === 2 ? "#fef08a" : "transparent" }}><span>Menos de 100 Km</span><span>2</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "1.5px 3px", background: selectedDoc.pts_distancia === 5 ? "#fef08a" : "transparent" }}><span>Menos de 200 Km</span><span>5</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "1.5px 3px", background: selectedDoc.pts_distancia === 8 ? "#fef08a" : "transparent" }}><span>Más de 200 Km</span><span>8</span></div>

                  <div style={{ background: "#fbbf24", fontWeight: "bold", textAlign: "center", padding: "1.5px", borderTop: "1px solid #000", borderBottom: "1px solid #000" }}>D. Condiciones de la Vía / Ptos</div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "1.5px 3px", background: selectedDoc.pts_condiciones_via === 1 ? "#fef08a" : "transparent" }}><span>Pavimentada</span><span>1</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "1.5px 3px", background: selectedDoc.pts_condiciones_via === 2 ? "#fef08a" : "transparent" }}><span>Mixta (&lt;50% No Pav.)</span><span>2</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "1.5px 3px", background: selectedDoc.pts_condiciones_via === 4 ? "#fef08a" : "transparent" }}><span>No Pavimentada</span><span>4</span></div>

                  <div style={{ background: "#fbbf24", fontWeight: "bold", textAlign: "center", padding: "1.5px", borderTop: "1px solid #000", borderBottom: "1px solid #000" }}>G. Hora del Traslado / Ptos</div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "1.5px 3px", background: selectedDoc.pts_hora_traslado === 1 ? "#fef08a" : "transparent" }}><span>Día (06:00 a 18:00 h)</span><span>1</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "1.5px 3px", background: selectedDoc.pts_hora_traslado === 8 ? "#fef08a" : "transparent" }}><span>Noche (18:00 a 06:00 h)</span><span>8</span></div>
                </div>

                {/* Columna B, E */}
                <div style={{ borderRight: "1px solid #000" }}>
                  <div style={{ background: "#fbbf24", fontWeight: "bold", textAlign: "center", padding: "1.5px", borderBottom: "1px solid #000" }}>B. Clima / Ptos</div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "1.5px 3px", background: selectedDoc.pts_clima === 2 ? "#fef08a" : "transparent" }}><span>Seco / Cond. normales</span><span>2</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "1.5px 3px", background: selectedDoc.pts_clima === 4 ? "#fef08a" : "transparent" }}><span>Lluvia suave</span><span>4</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "1.5px 3px", background: selectedDoc.pts_clima === 8 ? "#fef08a" : "transparent" }}><span>Lluvia fuerte/niebla</span><span>8</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "1.5px 3px", background: selectedDoc.pts_clima === 10 ? "#fef08a" : "transparent" }}><span>Nieve</span><span>10</span></div>

                  <div style={{ background: "#fbbf24", fontWeight: "bold", textAlign: "center", padding: "1.5px", borderTop: "1px solid #000", borderBottom: "1px solid #000" }}>E. Comunicaciones / Ptos</div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "1.5px 3px", background: selectedDoc.pts_comunicaciones === 0 ? "#fef08a" : "transparent" }}><span>Teléfono celular</span><span>0</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "1.5px 3px", background: selectedDoc.pts_comunicaciones === 2 ? "#fef08a" : "transparent" }}><span>Sin com. y caravana</span><span>2</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "1.5px 3px", background: selectedDoc.pts_comunicaciones === 4 ? "#fef08a" : "transparent" }}><span>Sin com. sin caravana</span><span>4</span></div>

                  <div style={{ background: "#fee2e2", padding: "2.5px", fontSize: "0.68rem", borderTop: "1px solid #000", textAlign: "center" }}>
                    <strong>Horas trabajo + Viaje &gt; 16h = NO CONDUCIR</strong>
                  </div>
                  <div style={{ background: "#fff3cd", padding: "2.5px", fontSize: "0.68rem", borderTop: "1px solid #000" }}>
                    Manejo Nocturno (&gt;18h) requiere Aprobación GCO/QHSE.
                  </div>
                </div>

                {/* Columna C, F, EVALUACIÓN TOTAL */}
                <div>
                  <div style={{ background: "#fbbf24", fontWeight: "bold", textAlign: "center", padding: "1.5px", borderBottom: "1px solid #000" }}>C. Vehículos y personas / Ptos</div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "1.5px 3px", background: selectedDoc.pts_vehiculos_personas === 1 ? "#fef08a" : "transparent" }}><span>2+ Vehi. 2+ pers.</span><span>1</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "1.5px 3px", background: selectedDoc.pts_vehiculos_personas === 2 ? "#fef08a" : "transparent" }}><span>2+ Vehi. 1+ pers.</span><span>2</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "1.5px 3px", background: selectedDoc.pts_vehiculos_personas === 3 ? "#fef08a" : "transparent" }}><span>1Vehi. 2+ pers.</span><span>3</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "1.5px 3px", background: selectedDoc.pts_vehiculos_personas === 6 ? "#fef08a" : "transparent" }}><span>1Vehi. 1 pers.</span><span>6</span></div>

                  <div style={{ background: "#fbbf24", fontWeight: "bold", textAlign: "center", padding: "1.5px", borderTop: "1px solid #000", borderBottom: "1px solid #000" }}>F. Hrs. trabajadas + Viaje / Ptos</div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "1.5px 3px", background: selectedDoc.pts_horas_trabajadas === 1 ? "#fef08a" : "transparent" }}><span>Hrs. trab. + Viaje =&lt;12</span><span>1</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "1.5px 3px", background: selectedDoc.pts_horas_trabajadas === 3 ? "#fef08a" : "transparent" }}><span>Hrs. trab. + Viaje =&lt;14</span><span>3</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "1.5px 3px", background: selectedDoc.pts_horas_trabajadas === 6 ? "#fef08a" : "transparent" }}><span>Hrs. Trab. + Viaje =&lt;16</span><span>6</span></div>

                  <div style={{ background: "#e5e7eb", fontWeight: "bold", textAlign: "center", borderTop: "1px solid #000", borderBottom: "1px solid #000", padding: "1.5px", fontSize: "0.78rem" }}>
                    EVALUACIÓN DEL VIAJE
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", padding: "2px", fontSize: "0.7rem", background: "#ffffff" }}>
                    <div>
                      <div>A: {selectedDoc.pts_distancia || 1}</div>
                      <div>B: {selectedDoc.pts_clima || 2}</div>
                      <div>C: {selectedDoc.pts_vehiculos_personas || 1}</div>
                      <div>D: {selectedDoc.pts_condiciones_via || 1}</div>
                      <div>E: {selectedDoc.pts_comunicaciones || 0}</div>
                      <div>F: {selectedDoc.pts_horas_trabajadas || 1}</div>
                      <div>G: {selectedDoc.pts_hora_traslado || 1}</div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: "3px", padding: "2px" }}>
                      <strong style={{ fontSize: "0.9rem" }}>{selectedDoc.puntaje_total} pts</strong>
                      <span style={{ padding: "1px 4px", borderRadius: "8px", color: "#fff", fontSize: "0.62rem", fontWeight: "bold", marginTop: "1px", background: selectedDoc.nivel_riesgo === 'ALTO' ? '#dc2626' : selectedDoc.nivel_riesgo === 'MEDIO' ? '#ca8a04' : '#16a34a' }}>
                        RIESGO {selectedDoc.nivel_riesgo}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Banner Clasificación */}
              <div style={{ background: "#fee2e2", border: "1px solid #000", borderTop: 0, textAlign: "center", fontWeight: "bold", fontSize: "0.68rem", padding: "2px" }}>
                NOTA: DE ACUERDO AL PUNTAJE OBTENIDO SE DEBE SOLICITAR LA APROBACIÓN CORRESPONDIENTE SEGÚN LA SIGUIENTE CLASIFICACIÓN
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", border: "1px solid #000", borderTop: 0, fontSize: "0.7rem", textAlign: "center" }}>
                <div style={{ background: "#dcfce7", padding: "4px", borderRight: "1px solid #000", border: selectedDoc.nivel_riesgo === "BAJO" ? "2px solid #000" : "none" }}>
                  <strong>RIESGO BAJO (0 A 15 PUNTOS)</strong><br />
                  AUTORIZA SUPERVISOR DIRECTO Y QHSE
                </div>
                <div style={{ background: "#fef9c3", padding: "4px", borderRight: "1px solid #000", border: selectedDoc.nivel_riesgo === "MEDIO" ? "2px solid #000" : "none" }}>
                  <strong>RIESGO MEDIO (16 A 22 PUNTOS)</strong><br />
                  COORDINACIONES DE AREA
                </div>
                <div style={{ background: "#fee2e2", padding: "4px", border: selectedDoc.nivel_riesgo === "ALTO" ? "2px solid #000" : "none" }}>
                  <strong>RIESGO ALTO (&gt; 23 PUNTOS)</strong><br />
                  AUTORIZA GERENCIA GENERAL
                </div>
              </div>

              {/* FIRMAS Y AUTORIZACIONES (SOLO 1 FIRMA DE AUTORIZANTE SEGÚN NIVEL DE RIESGO) */}
              <div style={{ border: "1px solid #000", borderTop: 0, padding: "4px" }}>
                <div style={{ textAlign: "center", marginBottom: "6px" }}>
                  {selectedDoc.firma_conductor ? (
                    <img src={selectedDoc.firma_conductor} style={{ maxHeight: "36px", margin: "0 auto", display: "block" }} alt="Firma Conductor" />
                  ) : (
                    <div style={{ height: "30px", color: "#64748b" }}>[Sin Firma Conductor]</div>
                  )}
                  <div style={{ borderTop: "1px solid #000", width: "50%", margin: "2px auto 1px auto", fontWeight: "bold", fontSize: "0.72rem" }}>
                    {selectedDoc.nombre_conductor_firma || selectedDoc.nombre_conductor}
                  </div>
                  <small style={{ fontWeight: "bold", fontSize: "0.68rem" }}>CONDUCTOR</small>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px", textAlign: "center" }}>
                  {/* Columna 1: QHSE / Supervisor (Riesgo Bajo) */}
                  <div>
                    {selectedDoc.firma_autorizador && (selectedDoc.nivel_riesgo === "BAJO" || !selectedDoc.nivel_riesgo) ? (
                      <img src={selectedDoc.firma_autorizador} style={{ maxHeight: "32px", margin: "0 auto", display: "block" }} alt="Firma QHSE" />
                    ) : (
                      <div style={{ height: "25px" }}></div>
                    )}
                    <div style={{ borderTop: "1px solid #000", width: "75%", margin: "2px auto 1px auto", fontWeight: "bold", fontSize: "0.7rem" }}>
                      {selectedDoc.firma_autorizador && (selectedDoc.nivel_riesgo === "BAJO" || !selectedDoc.nivel_riesgo) ? selectedDoc.nombre_autorizador_firma : "NOMBRE Y FIRMA"}
                    </div>
                    <small style={{ fontSize: "0.65rem", fontWeight: "bold" }}>SUPERVISOR DIRECTO / QHSE</small>
                  </div>

                  {/* Columna 2: Coordinación / Autoridad de Sitio (Riesgo Medio) */}
                  <div>
                    {selectedDoc.firma_autorizador && selectedDoc.nivel_riesgo === "MEDIO" ? (
                      <img src={selectedDoc.firma_autorizador} style={{ maxHeight: "32px", margin: "0 auto", display: "block" }} alt="Firma Coordinador" />
                    ) : (
                      <div style={{ height: "25px" }}></div>
                    )}
                    <div style={{ borderTop: "1px solid #000", width: "75%", margin: "2px auto 1px auto", fontWeight: "bold", fontSize: "0.7rem" }}>
                      {selectedDoc.firma_autorizador && selectedDoc.nivel_riesgo === "MEDIO" ? selectedDoc.nombre_autorizador_firma : "NOMBRE Y FIRMA"}
                    </div>
                    <small style={{ fontSize: "0.65rem", fontWeight: "bold" }}>AUTORIDAD DE ÁREA / COORDINACIÓN</small>
                  </div>

                  {/* Columna 3: Gerente de Área (Riesgo Alto) */}
                  <div>
                    {selectedDoc.firma_autorizador && selectedDoc.nivel_riesgo === "ALTO" ? (
                      <img src={selectedDoc.firma_autorizador} style={{ maxHeight: "32px", margin: "0 auto", display: "block" }} alt="Firma Gerente" />
                    ) : (
                      <div style={{ height: "25px" }}></div>
                    )}
                    <div style={{ borderTop: "1px solid #000", width: "75%", margin: "2px auto 1px auto", fontWeight: "bold", fontSize: "0.7rem" }}>
                      {selectedDoc.firma_autorizador && selectedDoc.nivel_riesgo === "ALTO" ? selectedDoc.nombre_autorizador_firma : "NOMBRE Y FIRMA"}
                    </div>
                    <small style={{ fontSize: "0.65rem", fontWeight: "bold" }}>GERENTE DE ÁREA</small>
                  </div>
                </div>
              </div>

              {/* Inspección Vehicular Integrada Completa */}
              <div style={{ marginTop: "12px", border: "1.5px solid #0284c7", borderRadius: "8px", padding: "12px", background: "#f0f9ff" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", flexWrap: "wrap", gap: "6px" }}>
                  <h3 style={{ margin: 0, color: "#0369a1", fontSize: "0.95rem", fontWeight: "800" }}>
                    🚗 Inspección Vehicular Integrada
                  </h3>
                  {(selectedDoc.inspeccion_es_dia_siguiente || selectedDoc.es_dia_siguiente) && (
                    <span style={{ background: "#2563eb", color: "#ffffff", padding: "4px 10px", borderRadius: "12px", fontSize: "0.75rem", fontWeight: "bold" }}>
                      🌙 Programado con 24h Anticipación (Día Siguiente 4:00 AM - 7:00 AM)
                    </span>
                  )}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", fontSize: "0.78rem", marginBottom: "10px", background: "#ffffff", padding: "8px", borderRadius: "6px", border: "1px solid #bae6fd" }}>
                  <div><strong>Combustible:</strong> {selectedDoc.inspeccion_combustible || selectedDoc.combustible || "3/4"}</div>
                  <div><strong>Estado Inspección:</strong> <span style={{ fontWeight: "bold", color: "#0284c7" }}>{selectedDoc.inspeccion_estado || selectedDoc.estado || "REGISTRADA"}</span></div>
                  <div><strong>Fecha Operativa:</strong> {selectedDoc.inspeccion_fecha_operativa || String(selectedDoc.fecha_emision || "").split("T")[0]}</div>
                </div>

                {/* Componente de Visualizador de Daños */}
                <div style={{ background: "#ffffff", padding: "10px", borderRadius: "6px", border: "1px solid #bae6fd", marginBottom: "10px" }}>
                  <DamageViewer
                    damages={selectedDoc.inspeccion_danos || {}}
                    vehicle={selectedDoc.tipo_vehiculo || selectedDoc.numero_unidad || "Vehículo"}
                  />
                </div>

                {/* Checklist si existe */}
                {selectedDoc.inspeccion_checklist && typeof selectedDoc.inspeccion_checklist === 'object' && Object.keys(selectedDoc.inspeccion_checklist).length > 0 && (
                  <div style={{ background: "#ffffff", padding: "10px", borderRadius: "6px", border: "1px solid #bae6fd", marginBottom: "10px" }}>
                    <strong style={{ fontSize: "0.82rem", color: "#0f172a", display: "block", marginBottom: "6px" }}>📋 Checklist de Componentes Inspeccionados:</strong>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", maxHeight: "180px", overflowY: "auto", fontSize: "0.78rem" }}>
                      {Object.entries(selectedDoc.inspeccion_checklist).map(([item, state]) => (
                        <div key={item} style={{ display: "flex", justifyContent: "space-between", background: "#f8fafc", padding: "4px 8px", borderRadius: "4px", border: "1px solid #e2e8f0" }}>
                          <span>{item}</span>
                          <span style={{ fontWeight: "bold", color: state === "B" ? "#166534" : state === "M" ? "#991b1b" : "#854d0e" }}>
                            {state === "B" ? "Bueno (B)" : state === "R" ? "Regular (R)" : state === "M" ? "Malo (M)" : state}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Observaciones y Firma */}
                {(selectedDoc.inspeccion_observaciones || selectedDoc.inspeccion_firma_conductor || selectedDoc.firma_conductor) && (
                  <div style={{ background: "#ffffff", padding: "8px", borderRadius: "6px", border: "1px solid #bae6fd", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontSize: "0.78rem" }}>
                      <strong>Observaciones Inspección:</strong> {selectedDoc.inspeccion_observaciones || "Sin observaciones."}
                    </div>
                    {(selectedDoc.inspeccion_firma_conductor || selectedDoc.firma_conductor) && (
                      <div style={{ textAlign: "center" }}>
                        <img src={selectedDoc.inspeccion_firma_conductor || selectedDoc.firma_conductor} alt="Firma Inspección" style={{ maxHeight: "32px" }} />
                        <small style={{ display: "block", fontSize: "0.68rem", fontWeight: "bold" }}>Firma Conductor</small>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Acciones del Modal */}
            <div style={{ display: "flex", gap: "10px", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <button
                type="button"
                className="secondary-button"
                onClick={() => openGerenciamientoPdfPreview(selectedDoc, true)}
              >
                📥 Descargar / Imprimir PDF (Hoja Carta)
              </button>
            </div>

            {/* Sección de Aprobación Unificada si está pendiente */}
            {selectedDoc.estado === "PENDIENTE" ? (
              <div className="inspection-decision-panel">
                <div style={{ padding: "8px 12px", borderRadius: "6px", marginBottom: "12px", background: selectedDoc.nivel_riesgo === "ALTO" ? "#fee2e2" : selectedDoc.nivel_riesgo === "MEDIO" ? "#fef9c3" : "#dcfce7", border: "1px solid #cbd5e1", fontSize: "0.85rem", color: "#000" }}>
                  {selectedDoc.nivel_riesgo === "ALTO" ? (
                    <span>🔴 <strong>RIESGO ALTO ({selectedDoc.puntaje_total} pts):</strong> Requiere aprobación obligatoria de <strong>GERENCIA GENERAL (GERENTE)</strong>.</span>
                  ) : selectedDoc.nivel_riesgo === "MEDIO" ? (
                    <span>🟡 <strong>RIESGO MEDIO ({selectedDoc.puntaje_total} pts):</strong> Requiere aprobación de <strong>COORDINACIÓN DE ÁREA (COORDINADOR)</strong>.</span>
                  ) : (
                    <span>🟢 <strong>RIESGO BAJO ({selectedDoc.puntaje_total} pts):</strong> Autoriza <strong>SUPERVISOR DIRECTO O QHSE</strong>.</span>
                  )}
                </div>

                <div className="inspection-decision-section">
                  <label className="inspection-comment-field">
                    <span>Seleccionar Persona Autorizadora:</span>
                    <select
                      value={autorizadorId}
                      onChange={(e) => handleSelectAutorizador(e.target.value)}
                      style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                    >
                      <option value="">-- Selecciona Autorizador --</option>
                      {usuariosAdmin.map((u) => (
                        <option key={u.id_usuarios_admin} value={u.id_usuarios_admin}>
                          {u.nombre || u.username} — [{u.rol}]
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="inspection-decision-section">
                  <label className="inspection-comment-field">
                    <span>Nombre en la Firma:</span>
                    <input
                      type="text"
                      value={autorizadorNombre}
                      onChange={(e) => setAutorizadorNombre(e.target.value)}
                      style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                    />
                  </label>
                </div>

                <div className="inspection-decision-section">
                  <label className="inspection-comment-field">
                    <span>Observaciones / Acciones de Control:</span>
                    <textarea
                      rows="2"
                      value={observaciones}
                      onChange={(e) => setObservaciones(e.target.value)}
                      placeholder="Comentarios u observaciones de control"
                    />
                  </label>
                </div>

                <div className="inspection-decision-section">
                  <ApprovalSignature onChange={setFirmaAutorizador} />
                </div>

                <div className="inspection-decision-section form-actions inspection-decision-actions">
                  <button
                    type="button"
                    className="danger-button"
                    disabled={approving}
                    onClick={() => handleDecide("RECHAZADO")}
                  >
                    Rechazar Viaje
                  </button>
                  <button
                    type="button"
                    className="primary-button"
                    disabled={approving || !firmaAutorizador}
                    onClick={() => handleDecide("APROBADO")}
                  >
                    Aprobar Gerenciamiento e Inspección
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ background: selectedDoc.estado === "APROBADO" ? "#dcfce7" : "#fee2e2", padding: "12px", borderRadius: "8px", textAlign: "center", color: selectedDoc.estado === "APROBADO" ? "#166534" : "#991b1b", fontWeight: "bold" }}>
                Documento {selectedDoc.estado} por {selectedDoc.nombre_autorizador_firma || "Autorizador"}
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}
