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
      <div style={{ border: "2px dashed #94a3b8", borderRadius: "8px", background: "#f8fafc", padding: "4px" }}>
        <canvas
          ref={canvasRef}
          width="640"
          height="180"
          style={{ width: "100%", height: "140px", cursor: "crosshair", touchAction: "none" }}
          onPointerDown={start}
          onPointerMove={draw}
          onPointerUp={stop}
          onPointerLeave={stop}
        />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "6px" }}>
        <small style={{ color: hasSignature ? "#166534" : "#64748b", fontWeight: "bold" }}>
          {hasSignature ? "✓ Firma de autorizador capturada." : "Dibuja la firma con el puntero o dedo."}
        </small>
        <button
          type="button"
          disabled={!hasSignature}
          onClick={clear}
          style={{ background: "#e2e8f0", border: 0, padding: "4px 10px", borderRadius: "4px", cursor: "pointer", fontSize: "0.8rem" }}
        >
          Borrar Firma
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

  // Generador de Vista Previa / Imprimir PDF del Formato Oficial SII-MX-23-LOG-003 v3.0
  function openGerenciamientoPdfPreview(doc) {
    const printWindow = window.open("", "_blank", "width=900,height=1000");
    if (!printWindow) {
      alert("Habilita los popups en el navegador para ver la vista previa.");
      return;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8" />
        <title>Vista Previa - Gerenciamiento Vehicular ${doc.folio_documento}</title>
        <style>
          body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #0f172a; margin: 20px; line-height: 1.3; }
          .header-box { border: 2px solid #000; padding: 10px; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center; }
          .title-banner { background: #0f172a; color: #fff; text-align: center; font-weight: bold; padding: 6px; font-size: 14px; text-transform: uppercase; margin-bottom: 15px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 11px; }
          th, td { border: 1px solid #000; padding: 5px 8px; text-align: left; }
          th { background: #e2e8f0; font-weight: bold; }
          .section-title { font-weight: bold; font-size: 12px; background: #cbd5e1; padding: 4px 8px; margin-top: 14px; margin-bottom: 6px; border: 1px solid #000; }
          .risk-badge { font-weight: bold; padding: 4px 10px; border-radius: 4px; color: #fff; display: inline-block; }
          .risk-bajo { background: #16a34a; }
          .risk-medio { background: #ca8a04; }
          .risk-alto { background: #dc2626; }
          .signatures-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 20px; text-align: center; }
          .sig-box { border: 1px solid #000; padding: 10px; min-height: 100px; display: flex; flex-direction: column; justify-content: space-between; align-items: center; }
          .sig-img { max-height: 70px; }
          @media print {
            body { margin: 0; font-size: 11px; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div className="no-print" style="margin-bottom: 15px; text-align: right;">
          <button onclick="window.print()" style="padding: 8px 16px; background: #0284c7; color: #fff; border: 0; border-radius: 6px; font-weight: bold; cursor: pointer;">🖨️ Imprimir / Guardar como PDF</button>
        </div>

        <div class="header-box">
          <div style="display: flex; align-items: center; gap: 10px;">
            <img src="${logoAQR}" alt="AQUARIO" style="height: 48px;" />
          </div>
          <div style="text-align: right; font-size: 10px;">
            <div><strong>Emisión:</strong> ${doc.fecha_emision ? String(doc.fecha_emision).split("T")[0] : "Noviembre 2023"}</div>
            <div><strong>Versión:</strong> ${doc.version_documento || "3.0"}</div>
            <div><strong>Área Responsable:</strong> ${doc.area_responsable || "Logística"}</div>
            <div><strong>No. Documento:</strong> ${doc.folio_documento}</div>
          </div>
        </div>

        <div class="title-banner">
          GERENCIAMIENTO VEHICULAR (VIAJES FUERA DE LA CIUDAD / ESTADO)
        </div>

        <!-- Encabezado de Salida -->
        <table>
          <tr>
            <th>Fecha de Emisión</th>
            <td>${String(doc.fecha_emision || "").split("T")[0]}</td>
            <th>Hora de Salida</th>
            <td>${doc.hora_salida || "N/A"}</td>
            <th>Folio / ID</th>
            <td>${doc.folio_documento} #${doc.id_gerenciamiento}</td>
          </tr>
          <tr>
            <th>Origen</th>
            <td>${doc.origen_nombre || doc.origen_texto || "N/A"}</td>
            <th>Destino</th>
            <td>${doc.destino_nombre || doc.destino_texto || "N/A"}</td>
            <th>Kilometraje Inicial</th>
            <td>${doc.kilometraje || 0} km</td>
          </tr>
          <tr>
            <th>Departamento</th>
            <td colspan="5">${doc.departamento || "Logística"}</td>
          </tr>
        </table>

        <!-- 1. Valoración Médica -->
        <div class="section-title">1. VALORACIÓN MÉDICA PRE-VIAJE</div>
        <table>
          <tr>
            <th>Presión Arterial</th>
            <td>${doc.presion_arterial || "N/A"}</td>
            <th>Examen Visual</th>
            <td>${doc.examen_visual || "N/A"}</td>
            <th>Glucosa</th>
            <td>${doc.glucosa || "N/A"}</td>
          </tr>
          <tr>
            <th>Alcoholímetro</th>
            <td>${doc.alcoholimetro ? "POSITIVO (+)" : "NEGATIVO (0.00)"}</td>
            <th>Frecuencia Cardíaca</th>
            <td>${doc.frecuencia_cardiaca || "N/A"}</td>
            <th>Frecuencia Respiratoria</th>
            <td>${doc.frecuencia_respiratoria || "N/A"}</td>
          </tr>
        </table>

        <!-- 2. Información General -->
        <div class="section-title">2. INFORMACIÓN GENERAL DEL TRASLADO</div>
        <table>
          <tr>
            <th>Tipo de Vehículo</th>
            <td>${doc.tipo_vehiculo || "N/A"}</td>
            <th>Placa</th>
            <td>${doc.placa || "N/A"}</td>
            <th>Modelo</th>
            <td>${doc.modelo || "N/A"}</td>
          </tr>
          <tr>
            <th>Color</th>
            <td>${doc.color || "N/A"}</td>
            <th>Vehículo de Empresa</th>
            <td>${doc.vehiculo_empresa ? "SÍ" : "NO"}</td>
            <th>No. de Unidad</th>
            <td>${doc.numero_unidad || "N/A"}</td>
          </tr>
          <tr>
            <th>Nombre Contratista</th>
            <td colspan="5">${doc.nombre_contratista || "N/A (Vehículo Propio)"}</td>
          </tr>
          <tr>
            <th>Conductor</th>
            <td>${doc.nombre_conductor || doc.conductor_nombre || "N/A"}</td>
            <th>No. Licencia / Tipo</th>
            <td>${doc.licencia_numero || "N/A"} (${doc.licencia_tipo || "Chofer"})</td>
            <th>Vencimiento Licencia</th>
            <td>${doc.licencia_vencimiento ? String(doc.licencia_vencimiento).split("T")[0] : "N/A"}</td>
          </tr>
          <tr>
            <th>Teléfono Conductor</th>
            <td>${doc.telefono_conductor || "N/A"}</td>
            <th>Tiempo de Viaje Estimado</th>
            <td colspan="3">${doc.tiempo_viaje_horas || 1} horas</td>
          </tr>
          <tr>
            <th>Ruta a Seguir (Puntos)</th>
            <td colspan="5">${Array.isArray(doc.ruta_puntos) ? doc.ruta_puntos.join(" ➔ ") : (doc.ruta_puntos || "N/A")}</td>
          </tr>
          <tr>
            <th>Acompañantes</th>
            <td colspan="5">${Array.isArray(doc.acompanantes) ? doc.acompanantes.join(", ") : (doc.acompanantes || "Sin acompañantes")}</td>
          </tr>
        </table>

        <!-- Sitios de Reporte -->
        ${Array.isArray(doc.sitios_reporte) && doc.sitios_reporte.length > 0 ? `
          <div class="section-title">SITIOS DE REPORTE EN RUTA (PARA VIAJES > 1 HORA)</div>
          <table>
            <thead>
              <tr>
                <th>Punto de la Ruta</th>
                <th>Hora Reportada en Curso</th>
              </tr>
            </thead>
            <tbody>
              ${doc.sitios_reporte.map((s, idx) => `
                <tr>
                  <td>Punto ${idx + 1}: ${s.punto}</td>
                  <td>${s.horaReportada || "Pendiente durante viaje en curso"}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        ` : ""}

        <!-- 3. Lista de Verificación -->
        <div class="section-title">3. LISTA DE VERIFICACIÓN DE PREVIAJE</div>
        <table>
          <tr>
            <td style="width: 80%;">¿El conductor tiene conocimiento de los riesgos locales (vía, clima, peatones, animales, ciclistas)?</td>
            <th style="text-align: center;">${doc.conocimiento_riesgos_locales !== false ? "SÍ" : "NO"}</th>
          </tr>
          <tr>
            <td>¿El conductor está informado que es prohibido transportar personal ajeno a la empresa?</td>
            <th style="text-align: center;">${doc.prohibido_personal_ajeno !== false ? "SÍ" : "NO"}</th>
          </tr>
          <tr>
            <td>¿Se realizó la inspección del vehículo con la lista de chequeo? (Anexar registro)</td>
            <th style="text-align: center;">${doc.inspeccion_vehiculo_realizada !== false ? "SÍ" : "NO"}</th>
          </tr>
          <tr>
            <td>¿Se realizó la reunión pre caravana? (Sólo para viajes de más de 1 vehículo incluyendo pesado)</td>
            <th style="text-align: center;">${doc.reunion_pre_caravana_realizada ? "SÍ" : "NO"}</th>
          </tr>
        </table>

        <!-- 4. Análisis de Riesgos -->
        <div class="section-title">4. ANÁLISIS DE RIESGOS (TABULADORES A AL G)</div>
        <table>
          <thead>
            <tr>
              <th>Categoría Evaluar</th>
              <th>Puntos Obt.</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>A: Distancia a recorrer</td><td>${doc.pts_distancia || 1} ptos</td></tr>
            <tr><td>B: Clima</td><td>${doc.pts_clima || 2} ptos</td></tr>
            <tr><td>C: Vehículos y personas</td><td>${doc.pts_vehiculos_personas || 1} ptos</td></tr>
            <tr><td>D: Condiciones de la vía</td><td>${doc.pts_condiciones_via || 1} ptos</td></tr>
            <tr><td>E: Comunicaciones disponibles</td><td>${doc.pts_comunicaciones || 0} ptos</td></tr>
            <tr><td>F: Horas trabajadas + Tiempo de viaje</td><td>${doc.pts_horas_trabajadas || 1} ptos</td></tr>
            <tr><td>G: Hora de traslado</td><td>${doc.pts_hora_traslado || 1} ptos</td></tr>
            <tr style="background: #f1f5f9; font-weight: bold; font-size: 12px;">
              <td>PUNTAJE ACUMULADO TOTAL</td>
              <td>
                <span class="risk-badge risk-${(doc.nivel_riesgo || 'BAJO').toLowerCase()}">
                  ${doc.puntaje_total} ptos — RIESGO ${doc.nivel_riesgo}
                </span>
              </td>
            </tr>
          </tbody>
        </table>

        <div style="background: #f8fafc; padding: 8px; border: 1px solid #000; font-size: 11px; margin-bottom: 14px;">
          <strong>Autorización Requerida según Puntaje:</strong> ${doc.autorizacion_requerida || "SUPERVISOR DIRECTO O QHSE"}<br/>
          ${doc.observaciones ? `<strong>Observaciones de Aprobación:</strong> ${doc.observaciones}` : ""}
        </div>

        <!-- 5. Firmas -->
        <div class="section-title">5. FIRMAS Y AUTORIZACIÓN</div>
        <div class="signatures-grid">
          <div class="sig-box">
            <div>
              ${doc.firma_conductor ? `<img src="${doc.firma_conductor}" class="sig-img" alt="Firma Conductor" />` : '<div style="height: 60px;">[Sin Firma]</div>'}
            </div>
            <div>
              <hr style="border: 0; border-top: 1px solid #000; margin: 4px 0;" />
              <strong>${doc.nombre_conductor_firma || doc.nombre_conductor || "Nombre y Firma Conductor"}</strong><br/>
              <small>Conductor de Unidad</small>
            </div>
          </div>

          <div class="sig-box">
            <div>
              ${doc.firma_autorizador ? `<img src="${doc.firma_autorizador}" class="sig-img" alt="Firma Autorizador" />` : '<div style="height: 60px; font-style: italic; color: #64748b;">[Pendiente Firma Autorizador]</div>'}
            </div>
            <div>
              <hr style="border: 0; border-top: 1px solid #000; margin: 4px 0;" />
              <strong>${doc.nombre_autorizador_firma || "Nombre y Firma Autorizador"}</strong><br/>
              <small>Coordinador / Gerente / QHSE</small>
            </div>
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
            Revisión y aprobación de formatos de riesgo SII-MX-23-LOG-003 v3.0
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
            <option value="MEDIO">🟡 Riesgo Medio (16-23)</option>
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
                        👁️ Ver Detalle
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Completo de Detalle y Aprobación */}
      {selectedDoc && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 9999, display: "grid", placeItems: "center", padding: "16px", overflowY: "auto" }}>
          <div style={{ background: "#ffffff", borderRadius: "12px", maxWidth: "850px", width: "100%", padding: "24px", maxHeight: "92vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.4)" }}>
            
            {/* Header modal */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid #0f172a", paddingBottom: "10px", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <img src={logoAQR} alt="Logo AQUARIO" style={{ height: "44px", objectFit: "contain" }} />
                <div>
                  <h2 style={{ margin: 0, fontSize: "1.15rem", color: "#0f172a" }}>Documento de Gerenciamiento Vehicular {selectedDoc.folio_documento}</h2>
                  <small style={{ color: "#64748b", fontWeight: "bold" }}>SII-MX-23-LOG-003 v3.0 · Logística</small>
                </div>
              </div>
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <button
                  type="button"
                  onClick={() => openGerenciamientoPdfPreview(selectedDoc)}
                  style={{ background: "#0284c7", color: "#ffffff", border: 0, padding: "8px 14px", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "0.85rem" }}
                >
                  🔍 Vista Previa / Imprimir PDF
                </button>
                <button onClick={() => setSelectedDoc(null)} style={{ background: "transparent", border: 0, fontSize: "1.4rem", cursor: "pointer", color: "#64748b" }}>✕</button>
              </div>
            </div>

            {/* Datos Generales de Salida */}
            <div style={{ background: "#f8fafc", padding: "14px", borderRadius: "8px", border: "1px solid #e2e8f0", marginBottom: "14px" }}>
              <h4 style={{ margin: "0 0 10px", color: "#0f172a", borderBottom: "1px solid #cbd5e1", paddingBottom: "4px" }}>📋 Datos Generales de Salida</h4>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "8px", fontSize: "0.88rem" }}>
                <div><strong>Folio:</strong> {selectedDoc.folio_documento} #{selectedDoc.id_gerenciamiento}</div>
                <div><strong>Fecha Emisión:</strong> {String(selectedDoc.fecha_emision || "").split("T")[0]}</div>
                <div><strong>Hora de Salida:</strong> {selectedDoc.hora_salida || "N/A"}</div>
                <div><strong>Departamento:</strong> {selectedDoc.departamento || "Logística"}</div>
                <div><strong>Origen:</strong> {selectedDoc.origen_nombre || selectedDoc.origen_texto || "N/A"}</div>
                <div><strong>Destino Final:</strong> {selectedDoc.destino_nombre || selectedDoc.destino_texto || "N/A"}</div>
                <div><strong>Kilometraje Inicial:</strong> {selectedDoc.kilometraje || 0} km</div>
              </div>
            </div>

            {/* 1. Valoración Médica Pre-viaje */}
            <div style={{ background: "#ffffff", padding: "14px", borderRadius: "8px", border: "1px solid #cbd5e1", marginBottom: "14px" }}>
              <h4 style={{ margin: "0 0 10px", color: "#1e3a8a", borderBottom: "1px solid #e2e8f0", paddingBottom: "4px" }}>🩺 1. Valoración Médica Pre-viaje</h4>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "8px", fontSize: "0.85rem" }}>
                <div><strong>Presión Arterial:</strong> {selectedDoc.presion_arterial || "N/A"}</div>
                <div><strong>Examen Visual:</strong> {selectedDoc.examen_visual || "N/A"}</div>
                <div><strong>Glucosa:</strong> {selectedDoc.glucosa || "N/A"}</div>
                <div><strong>Alcoholímetro:</strong> <span style={{ fontWeight: "bold", color: selectedDoc.alcoholimetro ? "#dc2626" : "#166534" }}>{selectedDoc.alcoholimetro ? "POSITIVO (+)" : "NEGATIVO (0.00)"}</span></div>
                <div><strong>Frec. Cardíaca:</strong> {selectedDoc.frecuencia_cardiaca || "N/A"}</div>
                <div><strong>Frec. Respiratoria:</strong> {selectedDoc.frecuencia_respiratoria || "N/A"}</div>
              </div>
            </div>

            {/* 2. Información General del Traslado */}
            <div style={{ background: "#ffffff", padding: "14px", borderRadius: "8px", border: "1px solid #cbd5e1", marginBottom: "14px" }}>
              <h4 style={{ margin: "0 0 10px", color: "#1e3a8a", borderBottom: "1px solid #e2e8f0", paddingBottom: "4px" }}>🚙 2. Información General del Traslado</h4>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "8px", fontSize: "0.85rem", marginBottom: "10px" }}>
                <div><strong>Unidad / No. Eco:</strong> {selectedDoc.numero_unidad || "N/A"} ({selectedDoc.tipo_vehiculo || "N/A"})</div>
                <div><strong>Placa:</strong> {selectedDoc.placa || "N/A"}</div>
                <div><strong>Modelo:</strong> {selectedDoc.modelo || "N/A"}</div>
                <div><strong>Color:</strong> {selectedDoc.color || "N/A"}</div>
                <div><strong>Vehículo Empresa:</strong> {selectedDoc.vehiculo_empresa ? "SÍ" : "NO"}</div>
                <div><strong>Contratista:</strong> {selectedDoc.nombre_contratista || "N/A"}</div>
                <div><strong>Conductor:</strong> {selectedDoc.nombre_conductor || selectedDoc.conductor_nombre}</div>
                <div><strong>Licencia:</strong> {selectedDoc.licencia_numero || "N/A"} ({selectedDoc.licencia_tipo || "Chofer"})</div>
                <div><strong>Vencimiento Licencia:</strong> {selectedDoc.licencia_vencimiento ? String(selectedDoc.licencia_vencimiento).split("T")[0] : "N/A"}</div>
                <div><strong>Teléfono Conductor:</strong> {selectedDoc.telefono_conductor || "N/A"}</div>
                <div><strong>Tiempo Estimado Viaje:</strong> {selectedDoc.tiempo_viaje_horas || 1} horas</div>
              </div>

              <div style={{ background: "#f8fafc", padding: "10px", borderRadius: "6px", border: "1px solid #e2e8f0", fontSize: "0.85rem", marginTop: "8px" }}>
                <div style={{ marginBottom: "6px" }}>
                  <strong>Ruta a Seguir (Puntos):</strong> {Array.isArray(selectedDoc.ruta_puntos) && selectedDoc.ruta_puntos.length ? selectedDoc.ruta_puntos.join(" ➔ ") : (selectedDoc.ruta_puntos || "No especificados")}
                </div>
                <div>
                  <strong>Acompañantes:</strong> {Array.isArray(selectedDoc.acompanantes) && selectedDoc.acompanantes.length ? selectedDoc.acompanantes.join(", ") : (selectedDoc.acompanantes || "Sin acompañantes")}
                </div>
              </div>

              {/* Sitios de reporte */}
              {Array.isArray(selectedDoc.sitios_reporte) && selectedDoc.sitios_reporte.length > 0 && (
                <div style={{ marginTop: "10px", background: "#f1f5f9", padding: "10px", borderRadius: "6px" }}>
                  <strong style={{ fontSize: "0.83rem", color: "#334155" }}>Sitios de Reporte en Ruta (Para viajes &gt; 1 hora):</strong>
                  <ul style={{ margin: "4px 0 0", paddingLeft: "18px", fontSize: "0.82rem" }}>
                    {selectedDoc.sitios_reporte.map((s, idx) => (
                      <li key={idx}>
                        Punto {idx + 1}: <strong>{s.punto}</strong> — {s.horaReportada ? `✅ Reportado a las ${s.horaReportada}` : "⏱️ Pendiente de reporte durante viaje en curso"}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* 3. Lista de Verificación Previaje */}
            <div style={{ background: "#ffffff", padding: "14px", borderRadius: "8px", border: "1px solid #cbd5e1", marginBottom: "14px" }}>
              <h4 style={{ margin: "0 0 10px", color: "#1e3a8a", borderBottom: "1px solid #e2e8f0", paddingBottom: "4px" }}>✅ 3. Lista de Verificación de Previaje (Control SÍ / NO)</h4>
              <div style={{ display: "grid", gap: "6px", fontSize: "0.83rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", background: "#f8fafc", padding: "6px 10px", borderRadius: "4px" }}>
                  <span>1. ¿El conductor tiene conocimiento de los riesgos locales (vía, clima, peatones, animales, ciclistas)?</span>
                  <strong>{selectedDoc.conocimiento_riesgos_locales !== false ? "SÍ" : "NO"}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", background: "#f8fafc", padding: "6px 10px", borderRadius: "4px" }}>
                  <span>2. ¿El conductor está informado que es prohibido transportar personal ajeno a la empresa?</span>
                  <strong>{selectedDoc.prohibido_personal_ajeno !== false ? "SÍ" : "NO"}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", background: "#f8fafc", padding: "6px 10px", borderRadius: "4px" }}>
                  <span>3. ¿Se realizó la inspección del vehículo con la lista de chequeo? (Anexar registro)</span>
                  <strong>{selectedDoc.inspeccion_vehiculo_realizada !== false ? "SÍ" : "NO"}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", background: "#f8fafc", padding: "6px 10px", borderRadius: "4px" }}>
                  <span>4. ¿Se realizó la reunión pre caravana? (Sólo para viajes de más de 1 vehículo incluyendo pesado)</span>
                  <strong>{selectedDoc.reunion_pre_caravana_realizada ? "SÍ" : "NO"}</strong>
                </div>
              </div>
            </div>

            {/* 4. Matriz de Análisis de Riesgos */}
            <div style={{ background: "#f1f5f9", padding: "14px", borderRadius: "8px", marginBottom: "14px", borderLeft: `6px solid ${selectedDoc.nivel_riesgo === 'ALTO' ? '#dc2626' : selectedDoc.nivel_riesgo === 'MEDIO' ? '#ca8a04' : '#16a34a'}` }}>
              <h4 style={{ margin: "0 0 8px", color: "#0f172a" }}>⚠️ 4. Análisis de Riesgos (Tabuladores A al G)</h4>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "6px", fontSize: "0.82rem", marginBottom: "10px" }}>
                <div>A. Distancia: <strong>{selectedDoc.pts_distancia || 1} ptos</strong></div>
                <div>B. Clima: <strong>{selectedDoc.pts_clima || 2} ptos</strong></div>
                <div>C. Vehículos/Personas: <strong>{selectedDoc.pts_vehiculos_personas || 1} ptos</strong></div>
                <div>D. Vía: <strong>{selectedDoc.pts_condiciones_via || 1} ptos</strong></div>
                <div>E. Comunicaciones: <strong>{selectedDoc.pts_comunicaciones || 0} ptos</strong></div>
                <div>F. Horas Trabajadas: <strong>{selectedDoc.pts_horas_trabajadas || 1} ptos</strong></div>
                <div>G. Hora Traslado: <strong>{selectedDoc.pts_hora_traslado || 1} ptos</strong></div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #cbd5e1", paddingTop: "8px" }}>
                <div>
                  <strong style={{ fontSize: "1.1rem" }}>PUNTUAJE TOTAL: {selectedDoc.puntaje_total} ptos</strong>
                  <div style={{ fontSize: "0.82rem", color: "#475569" }}>Nivel de Autorización Requerido: <strong>{selectedDoc.autorizacion_requerida}</strong></div>
                </div>
                <div style={{ background: selectedDoc.nivel_riesgo === 'ALTO' ? '#dc2626' : selectedDoc.nivel_riesgo === 'MEDIO' ? '#ca8a04' : '#16a34a', color: "#fff", padding: "6px 14px", borderRadius: "16px", fontWeight: "bold", fontSize: "0.88rem" }}>
                  RIESGO {selectedDoc.nivel_riesgo}
                </div>
              </div>
            </div>

            {/* 5. Firma del Conductor */}
            {selectedDoc.firma_conductor && (
              <div style={{ marginBottom: "16px", background: "#f8fafc", padding: "10px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                <strong style={{ fontSize: "0.85rem" }}>Firma Digital del Conductor:</strong>
                <div style={{ background: "#ffffff", border: "1px solid #cbd5e1", padding: "6px", borderRadius: "6px", display: "inline-block", marginTop: "4px" }}>
                  <img src={selectedDoc.firma_conductor} alt="Firma Conductor" style={{ maxHeight: "85px" }} />
                </div>
              </div>
            )}

            {/* Formulario de Firma y Aprobación del Autorizador */}
            <div style={{ borderTop: "2px solid #0f172a", paddingTop: "16px", marginTop: "16px" }}>
              <h4 style={{ margin: "0 0 10px", color: "#1e3a8a" }}>✍️ Firma y Aprobación del Autorizador / Supervisor</h4>

              <div style={{ display: "grid", gap: "12px", marginBottom: "14px" }}>
                {/* Seleccionar a la persona */}
                <label style={{ fontSize: "0.85rem", fontWeight: "bold" }}>
                  Seleccionar Autorizador / Supervisor *:
                  <select
                    value={autorizadorId}
                    onChange={(e) => handleSelectAutorizador(e.target.value)}
                    style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1", marginTop: "4px", background: "#ffffff" }}
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
                    style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1", marginTop: "4px", background: "#ffffff" }}
                  />
                </label>

                <label style={{ fontSize: "0.85rem", fontWeight: "bold" }}>
                  Observaciones / Acciones de Control:
                  <textarea
                    value={observaciones}
                    onChange={(e) => setObservaciones(e.target.value)}
                    rows={2}
                    placeholder="Detalle acciones de control o notas de aprobación"
                    style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1", marginTop: "4px", background: "#ffffff" }}
                  />
                </label>

                {/* Canvas de Firma Digital del Supervisor */}
                {selectedDoc.estado === "APROBADO" && selectedDoc.firma_autorizador ? (
                  <div style={{ background: "#f0fdf4", padding: "10px", borderRadius: "8px", border: "1px solid #bbf7d0" }}>
                    <strong style={{ fontSize: "0.85rem", color: "#166534" }}>✅ Documento Aprobado por: {selectedDoc.nombre_autorizador_firma}</strong>
                    <div style={{ marginTop: "4px" }}>
                      <img src={selectedDoc.firma_autorizador} alt="Firma Autorizador" style={{ maxHeight: "80px", background: "#ffffff", padding: "4px", borderRadius: "4px", border: "1px solid #cbd5e1" }} />
                    </div>
                  </div>
                ) : (
                  <ApprovalSignature onChange={setFirmaAutorizador} />
                )}
              </div>

              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "16px" }}>
                <button
                  type="button"
                  onClick={() => handleAprobarRechazar("RECHAZADO")}
                  disabled={approving}
                  style={{ background: "#ef4444", color: "#ffffff", border: 0, padding: "10px 20px", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}
                >
                  ❌ Rechazar Viaje
                </button>
                <button
                  type="button"
                  onClick={() => handleAprobarRechazar("APROBADO")}
                  disabled={approving}
                  style={{ background: "#16a34a", color: "#ffffff", border: 0, padding: "10px 22px", borderRadius: "6px", fontWeight: "bold", cursor: "pointer", boxShadow: "0 4px 12px rgba(22, 163, 74, 0.3)" }}
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
