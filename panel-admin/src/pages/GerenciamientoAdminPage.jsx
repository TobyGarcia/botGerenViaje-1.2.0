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

  // Generador del Formato Ajustado Exactamente a 1 Hoja Tamaña Carta (Letter)
  function openGerenciamientoPdfPreview(doc, autoPrint = true) {
    const printWindow = window.open("", "_blank", "width=980,height=1100");
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
          @page { size: letter portrait; margin: 4mm 6mm; }
          * { box-sizing: border-box; }
          body { font-family: Arial, Helvetica, sans-serif; font-size: 9px; color: #000; margin: 0; padding: 4px; line-height: 1.15; }
          .sheet-container { border: 1.5px solid #000; padding: 4px; width: 100%; max-width: 820px; margin: 0 auto; background: #fff; }
          .header-table { width: 100%; border-collapse: collapse; margin-bottom: 0; }
          .header-table td { border: 1px solid #000; padding: 2px 4px; text-align: center; vertical-align: middle; }
          .logo-cell { width: 22%; }
          .title-cell { width: 53%; font-weight: bold; font-size: 11px; }
          .meta-cell { width: 25%; font-size: 8.5px; text-align: left; }
          .banner-title { background: #d1d5db; font-weight: bold; text-align: center; font-size: 11px; padding: 3px; border: 1px solid #000; border-top: 0; text-transform: uppercase; }
          table.data-table { width: 100%; border-collapse: collapse; margin-bottom: 0; font-size: 8.5px; }
          table.data-table td, table.data-table th { border: 1px solid #000; padding: 2px 4px; text-align: left; }
          table.data-table th { background: #f3f4f6; font-weight: bold; }
          .section-header { background: #e5e7eb; font-weight: bold; text-align: center; font-size: 9.5px; padding: 2px; border: 1px solid #000; border-top: 0; text-transform: uppercase; }
          .risk-grid { display: grid; grid-template-columns: 1fr 1fr 1.15fr; border: 1px solid #000; border-top: 0; font-size: 8.5px; }
          .risk-col { border-right: 1px solid #000; }
          .risk-col:last-child { border-right: 0; }
          .risk-header-bar { background: #fbbf24; font-weight: bold; text-align: center; border-bottom: 1px solid #000; padding: 1.5px; font-size: 8.5px; }
          .item-row { display: flex; justify-content: space-between; border-bottom: 1px solid #e5e7eb; padding: 1.5px 3px; font-size: 8px; }
          .item-row.selected { background: #fef08a; font-weight: bold; }
          .class-banner { background: #fee2e2; border: 1px solid #000; border-top: 0; text-align: center; font-weight: bold; font-size: 8px; padding: 2px; }
          .class-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; border: 1px solid #000; border-top: 0; font-size: 8.5px; text-align: center; }
          .class-box { border-right: 1px solid #000; padding: 3px; }
          .class-box:last-child { border-right: 0; }
          .class-box.green { background: #dcfce7; }
          .class-box.yellow { background: #fef9c3; }
          .class-box.red { background: #fee2e2; }
          .signatures-container { border: 1px solid #000; border-top: 0; padding: 4px; }
          .driver-sig-box { text-align: center; margin-bottom: 6px; }
          .authorizers-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; text-align: center; margin-top: 4px; }
          .sig-line { border-top: 1px solid #000; width: 75%; margin: 2px auto 1px auto; font-weight: bold; font-size: 8.5px; }
          .footer-note { font-size: 7.5px; color: #dc2626; font-weight: bold; text-align: center; margin-top: 3px; }
          @media print { body { margin: 0; padding: 0; } .sheet-container { border: 1px solid #000; padding: 3px; max-width: 100%; } .no-print { display: none !important; } }
        </style>
      </head>
      <body>
        <div class="no-print" style="margin-bottom: 8px; text-align: right; max-width: 820px; margin: 0 auto;">
          <button onclick="window.print()" style="padding: 6px 14px; background: #0284c7; color: #fff; border: 0; border-radius: 4px; font-weight: bold; cursor: pointer;">🖨️ Imprimir</button>
        </div>
        <div class="sheet-container">
          <table class="header-table">
            <tr>
              <td class="logo-cell"><img src="${logoAQR}" alt="AQUARIO" style="max-height: 36px;" /></td>
              <td class="title-cell">CÓDIGO R2PLOG1 / ${doc.folio_documento}</td>
              <td class="meta-cell"><strong>Sistema:</strong> SGI<br /><strong>Versión:</strong> ${doc.version_documento || "3.0"}</td>
            </tr>
          </table>
          <div class="banner-title">GERENCIAMIENTO DE VIAJE</div>
          <table class="data-table">
            <tr>
              <th>FECHA</th><td>${dia}/${mes}/${anio}</td>
              <th>HORA</th><td>${horaHH}:${horaMM}</td>
              <th>FOLIO</th><td>${doc.folio_documento}</td>
            </tr>
          </table>
          <div class="section-header">1. INFORMACIÓN GENERAL</div>
          <table class="data-table">
            <tr><th>Conductor</th><td>${doc.nombre_conductor}</td><th>Vehículo</th><td>${doc.tipo_vehiculo}</td></tr>
          </table>
          <div class="section-header">3. ANÁLISIS DE RIESGOS</div>
          <div class="risk-grid">
            <div class="risk-col">
              <div class="risk-header-bar">A. Distancia</div>
              <div class="item-row ${doc.pts_distancia === 1 ? 'selected' : ''}"><span>Distancia</span><span>${doc.pts_distancia}</span></div>
            </div>
            <div class="risk-col">
              <div class="risk-header-bar">B. Clima</div>
              <div class="item-row ${doc.pts_clima === 2 ? 'selected' : ''}"><span>Clima</span><span>${doc.pts_clima}</span></div>
            </div>
            <div class="risk-col">
              <div class="risk-header-bar">Total</div>
              <div style="text-align: center; font-size: 14px; font-weight: bold;">${doc.puntaje_total} pts</div>
            </div>
          </div>
          <div class="signatures-container">
            <div class="driver-sig-box">
              ${doc.firma_conductor ? `<img src="${doc.firma_conductor}" style="max-height: 40px;" />` : ''}
              <div class="sig-line">${doc.nombre_conductor}</div>
            </div>
          </div>
        </div>
        <script>
          ${autoPrint ? "window.onload = function() { window.print(); };" : ""}
        </script>
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
            Revisión y aprobación de formatos de riesgo SII-MX-23-LOG-003 v3.0 (R2PLOG1) — Tamaño Carta
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
                      <div style={{ display: "flex", gap: "6px", justifyContent: "center" }}>
                        <button onClick={() => { setSelectedDoc(item); setFirmaAutorizador(""); setObservaciones(item.observaciones || ""); setAutorizadorNombre(item.nombre_autorizador_firma || user?.nombre || user?.username || ""); }} style={{ background: "#1e3a8a", color: "#fff", border: 0, padding: "6px 10px", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", fontSize: "0.8rem" }} title="Ver formato en pantalla">
                          👁️ Ver Hoja
                        </button>
                        <button onClick={() => openGerenciamientoPdfPreview(item, true)} style={{ background: "#16a34a", color: "#fff", border: 0, padding: "6px 10px", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", fontSize: "0.8rem" }} title="Descargar o Imprimir PDF">
                          📥 Descargar PDF
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal con Hoja Ajustada a Tamaño Carta */}
      {selectedDoc && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 9999, display: "grid", placeItems: "center", padding: "12px", overflowY: "auto" }}>
          <div style={{ background: "#ffffff", borderRadius: "8px", maxWidth: "860px", width: "100%", padding: "16px", maxHeight: "96vh", overflowY: "auto", boxShadow: "0 25px 60px rgba(0,0,0,0.5)", border: "2px solid #000" }}>
            
            {/* Toolbar modal */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid #000", paddingBottom: "8px", marginBottom: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <img src={logoAQR} alt="AQUARIO" style={{ height: "32px" }} />
                <span style={{ fontWeight: "bold", fontSize: "1.05rem" }}>GERENCIAMIENTO DE VIAJE — {selectedDoc.folio_documento} (Carta)</span>
              </div>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <button
                  type="button"
                  onClick={() => openGerenciamientoPdfPreview(selectedDoc, true)}
                  style={{ background: "#16a34a", color: "#ffffff", border: 0, padding: "6px 14px", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", fontSize: "0.82rem" }}
                >
                  📥 Descargar / Imprimir PDF
                </button>
                <button onClick={() => setSelectedDoc(null)} style={{ background: "transparent", border: 0, fontSize: "1.3rem", cursor: "pointer", fontWeight: "bold" }}>✕</button>
              </div>
            </div>

            {/* HOJA EN FORMATO TAMAÑO CARTA COMPACTA */}
            <div style={{ border: "1.5px solid #000", padding: "6px", background: "#ffffff", fontSize: "0.78rem" }}>
              
              {/* Encabezado */}
              <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 0 }}>
                <tbody>
                  <tr>
                    <td style={{ border: "1px solid #000", padding: "4px", width: "22%", textAlign: "center" }}>
                      <img src={logoAQR} alt="AQUARIO" style={{ maxHeight: "34px" }} />
                    </td>
                    <td style={{ border: "1px solid #000", padding: "4px", width: "53%", textAlign: "center", fontWeight: "bold", fontSize: "0.9rem" }}>
                      CÓDIGO<br />R2PLOG1 / {selectedDoc.folio_documento}
                    </td>
                    <td style={{ border: "1px solid #000", padding: "4px", width: "25%", fontSize: "0.72rem" }}>
                      <strong>Sistema:</strong> SGI<br />
                      <strong>Versión:</strong> {selectedDoc.version_documento || "3.0"}<br />
                      <strong>Página:</strong> 1 de 1
                    </td>
                  </tr>
                </tbody>
              </table>

              <div style={{ background: "#d1d5db", fontWeight: "bold", textAlign: "center", fontSize: "0.88rem", padding: "3px", border: "1px solid #000", borderTop: 0, textTransform: "uppercase" }}>
                GERENCIAMIENTO DE VIAJE
              </div>

              {/* Metadata */}
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.75rem" }}>
                <tbody>
                  <tr>
                    <th style={{ border: "1px solid #000", background: "#f3f4f6", padding: "2px 4px", width: "12%" }}>FECHA</th>
                    <td style={{ border: "1px solid #000", padding: "2px 4px", width: "25%" }}>
                      DÍA: <strong>{String(selectedDoc.fecha_emision || "").split("T")[0].split("-")[2] || "01"}</strong> /
                      MES: <strong>{String(selectedDoc.fecha_emision || "").split("T")[0].split("-")[1] || "09"}</strong> /
                      AÑO: <strong>{String(selectedDoc.fecha_emision || "").split("T")[0].split("-")[0] || "2026"}</strong>
                    </td>
                    <th style={{ border: "1px solid #000", background: "#f3f4f6", padding: "2px 4px", width: "15%" }}>HORA DE SALIDA</th>
                    <td style={{ border: "1px solid #000", padding: "2px 4px", width: "20%" }}>HORA: <strong>{selectedDoc.hora_salida || "08:00"}</strong></td>
                    <th style={{ border: "1px solid #000", background: "#f3f4f6", padding: "2px 4px", width: "10%" }}>FOLIO</th>
                    <td style={{ border: "1px solid #000", padding: "2px 4px", width: "18%" }}><strong>{selectedDoc.folio_documento}</strong></td>
                  </tr>
                  <tr>
                    <th style={{ border: "1px solid #000", background: "#f3f4f6", padding: "2px 4px" }}>ORIGEN</th>
                    <td style={{ border: "1px solid #000", padding: "2px 4px" }} colSpan={2}><strong>{selectedDoc.origen_nombre || selectedDoc.origen_texto || "N/A"}</strong></td>
                    <th style={{ border: "1px solid #000", background: "#f3f4f6", padding: "2px 4px" }}>DESTINO</th>
                    <td style={{ border: "1px solid #000", padding: "2px 4px" }} colSpan={2}><strong>{selectedDoc.destino_nombre || selectedDoc.destino_texto || "N/A"}</strong></td>
                  </tr>
                  <tr>
                    <th style={{ border: "1px solid #000", background: "#f3f4f6", padding: "2px 4px" }}>DEPARTAMENTO</th>
                    <td style={{ border: "1px solid #000", padding: "2px 4px" }} colSpan={2}>{selectedDoc.departamento || "Logística"}</td>
                    <th style={{ border: "1px solid #000", background: "#f3f4f6", padding: "2px 4px" }}>KILOMETRAJE</th>
                    <td style={{ border: "1px solid #000", padding: "2px 4px" }} colSpan={2}><strong>{selectedDoc.kilometraje || 0} km</strong></td>
                  </tr>
                </tbody>
              </table>

              {/* 1. INFORMACIÓN GENERAL */}
              <div style={{ background: "#e5e7eb", fontWeight: "bold", textAlign: "center", padding: "2px", border: "1px solid #000", borderTop: 0, fontSize: "0.8rem" }}>
                1. INFORMACIÓN GENERAL
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.75rem" }}>
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
                      [ {selectedDoc.vehiculo_empresa !== false ? "X" : " "} ] SÍ &nbsp;
                      [ {selectedDoc.vehiculo_empresa === false ? "X" : " "} ] NO
                    </td>
                    <th style={{ border: "1px solid #000", background: "#f3f4f6", padding: "2px 4px" }} colSpan={2}>Nombre empresa contratista</th>
                    <td style={{ border: "1px solid #000", padding: "2px 4px" }} colSpan={2}>{selectedDoc.nombre_contratista || "N/A"}</td>
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
              <div style={{ background: "#f9fafb", fontWeight: "bold", border: "1px solid #000", borderTop: 0, padding: "2px 4px", fontSize: "0.72rem" }}>
                Sitios de reporte (para viajes superiores a 1 hora)
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.72rem" }}>
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
              <div style={{ background: "#e5e7eb", fontWeight: "bold", textAlign: "center", padding: "2px", border: "1px solid #000", borderTop: 0, fontSize: "0.8rem" }}>
                2. LISTA VERIFICACIÓN DE PREVIAJE
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.72rem" }}>
                <thead>
                  <tr>
                    <th style={{ border: "1px solid #000", background: "#f3f4f6", padding: "2px 4px", textAlign: "left" }}>Pregunta de Control</th>
                    <th style={{ border: "1px solid #000", background: "#f3f4f6", padding: "2px 4px", width: "8%", textAlign: "center" }}>SI</th>
                    <th style={{ border: "1px solid #000", background: "#f3f4f6", padding: "2px 4px", width: "8%", textAlign: "center" }}>NO</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ border: "1px solid #000", padding: "2px 4px" }}>1. ¿El conductor tiene conocimiento de los riesgos locales (estado de la vía (google maps), clima, peatones, animales, ciclistas)?</td>
                    <td style={{ border: "1px solid #000", textAlign: "center", fontWeight: "bold" }}>{selectedDoc.conocimiento_riesgos_locales !== false ? "X" : ""}</td>
                    <td style={{ border: "1px solid #000", textAlign: "center", fontWeight: "bold" }}>{selectedDoc.conocimiento_riesgos_locales === false ? "X" : ""}</td>
                  </tr>
                  <tr>
                    <td style={{ border: "1px solid #000", padding: "2px 4px" }}>2. ¿El conductor ha consumido medicamentos que producen somnolencia o presenta padecimiento del sueño?</td>
                    <td style={{ border: "1px solid #000", textAlign: "center", fontWeight: "bold" }}>{selectedDoc.alcoholimetro ? "X" : ""}</td>
                    <td style={{ border: "1px solid #000", textAlign: "center", fontWeight: "bold" }}>{!selectedDoc.alcoholimetro ? "X" : ""}</td>
                  </tr>
                  <tr>
                    <td style={{ border: "1px solid #000", padding: "2px 4px" }}>3. ¿El conductor ha dormido adecuadamente?</td>
                    <td style={{ border: "1px solid #000", textAlign: "center", fontWeight: "bold" }}>{selectedDoc.prohibido_personal_ajeno !== false ? "X" : ""}</td>
                    <td style={{ border: "1px solid #000", textAlign: "center", fontWeight: "bold" }}>{selectedDoc.prohibido_personal_ajeno === false ? "X" : ""}</td>
                  </tr>
                  <tr>
                    <td style={{ border: "1px solid #000", padding: "2px 4px" }}>4. ¿El conductor está informado que es prohibido transportar personal ajeno a la empresa?</td>
                    <td style={{ border: "1px solid #000", textAlign: "center", fontWeight: "bold" }}>{selectedDoc.prohibido_personal_ajeno !== false ? "X" : ""}</td>
                    <td style={{ border: "1px solid #000", textAlign: "center", fontWeight: "bold" }}>{selectedDoc.prohibido_personal_ajeno === false ? "X" : ""}</td>
                  </tr>
                  <tr>
                    <td style={{ border: "1px solid #000", padding: "2px 4px" }}>5. ¿Se realizó la inspección del vehículo con la lista de chequeo? (Anexar registro)</td>
                    <td style={{ border: "1px solid #000", textAlign: "center", fontWeight: "bold" }}>{selectedDoc.inspeccion_vehiculo_realizada !== false ? "X" : ""}</td>
                    <td style={{ border: "1px solid #000", textAlign: "center", fontWeight: "bold" }}>{selectedDoc.inspeccion_vehiculo_realizada === false ? "X" : ""}</td>
                  </tr>
                  <tr>
                    <td style={{ border: "1px solid #000", padding: "2px 4px" }}>6. ¿Se realizó la reunión pre caravana? (Anexar registro) *Sólo para viajes de más de un vehículo incluyendo pesado.</td>
                    <td style={{ border: "1px solid #000", textAlign: "center", fontWeight: "bold" }}>{selectedDoc.reunion_pre_caravana_realizada ? "X" : ""}</td>
                    <td style={{ border: "1px solid #000", textAlign: "center", fontWeight: "bold" }}>{!selectedDoc.reunion_pre_caravana_realizada ? "X" : ""}</td>
                  </tr>
                </tbody>
              </table>

              {/* 3. ANÁLISIS DE RIESGOS */}
              <div style={{ background: "#e5e7eb", fontWeight: "bold", textAlign: "center", padding: "2px", border: "1px solid #000", borderTop: 0, fontSize: "0.8rem" }}>
                3. ANÁLISIS DE RIESGOS
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.15fr", border: "1px solid #000", borderTop: 0, fontSize: "0.72rem" }}>
                
                {/* Columna A, D, G */}
                <div style={{ borderRight: "1px solid #000" }}>
                  <div style={{ background: "#fbbf24", fontWeight: "bold", textAlign: "center", padding: "1.5px", borderBottom: "1px solid #000" }}>A. Distancia a Recorrer / Ptos</div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "1.5px 3px", background: selectedDoc.pts_distancia === 1 ? "#fef08a" : "transparent" }}><span>Menos de 50 Km</span><span>1</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "1.5px 3px", background: selectedDoc.pts_distancia === 2 ? "#fef08a" : "transparent" }}><span>Menos de 100 Km</span><span>2</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "1.5px 3px", background: selectedDoc.pts_distancia === 5 ? "#fef08a" : "transparent" }}><span>Menos de 200 Km</span><span>5</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "1.5px 3px", background: selectedDoc.pts_distancia === 8 ? "#fef08a" : "transparent" }}><span>Mas de 200 Km</span><span>8</span></div>

                  <div style={{ background: "#fbbf24", fontWeight: "bold", textAlign: "center", padding: "1.5px", borderTop: "1px solid #000", borderBottom: "1px solid #000" }}>D. Condiciones de la vía / Ptos</div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "1.5px 3px", background: selectedDoc.pts_condiciones_via === 1 ? "#fef08a" : "transparent" }}><span>Pavimentada</span><span>1</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "1.5px 3px", background: selectedDoc.pts_condiciones_via === 2 ? "#fef08a" : "transparent" }}><span>Mixta (&lt;50% No Pav.)</span><span>2</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "1.5px 3px", background: selectedDoc.pts_condiciones_via === 4 ? "#fef08a" : "transparent" }}><span>No Pavimentada</span><span>4</span></div>

                  <div style={{ background: "#fbbf24", fontWeight: "bold", textAlign: "center", padding: "1.5px", borderTop: "1px solid #000", borderBottom: "1px solid #000" }}>G. Hora del traslado / Ptos</div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "1.5px 3px", background: selectedDoc.pts_hora_traslado === 1 ? "#fef08a" : "transparent" }}><span>Día (6-18)</span><span>1</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "1.5px 3px", background: selectedDoc.pts_hora_traslado === 8 ? "#fef08a" : "transparent" }}><span>Noche (18-6)</span><span>8</span></div>
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
                <div style={{ background: "#dcfce7", padding: "4px", borderRight: "1px solid #000" }}>
                  <strong>RIESGO BAJO (0 A 15 PUNTOS)</strong><br />
                  AUTORIZA SUPERVISOR DIRECTO Y QHSE
                </div>
                <div style={{ background: "#fef9c3", padding: "4px", borderRight: "1px solid #000" }}>
                  <strong>RIESGO MEDIO (16 A 22 PUNTOS)</strong><br />
                  COORDINACIONES DE AREA
                </div>
                <div style={{ background: "#fee2e2", padding: "4px" }}>
                  <strong>RIESGO ALTO (&gt; 23 PUNTOS)</strong><br />
                  AUTORIZA GERENCIA GENERAL
                </div>
              </div>

              {/* Firmas */}
              <div style={{ border: "1px solid #000", borderTop: 0, padding: "6px", background: "#ffffff" }}>
                <div style={{ textAlign: "center", marginBottom: "6px" }}>
                  {selectedDoc.firma_conductor ? (
                    <img src={selectedDoc.firma_conductor} alt="Firma Conductor" style={{ maxHeight: "42px" }} />
                  ) : (
                    <div style={{ height: "35px" }}>[Sin Firma Conductor]</div>
                  )}
                  <div style={{ borderTop: "1px solid #000", width: "60%", margin: "2px auto 1px auto", fontWeight: "bold", fontSize: "0.75rem" }}>
                    {selectedDoc.nombre_conductor_firma || selectedDoc.nombre_conductor || "NOMBRE Y FIRMA CONDUCTOR"}
                  </div>
                  <small style={{ fontWeight: "bold", fontSize: "0.7rem" }}>CONDUCTOR</small>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", textAlign: "center" }}>
                  <div>
                    {selectedDoc.firma_autorizador ? <img src={selectedDoc.firma_autorizador} alt="Firma Autorizador" style={{ maxHeight: "35px" }} /> : <div style={{ height: "30px" }}></div>}
                    <div style={{ borderTop: "1px solid #000", width: "80%", margin: "2px auto 1px auto", fontSize: "0.7rem", fontWeight: "bold" }}>
                      {selectedDoc.nombre_autorizador_firma || "NOMBRE Y FIRMA"}
                    </div>
                    <small style={{ fontSize: "0.68rem" }}>QHSE</small>
                  </div>
                  <div>
                    {selectedDoc.firma_autorizador ? <img src={selectedDoc.firma_autorizador} alt="Firma Sitio" style={{ maxHeight: "35px" }} /> : <div style={{ height: "30px" }}></div>}
                    <div style={{ borderTop: "1px solid #000", width: "80%", margin: "2px auto 1px auto", fontSize: "0.7rem", fontWeight: "bold" }}>
                      {selectedDoc.nombre_autorizador_firma || "NOMBRE Y FIRMA"}
                    </div>
                    <small style={{ fontSize: "0.68rem" }}>AUTORIDAD DE ÁREA O SITIO</small>
                  </div>
                  <div>
                    {selectedDoc.firma_autorizador ? <img src={selectedDoc.firma_autorizador} alt="Firma Gerente" style={{ maxHeight: "35px" }} /> : <div style={{ height: "30px" }}></div>}
                    <div style={{ borderTop: "1px solid #000", width: "80%", margin: "2px auto 1px auto", fontSize: "0.7rem", fontWeight: "bold" }}>
                      {selectedDoc.nombre_autorizador_firma || "NOMBRE Y FIRMA"}
                    </div>
                    <small style={{ fontSize: "0.68rem" }}>GERENTE DE ÁREA</small>
                  </div>
                </div>
              </div>

              <div style={{ fontSize: "0.65rem", color: "#dc2626", fontWeight: "bold", textAlign: "center", marginTop: "4px" }}>
                NOTA: Un Gerenciamiento de Viajes debe ser preparado para todos los viajes: Superiores a 50 Km, en áreas remotas o bajo condiciones adversas, hacia o desde locaciones en campo con el cliente.
              </div>
            </div>

            {/* PANEL DE INTERACCIÓN / APROBACIÓN CON CANVAS DE FIRMA Y SELECCIÓN DE USUARIO */}
            <div style={{ borderTop: "2px solid #000", paddingTop: "10px", marginTop: "10px", background: "#f8fafc", padding: "10px", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
              <h4 style={{ margin: "0 0 6px", color: "#0f172a", fontSize: "0.9rem" }}>✍️ Procesar Aprobación Unificada (Gerenciamiento + Inspección Vehicular)</h4>

              <div style={{ background: "#e0f2fe", border: "1px solid #7dd3fc", padding: "8px 12px", borderRadius: "6px", marginBottom: "10px", fontSize: "0.82rem", color: "#0369a1" }}>
                <strong>🚗 Inspección Vehicular Integrada con este Gerenciamiento:</strong>
                <div style={{ marginTop: "4px", display: "flex", gap: "14px", flexWrap: "wrap" }}>
                  <span>Nivel Combustible: <strong>{selectedDoc.inspeccion_combustible || "3/4"}</strong></span>
                  <span>Estado Inspección: <strong style={{ color: selectedDoc.inspeccion_estado === 'APROBADA' || selectedDoc.estado === 'APROBADO' ? '#166534' : '#d97706' }}>{selectedDoc.inspeccion_estado || (selectedDoc.estado === 'APROBADO' ? 'APROBADA' : 'PENDIENTE CON GERENCIAMIENTO')}</strong></span>
                </div>
                {selectedDoc.inspeccion_observaciones && (
                  <div style={{ marginTop: "2px" }}>Obs. Vehículo: {selectedDoc.inspeccion_observaciones}</div>
                )}
              </div>

              <div style={{ display: "grid", gap: "8px", marginBottom: "8px" }}>
                <label style={{ fontSize: "0.8rem", fontWeight: "bold" }}>
                  Seleccionar Persona Autorizadora *:
                  <select
                    value={autorizadorId}
                    onChange={(e) => handleSelectAutorizador(e.target.value)}
                    style={{ width: "100%", padding: "6px", borderRadius: "4px", border: "1px solid #000", marginTop: "2px", background: "#ffffff" }}
                  >
                    <option value="">-- {user?.nombre || user?.username || "Usuario Actual"} (Usuario Conectado) --</option>
                    {usuariosAdmin.map((u) => (
                      <option key={u.id_usuarios_admin} value={u.id_usuarios_admin}>
                        {u.nombre || u.username} — [{u.rol}]
                      </option>
                    ))}
                  </select>
                </label>

                <label style={{ fontSize: "0.8rem", fontWeight: "bold" }}>
                  Nombre del Autorizador en Firma:
                  <input
                    type="text"
                    value={autorizadorNombre}
                    onChange={(e) => setAutorizadorNombre(e.target.value)}
                    required
                    style={{ width: "100%", padding: "6px", borderRadius: "4px", border: "1px solid #000", marginTop: "2px", background: "#ffffff" }}
                  />
                </label>

                <label style={{ fontSize: "0.8rem", fontWeight: "bold" }}>
                  Observaciones / Acciones de Control:
                  <textarea
                    value={observaciones}
                    onChange={(e) => setObservaciones(e.target.value)}
                    rows={2}
                    placeholder="Detalle acciones de control o notas de aprobación"
                    style={{ width: "100%", padding: "6px", borderRadius: "4px", border: "1px solid #000", marginTop: "2px", background: "#ffffff" }}
                  />
                </label>

                {selectedDoc.estado === "APROBADO" && selectedDoc.firma_autorizador ? (
                  <div style={{ background: "#dcfce7", padding: "8px", borderRadius: "4px", border: "1px solid #16a34a" }}>
                    <strong style={{ fontSize: "0.8rem", color: "#166534" }}>✅ Documento e Inspección Aprobados por: {selectedDoc.nombre_autorizador_firma}</strong>
                    <div style={{ marginTop: "4px" }}>
                      <img src={selectedDoc.firma_autorizador} alt="Firma Autorizador" style={{ maxHeight: "55px", background: "#ffffff", padding: "2px", borderRadius: "4px", border: "1px solid #cbd5e1" }} />
                    </div>
                  </div>
                ) : (
                  <ApprovalSignature onChange={setFirmaAutorizador} />
                )}
              </div>

              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "10px" }}>
                <button
                  type="button"
                  onClick={() => handleAprobarRechazar("RECHAZADO")}
                  disabled={approving}
                  style={{ background: "#ef4444", color: "#ffffff", border: 0, padding: "8px 16px", borderRadius: "4px", fontWeight: "bold", cursor: "pointer", fontSize: "0.85rem" }}
                >
                  ❌ Rechazar Viaje
                </button>
                <button
                  type="button"
                  onClick={() => handleAprobarRechazar("APROBADO")}
                  disabled={approving}
                  style={{ background: "#16a34a", color: "#ffffff", border: 0, padding: "8px 20px", borderRadius: "4px", fontWeight: "bold", cursor: "pointer", fontSize: "0.85rem", boxShadow: "0 4px 12px rgba(22, 163, 74, 0.3)" }}
                >
                  ✅ Aprobar Gerenciamiento e Inspección Vehicular
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
