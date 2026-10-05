import { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import {
  getManejoComentadoConductores,
  programarCursoManejoComentado,
  renovarManejoComentadoDirecto,
  getCursosManejoComentado,
  updateManejoComentadoConductor,
  batchUpdateManejoComentadoConductores
} from "../services/api.js";
import {
  IconCalendario,
  IconDispositivo,
  IconReloj,
  IconEditar,
  IconExcel,
  IconDescargar,
  IconSubir
} from "../components/Icons.jsx";

function parseExcelDate(val) {
  if (!val && val !== 0) return "";
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return "";
    const yyyy = val.getFullYear();
    const mm = String(val.getMonth() + 1).padStart(2, "0");
    const dd = String(val.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }
  if (typeof val === "number") {
    const dateObj = new Date(Math.round((val - 25569) * 86400 * 1000));
    if (!isNaN(dateObj.getTime())) {
      const yyyy = dateObj.getUTCFullYear();
      const mm = String(dateObj.getUTCMonth() + 1).padStart(2, "0");
      const dd = String(dateObj.getUTCDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    }
  }
  const str = String(val).trim();
  const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const ymdMatch = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (ymdMatch) {
    const [, y, m, d] = ymdMatch;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return "";
}

function calculateProximaEvaluacionDate(scoreVal, fechaRealizVal) {
  if (!fechaRealizVal) return "";
  const num = Number(scoreVal || 0);
  let dias = 0;
  if (num >= 85) dias = 365;
  else if (num >= 75) dias = 180;
  else if (num >= 50) dias = 90;
  else dias = 30;

  const dateMatch = String(fechaRealizVal).match(/^\d{4}-\d{2}-\d{2}/);
  if (!dateMatch) return "";
  const [y, m, d] = dateMatch[0].split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + dias);
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatDate(value) {
  if (!value) return "Sin registro";
  const datePart = String(value).match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (!datePart) return "Fecha no válida";
  const [y, m, d] = datePart.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-MX", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function getBadgeClass(estado) {
  switch (estado) {
    case "VIGENTE":
      return "status-badge status-active";
    case "PROXIMO_A_VENCER":
    case "PENDIENTE":
      return "status-badge status-pending";
    case "VENCIDO":
    case "SIN_REGISTRO":
    case "REPROBADO":
      return "status-badge status-inactive";
    default:
      return "status-badge";
  }
}

function getBadgeLabel(estado, dias) {
  switch (estado) {
    case "VIGENTE":
      return `Vigente (${dias} días)`;
    case "PROXIMO_A_VENCER":
      return `Próximo a vencer (${dias} días)`;
    case "VENCIDO":
      return `Vencido (hace ${Math.abs(dias)} días)`;
    case "PENDIENTE":
      return "Cálculo Pendiente";
    case "REPROBADO":
      return "Reprobado";
    case "SIN_REGISTRO":
      return "Sin registro";
    default:
      return estado;
  }
}

function calculateScoreFromDates(fechaRealizVal, proximaEvVal) {
  if (!fechaRealizVal || !proximaEvVal) return null;
  const matchR = String(fechaRealizVal).match(/^\d{4}-\d{2}-\d{2}/);
  const matchP = String(proximaEvVal).match(/^\d{4}-\d{2}-\d{2}/);
  if (!matchR || !matchP) return null;

  const [yr, mr, dr] = matchR[0].split("-").map(Number);
  const [yp, mp, dp] = matchP[0].split("-").map(Number);
  const dateR = new Date(yr, mr - 1, dr);
  const dateP = new Date(yp, mp - 1, dp);

  const diffMs = dateP.getTime() - dateR.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return "0";
  if (diffDays >= 270) {
    return "100";
  } else if (diffDays >= 135) {
    return "80";
  } else if (diffDays >= 45) {
    return "70";
  } else {
    return "40";
  }
}

function getPreviewVigencia(calificacion, fechaEvaluacion, proximaEvaluacion = null) {
  let score = Number(calificacion || 0);

  // Si no hay calificacion o es 0, pero sí hay proximaEvaluacion y fechaEvaluacion, deducir score de las fechas
  if ((!calificacion || score === 0) && proximaEvaluacion && fechaEvaluacion) {
    const deduced = calculateScoreFromDates(fechaEvaluacion, proximaEvaluacion);
    if (deduced !== null && Number(deduced) > 0) {
      score = Number(deduced);
    }
  }

  let dias = 0;
  let label = "";
  let aprobado = true;

  if (score >= 85) {
    dias = 365;
    label = "365 días (1 año)";
  } else if (score >= 75) {
    dias = 180;
    label = "180 días (6 meses)";
  } else if (score >= 50) {
    dias = 90;
    label = "90 días (3 meses)";
  } else {
    dias = 0;
    label = "Reprobado (re-evaluación al siguiente mes)";
    aprobado = false;
  }

  if (proximaEvaluacion) {
    const pMatch = String(proximaEvaluacion).match(/^\d{4}-\d{2}-\d{2}/);
    if (pMatch) {
      const [yp, mp, dp] = pMatch[0].split("-").map(Number);
      const customExpiryStr = new Date(yp, mp - 1, dp).toLocaleDateString("es-MX", { year: "numeric", month: "2-digit", day: "2-digit" });
      return { aprobado, label, fechaVencimiento: customExpiryStr };
    }
  }

  if (!aprobado || !fechaEvaluacion) {
    return { aprobado, label, fechaVencimiento: null };
  }

  const dateMatch = String(fechaEvaluacion).match(/^\d{4}-\d{2}-\d{2}/);
  if (!dateMatch) return { aprobado, label, fechaVencimiento: null };

  const [y, m, d] = dateMatch[0].split("-").map(Number);
  const evalDate = new Date(y, m - 1, d);
  evalDate.setDate(evalDate.getDate() + dias);
  const expiryStr = evalDate.toLocaleDateString("es-MX", { year: "numeric", month: "2-digit", day: "2-digit" });

  return { aprobado, label, fechaVencimiento: expiryStr };
}

export default function ManejoComentadoPage({ user }) {
  const [activeTab, setActiveTab] = useState(() => {
    const hash = window.location.hash.toLowerCase();
    if (hash.includes("cursos")) return "cursos";
    try {
      const saved = sessionStorage.getItem("gv_admin_mc_tab");
      if (saved === "cursos" || saved === "conductores") return saved;
    } catch {}
    return "conductores";
  });
  const [conductores, setConductores] = useState([]);
  const [cursos, setCursos] = useState([]);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("TODOS");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");
  const [currentCondPage, setCurrentCondPage] = useState(1);
  const [currentCursoPage, setCurrentCursoPage] = useState(1);
  const itemsPerPage = 20;

  // Modales
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingConductor, setEditingConductor] = useState(null);
  const [showRenovarModal, setShowRenovarModal] = useState(false);
  const [showProgramarModal, setShowProgramarModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // Modal de Ingesta desde Excel
  const [showImportModal, setShowImportModal] = useState(false);
  const [importRows, setImportRows] = useState([]);
  const [importFileName, setImportFileName] = useState("");
  const [importLoading, setImportLoading] = useState(false);
  const [importApplying, setImportApplying] = useState(false);

  // Formulario Edición (Solo datos de manejo comentado)
  const [editForm, setEditForm] = useState({
    idConductor: "",
    fechaRealizacion: "",
    score: "100",
    proximaEvaluacion: "",
    comentarios: ""
  });

  // Formulario Renovación
  const [renovarForm, setRenovarForm] = useState({
    idConductor: "",
    fechaEvaluacion: new Date().toISOString().slice(0, 10),
    calificacion: "100",
    estadoEvaluacion: "APROBADO",
    comentarios: ""
  });

  // Formulario Programación Curso
  const [cursoForm, setCursoForm] = useState({
    titulo: "Curso de Manejo Comentado y Prevención de Riesgos",
    fechaCursoOral: new Date().toISOString().slice(0, 10),
    fechaEvaluacionInicio: new Date().toISOString().slice(0, 10),
    fechaEvaluacionFin: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    idConductores: [],
    notas: ""
  });

  async function loadData() {
    setLoading(true);
    try {
      const [resCond, resCur] = await Promise.all([
        getManejoComentadoConductores({ search, status: filterStatus }),
        getCursosManejoComentado()
      ]);
      setConductores(resCond.data || []);
      setCursos(resCur.data || []);
    } catch (err) {
      setMessage(err.message || "Error al cargar datos.");
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [search, filterStatus]);

  function handleOpenEditModal(conductor) {
    setEditingConductor(conductor);
    const rawFechaRealiz = conductor.fecha_manejo_comentado
      ? String(conductor.fecha_manejo_comentado).slice(0, 10)
      : new Date().toISOString().slice(0, 10);
    let rawScore = conductor.score !== null && conductor.score !== undefined ? String(conductor.score) : "";
    let rawProximaEv = conductor.fecha_vencimiento ? String(conductor.fecha_vencimiento).slice(0, 10) : "";

    // Si no tiene score o es 0 pero tiene próxima evaluación, calcular calificación según la diferencia de fechas
    if ((!rawScore || rawScore === "0") && rawProximaEv && rawFechaRealiz) {
      const calcScore = calculateScoreFromDates(rawFechaRealiz, rawProximaEv);
      if (calcScore) rawScore = calcScore;
    }

    if (!rawScore) rawScore = "100";

    if (!rawProximaEv && rawFechaRealiz) {
      rawProximaEv = calculateProximaEvaluacionDate(rawScore, rawFechaRealiz);
    }

    setEditForm({
      idConductor: conductor.id_conductores,
      fechaRealizacion: rawFechaRealiz,
      score: rawScore,
      proximaEvaluacion: rawProximaEv,
      comentarios: conductor.ultima_evaluacion?.comentarios || ""
    });
    setShowEditModal(true);
  }

  function handleEditScoreChange(val) {
    if (!val) {
      setEditForm((prev) => ({
        ...prev,
        score: ""
      }));
      return;
    }
    const newProx = calculateProximaEvaluacionDate(val, editForm.fechaRealizacion);
    setEditForm((prev) => ({
      ...prev,
      score: val,
      proximaEvaluacion: newProx || prev.proximaEvaluacion
    }));
  }

  function handleEditFechaRealizacionChange(val) {
    const newProx = calculateProximaEvaluacionDate(editForm.score, val);
    setEditForm((prev) => ({
      ...prev,
      fechaRealizacion: val,
      proximaEvaluacion: newProx || prev.proximaEvaluacion
    }));
  }

  function handleEditProximaEvaluacionChange(val) {
    const calcScore = calculateScoreFromDates(editForm.fechaRealizacion, val);
    setEditForm((prev) => ({
      ...prev,
      proximaEvaluacion: val,
      score: calcScore !== null ? calcScore : prev.score
    }));
  }

  async function handleEditSubmit(e) {
    e.preventDefault();
    if (!editForm.idConductor) return;
    setSaving(true);
    setMessage("");

    try {
      await updateManejoComentadoConductor(editForm.idConductor, {
        fechaRealizacion: editForm.fechaRealizacion,
        score: editForm.score,
        proximaEvaluacion: editForm.proximaEvaluacion,
        comentarios: editForm.comentarios
      });
      setMessage("Datos de manejo comentado actualizados correctamente.");
      setMessageType("success");
      setShowEditModal(false);
      loadData();
    } catch (err) {
      setMessage(err.message || "Error al actualizar manejo comentado.");
      setMessageType("error");
    } finally {
      setSaving(false);
    }
  }

  async function handleRenovarSubmit(e) {
    e.preventDefault();
    if (!renovarForm.idConductor) return;
    setSaving(true);
    setMessage("");

    try {
      await renovarManejoComentadoDirecto(renovarForm);
      setMessage("Manejo comentado renovado y registrado correctamente.");
      setMessageType("success");
      setShowRenovarModal(false);
      loadData();
    } catch (err) {
      setMessage(err.message || "Error al renovar.");
      setMessageType("error");
    } finally {
      setSaving(false);
    }
  }

  async function handleProgramarSubmit(e) {
    e.preventDefault();
    if (cursoForm.idConductores.length === 0) {
      setMessage("Debes seleccionar al menos un conductor para el curso.");
      setMessageType("error");
      return;
    }
    setSaving(true);
    setMessage("");

    try {
      await programarCursoManejoComentado(cursoForm);
      setMessage("Curso de Manejo Comentado programado y notificado al grupo de Telegram.");
      setMessageType("success");
      setShowProgramarModal(false);
      loadData();
    } catch (err) {
      setMessage(err.message || "Error al programar curso.");
      setMessageType("error");
    } finally {
      setSaving(false);
    }
  }

  function handleSelectConductorRenovar(conductor) {
    setRenovarForm({
      idConductor: conductor.id_conductores,
      fechaEvaluacion: new Date().toISOString().slice(0, 10),
      calificacion: "100",
      estadoEvaluacion: "APROBADO",
      comentarios: `Renovación semestral de manejo comentado para ${conductor.nombre}`
    });
    setShowRenovarModal(true);
  }

  function toggleDriverSelection(id) {
    setCursoForm((prev) => {
      const exists = prev.idConductores.includes(id);
      return {
        ...prev,
        idConductores: exists
          ? prev.idConductores.filter((item) => item !== id)
          : [...prev.idConductores, id]
      };
    });
  }

  function selectAllDrivers() {
    setCursoForm((prev) => ({
      ...prev,
      idConductores: conductores.map((c) => c.id_conductores)
    }));
  }

  function deselectAllDrivers() {
    setCursoForm((prev) => ({ ...prev, idConductores: [] }));
  }

  function handleDownloadExcelTemplate() {
    if (!conductores || conductores.length === 0) {
      setMessage("No hay conductores disponibles para generar la plantilla.");
      setMessageType("error");
      return;
    }

    const data = conductores.map((c) => {
      const fechaRealiz = c.fecha_manejo_comentado ? String(c.fecha_manejo_comentado).slice(0, 10) : "";
      const proximaEv = c.fecha_vencimiento ? String(c.fecha_vencimiento).slice(0, 10) : "";
      const score = c.score !== null && c.score !== undefined ? c.score : "";

      return {
        "ID Conductor": c.id_conductores,
        "Nombre Completo": c.nombre || "",
        "Empresa": c.empresa || "",
        "Teléfono": c.telefono || "",
        "Licencia": c.licencia_numero || "",
        "Tipo de licencia": c.tipo_licencia || "Automovilista",
        "Vencimiento de Licencia": c.licencia_vencimiento ? String(c.licencia_vencimiento).slice(0, 10) : "",
        "Fecha realiz": fechaRealiz,
        "Score de Manejo Comentado": score,
        "Próxima Ev.": proximaEv,
        "Comentarios": c.ultima_evaluacion?.comentarios || ""
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    ws["!cols"] = [
      { wch: 14 },
      { wch: 32 },
      { wch: 18 },
      { wch: 14 },
      { wch: 14 },
      { wch: 18 },
      { wch: 22 },
      { wch: 16 },
      { wch: 26 },
      { wch: 16 },
      { wch: 35 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Manejo Comentado");
    const todayStr = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `Plantilla_Manejo_Comentado_${todayStr}.xlsx`);
  }

  function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFileName(file.name);
    setImportLoading(true);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const buffer = evt.target.result;
        const wb = XLSX.read(buffer, { type: "array", cellDates: true });
        const sheetName = wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];
        const rawJson = XLSX.utils.sheet_to_json(ws, { defval: "" });

        if (!rawJson || rawJson.length === 0) {
          setMessage("El archivo Excel está vacío o no contiene filas.");
          setMessageType("error");
          setImportLoading(false);
          return;
        }

        const parsed = rawJson.map((row) => {
          const rawId = row["ID Conductor"] ?? row["ID"] ?? row["Id"] ?? row["id_conductores"] ?? null;
          const idConductor = rawId ? Number(rawId) : null;
          const rawNombre = String(row["Nombre Completo"] ?? row["Nombre"] ?? row["Conductor"] ?? "").trim();

          let matched = null;
          if (idConductor) {
            matched = conductores.find((c) => Number(c.id_conductores) === idConductor);
          }
          if (!matched && rawNombre) {
            matched = conductores.find((c) => c.nombre.trim().toLowerCase() === rawNombre.toLowerCase());
          }

          const fechaRealiz = parseExcelDate(row["Fecha realiz"] ?? row["Fecha Realiz"] ?? row["Fecha Realización"] ?? row["fecha_manejo_comentado"]);
          let score = String(row["Score de Manejo Comentado"] ?? row["Score"] ?? row["Calificación"] ?? row["calificacion"] ?? "").trim();
          let proximaEv = parseExcelDate(row["Próxima Ev."] ?? row["Próxima Ev"] ?? row["Proxima Ev"] ?? row["Próxima Evaluación"] ?? row["fecha_vencimiento"]);
          const comentarios = String(row["Comentarios"] ?? row["Observaciones"] ?? "").trim();

          if ((!score || score === "0") && fechaRealiz && proximaEv) {
            const autoS = calculateScoreFromDates(fechaRealiz, proximaEv);
            if (autoS) score = autoS;
          }
          if (score && fechaRealiz && !proximaEv) {
            proximaEv = calculateProximaEvaluacionDate(score, fechaRealiz);
          }

          const hasChanges = Boolean(fechaRealiz || score || proximaEv || comentarios);

          return {
            idConductor: matched ? matched.id_conductores : idConductor,
            nombre: matched ? matched.nombre : rawNombre || "Sin nombre",
            empresa: matched ? matched.empresa : (row["Empresa"] || ""),
            fechaRealiz,
            score,
            proximaEv,
            comentarios,
            matched: Boolean(matched),
            hasChanges
          };
        });

        setImportRows(parsed);
        setShowImportModal(true);
      } catch (err) {
        console.error("Error al leer Excel:", err);
        setMessage("Error al leer el archivo Excel: " + (err.message || "Formato inválido."));
        setMessageType("error");
      } finally {
        setImportLoading(false);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  }

  async function handleApplyImport() {
    const validRows = importRows.filter((r) => r.matched && (r.fechaRealiz || r.score || r.proximaEv));
    if (validRows.length === 0) {
      setMessage("No hay filas válidas con datos de evaluación para actualizar.");
      setMessageType("error");
      return;
    }

    setImportApplying(true);
    setMessage("");

    try {
      const records = validRows.map((r) => ({
        idConductor: r.idConductor,
        fechaRealizacion: r.fechaRealiz || undefined,
        score: r.score || undefined,
        proximaEvaluacion: r.proximaEv || undefined,
        comentarios: r.comentarios || "Actualización por ingesta de plantilla Excel"
      }));

      const res = await batchUpdateManejoComentadoConductores(records);
      setMessage(res.message || `Se actualizaron correctamente ${records.length} conductores.`);
      setMessageType("success");
      setShowImportModal(false);
      setImportRows([]);
      await loadData();
    } catch (err) {
      setMessage(err.message || "Error al aplicar la ingesta desde Excel.");
      setMessageType("error");
    } finally {
      setImportApplying(false);
    }
  }

  const canManage = ["ADMINISTRADOR", "GERENTE", "GERENTE_GENERAL", "COORDINADOR", "COORDINADOR_AREA", "COORDINADOR_QHSE", "SUPERVISOR", "QHSE", "INSTRUCTOR"].includes(user.rol);

  const totalFilteredCond = conductores.length;
  const totalPagesCond = Math.max(1, Math.ceil(totalFilteredCond / itemsPerPage));
  const paginatedConductores = conductores.slice(
    (currentCondPage - 1) * itemsPerPage,
    currentCondPage * itemsPerPage
  );

  const totalFilteredCursos = cursos.length;
  const totalPagesCursos = Math.max(1, Math.ceil(totalFilteredCursos / itemsPerPage));
  const paginatedCursos = cursos.slice(
    (currentCursoPage - 1) * itemsPerPage,
    currentCursoPage * itemsPerPage
  );

  return (
    <section className="module-page">
      <header className="module-header">
        <div>
          <span className="module-label">Capacitación Vial</span>
          <h1>Manejo Comentado</h1>
          <p>
            Vigencia de evaluaciones prácticas, programación de cursos teóricos
            y registro de acreditaciones.
          </p>
        </div>

        <div className="module-header-actions" style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
          {canManage && (
            <>
              <button
                type="button"
                className="secondary-button"
                onClick={handleDownloadExcelTemplate}
                style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                title="Descargar plantilla de Excel prellenada con los conductores registrados"
              >
                <IconExcel size={16} />
                <IconDescargar size={14} />
                Plantilla Excel
              </button>

              <label
                className="secondary-button"
                style={{ display: "inline-flex", alignItems: "center", gap: "6px", cursor: "pointer", margin: 0 }}
                title="Subir archivo Excel para actualizar evaluaciones de manejo comentado"
              >
                <IconExcel size={16} />
                <IconSubir size={14} />
                Importar Excel
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleFileSelect}
                  style={{ display: "none" }}
                />
              </label>

              <button
                type="button"
                className="secondary-button"
                onClick={() => setShowRenovarModal(true)}
              >
                + Renovar Directo
              </button>

              <button
                type="button"
                className="primary-button"
                onClick={() => setShowProgramarModal(true)}
                style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
              >
                <IconCalendario size={16} /> Programar Curso
              </button>

              <a
                href="/evaluacion"
                target="_blank"
                rel="noreferrer"
                className="secondary-button"
                style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
              >
                <IconDispositivo size={16} /> Aplicativo Móvil (/evaluacion)
              </a>
            </>
          )}
        </div>
      </header>

      {message && (
        <div className={`module-message module-message-${messageType}`} style={{ marginBottom: "1rem" }}>
          {message}
        </div>
      )}

      {/* Navegación por Pestañas */}
      <div className="ranking-segmented-control" style={{ marginBottom: "20px" }}>
        <button
          type="button"
          className={`ranking-tab-btn ${activeTab === "conductores" ? "active" : ""}`}
          onClick={() => {
            setActiveTab("conductores");
            try { sessionStorage.setItem("gv_admin_mc_tab", "conductores"); } catch {}
          }}
        >
          Conductores y Vigencias
        </button>
        <button
          type="button"
          className={`ranking-tab-btn ${activeTab === "cursos" ? "active" : ""}`}
          onClick={() => {
            setActiveTab("cursos");
            try { sessionStorage.setItem("gv_admin_mc_tab", "cursos"); } catch {}
          }}
        >
          Cursos Programados ({cursos.length})
        </button>
      </div>

      {activeTab === "conductores" && (
        <>
          <section className="module-toolbar" style={{ marginBottom: "20px" }}>
            <label className="search-field">
              <span>Buscar</span>
              <input
                type="search"
                placeholder="Nombre, licencia o teléfono"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentCondPage(1);
                }}
              />
            </label>

            <label className="status-filter">
              <span>Estado</span>
              <select
                value={filterStatus}
                onChange={(e) => {
                  setFilterStatus(e.target.value);
                  setCurrentCondPage(1);
                }}
              >
                <option value="TODOS">Todos los estatus</option>
                <option value="VIGENTE">Vigentes (&gt; 30 días)</option>
                <option value="PROXIMO_A_VENCER">Próximos a vencer (&lt;= 30 días)</option>
                <option value="VENCIDO">Vencidos</option>
                <option value="SIN_REGISTRO">Sin registro</option>
              </select>
            </label>
          </section>

          <section className="table-panel">
            {loading ? (
              <p className="table-status">Cargando estado de manejo comentado...</p>
            ) : conductores.length === 0 ? (
              <p className="table-status">No se encontraron conductores con el filtro seleccionado.</p>
            ) : (
              <>
                <div className="table-wrapper admin-table-desktop">
                  <table className="admin-table conductores-table" style={{ width: "100%", tableLayout: "auto" }}>
                    <thead>
                      <tr>
                        <th>Conductor</th>
                        <th>Teléfono</th>
                        <th>Licencia</th>
                        <th>Venc. Licencia</th>
                        <th>Tipo Licencia</th>
                        <th>Fecha realiz</th>
                        <th>Próxima Ev.</th>
                        <th style={{ textAlign: "center" }}>Score</th>
                        <th>Estatus</th>
                        <th style={{ textAlign: "center", width: "95px" }}>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedConductores.map((conductor) => (
                        <tr key={conductor.id_conductores}>
                          <td>
                            <div className="conductor-name-group" style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                              <strong className="conductor-name-cell" style={{ color: "#0f172a" }}>
                                {conductor.nombre}
                              </strong>
                              {conductor.empresa && (
                                <span className="empresa-pill-badge" title={conductor.empresa} style={{ width: "fit-content" }}>
                                  {conductor.empresa}
                                </span>
                              )}
                            </div>
                          </td>
                          <td style={{ color: "#475569" }}>{conductor.telefono || "Sin registro"}</td>
                          <td>
                            <span className="licencia-num">{conductor.licencia_numero || "N/A"}</span>
                          </td>
                          <td style={{ color: "#475569" }}>{formatDate(conductor.licencia_vencimiento)}</td>
                          <td>
                            <span style={{ display: "inline-block", padding: "2px 7px", borderRadius: "5px", fontSize: "0.74rem", fontWeight: 600, background: "#f8fafc", color: "#475569", border: "1px solid #e2e8f0" }}>
                              {conductor.tipo_licencia || "Automovilista"}
                            </span>
                          </td>
                          <td style={{ color: "#475569" }}>{formatDate(conductor.fecha_manejo_comentado)}</td>
                          <td>
                            <strong style={{ color: conductor.estado_vigencia === "VENCIDO" ? "#dc2626" : conductor.estado_vigencia === "PROXIMO_A_VENCER" ? "#d97706" : "#166534" }}>
                              {formatDate(conductor.fecha_vencimiento)}
                            </strong>
                          </td>
                          <td style={{ textAlign: "center" }}>
                            {conductor.score !== null && conductor.score !== undefined ? (
                              <span
                                style={{
                                  display: "inline-block",
                                  padding: "3px 8px",
                                  borderRadius: "6px",
                                  fontWeight: "700",
                                  fontSize: "0.82rem",
                                  backgroundColor: conductor.score >= 85 ? "#e4f7ed" : conductor.score >= 70 ? "#fff0c9" : "#fae8e8",
                                  color: conductor.score >= 85 ? "#12643e" : conductor.score >= 70 ? "#7a560b" : "#8a3030"
                                }}
                              >
                                {conductor.score}
                              </span>
                            ) : (
                              <span style={{ color: "#94a3b8" }}>-</span>
                            )}
                          </td>
                          <td>
                            <span className={getBadgeClass(conductor.estado_vigencia)}>
                              {getBadgeLabel(conductor.estado_vigencia, conductor.dias_para_vencer)}
                            </span>
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <div className="conductor-actions-cell" style={{ justifyContent: "center", gap: "6px" }}>
                              {canManage && (
                                <button
                                  type="button"
                                  className="conductor-action-btn btn-view-license"
                                  onClick={() => handleOpenEditModal(conductor)}
                                  data-tooltip="Editar manejo comentado"
                                  aria-label="Editar manejo comentado"
                                >
                                  <IconEditar size={16} />
                                </button>
                              )}
                              <a
                                href="/evaluacion"
                                target="_blank"
                                rel="noreferrer"
                                className="conductor-action-btn btn-role"
                                data-tooltip="Evaluar en app móvil (/evaluacion)"
                                aria-label="Evaluar en app móvil"
                                style={{ textDecoration: "none" }}
                              >
                                <IconDispositivo size={16} />
                              </a>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {totalFilteredCond > 0 && (
                  <div className="table-pagination">
                    <span className="pagination-info">
                      Mostrando {Math.min((currentCondPage - 1) * itemsPerPage + 1, totalFilteredCond)} - {Math.min(currentCondPage * itemsPerPage, totalFilteredCond)} de {totalFilteredCond} conductores
                    </span>
                    <div className="pagination-controls">
                      <button
                        type="button"
                        className="pagination-btn"
                        onClick={() => setCurrentCondPage((p) => Math.max(1, p - 1))}
                        disabled={currentCondPage === 1}
                      >
                        Anterior
                      </button>
                      <span className="pagination-page-indicator">
                        Página {currentCondPage} de {totalPagesCond}
                      </span>
                      <button
                        type="button"
                        className="pagination-btn"
                        onClick={() => setCurrentCondPage((p) => Math.min(totalPagesCond, p + 1))}
                        disabled={currentCondPage === totalPagesCond}
                      >
                        Siguiente
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </section>
        </>
      )}

      {activeTab === "cursos" && (
        <section className="table-panel">
          {cursos.length === 0 ? (
            <p className="table-status">No hay cursos de manejo comentado agendados.</p>
          ) : (
            <>
              <div className="table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Curso</th>
                      <th>Fecha Oral</th>
                      <th>Ventana Evaluación Práctica</th>
                      <th>Instructor</th>
                      <th>Programado por</th>
                      <th>Estatus Participantes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedCursos.map((c) => (
                      <tr key={c.id_curso}>
                        <td>
                          <strong>{c.titulo}</strong>
                          {c.notas && <small style={{ display: "block", color: "#607986" }}>{c.notas}</small>}
                        </td>
                        <td>{formatDate(c.fecha_curso_oral)}</td>
                        <td>
                          {formatDate(c.fecha_evaluacion_inicio)} al {formatDate(c.fecha_evaluacion_fin)}
                        </td>
                        <td>{c.instructor_nombre || "Sin asignar"}</td>
                        <td>{c.programador_nombre || "Admin"}</td>
                        <td>
                          <span className="status-badge status-active" style={{ marginRight: "4px" }}>
                            Total: {c.total_participantes}
                          </span>
                          <span className="status-badge status-active" style={{ marginRight: "4px", backgroundColor: "#e4f7ed", color: "#12643e" }}>
                            Aprobados: {c.aprobados}
                          </span>
                          <span className="status-badge status-inactive">
                            Pendientes: {c.pendientes}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalFilteredCursos > 0 && (
                <div className="table-pagination">
                  <span className="pagination-info">
                    Mostrando {Math.min((currentCursoPage - 1) * itemsPerPage + 1, totalFilteredCursos)} - {Math.min(currentCursoPage * itemsPerPage, totalFilteredCursos)} de {totalFilteredCursos} cursos
                  </span>
                  <div className="pagination-controls">
                    <button
                      type="button"
                      className="pagination-btn"
                      onClick={() => setCurrentCursoPage((p) => Math.max(1, p - 1))}
                      disabled={currentCursoPage === 1}
                    >
                      Anterior
                    </button>
                    <span className="pagination-page-indicator">
                      Página {currentCursoPage} de {totalPagesCursos}
                    </span>
                    <button
                      type="button"
                      className="pagination-btn"
                      onClick={() => setCurrentCursoPage((p) => Math.min(totalPagesCursos, p + 1))}
                      disabled={currentCursoPage === totalPagesCursos}
                    >
                      Siguiente
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      )}

      {/* Modal Editar Manejo Comentado */}
      {showEditModal && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: "660px", maxHeight: "92vh", overflowY: "auto" }}>
            <h2>Editar Manejo Comentado</h2>
            <p style={{ color: "#607986", fontSize: "0.88rem", marginBottom: "1.25rem" }}>
              Actualiza la fecha de realización, calificación y próxima evaluación del conductor.
            </p>

            {/* Ficha informativa del conductor (Solo Lectura) */}
            {editingConductor && (
              <div
                style={{
                  background: "#f8fafc",
                  border: "1px solid #e2edf2",
                  borderRadius: "10px",
                  padding: "12px 16px",
                  marginBottom: "1.25rem"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <span style={{ fontWeight: "700", color: "#1e293b", fontSize: "0.95rem" }}>
                    {editingConductor.nombre} {editingConductor.empresa ? `(${editingConductor.empresa})` : ""}
                  </span>
                  <span style={{ fontSize: "0.75rem", background: "#e2edf2", color: "#475569", padding: "2px 8px", borderRadius: "999px", fontWeight: "600" }}>
                    ID: #{editingConductor.id_conductores} (Solo Lectura)
                  </span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "8px", fontSize: "0.82rem", color: "#475569" }}>
                  <div>
                    <span style={{ color: "#94a3b8", display: "block" }}>Teléfono:</span>
                    <strong>{editingConductor.telefono || "Sin registro"}</strong>
                  </div>
                  <div>
                    <span style={{ color: "#94a3b8", display: "block" }}>Licencia:</span>
                    <strong>{editingConductor.licencia_numero || "Sin registro"}</strong>
                  </div>
                  <div>
                    <span style={{ color: "#94a3b8", display: "block" }}>Venc. Licencia:</span>
                    <strong>{formatDate(editingConductor.licencia_vencimiento)}</strong>
                  </div>
                  <div>
                    <span style={{ color: "#94a3b8", display: "block" }}>Tipo Licencia:</span>
                    <strong>{editingConductor.tipo_licencia || "Automovilista"}</strong>
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={handleEditSubmit}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                <div className="form-group">
                  <label>Fecha realiz (Realización) *</label>
                  <input
                    type="date"
                    className="form-control"
                    value={editForm.fechaRealizacion}
                    onChange={(e) => handleEditFechaRealizacionChange(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Score (0 - 100) *</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    className="form-control"
                    value={editForm.score}
                    onChange={(e) => handleEditScoreChange(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Próxima Ev. (Evaluación)</label>
                  <input
                    type="date"
                    className="form-control"
                    value={editForm.proximaEvaluacion}
                    onChange={(e) => handleEditProximaEvaluacionChange(e.target.value)}
                  />
                </div>
              </div>

              {/* Cálculo dinámico de la vigencia */}
              {(() => {
                const preview = getPreviewVigencia(editForm.score, editForm.fechaRealizacion, editForm.proximaEvaluacion);
                return (
                  <div
                    style={{
                      background: preview.aprobado ? "#f0fdf4" : "#fef2f2",
                      border: `1px solid ${preview.aprobado ? "#bbf7d0" : "#fecaca"}`,
                      borderRadius: "8px",
                      padding: "10px 14px",
                      marginBottom: "1rem",
                      fontSize: "0.85rem"
                    }}
                  >
                    <div style={{ fontWeight: "600", color: preview.aprobado ? "#166534" : "#991b1b" }}>
                      Cálculo de Vigencia Asignada: {preview.label}
                    </div>
                    <div style={{ marginTop: "3px", color: "#475569" }}>
                      Próxima fecha sugerida: {preview.fechaVencimiento || "Pendiente"} (puedes ajustar la fecha manualmente en el campo anterior)
                    </div>
                  </div>
                );
              })()}

              <div className="form-group" style={{ marginBottom: "1.25rem" }}>
                <label>Comentarios / Observaciones del Evaluador</label>
                <textarea
                  className="form-control"
                  rows="3"
                  value={editForm.comentarios}
                  onChange={(e) => setEditForm({ ...editForm, comentarios: e.target.value })}
                  placeholder="Observaciones de la evaluación..."
                />
              </div>

              <div className="form-actions" style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setShowEditModal(false)}
                  disabled={saving}
                >
                  Cancelar
                </button>
                <button type="submit" className="primary-button" disabled={saving}>
                  {saving ? "Guardando..." : "Guardar Cambios"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Renovar Manejo Comentado */}
      {showRenovarModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <h2>Renovar Manejo Comentado (Directo)</h2>
            <form onSubmit={handleRenovarSubmit}>
              <div className="form-group" style={{ marginBottom: "1rem" }}>
                <label>Selecciona el Conductor *</label>
                <select
                  className="form-control"
                  value={renovarForm.idConductor}
                  onChange={(e) => setRenovarForm({ ...renovarForm, idConductor: e.target.value })}
                  required
                >
                  <option value="">-- Seleccionar Conductor --</option>
                  {conductores.map((c) => (
                    <option key={c.id_conductores} value={c.id_conductores}>
                      {c.nombre} ({c.empresa || "Sin Empresa"})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: "1rem" }}>
                <label>Fecha de Evaluación *</label>
                <input
                  type="date"
                  className="form-control"
                  value={renovarForm.fechaEvaluacion}
                  onChange={(e) => setRenovarForm({ ...renovarForm, fechaEvaluacion: e.target.value })}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: "1rem" }}>
                <label>Calificación (0 - 100) *</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  className="form-control"
                  value={renovarForm.calificacion}
                  onChange={(e) => {
                    const val = e.target.value;
                    const score = Number(val);
                    const autoStatus = score >= 50 ? "APROBADO" : "REPROBADO";
                    setRenovarForm({ ...renovarForm, calificacion: val, estadoEvaluacion: autoStatus });
                  }}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: "1rem" }}>
                <label>Resultado de Evaluación</label>
                <select
                  className="form-control"
                  value={renovarForm.estadoEvaluacion}
                  onChange={(e) => setRenovarForm({ ...renovarForm, estadoEvaluacion: e.target.value })}
                >
                  <option value="APROBADO">APROBADO</option>
                  <option value="REPROBADO">REPROBADO</option>
                </select>
              </div>

              {/* Vista previa del cálculo dinámico */}
              {(() => {
                const preview = getPreviewVigencia(renovarForm.calificacion, renovarForm.fechaEvaluacion);
                return (
                  <div
                    style={{
                      background: preview.aprobado ? "#eefbf3" : "#fff5f5",
                      border: `1px solid ${preview.aprobado ? "#abebd2" : "#feb2b2"}`,
                      borderRadius: "8px",
                      padding: "12px",
                      marginBottom: "1rem",
                      fontSize: "0.9rem"
                    }}
                  >
                    <strong>Cálculo de Vigencia Asignada:</strong>
                    <div style={{ marginTop: "4px" }}>
                      • <strong>Estatus:</strong> {preview.aprobado ? "APROBADO" : "REPROBADO"} ({preview.label})
                    </div>
                    {preview.aprobado && preview.fechaVencimiento && (
                      <div style={{ marginTop: "2px", color: "#166534" }}>
                        • <strong>Fecha de Vencimiento:</strong> {preview.fechaVencimiento} (calculada descontando los días de la evaluación)
                      </div>
                    )}
                    {!preview.aprobado && (
                      <div style={{ marginTop: "2px", color: "#991b1b" }}>
                        • Re-evaluación y curso programados para el próximo mes.
                      </div>
                    )}
                  </div>
                );
              })()}

              <div className="form-group" style={{ marginBottom: "1rem" }}>
                <label>Comentarios / Observaciones del Evaluador</label>
                <textarea
                  className="form-control"
                  rows="3"
                  value={renovarForm.comentarios}
                  onChange={(e) => setRenovarForm({ ...renovarForm, comentarios: e.target.value })}
                />
              </div>

              <div className="form-actions" style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setShowRenovarModal(false)}
                  disabled={saving}
                >
                  Cancelar
                </button>
                <button type="submit" className="primary-button" disabled={saving}>
                  {saving ? "Guardando..." : "Guardar y Renovar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Programar Curso */}
      {showProgramarModal && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: "620px", maxHeight: "90vh", overflowY: "auto" }}>
            <h2>Programar Curso de Manejo Comentado</h2>
            <p style={{ color: "#607986", fontSize: "0.9rem", marginBottom: "1rem" }}>
              Define la fecha del curso oral, la ventana de evaluación práctica y selecciona manualmente a los integrantes del equipo.
            </p>
            <form onSubmit={handleProgramarSubmit}>
              <div className="form-group" style={{ marginBottom: "1rem" }}>
                <label>Título del Curso *</label>
                <input
                  type="text"
                  className="form-control"
                  value={cursoForm.titulo}
                  onChange={(e) => setCursoForm({ ...cursoForm, titulo: e.target.value })}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: "1rem" }}>
                <label>Fecha de Curso Oral *</label>
                <input
                  type="date"
                  className="form-control"
                  value={cursoForm.fechaCursoOral}
                  onChange={(e) => setCursoForm({ ...cursoForm, fechaCursoOral: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                <div className="form-group">
                  <label>Inicio Evaluación Práctica *</label>
                  <input
                    type="date"
                    className="form-control"
                    value={cursoForm.fechaEvaluacionInicio}
                    onChange={(e) => setCursoForm({ ...cursoForm, fechaEvaluacionInicio: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Fin Evaluación Práctica *</label>
                  <input
                    type="date"
                    className="form-control"
                    value={cursoForm.fechaEvaluacionFin}
                    onChange={(e) => setCursoForm({ ...cursoForm, fechaEvaluacionFin: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: "1rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                  <label style={{ margin: 0 }}>Integrantes de tu equipo a ingresar * ({cursoForm.idConductores.length} seleccionados)</label>
                  <div>
                    <button type="button" className="btn-link" onClick={selectAllDrivers}>Todos</button>
                    <button type="button" className="btn-link" onClick={deselectAllDrivers}>Ninguno</button>
                  </div>
                </div>
                <div style={{ maxHeight: "180px", overflowY: "auto", border: "1px solid #c2d8e3", padding: "10px", borderRadius: "8px", background: "#fdfefe" }}>
                  {conductores.map((c) => {
                    const isChecked = cursoForm.idConductores.includes(c.id_conductores);
                    return (
                      <label key={c.id_conductores} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "4px 0", cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleDriverSelection(c.id_conductores)}
                        />
                        <span>{c.nombre} <small style={{ color: "#607986" }}>({c.empresa || "Sin Empresa"}) - {c.estado_vigencia}</small></span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: "1rem" }}>
                <label>Notas / Indicaciones para el Grupo</label>
                <textarea
                  className="form-control"
                  rows="2"
                  placeholder="Lugar de reunión, material requerido, etc."
                  value={cursoForm.notas}
                  onChange={(e) => setCursoForm({ ...cursoForm, notas: e.target.value })}
                />
              </div>

              <div className="form-actions" style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setShowProgramarModal(false)}
                  disabled={saving}
                >
                  Cancelar
                </button>
                <button type="submit" className="primary-button" disabled={saving}>
                  {saving ? "Programando..." : "Programar y Notificar a Telegram"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Ingesta desde Plantilla Excel */}
      {showImportModal && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: "780px", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <h2 style={{ margin: 0 }}>Ingesta de Evaluaciones desde Excel</h2>
              <span style={{ fontSize: "0.82rem", background: "#f1f5f9", padding: "4px 10px", borderRadius: "999px", color: "#475569", fontWeight: 600 }}>
                {importFileName}
              </span>
            </div>
            <p style={{ color: "#607986", fontSize: "0.88rem", marginBottom: "1.25rem" }}>
              Revisa la vista previa de las evaluaciones detectadas en el archivo antes de aplicar las actualizaciones masivas.
            </p>

            {/* Tarjetas resumen */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "1.25rem" }}>
              <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "10px", textAlign: "center" }}>
                <span style={{ fontSize: "0.78rem", color: "#64748b", display: "block" }}>Filas en Archivo</span>
                <strong style={{ fontSize: "1.25rem", color: "#0f172a" }}>{importRows.length}</strong>
              </div>
              <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "8px", padding: "10px", textAlign: "center" }}>
                <span style={{ fontSize: "0.78rem", color: "#166534", display: "block" }}>Conductores Identificados</span>
                <strong style={{ fontSize: "1.25rem", color: "#166534" }}>{importRows.filter((r) => r.matched).length}</strong>
              </div>
              <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: "8px", padding: "10px", textAlign: "center" }}>
                <span style={{ fontSize: "0.78rem", color: "#1d4ed8", display: "block" }}>Listos para Actualizar</span>
                <strong style={{ fontSize: "1.25rem", color: "#1d4ed8" }}>
                  {importRows.filter((r) => r.matched && (r.fechaRealiz || r.score || r.proximaEv)).length}
                </strong>
              </div>
            </div>

            {/* Tabla de previsualización */}
            <div style={{ maxHeight: "320px", overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: "8px", marginBottom: "1.25rem" }}>
              <table className="admin-table" style={{ width: "100%", fontSize: "0.82rem" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", position: "sticky", top: 0, zIndex: 1 }}>
                    <th style={{ padding: "8px 10px" }}>Conductor</th>
                    <th style={{ padding: "8px 10px" }}>Fecha realiz</th>
                    <th style={{ padding: "8px 10px", textAlign: "center" }}>Score</th>
                    <th style={{ padding: "8px 10px" }}>Próxima Ev.</th>
                    <th style={{ padding: "8px 10px", textAlign: "center" }}>Estatus</th>
                  </tr>
                </thead>
                <tbody>
                  {importRows.map((row, idx) => {
                    const isReady = row.matched && (row.fechaRealiz || row.score || row.proximaEv);
                    return (
                      <tr key={idx} style={{ background: !row.matched ? "#fff5f5" : isReady ? "#f0fdf4" : "#ffffff" }}>
                        <td style={{ padding: "8px 10px" }}>
                          <strong>{row.nombre}</strong>
                          {row.empresa && <small style={{ display: "block", color: "#64748b" }}>{row.empresa}</small>}
                        </td>
                        <td style={{ padding: "8px 10px" }}>
                          {row.fechaRealiz ? formatDate(row.fechaRealiz) : <span style={{ color: "#94a3b8" }}>-</span>}
                        </td>
                        <td style={{ padding: "8px 10px", textAlign: "center" }}>
                          {row.score ? (
                            <span
                              style={{
                                fontWeight: 700,
                                padding: "2px 6px",
                                borderRadius: "4px",
                                background: Number(row.score) >= 70 ? "#e4f7ed" : "#fae8e8",
                                color: Number(row.score) >= 70 ? "#12643e" : "#8a3030"
                              }}
                            >
                              {row.score}
                            </span>
                          ) : (
                            <span style={{ color: "#94a3b8" }}>-</span>
                          )}
                        </td>
                        <td style={{ padding: "8px 10px" }}>
                          {row.proximaEv ? formatDate(row.proximaEv) : <span style={{ color: "#94a3b8" }}>-</span>}
                        </td>
                        <td style={{ padding: "8px 10px", textAlign: "center" }}>
                          {!row.matched ? (
                            <span style={{ fontSize: "0.75rem", color: "#dc2626", fontWeight: 600 }}>No encontrado</span>
                          ) : isReady ? (
                            <span style={{ fontSize: "0.75rem", color: "#166534", fontWeight: 600 }}>Listo para actualizar</span>
                          ) : (
                            <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Sin datos nuevos</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="form-actions" style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setShowImportModal(false);
                  setImportRows([]);
                }}
                disabled={importApplying}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={handleApplyImport}
                disabled={importApplying || importRows.filter((r) => r.matched && (r.fechaRealiz || r.score || r.proximaEv)).length === 0}
              >
                {importApplying
                  ? "Aplicando cambios..."
                  : `Aplicar Ingesta (${importRows.filter((r) => r.matched && (r.fechaRealiz || r.score || r.proximaEv)).length} conductores)`}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
