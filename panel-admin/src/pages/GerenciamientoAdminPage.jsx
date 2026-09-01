import { useEffect, useRef, useState } from "react";
import logoAQR from "../assets/LoginAssets/logoAQR.webp";
import { getAdminUsuarios } from "../services/api.js";

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
    <div style={{ marginTop: "10px" }}>
      <label style={{ fontSize: "0.85rem", fontWeight: "bold", display: "block", marginBottom: "6px" }}>
        Firma Digital del Autorizador *
      </label>
      <div style={{ border: "2px dashed #000000", borderRadius: "4px", background: "#ffffff", padding: "4px" }}>
        <canvas
          ref={canvasRef}
          width="640"
          height="160"
          style={{ width: "100%", height: "130px", cursor: "crosshair", touchAction: "none" }}
          onPointerDown={start}
          onPointerMove={draw}
          onPointerUp={stop}
          onPointerLeave={stop}
        />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "6px" }}>
        <small style={{ color: hasSignature ? "#166534" : "#64748b", fontWeight: "bold" }}>
          {hasSignature ? "✓ Firma de autorizador capturada." : "Dibuja tu firma con el mouse o pantalla táctil."}
        </small>
        <button
          type="button"
          disabled={!hasSignature}
          onClick={clear}
          style={{ background: "#e2e8f0", border: 0, padding: "4px 10px", borderRadius: "4px", cursor: "pointer", fontSize: "0.8rem" }}
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

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (filterRiesgo) params.append("nivelRiesgo", filterRiesgo);
      if (filterEstado) params.append("estado", filterEstado);

      const [resDocs, resUsers] = await Promise.all([
        fetch(`${API_BASE_URL}/api/gerenciamiento-viajes?${params.toString()}`).then((r) => r.json()),
        getAdminUsuarios().catch(() => ({ data: [] }))
      ]);

      setList(resDocs.data || []);
      setUsuariosAdmin(resUsers.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [filterRiesgo, filterEstado]);

  function handleSelectAutorizador(idVal) {
    setAutorizadorId(idVal);
    if (!idVal) {
      setAutorizadorNombre(user?.nombre || user?.username || "");
      return;
    }
    const found = usuariosAdmin.find((u) => String(u.id_usuarios_admin) === String(idVal));
    if (found) {
      setAutorizadorNombre(found.nombre || found.username);
    }
  }

  async function handleAprobarRechazar(nuevoEstado) {
    if (!selectedDoc) return;

    if (nuevoEstado === "APROBADO" && !firmaAutorizador) {
      alert("Por favor captura la firma digital del autorizador antes de aprobar.");
      return;
    }

    if (!autorizadorNombre.trim()) {
      alert("Selecciona o ingresa el nombre de la persona que autoriza.");
      return;
    }

    setApproving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/gerenciamiento-viajes/${selectedDoc.id_gerenciamiento}/aprobar`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idUsuarioAdmin: autorizadorId ? Number(autorizadorId) : (user?.id_usuarios_admin || null),
          nombreAutorizador: autorizadorNombre.trim(),
          firmaAutorizador: firmaAutorizador || null,
          estado: nuevoEstado,
          observaciones
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

  // Generador del Formato Oficial idéntico a la plantilla impresa/PDF R2PLOG1 / SII-MX-23-LOG-003
  function openGerenciamientoPdfPreview(doc) {
    const printWindow = window.open("", "_blank", "width=1000,height=1100");
    if (!printWindow) {
      alert("Habilita las ventanas emergentes en tu navegador para ver la vista previa.");
      return;
    }

    const fechaPartes = String(doc.fecha_emision || "").split("T")[0].split("-");
    const anio = fechaPartes[0] || "2026";
    const mes = fechaPartes[1] || "09";
    const dia = fechaPartes[2] || "01";

    const horaPartes = String(doc.hora_salida || "08:00").split(":");
    const horaHH = horaPartes[0] || "08";
    const horaMM = horaPartes[1] || "00";

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8" />
        <title>GERENCIAMIENTO DE VIAJE - ${doc.folio_documento}</title>
        <style>
          * { box-sizing: border-box; }
          body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #000; margin: 15px; padding: 0; }
          .sheet-container { border: 2px solid #000; padding: 10px; max-width: 950px; margin: 0 auto; background: #fff; }
          
          /* Encabezado */
          .header-table { width: 100%; border-collapse: collapse; margin-bottom: 0; }
          .header-table td { border: 1px solid #000; padding: 4px 8px; text-align: center; vertical-align: middle; }
          .logo-cell { width: 25%; }
          .title-cell { width: 50%; font-weight: bold; font-size: 13px; }
          .meta-cell { width: 25%; font-size: 10px; text-align: left; }
          
          .banner-title { background: #d1d5db; font-weight: bold; text-align: center; font-size: 13px; padding: 5px; border: 1px solid #000; border-top: 0; text-transform: uppercase; margin-bottom: 0; }

          /* Tablas Generales */
          table.data-table { width: 100%; border-collapse: collapse; margin-bottom: 0; font-size: 10.5px; }
          table.data-table td, table.data-table th { border: 1px solid #000; padding: 4px 6px; text-align: left; }
          table.data-table th { background: #f3f4f6; font-weight: bold; }

          .section-header { background: #e5e7eb; font-weight: bold; text-align: center; font-size: 11px; padding: 4px; border: 1px solid #000; text-transform: uppercase; }

          /* Tabuladores Grid 3 columnas */
          .risk-grid { display: grid; grid-template-columns: 1fr 1fr 1.2fr; border: 1px solid #000; border-top: 0; }
          .risk-col { border-right: 1px solid #000; }
          .risk-col:last-child { border-right: 0; }

          .risk-header-bar { background: #fbbf24; font-weight: bold; text-align: center; border-bottom: 1px solid #000; padding: 3px; font-size: 11px; }

          .item-row { display: flex; justify-content: space-between; border-bottom: 1px solid #e5e7eb; padding: 3px 5px; font-size: 10px; }
          .item-row.selected { background: #fef08a; font-weight: bold; }

          .eval-table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
          .eval-table td { border: 1px solid #000; padding: 3px 6px; }

          /* Classification Banner */
          .class-banner { background: #fee2e2; border: 1px solid #000; text-align: center; font-weight: bold; font-size: 9.5px; padding: 4px; margin-top: 6px; }

          .class-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; border: 1px solid #000; border-top: 0; font-size: 10px; text-align: center; }
          .class-box { border-right: 1px solid #000; padding: 6px; }
          .class-box:last-child { border-right: 0; }
          .class-box.green { background: #dcfce7; }
          .class-box.yellow { background: #fef9c3; }
          .class-box.red { background: #fee2e2; }

          /* Signatures */
          .signatures-container { border: 1px solid #000; border-top: 0; padding: 10px; }
          .driver-sig-box { text-align: center; margin-bottom: 15px; }
          .authorizers-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; text-align: center; margin-top: 10px; }
          .sig-line { border-top: 1px solid #000; width: 80%; margin: 6px auto 2px auto; font-weight: bold; font-size: 10px; }

          .footer-note { font-size: 9px; color: #dc2626; font-weight: bold; text-align: center; margin-top: 8px; }

          @media print {
            body { margin: 0; }
            .sheet-container { border: 0; padding: 0; max-width: 100%; }
            .no-print { display: none !important; }
          }
        </style>
      </head>
      <body>
        <div class="no-print" style="margin-bottom: 12px; text-align: right; max-width: 950px; margin-left: auto; margin-right: auto;">
          <button onclick="window.print()" style="padding: 8px 18px; background: #0284c7; color: #fff; border: 0; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 13px;">
            🖨️ Imprimir / Guardar como PDF
          </button>
        </div>

        <div class="sheet-container">
          <!-- Encabezado Oficial -->
          <table class="header-table">
            <tr>
              <td class="logo-cell">
                <img src="${logoAQR}" alt="AQUARIO" style="max-height: 44px; object-fit: contain;" />
              </td>
              <td class="title-cell">
                CÓDIGO<br />
                R2PLOG1 / ${doc.folio_documento}
              </td>
              <td class="meta-cell">
                <strong>Sistema:</strong> SGI<br />
                <strong>Versión:</strong> ${doc.version_documento || "3.0"}<br />
                <strong>Página:</strong> 1 de 1
              </td>
            </tr>
          </table>

          <div class="banner-title">GERENCIAMIENTO DE VIAJE</div>

          <!-- Metadata -->
          <table class="data-table">
            <tr>
              <th style="width: 12%;">FECHA</th>
              <td style="width: 25%;">DÍA: <strong>${dia}</strong> / MES: <strong>${mes}</strong> / AÑO: <strong>${anio}</strong></td>
              <th style="width: 15%;">HORA DE SALIDA</th>
              <td style="width: 20%;">HORA: <strong>${horaHH}</strong> : <strong>${horaMM}</strong></td>
              <th style="width: 10%;">FOLIO</th>
              <td style="width: 18%;"><strong>${doc.folio_documento}</strong></td>
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
              <th>Vehículo de la empresa</th>
              <td>
                <span style="font-weight: bold;">[ ${doc.vehiculo_empresa !== false ? "X" : " "} ] SÍ</span> &nbsp;&nbsp;&nbsp;
                <span style="font-weight: bold;">[ ${doc.vehiculo_empresa === false ? "X" : " "} ] NO</span>
              </td>
              <th colspan="2">Nombre de la empresa contratista</th>
              <td colspan="2">${doc.nombre_contratista || "N/A (AQUARIO)"}</td>
              <th>No. Unidad</th>
              <td><strong>${doc.numero_unidad || "N/A"}</strong></td>
            </tr>
            <tr>
              <th>Conductor</th>
              <td colspan="3"><strong>${doc.nombre_conductor || doc.conductor_nombre}</strong></td>
              <th colspan="2">Número Tel. Celular</th>
              <td colspan="2">${doc.telefono_conductor || "N/A"}</td>
            </tr>
            <tr>
              <th>Número de licencia</th>
              <td>${doc.licencia_numero || "N/A"}</td>
              <th>Tipo</th>
              <td>${doc.licencia_tipo || "Chofer"}</td>
              <th colspan="2">Fecha de vencimiento</th>
              <td colspan="2">${doc.licencia_vencimiento ? String(doc.licencia_vencimiento).split("T")[0] : "N/A"}</td>
            </tr>
            <tr>
              <th>Ruta a seguir</th>
              <td colspan="4"><strong>${Array.isArray(doc.ruta_puntos) ? doc.ruta_puntos.join(" ➔ ") : (doc.ruta_puntos || "N/A")}</strong></td>
              <th colspan="2">Tiempo de Viaje</th>
              <td>${doc.tiempo_viaje_horas || 1} hrs</td>
            </tr>
            <tr>
              <th>Acompañante(s)</th>
              <td colspan="7">${Array.isArray(doc.acompanantes) && doc.acompanantes.length ? doc.acompanantes.join(", ") : "Sin acompañantes"}</td>
            </tr>
          </table>

          <!-- Sitios de reporte -->
          <div style="background: #f9fafb; font-weight: bold; border: 1px solid #000; border-top: 0; padding: 3px 6px; font-size: 10px;">
            Sitios de reporte (para viajes superiores a 1 hora)
          </div>
          <table class="data-table">
            <tr>
              <th style="width: 10%;">Punto 1</th>
              <td style="width: 35%;">${doc.sitios_reporte?.[0]?.punto || "N/A"}</td>
              <th style="width: 8%;">Hora</th>
              <td style="width: 12%;">${doc.sitios_reporte?.[0]?.horaReportada || "--:--"}</td>
              <th style="width: 10%;">Punto 3</th>
              <td style="width: 15%;">${doc.sitios_reporte?.[2]?.punto || "N/A"}</td>
              <th style="width: 5%;">Hora</th>
              <td style="width: 5%;">${doc.sitios_reporte?.[2]?.horaReportada || "--:--"}</td>
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
                <td>1. ¿El conductor tiene conocimiento de los riesgos locales (estado de la vía (google maps), clima, peatones, parte automotor, animales en la vía, ciclistas, motociclistas)?</td>
                <td style="text-align: center; font-weight: bold;">${doc.conocimiento_riesgos_locales !== false ? "X" : ""}</td>
                <td style="text-align: center; font-weight: bold;">${doc.conocimiento_riesgos_locales === false ? "X" : ""}</td>
              </tr>
              <tr>
                <td>2. ¿El conductor ha consumido medicamentos que producen somnolencia o presenta algún padecimiento del sueño?</td>
                <td style="text-align: center; font-weight: bold;">${doc.alcoholimetro ? "X" : ""}</td>
                <td style="text-align: center; font-weight: bold;">${!doc.alcoholimetro ? "X" : ""}</td>
              </tr>
              <tr>
                <td>3. ¿El conductor ha dormido adecuadamente?</td>
                <td style="text-align: center; font-weight: bold;">${doc.prohibido_personal_ajeno !== false ? "X" : ""}</td>
                <td style="text-align: center; font-weight: bold;">${doc.prohibido_personal_ajeno === false ? "X" : ""}</td>
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
                <td>6. ¿Se realizó la reunión pre caravana? (Anexar registro) *Sólo para viajes de más de un vehículo incluyendo pesado.</td>
                <td style="text-align: center; font-weight: bold;">${doc.reunion_pre_caravana_realizada ? "X" : ""}</td>
                <td style="text-align: center; font-weight: bold;">${!doc.reunion_pre_caravana_realizada ? "X" : ""}</td>
              </tr>
            </tbody>
          </table>

          <!-- 3. ANÁLISIS DE RIESGOS -->
          <div class="section-header">3. ANÁLISIS DE RIESGOS</div>
          <div class="risk-grid">
            <!-- Columna 1: A, D, G -->
            <div class="risk-col">
              <div class="risk-header-bar">A. Distancia a Recorrer / Ptos</div>
              <div class="item-row ${doc.pts_distancia === 1 ? 'selected' : ''}"><span>Menos de 50 Km</span><span>1</span></div>
              <div class="item-row ${doc.pts_distancia === 2 ? 'selected' : ''}"><span>Menos de 100 Km</span><span>2</span></div>
              <div class="item-row ${doc.pts_distancia === 5 ? 'selected' : ''}"><span>Menos de 200 Km</span><span>5</span></div>
              <div class="item-row ${doc.pts_distancia === 8 ? 'selected' : ''}"><span>Mas de 200 Km</span><span>8</span></div>

              <div class="risk-header-bar" style="margin-top: 4px;">D. Condiciones de la vía / Ptos</div>
              <div class="item-row ${doc.pts_condiciones_via === 1 ? 'selected' : ''}"><span>Pavimentada</span><span>1</span></div>
              <div class="item-row ${doc.pts_condiciones_via === 2 ? 'selected' : ''}"><span>Mixta (&lt;50% No Pavimentada)</span><span>2</span></div>
              <div class="item-row ${doc.pts_condiciones_via === 4 ? 'selected' : ''}"><span>No Pavimentada</span><span>4</span></div>

              <div class="risk-header-bar" style="margin-top: 4px;">G. Hora del traslado / Ptos</div>
              <div class="item-row ${doc.pts_hora_traslado === 1 ? 'selected' : ''}"><span>Día (6-18)</span><span>1</span></div>
              <div class="item-row ${doc.pts_hora_traslado === 8 ? 'selected' : ''}"><span>Noche (18-6)</span><span>8</span></div>
            </div>

            <!-- Columna 2: B, E, Bloqueos -->
            <div class="risk-col">
              <div class="risk-header-bar">B. Clima / Ptos</div>
              <div class="item-row ${doc.pts_clima === 2 ? 'selected' : ''}"><span>Seco / Condiciones normales</span><span>2</span></div>
              <div class="item-row ${doc.pts_clima === 4 ? 'selected' : ''}"><span>Lluvia suave</span><span>4</span></div>
              <div class="item-row ${doc.pts_clima === 8 ? 'selected' : ''}"><span>Lluvia fuerte y/o niebla</span><span>8</span></div>
              <div class="item-row ${doc.pts_clima === 10 ? 'selected' : ''}"><span>Nieve</span><span>10</span></div>

              <div class="risk-header-bar" style="margin-top: 4px;">E. Comunicaciones Disponibles / Ptos</div>
              <div class="item-row ${doc.pts_comunicaciones === 0 ? 'selected' : ''}"><span>Teléfono celular</span><span>0</span></div>
              <div class="item-row ${doc.pts_comunicaciones === 2 ? 'selected' : ''}"><span>Sin Comunicación y en caravana</span><span>2</span></div>
              <div class="item-row ${doc.pts_comunicaciones === 4 ? 'selected' : ''}"><span>sin Comunicación y sin caravana</span><span>4</span></div>

              <div style="padding: 4px; background: #fee2e2; border-top: 1px solid #000; font-size: 9px; text-align: center; margin-top: 4px;">
                <strong>Horas de trabajo + Horas de Viajes &gt; 16 Horas = NO CONDUCIR</strong>
              </div>
              <div style="padding: 4px; background: #fff3cd; font-size: 8.5px; border-top: 1px solid #000;">
                Manejo Nocturno (después de 18:00 hr) Requiere Aprobación de GCO y QHSE.<br />
                <em>Observaciones: ${doc.observaciones || "Sin notas adicionales."}</em>
              </div>
            </div>

            <!-- Columna 3: C, F, EVALUACIÓN TOTAL -->
            <div class="risk-col">
              <div class="risk-header-bar">C. Vehículos y personas / Ptos</div>
              <div class="item-row ${doc.pts_vehiculos_personas === 1 ? 'selected' : ''}"><span>2 o + Vehi. Con 2 ó + pers.</span><span>1</span></div>
              <div class="item-row ${doc.pts_vehiculos_personas === 2 ? 'selected' : ''}"><span>2 o + Vehi. Con 1 ó + pers.</span><span>2</span></div>
              <div class="item-row ${doc.pts_vehiculos_personas === 3 ? 'selected' : ''}"><span>1Vehi. Con 2 ó + personas</span><span>3</span></div>
              <div class="item-row ${doc.pts_vehiculos_personas === 6 ? 'selected' : ''}"><span>1Vehi. Con 1 persona</span><span>6</span></div>

              <div class="risk-header-bar" style="margin-top: 4px;">F. Hrs. trabajadas + Tiempo Viaje / Ptos</div>
              <div class="item-row ${doc.pts_horas_trabajadas === 1 ? 'selected' : ''}"><span>Hrs. trabajadas + Viaje =&lt;12</span><span>1</span></div>
              <div class="item-row ${doc.pts_horas_trabajadas === 3 ? 'selected' : ''}"><span>Hrs. trabajadas + Viaje =&lt;14</span><span>3</span></div>
              <div class="item-row ${doc.pts_horas_trabajadas === 6 ? 'selected' : ''}"><span>Hrs. Trabajadas + Viaje =&lt; 16</span><span>6</span></div>

              <!-- EVALUACIÓN DEL VIAJE -->
              <div style="background: #e5e7eb; font-weight: bold; text-align: center; border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 2px; font-size: 10px;">
                EVALUACIÓN DEL VIAJE
              </div>
              <table class="eval-table">
                <tr><td>A: ${doc.pts_distancia || 1}</td><td rowspan="7" style="vertical-align: middle; text-align: center; background: #fff;">
                  <div style="font-weight: bold; font-size: 12px; margin-bottom: 4px;">TOTAL<br />${doc.puntaje_total} pts</div>
                  <div style="padding: 2px 4px; color: #fff; font-weight: bold; border-radius: 3px; font-size: 9.5px; background: ${doc.nivel_riesgo === 'ALTO' ? '#dc2626' : doc.nivel_riesgo === 'MEDIO' ? '#ca8a04' : '#16a34a'};">
                    RIESGO ${doc.nivel_riesgo}
                  </div>
                </td></tr>
                <tr><td>B: ${doc.pts_clima || 2}</td></tr>
                <tr><td>C: ${doc.pts_vehiculos_personas || 1}</td></tr>
                <tr><td>D: ${doc.pts_condiciones_via || 1}</td></tr>
                <tr><td>E: ${doc.pts_comunicaciones || 0}</td></tr>
                <tr><td>F: ${doc.pts_horas_trabajadas || 1}</td></tr>
                <tr><td>G: ${doc.pts_hora_traslado || 1}</td></tr>
              </table>
            </div>
          </div>

          <!-- Banner Clasificación -->
          <div class="class-banner">
            NOTA: DE ACUERDO AL PUNTAJE OBTENIDO SE DEBE SOLICITAR LA APROBACIÓN CORRESPONDIENTE SEGÚN LA SIGUIENTE CLASIFICACIÓN
          </div>
          <div class="class-grid">
            <div class="class-box green">
              <strong>RIESGO BAJO (0 A 15 PUNTOS)</strong><br />
              AUTORIZA SUPERVISOR DIRECTO Y QHSE
            </div>
            <div class="class-box yellow">
              <strong>RIESGO MEDIO (16 A 22 PUNTOS)</strong><br />
              COORDINACIONES DE AREA
            </div>
            <div class="class-box red">
              <strong>RIESGO ALTO (&gt; 23 PUNTOS)</strong><br />
              AUTORIZA GERENCIA GENERAL
            </div>
          </div>

          <!-- FIRMAS -->
          <div class="signatures-container">
            <div class="driver-sig-box">
              ${doc.firma_conductor ? `<img src="${doc.firma_conductor}" style="max-height: 55px;" alt="Firma Conductor" />` : '<div style="height: 45px;">[Sin Firma Conductor]</div>'}
              <div class="sig-line">${doc.nombre_conductor_firma || doc.nombre_conductor || "NOMBRE Y FIRMA CONDUCTOR"}</div>
              <small style="font-weight: bold;">CONDUCTOR</small>
            </div>

            <div class="authorizers-grid">
              <div>
                ${doc.firma_autorizador ? `<img src="${doc.firma_autorizador}" style="max-height: 45px;" alt="Firma QHSE" />` : '<div style="height: 40px;"></div>'}
                <div class="sig-line">${doc.nombre_autorizador_firma || "NOMBRE Y FIRMA"}</div>
                <small>QHSE</small>
              </div>
              <div>
                ${doc.firma_autorizador ? `<img src="${doc.firma_autorizador}" style="max-height: 45px;" alt="Firma Autoridad Sitio" />` : '<div style="height: 40px;"></div>'}
                <div class="sig-line">${doc.nombre_autorizador_firma || "NOMBRE Y FIRMA"}</div>
                <small>AUTORIDAD DE ÁREA O SITIO</small>
              </div>
              <div>
                ${doc.firma_autorizador ? `<img src="${doc.firma_autorizador}" style="max-height: 45px;" alt="Firma Gerente" />` : '<div style="height: 40px;"></div>'}
                <div class="sig-line">${doc.nombre_autorizador_firma || "NOMBRE Y FIRMA"}</div>
                <small>GERENTE DE ÁREA</small>
              </div>
            </div>
          </div>

          <div class="footer-note">
            NOTA: Un Gerenciamiento de Viajes debe ser preparado para todos los viajes: Superiores a 50 Km, en áreas remotas o bajo condiciones adversas, hacia o desde locaciones en campo con el cliente.
          </div>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  }

  return (
    <div style={{ padding: "20px", maxWidth: "1200px", margin: "0 auto" }}>
      <header style={{ marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.6rem", color: "#0f172a" }}>🗺️ Gerenciamiento de Viajes (Fuera de Ciudad / Estado)</h1>
          <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: "0.9rem" }}>
            Revisión y aprobación de formatos de riesgo SII-MX-23-LOG-003 v3.0 (R2PLOG1)
          </p>
        </div>
        <button onClick={loadData} style={{ background: "#0284c7", color: "#fff", border: 0, padding: "8px 16px", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}>
          🔄 Actualizar
        </button>
      </header>

      {/* Filtros */}
      <div style={{ display: "flex", gap: "14px", background: "#ffffff", padding: "12px 16px", borderRadius: "8px", border: "1px solid #e2e8f0", marginBottom: "20px" }}>
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
      </div>

      {loading ? (
        <p>Cargando registros de gerenciamiento...</p>
      ) : error ? (
        <p style={{ color: "#dc2626" }}>{error}</p>
      ) : list.length === 0 ? (
        <div style={{ background: "#ffffff", padding: "40px", textAlign: "center", borderRadius: "8px", border: "1px solid #e2e8f0", color: "#64748b" }}>
          No se encontraron documentos de gerenciamiento de viaje registrados.
        </div>
      ) : (
        <div style={{ background: "#ffffff", borderRadius: "8px", border: "1px solid #e2e8f0", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.88rem" }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0", textAlign: "left", color: "#475569" }}>
                <th style={{ padding: "12px 14px" }}>Folio</th>
                <th style={{ padding: "12px 14px" }}>Fecha</th>
                <th style={{ padding: "12px 14px" }}>Conductor</th>
                <th style={{ padding: "12px 14px" }}>Origen / Destino</th>
                <th style={{ padding: "12px 14px" }}>Puntaje Total</th>
                <th style={{ padding: "12px 14px" }}>Nivel de Riesgo</th>
                <th style={{ padding: "12px 14px" }}>Autorización Requerida</th>
                <th style={{ padding: "12px 14px" }}>Estado</th>
                <th style={{ padding: "12px 14px", textAlign: "center" }}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {list.map((item) => {
                let badgeBg = "#16a34a";
                if (item.nivel_riesgo === "ALTO") badgeBg = "#dc2626";
                else if (item.nivel_riesgo === "MEDIO") badgeBg = "#ca8a04";

                return (
                  <tr key={item.id_gerenciamiento} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "12px 14px", fontWeight: "bold" }}>{item.folio_documento} #{item.id_gerenciamiento}</td>
                    <td style={{ padding: "12px 14px" }}>{String(item.fecha_emision || "").split("T")[0]}</td>
                    <td style={{ padding: "12px 14px" }}>{item.nombre_conductor || item.conductor_nombre}</td>
                    <td style={{ padding: "12px 14px" }}>{item.origen_nombre || item.origen_texto || "N/A"} ➔ {item.destino_nombre || item.destino_texto || "N/A"}</td>
                    <td style={{ padding: "12px 14px", fontWeight: "bold" }}>{item.puntaje_total} ptos</td>
                    <td style={{ padding: "12px 14px" }}>
                      <span style={{ background: badgeBg, color: "#fff", padding: "3px 10px", borderRadius: "12px", fontSize: "0.75rem", fontWeight: "bold" }}>
                        {item.nivel_riesgo}
                      </span>
                    </td>
                    <td style={{ padding: "12px 14px", fontSize: "0.8rem", color: "#334155" }}>{item.autorizacion_requerida}</td>
                    <td style={{ padding: "12px 14px" }}>
                      <span style={{
                        padding: "3px 8px", borderRadius: "4px", fontSize: "0.78rem", fontWeight: "bold",
                        background: item.estado === "APROBADO" ? "#dcfce7" : item.estado === "RECHAZADO" ? "#fee2e2" : "#fef9c3",
                        color: item.estado === "APROBADO" ? "#166534" : item.estado === "RECHAZADO" ? "#991b1b" : "#854d0e"
                      }}>
                        {item.estado}
                      </span>
                    </td>
                    <td style={{ padding: "12px 14px", textAlign: "center" }}>
                      <button onClick={() => { setSelectedDoc(item); setFirmaAutorizador(""); setObservaciones(item.observaciones || ""); setAutorizadorNombre(item.nombre_autorizador_firma || user?.nombre || user?.username || ""); }} style={{ background: "#1e3a8a", color: "#fff", border: 0, padding: "6px 12px", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", fontSize: "0.8rem" }}>
                        👁️ Ver Formato Oficial
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal con Formato Estructurado Identico al PDF / Hoja Oficial */}
      {selectedDoc && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 9999, display: "grid", placeItems: "center", padding: "16px", overflowY: "auto" }}>
          <div style={{ background: "#ffffff", borderRadius: "8px", maxWidth: "920px", width: "100%", padding: "20px", maxHeight: "95vh", overflowY: "auto", boxShadow: "0 25px 60px rgba(0,0,0,0.5)", border: "2px solid #000" }}>
            
            {/* Toolbar modal */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid #000", paddingBottom: "10px", marginBottom: "14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <img src={logoAQR} alt="AQUARIO" style={{ height: "38px" }} />
                <span style={{ fontWeight: "bold", fontSize: "1.1rem" }}>GERENCIAMIENTO DE VIAJE — {selectedDoc.folio_documento}</span>
              </div>
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <button
                  type="button"
                  onClick={() => openGerenciamientoPdfPreview(selectedDoc)}
                  style={{ background: "#0284c7", color: "#ffffff", border: 0, padding: "8px 16px", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", fontSize: "0.85rem" }}
                >
                  🖨️ Abrir / Imprimir Formato PDF
                </button>
                <button onClick={() => setSelectedDoc(null)} style={{ background: "transparent", border: 0, fontSize: "1.4rem", cursor: "pointer", fontWeight: "bold" }}>✕</button>
              </div>
            </div>

            {/* HOJA CON ESTRUCTURA IDÉNTICA AL FORMATO PDF */}
            <div style={{ border: "2px solid #000", padding: "12px", background: "#ffffff", fontSize: "0.82rem" }}>
              
              {/* Encabezado */}
              <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "0" }}>
                <tbody>
                  <tr>
                    <td style={{ border: "1px solid #000", padding: "6px", width: "25%", textAlign: "center" }}>
                      <img src={logoAQR} alt="AQUARIO" style={{ maxHeight: "40px" }} />
                    </td>
                    <td style={{ border: "1px solid #000", padding: "6px", width: "50%", textAlign: "center", fontWeight: "bold", fontSize: "0.95rem" }}>
                      CÓDIGO<br />R2PLOG1 / {selectedDoc.folio_documento}
                    </td>
                    <td style={{ border: "1px solid #000", padding: "6px", width: "25%", fontSize: "0.78rem" }}>
                      <strong>Sistema:</strong> SGI<br />
                      <strong>Versión:</strong> {selectedDoc.version_documento || "3.0"}<br />
                      <strong>Página:</strong> 1 de 1
                    </td>
                  </tr>
                </tbody>
              </table>

              <div style={{ background: "#d1d5db", fontWeight: "bold", textAlign: "center", fontSize: "0.95rem", padding: "5px", border: "1px solid #000", borderTop: 0, textTransform: "uppercase" }}>
                GERENCIAMIENTO DE VIAJE
              </div>

              {/* Metadata */}
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                <tbody>
                  <tr>
                    <th style={{ border: "1px solid #000", background: "#f3f4f6", padding: "4px", width: "12%" }}>FECHA</th>
                    <td style={{ border: "1px solid #000", padding: "4px", width: "25%" }}>
                      DÍA: <strong>{String(selectedDoc.fecha_emision || "").split("T")[0].split("-")[2] || "01"}</strong> /
                      MES: <strong>{String(selectedDoc.fecha_emision || "").split("T")[0].split("-")[1] || "09"}</strong> /
                      AÑO: <strong>{String(selectedDoc.fecha_emision || "").split("T")[0].split("-")[0] || "2026"}</strong>
                    </td>
                    <th style={{ border: "1px solid #000", background: "#f3f4f6", padding: "4px", width: "15%" }}>HORA DE SALIDA</th>
                    <td style={{ border: "1px solid #000", padding: "4px", width: "20%" }}>HORA: <strong>{selectedDoc.hora_salida || "08:00"}</strong></td>
                    <th style={{ border: "1px solid #000", background: "#f3f4f6", padding: "4px", width: "10%" }}>FOLIO</th>
                    <td style={{ border: "1px solid #000", padding: "4px", width: "18%" }}><strong>{selectedDoc.folio_documento}</strong></td>
                  </tr>
                  <tr>
                    <th style={{ border: "1px solid #000", background: "#f3f4f6", padding: "4px" }}>ORIGEN</th>
                    <td style={{ border: "1px solid #000", padding: "4px" }} colSpan={2}><strong>{selectedDoc.origen_nombre || selectedDoc.origen_texto || "N/A"}</strong></td>
                    <th style={{ border: "1px solid #000", background: "#f3f4f6", padding: "4px" }}>DESTINO</th>
                    <td style={{ border: "1px solid #000", padding: "4px" }} colSpan={2}><strong>{selectedDoc.destino_nombre || selectedDoc.destino_texto || "N/A"}</strong></td>
                  </tr>
                  <tr>
                    <th style={{ border: "1px solid #000", background: "#f3f4f6", padding: "4px" }}>DEPARTAMENTO</th>
                    <td style={{ border: "1px solid #000", padding: "4px" }} colSpan={2}>{selectedDoc.departamento || "Logística"}</td>
                    <th style={{ border: "1px solid #000", background: "#f3f4f6", padding: "4px" }}>KILOMETRAJE</th>
                    <td style={{ border: "1px solid #000", padding: "4px" }} colSpan={2}><strong>{selectedDoc.kilometraje || 0} km</strong></td>
                  </tr>
                </tbody>
              </table>

              {/* 1. INFORMACIÓN GENERAL */}
              <div style={{ background: "#e5e7eb", fontWeight: "bold", textAlign: "center", padding: "4px", border: "1px solid #000", borderTop: 0 }}>
                1. INFORMACIÓN GENERAL
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                <tbody>
                  <tr>
                    <th style={{ border: "1px solid #000", background: "#f3f4f6", padding: "4px" }}>Tipo de vehículo</th>
                    <td style={{ border: "1px solid #000", padding: "4px" }}>{selectedDoc.tipo_vehiculo || "PickUp"}</td>
                    <th style={{ border: "1px solid #000", background: "#f3f4f6", padding: "4px" }}>Placa</th>
                    <td style={{ border: "1px solid #000", padding: "4px" }}>{selectedDoc.placa || "N/A"}</td>
                    <th style={{ border: "1px solid #000", background: "#f3f4f6", padding: "4px" }}>Modelo</th>
                    <td style={{ border: "1px solid #000", padding: "4px" }}>{selectedDoc.modelo || "N/A"}</td>
                    <th style={{ border: "1px solid #000", background: "#f3f4f6", padding: "4px" }}>Color</th>
                    <td style={{ border: "1px solid #000", padding: "4px" }}>{selectedDoc.color || "N/A"}</td>
                  </tr>
                  <tr>
                    <th style={{ border: "1px solid #000", background: "#f3f4f6", padding: "4px" }}>Vehículo empresa</th>
                    <td style={{ border: "1px solid #000", padding: "4px" }}>
                      [ {selectedDoc.vehiculo_empresa !== false ? "X" : " "} ] SÍ &nbsp;
                      [ {selectedDoc.vehiculo_empresa === false ? "X" : " "} ] NO
                    </td>
                    <th style={{ border: "1px solid #000", background: "#f3f4f6", padding: "4px" }} colSpan={2}>Nombre empresa contratista</th>
                    <td style={{ border: "1px solid #000", padding: "4px" }} colSpan={2}>{selectedDoc.nombre_contratista || "N/A"}</td>
                    <th style={{ border: "1px solid #000", background: "#f3f4f6", padding: "4px" }}>No. Unidad</th>
                    <td style={{ border: "1px solid #000", padding: "4px" }}><strong>{selectedDoc.numero_unidad || "N/A"}</strong></td>
                  </tr>
                  <tr>
                    <th style={{ border: "1px solid #000", background: "#f3f4f6", padding: "4px" }}>Conductor</th>
                    <td style={{ border: "1px solid #000", padding: "4px" }} colSpan={3}><strong>{selectedDoc.nombre_conductor || selectedDoc.conductor_nombre}</strong></td>
                    <th style={{ border: "1px solid #000", background: "#f3f4f6", padding: "4px" }} colSpan={2}>Tel. Celular</th>
                    <td style={{ border: "1px solid #000", padding: "4px" }} colSpan={2}>{selectedDoc.telefono_conductor || "N/A"}</td>
                  </tr>
                  <tr>
                    <th style={{ border: "1px solid #000", background: "#f3f4f6", padding: "4px" }}>Número de licencia</th>
                    <td style={{ border: "1px solid #000", padding: "4px" }}>{selectedDoc.licencia_numero || "N/A"}</td>
                    <th style={{ border: "1px solid #000", background: "#f3f4f6", padding: "4px" }}>Tipo</th>
                    <td style={{ border: "1px solid #000", padding: "4px" }}>{selectedDoc.licencia_tipo || "Chofer"}</td>
                    <th style={{ border: "1px solid #000", background: "#f3f4f6", padding: "4px" }} colSpan={2}>Fecha vencimiento</th>
                    <td style={{ border: "1px solid #000", padding: "4px" }} colSpan={2}>{selectedDoc.licencia_vencimiento ? String(selectedDoc.licencia_vencimiento).split("T")[0] : "N/A"}</td>
                  </tr>
                  <tr>
                    <th style={{ border: "1px solid #000", background: "#f3f4f6", padding: "4px" }}>Ruta a seguir</th>
                    <td style={{ border: "1px solid #000", padding: "4px" }} colSpan={4}><strong>{Array.isArray(selectedDoc.ruta_puntos) ? selectedDoc.ruta_puntos.join(" ➔ ") : (selectedDoc.ruta_puntos || "N/A")}</strong></td>
                    <th style={{ border: "1px solid #000", background: "#f3f4f6", padding: "4px" }} colSpan={2}>Tiempo de Viaje</th>
                    <td style={{ border: "1px solid #000", padding: "4px" }}>{selectedDoc.tiempo_viaje_horas || 1} hrs</td>
                  </tr>
                  <tr>
                    <th style={{ border: "1px solid #000", background: "#f3f4f6", padding: "4px" }}>Acompañante(s)</th>
                    <td style={{ border: "1px solid #000", padding: "4px" }} colSpan={7}>{Array.isArray(selectedDoc.acompanantes) && selectedDoc.acompanantes.length ? selectedDoc.acompanantes.join(", ") : "Sin acompañantes"}</td>
                  </tr>
                </tbody>
              </table>

              {/* Sitios de reporte */}
              <div style={{ background: "#f9fafb", fontWeight: "bold", border: "1px solid #000", borderTop: 0, padding: "3px 6px", fontSize: "0.78rem" }}>
                Sitios de reporte (para viajes superiores a 1 hora)
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
                <tbody>
                  <tr>
                    <th style={{ border: "1px solid #000", background: "#f3f4f6", padding: "3px" }}>Punto 1</th>
                    <td style={{ border: "1px solid #000", padding: "3px" }}>{selectedDoc.sitios_reporte?.[0]?.punto || "N/A"}</td>
                    <th style={{ border: "1px solid #000", background: "#f3f4f6", padding: "3px" }}>Hora</th>
                    <td style={{ border: "1px solid #000", padding: "3px" }}>{selectedDoc.sitios_reporte?.[0]?.horaReportada || "--:--"}</td>
                    <th style={{ border: "1px solid #000", background: "#f3f4f6", padding: "3px" }}>Punto 3</th>
                    <td style={{ border: "1px solid #000", padding: "3px" }}>{selectedDoc.sitios_reporte?.[2]?.punto || "N/A"}</td>
                    <th style={{ border: "1px solid #000", background: "#f3f4f6", padding: "3px" }}>Hora</th>
                    <td style={{ border: "1px solid #000", padding: "3px" }}>{selectedDoc.sitios_reporte?.[2]?.horaReportada || "--:--"}</td>
                  </tr>
                  <tr>
                    <th style={{ border: "1px solid #000", background: "#f3f4f6", padding: "3px" }}>Punto 2</th>
                    <td style={{ border: "1px solid #000", padding: "3px" }}>{selectedDoc.sitios_reporte?.[1]?.punto || "N/A"}</td>
                    <th style={{ border: "1px solid #000", background: "#f3f4f6", padding: "3px" }}>Hora</th>
                    <td style={{ border: "1px solid #000", padding: "3px" }}>{selectedDoc.sitios_reporte?.[1]?.horaReportada || "--:--"}</td>
                    <th style={{ border: "1px solid #000", background: "#f3f4f6", padding: "3px" }}>Punto 4</th>
                    <td style={{ border: "1px solid #000", padding: "3px" }}>{selectedDoc.sitios_reporte?.[3]?.punto || "N/A"}</td>
                    <th style={{ border: "1px solid #000", background: "#f3f4f6", padding: "3px" }}>Hora</th>
                    <td style={{ border: "1px solid #000", padding: "3px" }}>{selectedDoc.sitios_reporte?.[3]?.horaReportada || "--:--"}</td>
                  </tr>
                </tbody>
              </table>

              {/* 2. LISTA VERIFICACIÓN DE PREVIAJE */}
              <div style={{ background: "#e5e7eb", fontWeight: "bold", textAlign: "center", padding: "4px", border: "1px solid #000", borderTop: 0 }}>
                2. LISTA VERIFICACIÓN DE PREVIAJE
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
                <thead>
                  <tr>
                    <th style={{ border: "1px solid #000", background: "#f3f4f6", padding: "3px", textAlign: "left" }}>Pregunta de Control</th>
                    <th style={{ border: "1px solid #000", background: "#f3f4f6", padding: "3px", width: "8%", textAlign: "center" }}>SI</th>
                    <th style={{ border: "1px solid #000", background: "#f3f4f6", padding: "3px", width: "8%", textAlign: "center" }}>NO</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ border: "1px solid #000", padding: "3px" }}>1. ¿El conductor tiene conocimiento de los riesgos locales (estado de la vía (google maps), clima, peatones, parte automotor, animales en la vía, ciclistas, motociclistas)?</td>
                    <td style={{ border: "1px solid #000", textAlign: "center", fontWeight: "bold" }}>{selectedDoc.conocimiento_riesgos_locales !== false ? "X" : ""}</td>
                    <td style={{ border: "1px solid #000", textAlign: "center", fontWeight: "bold" }}>{selectedDoc.conocimiento_riesgos_locales === false ? "X" : ""}</td>
                  </tr>
                  <tr>
                    <td style={{ border: "1px solid #000", padding: "3px" }}>2. ¿El conductor ha consumido medicamentos que producen somnolencia o presenta algún padecimiento del sueño?</td>
                    <td style={{ border: "1px solid #000", textAlign: "center", fontWeight: "bold" }}>{selectedDoc.alcoholimetro ? "X" : ""}</td>
                    <td style={{ border: "1px solid #000", textAlign: "center", fontWeight: "bold" }}>{!selectedDoc.alcoholimetro ? "X" : ""}</td>
                  </tr>
                  <tr>
                    <td style={{ border: "1px solid #000", padding: "3px" }}>3. ¿El conductor ha dormido adecuadamente?</td>
                    <td style={{ border: "1px solid #000", textAlign: "center", fontWeight: "bold" }}>{selectedDoc.prohibido_personal_ajeno !== false ? "X" : ""}</td>
                    <td style={{ border: "1px solid #000", textAlign: "center", fontWeight: "bold" }}>{selectedDoc.prohibido_personal_ajeno === false ? "X" : ""}</td>
                  </tr>
                  <tr>
                    <td style={{ border: "1px solid #000", padding: "3px" }}>4. ¿El conductor está informado que es prohibido transportar personal ajeno a la empresa?</td>
                    <td style={{ border: "1px solid #000", textAlign: "center", fontWeight: "bold" }}>{selectedDoc.prohibido_personal_ajeno !== false ? "X" : ""}</td>
                    <td style={{ border: "1px solid #000", textAlign: "center", fontWeight: "bold" }}>{selectedDoc.prohibido_personal_ajeno === false ? "X" : ""}</td>
                  </tr>
                  <tr>
                    <td style={{ border: "1px solid #000", padding: "3px" }}>5. ¿Se realizó la inspección del vehículo con la lista de chequeo? (Anexar registro)</td>
                    <td style={{ border: "1px solid #000", textAlign: "center", fontWeight: "bold" }}>{selectedDoc.inspeccion_vehiculo_realizada !== false ? "X" : ""}</td>
                    <td style={{ border: "1px solid #000", textAlign: "center", fontWeight: "bold" }}>{selectedDoc.inspeccion_vehiculo_realizada === false ? "X" : ""}</td>
                  </tr>
                  <tr>
                    <td style={{ border: "1px solid #000", padding: "3px" }}>6. ¿Se realizó la reunión pre caravana? (Anexar registro) *Sólo para viajes de más de un vehículo incluyendo pesado.</td>
                    <td style={{ border: "1px solid #000", textAlign: "center", fontWeight: "bold" }}>{selectedDoc.reunion_pre_caravana_realizada ? "X" : ""}</td>
                    <td style={{ border: "1px solid #000", textAlign: "center", fontWeight: "bold" }}>{!selectedDoc.reunion_pre_caravana_realizada ? "X" : ""}</td>
                  </tr>
                </tbody>
              </table>

              {/* 3. ANÁLISIS DE RIESGOS */}
              <div style={{ background: "#e5e7eb", fontWeight: "bold", textAlign: "center", padding: "4px", border: "1px solid #000", borderTop: 0 }}>
                3. ANÁLISIS DE RIESGOS
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.2fr", border: "1px solid #000", borderTop: 0, fontSize: "0.78rem" }}>
                
                {/* Columna A, D, G */}
                <div style={{ borderRight: "1px solid #000" }}>
                  <div style={{ background: "#fbbf24", fontWeight: "bold", textAlign: "center", padding: "2px", borderBottom: "1px solid #000" }}>A. Distancia a Recorrer / Ptos</div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 4px", background: selectedDoc.pts_distancia === 1 ? "#fef08a" : "transparent" }}><span>Menos de 50 Km</span><span>1</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 4px", background: selectedDoc.pts_distancia === 2 ? "#fef08a" : "transparent" }}><span>Menos de 100 Km</span><span>2</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 4px", background: selectedDoc.pts_distancia === 5 ? "#fef08a" : "transparent" }}><span>Menos de 200 Km</span><span>5</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 4px", background: selectedDoc.pts_distancia === 8 ? "#fef08a" : "transparent" }}><span>Mas de 200 Km</span><span>8</span></div>

                  <div style={{ background: "#fbbf24", fontWeight: "bold", textAlign: "center", padding: "2px", borderTop: "1px solid #000", borderBottom: "1px solid #000" }}>D. Condiciones de la vía / Ptos</div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 4px", background: selectedDoc.pts_condiciones_via === 1 ? "#fef08a" : "transparent" }}><span>Pavimentada</span><span>1</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 4px", background: selectedDoc.pts_condiciones_via === 2 ? "#fef08a" : "transparent" }}><span>Mixta (&lt;50% No Pav.)</span><span>2</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 4px", background: selectedDoc.pts_condiciones_via === 4 ? "#fef08a" : "transparent" }}><span>No Pavimentada</span><span>4</span></div>

                  <div style={{ background: "#fbbf24", fontWeight: "bold", textAlign: "center", padding: "2px", borderTop: "1px solid #000", borderBottom: "1px solid #000" }}>G. Hora del traslado / Ptos</div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 4px", background: selectedDoc.pts_hora_traslado === 1 ? "#fef08a" : "transparent" }}><span>Día (6-18)</span><span>1</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 4px", background: selectedDoc.pts_hora_traslado === 8 ? "#fef08a" : "transparent" }}><span>Noche (18-6)</span><span>8</span></div>
                </div>

                {/* Columna B, E */}
                <div style={{ borderRight: "1px solid #000" }}>
                  <div style={{ background: "#fbbf24", fontWeight: "bold", textAlign: "center", padding: "2px", borderBottom: "1px solid #000" }}>B. Clima / Ptos</div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 4px", background: selectedDoc.pts_clima === 2 ? "#fef08a" : "transparent" }}><span>Seco / Cond. normales</span><span>2</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 4px", background: selectedDoc.pts_clima === 4 ? "#fef08a" : "transparent" }}><span>Lluvia suave</span><span>4</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 4px", background: selectedDoc.pts_clima === 8 ? "#fef08a" : "transparent" }}><span>Lluvia fuerte/niebla</span><span>8</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 4px", background: selectedDoc.pts_clima === 10 ? "#fef08a" : "transparent" }}><span>Nieve</span><span>10</span></div>

                  <div style={{ background: "#fbbf24", fontWeight: "bold", textAlign: "center", padding: "2px", borderTop: "1px solid #000", borderBottom: "1px solid #000" }}>E. Comunicaciones / Ptos</div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 4px", background: selectedDoc.pts_comunicaciones === 0 ? "#fef08a" : "transparent" }}><span>Teléfono celular</span><span>0</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 4px", background: selectedDoc.pts_comunicaciones === 2 ? "#fef08a" : "transparent" }}><span>Sin com. y caravana</span><span>2</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 4px", background: selectedDoc.pts_comunicaciones === 4 ? "#fef08a" : "transparent" }}><span>Sin com. sin caravana</span><span>4</span></div>

                  <div style={{ background: "#fee2e2", padding: "4px", fontSize: "0.72rem", borderTop: "1px solid #000", textAlign: "center" }}>
                    <strong>Horas trabajo + Viaje &gt; 16h = NO CONDUCIR</strong>
                  </div>
                  <div style={{ background: "#fff3cd", padding: "4px", fontSize: "0.72rem", borderTop: "1px solid #000" }}>
                    Manejo Nocturno (después 18h) requiere Aprobación GCO/QHSE.
                  </div>
                </div>

                {/* Columna C, F, EVALUACIÓN TOTAL */}
                <div>
                  <div style={{ background: "#fbbf24", fontWeight: "bold", textAlign: "center", padding: "2px", borderBottom: "1px solid #000" }}>C. Vehículos y personas / Ptos</div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 4px", background: selectedDoc.pts_vehiculos_personas === 1 ? "#fef08a" : "transparent" }}><span>2+ Vehi. 2+ pers.</span><span>1</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 4px", background: selectedDoc.pts_vehiculos_personas === 2 ? "#fef08a" : "transparent" }}><span>2+ Vehi. 1+ pers.</span><span>2</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 4px", background: selectedDoc.pts_vehiculos_personas === 3 ? "#fef08a" : "transparent" }}><span>1Vehi. 2+ pers.</span><span>3</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 4px", background: selectedDoc.pts_vehiculos_personas === 6 ? "#fef08a" : "transparent" }}><span>1Vehi. 1 pers.</span><span>6</span></div>

                  <div style={{ background: "#fbbf24", fontWeight: "bold", textAlign: "center", padding: "2px", borderTop: "1px solid #000", borderBottom: "1px solid #000" }}>F. Hrs. trabajadas + Viaje / Ptos</div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 4px", background: selectedDoc.pts_horas_trabajadas === 1 ? "#fef08a" : "transparent" }}><span>Hrs. trab. + Viaje =&lt;12</span><span>1</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 4px", background: selectedDoc.pts_horas_trabajadas === 3 ? "#fef08a" : "transparent" }}><span>Hrs. trab. + Viaje =&lt;14</span><span>3</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 4px", background: selectedDoc.pts_horas_trabajadas === 6 ? "#fef08a" : "transparent" }}><span>Hrs. Trab. + Viaje =&lt;16</span><span>6</span></div>

                  <div style={{ background: "#e5e7eb", fontWeight: "bold", textAlign: "center", borderTop: "1px solid #000", borderBottom: "1px solid #000", padding: "2px" }}>
                    EVALUACIÓN DEL VIAJE
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", padding: "4px", fontSize: "0.75rem", background: "#ffffff" }}>
                    <div>
                      <div>A: {selectedDoc.pts_distancia || 1}</div>
                      <div>B: {selectedDoc.pts_clima || 2}</div>
                      <div>C: {selectedDoc.pts_vehiculos_personas || 1}</div>
                      <div>D: {selectedDoc.pts_condiciones_via || 1}</div>
                      <div>E: {selectedDoc.pts_comunicaciones || 0}</div>
                      <div>F: {selectedDoc.pts_horas_trabajadas || 1}</div>
                      <div>G: {selectedDoc.pts_hora_traslado || 1}</div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: "4px", padding: "4px" }}>
                      <strong style={{ fontSize: "1rem" }}>{selectedDoc.puntaje_total} pts</strong>
                      <span style={{ padding: "2px 6px", borderRadius: "10px", color: "#fff", fontSize: "0.7rem", fontWeight: "bold", marginTop: "2px", background: selectedDoc.nivel_riesgo === 'ALTO' ? '#dc2626' : selectedDoc.nivel_riesgo === 'MEDIO' ? '#ca8a04' : '#16a34a' }}>
                        RIESGO {selectedDoc.nivel_riesgo}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Banner Clasificación */}
              <div style={{ background: "#fee2e2", border: "1px solid #000", borderTop: 0, textAlign: "center", fontWeight: "bold", fontSize: "0.75rem", padding: "4px" }}>
                NOTA: DE ACURO AL PUNTAJE OBTENIDO SE DEBE SOLICITAR LA APROBACIÓN CORRESPONDIENTE SEGÚN LA SIGUIENTE CLASIFICACIÓN
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", border: "1px solid #000", borderTop: 0, fontSize: "0.75rem", textAlign: "center" }}>
                <div style={{ background: "#dcfce7", padding: "6px", borderRight: "1px solid #000" }}>
                  <strong>RIESGO BAJO (0 A 15 PUNTOS)</strong><br />
                  AUTORIZA SUPERVISOR DIRECTO Y QHSE
                </div>
                <div style={{ background: "#fef9c3", padding: "6px", borderRight: "1px solid #000" }}>
                  <strong>RIESGO MEDIO (16 A 22 PUNTOS)</strong><br />
                  COORDINACIONES DE AREA
                </div>
                <div style={{ background: "#fee2e2", padding: "6px" }}>
                  <strong>RIESGO ALTO (&gt; 23 PUNTOS)</strong><br />
                  AUTORIZA GERENCIA GENERAL
                </div>
              </div>

              {/* Firmas */}
              <div style={{ border: "1px solid #000", borderTop: 0, padding: "10px", background: "#ffffff" }}>
                <div style={{ textAlign: "center", marginBottom: "12px" }}>
                  {selectedDoc.firma_conductor ? (
                    <img src={selectedDoc.firma_conductor} alt="Firma Conductor" style={{ maxHeight: "50px" }} />
                  ) : (
                    <div style={{ height: "40px" }}>[Sin Firma Conductor]</div>
                  )}
                  <div style={{ borderTop: "1px solid #000", width: "60%", margin: "4px auto 2px auto", fontWeight: "bold" }}>
                    {selectedDoc.nombre_conductor_firma || selectedDoc.nombre_conductor || "NOMBRE Y FIRMA CONDUCTOR"}
                  </div>
                  <small style={{ fontWeight: "bold" }}>CONDUCTOR</small>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", textAlign: "center" }}>
                  <div>
                    {selectedDoc.firma_autorizador ? <img src={selectedDoc.firma_autorizador} alt="Firma Autorizador" style={{ maxHeight: "40px" }} /> : <div style={{ height: "35px" }}></div>}
                    <div style={{ borderTop: "1px solid #000", width: "80%", margin: "4px auto 2px auto", fontSize: "0.75rem", fontWeight: "bold" }}>
                      {selectedDoc.nombre_autorizador_firma || "NOMBRE Y FIRMA"}
                    </div>
                    <small>QHSE</small>
                  </div>
                  <div>
                    {selectedDoc.firma_autorizador ? <img src={selectedDoc.firma_autorizador} alt="Firma Sitio" style={{ maxHeight: "40px" }} /> : <div style={{ height: "35px" }}></div>}
                    <div style={{ borderTop: "1px solid #000", width: "80%", margin: "4px auto 2px auto", fontSize: "0.75rem", fontWeight: "bold" }}>
                      {selectedDoc.nombre_autorizador_firma || "NOMBRE Y FIRMA"}
                    </div>
                    <small>AUTORIDAD DE ÁREA O SITIO</small>
                  </div>
                  <div>
                    {selectedDoc.firma_autorizador ? <img src={selectedDoc.firma_autorizador} alt="Firma Gerente" style={{ maxHeight: "40px" }} /> : <div style={{ height: "35px" }}></div>}
                    <div style={{ borderTop: "1px solid #000", width: "80%", margin: "4px auto 2px auto", fontSize: "0.75rem", fontWeight: "bold" }}>
                      {selectedDoc.nombre_autorizador_firma || "NOMBRE Y FIRMA"}
                    </div>
                    <small>GERENTE DE ÁREA</small>
                  </div>
                </div>
              </div>

              <div style={{ fontSize: "0.7rem", color: "#dc2626", fontWeight: "bold", textAlign: "center", marginTop: "6px" }}>
                NOTA: Un Gerenciamiento de Viajes debe ser preparado para todos los viajes: Superiores a 50 Km, en áreas remotas o bajo condiciones adversas, hacia o desde locaciones en campo con el cliente.
              </div>
            </div>

            {/* PANEL DE INTERACCIÓN / APROBACIÓN CON CANVAS DE FIRMA Y SELECCIÓN DE USUARIO */}
            <div style={{ borderTop: "2px solid #000", paddingTop: "14px", marginTop: "14px", background: "#f8fafc", padding: "14px", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
              <h4 style={{ margin: "0 0 10px", color: "#0f172a" }}>✍️ Procesar Aprobación / Firma Digital del Autorizador</h4>

              <div style={{ display: "grid", gap: "10px", marginBottom: "12px" }}>
                <label style={{ fontSize: "0.85rem", fontWeight: "bold" }}>
                  Seleccionar Persona Autorizadora *:
                  <select
                    value={autorizadorId}
                    onChange={(e) => handleSelectAutorizador(e.target.value)}
                    style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #000", marginTop: "4px", background: "#ffffff" }}
                  >
                    <option value="">-- {user?.nombre || user?.username || "Usuario Actual"} (Usuario Conectado) --</option>
                    {usuariosAdmin.map((u) => (
                      <option key={u.id_usuarios_admin} value={u.id_usuarios_admin}>
                        {u.nombre || u.username} — [{u.rol}]
                      </option>
                    ))}
                  </select>
                </label>

                <label style={{ fontSize: "0.85rem", fontWeight: "bold" }}>
                  Nombre del Autorizador en Firma:
                  <input
                    type="text"
                    value={autorizadorNombre}
                    onChange={(e) => setAutorizadorNombre(e.target.value)}
                    required
                    style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #000", marginTop: "4px", background: "#ffffff" }}
                  />
                </label>

                <label style={{ fontSize: "0.85rem", fontWeight: "bold" }}>
                  Observaciones / Acciones de Control:
                  <textarea
                    value={observaciones}
                    onChange={(e) => setObservaciones(e.target.value)}
                    rows={2}
                    placeholder="Detalle acciones de control o notas de aprobación"
                    style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #000", marginTop: "4px", background: "#ffffff" }}
                  />
                </label>

                {selectedDoc.estado === "APROBADO" && selectedDoc.firma_autorizador ? (
                  <div style={{ background: "#dcfce7", padding: "10px", borderRadius: "4px", border: "1px solid #16a34a" }}>
                    <strong style={{ fontSize: "0.85rem", color: "#166534" }}>✅ Documento Aprobado por: {selectedDoc.nombre_autorizador_firma}</strong>
                    <div style={{ marginTop: "4px" }}>
                      <img src={selectedDoc.firma_autorizador} alt="Firma Autorizador" style={{ maxHeight: "65px", background: "#ffffff", padding: "4px", borderRadius: "4px", border: "1px solid #cbd5e1" }} />
                    </div>
                  </div>
                ) : (
                  <ApprovalSignature onChange={setFirmaAutorizador} />
                )}
              </div>

              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "14px" }}>
                <button
                  type="button"
                  onClick={() => handleAprobarRechazar("RECHAZADO")}
                  disabled={approving}
                  style={{ background: "#ef4444", color: "#ffffff", border: 0, padding: "10px 20px", borderRadius: "4px", fontWeight: "bold", cursor: "pointer" }}
                >
                  ❌ Rechazar Viaje
                </button>
                <button
                  type="button"
                  onClick={() => handleAprobarRechazar("APROBADO")}
                  disabled={approving}
                  style={{ background: "#16a34a", color: "#ffffff", border: 0, padding: "10px 24px", borderRadius: "4px", fontWeight: "bold", cursor: "pointer", boxShadow: "0 4px 12px rgba(22, 163, 74, 0.3)" }}
                >
                  ✅ Aprobar y Autorizar Viaje
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
