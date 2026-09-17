import {
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import * as XLSX from "xlsx";

import {
  createAdminDestino,
  deleteAdminDestino,
  getAdminDestinos,
  importAdminDestinos,
  updateAdminDestino,
  updateAdminDestinoStatus
} from "../services/api.js";

// ==========================================
// ICONOS SVG PRO MAX (Sin emojis)
// ==========================================
function IconPin({ size = 18, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function IconMap({ size = 18, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
      <line x1="8" y1="2" x2="8" y2="18" />
      <line x1="16" y1="6" x2="16" y2="22" />
    </svg>
  );
}

function IconCompass({ size = 18, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
    </svg>
  );
}

function IconSearch({ size = 18, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function IconPlus({ size = 18, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function IconDownload({ size = 18, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function IconUpload({ size = 18, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function IconEye({ size = 16, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconPencil({ size = 16, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
    </svg>
  );
}

function IconTrash({ size = 16, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

function IconPower({ size = 16, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
      <line x1="12" y1="2" x2="12" y2="12" />
    </svg>
  );
}

function IconExternal({ size = 14, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

function IconAlertTriangle({ size = 18, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function IconCheck({ size = 14, strokeWidth = 2.8, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function IconCross({ size = 14, strokeWidth = 2.8, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function IconCheckCircle({ size = 18, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function IconX({ size = 18, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function IconFile({ size = 32, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

function IconRefresh({ size = 14, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}

const initialForm = {
  idDestino: null,
  nombre: "",
  direccion: "",
  latitud: "",
  longitud: ""
};

function DestinosPage({ user }) {
  const canEdit = [
    "ADMINISTRADOR",
    "GERENTE",
    "GERENTE_GENERAL",
    "COORDINADOR",
    "COORDINADOR_AREA",
    "COORDINADOR_QHSE",
    "SUPERVISOR",
    "QHSE",
    "INSTRUCTOR"
  ].includes(user?.rol) || user?.rol === "ADMINISTRADOR" || !user?.rol;

  const canCreate = [
    "ADMINISTRADOR",
    "GERENTE",
    "GERENTE_GENERAL",
    "COORDINADOR",
    "COORDINADOR_AREA",
    "COORDINADOR_QHSE",
    "SUPERVISOR",
    "QHSE",
    "INSTRUCTOR"
  ].includes(user?.rol) || user?.rol === "ADMINISTRADOR" || !user?.rol;

  const [destinos, setDestinos] = useState([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("TODOS");
  const [gpsFilter, setGpsFilter] = useState("TODOS");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");

  // Modal Crear / Editar
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(initialForm);
  const isEditing = Boolean(form.idDestino);
  const [saving, setSaving] = useState(false);
  const submittingRef = useRef(false);

  // Modal Ver Detalle
  const [detailDestino, setDetailDestino] = useState(null);

  // Modal Confirmación (Baja / Reactivación / Eliminación)
  const [confirmAction, setConfirmAction] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);

  // Modal Importación Excel / CSV
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importRows, setImportRows] = useState([]);
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState(null);
  const fileInputRef = useRef(null);

  async function loadDestinos() {
    setLoading(true);

    try {
      const response = await getAdminDestinos({
        search,
        status
      });

      setDestinos(response.data ?? []);
      setCurrentPage(1);
    } catch (error) {
      setMessage(error.message);
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadDestinos();
    }, 300);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [search, status]);

  // Manejo de tecla Escape para cerrar modales activos
  useEffect(() => {
    const anyModalOpen = showForm || Boolean(detailDestino) || Boolean(confirmAction) || showImportModal;
    if (!anyModalOpen) return undefined;

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        if (showForm && !saving) closeForm();
        if (detailDestino) setDetailDestino(null);
        if (confirmAction && !updatingId) setConfirmAction(null);
        if (showImportModal && !importing) closeImportModal();
      }
    }

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [showForm, saving, detailDestino, confirmAction, updatingId, showImportModal, importing]);

  // Cálculos para KPIs y Filtrado GPS local
  const kpiStats = useMemo(() => {
    const total = destinos.length;
    const activos = destinos.filter((d) => d.activo).length;
    const inactivos = total - activos;
    const conGps = destinos.filter(
      (d) => d.latitud !== null && d.longitud !== null && d.latitud !== undefined && d.longitud !== undefined
    ).length;

    return { total, activos, inactivos, conGps };
  }, [destinos]);

  const filteredDestinos = useMemo(() => {
    if (gpsFilter === "CON_GPS") {
      return destinos.filter(
        (d) => d.latitud !== null && d.longitud !== null && d.latitud !== undefined && d.longitud !== undefined
      );
    }
    if (gpsFilter === "SIN_GPS") {
      return destinos.filter(
        (d) => d.latitud === null || d.longitud === null || d.latitud === undefined || d.longitud === undefined
      );
    }
    return destinos;
  }, [destinos, gpsFilter]);

  // Paginación
  const totalFiltered = filteredDestinos.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / itemsPerPage));
  const paginatedDestinos = filteredDestinos.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Limpiar todos los filtros
  function handleResetFilters() {
    setSearch("");
    setStatus("TODOS");
    setGpsFilter("TODOS");
    setCurrentPage(1);
  }

  const hasActiveFilters = search.trim() !== "" || status !== "TODOS" || gpsFilter !== "TODOS";

  // Funciones Modal Formulario
  function openCreateForm() {
    setForm(initialForm);
    setMessage("");
    setShowForm(true);
  }

  function openEditForm(destino) {
    setForm({
      idDestino: destino.id_lugares,
      nombre: destino.nombre || "",
      direccion: destino.direccion || "",
      latitud: destino.latitud !== null && destino.latitud !== undefined ? String(destino.latitud) : "",
      longitud: destino.longitud !== null && destino.longitud !== undefined ? String(destino.longitud) : ""
    });
    setMessage("");
    setShowForm(true);
  }

  function closeForm() {
    if (saving) return;
    setShowForm(false);
    setForm(initialForm);
  }

  function handleFormChange(event) {
    const { name, value } = event.target;
    setForm((curr) => ({
      ...curr,
      [name]: value
    }));
    setMessage("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (submittingRef.current) return;

    const nombre = form.nombre.replace(/\s+/g, " ").trim();
    const direccion = form.direccion.replace(/\s+/g, " ").trim();
    const latStr = String(form.latitud || "").trim();
    const lngStr = String(form.longitud || "").trim();

    if (nombre.length < 2) {
      setMessage("El nombre del destino debe tener al menos 2 caracteres.");
      setMessageType("error");
      return;
    }

    let latitud = null;
    if (latStr) {
      const latNum = Number(latStr);
      if (isNaN(latNum) || latNum < -90 || latNum > 90) {
        setMessage("La latitud debe ser un número válido entre -90 y 90.");
        setMessageType("error");
        return;
      }
      latitud = latNum;
    }

    let longitud = null;
    if (lngStr) {
      const lngNum = Number(lngStr);
      if (isNaN(lngNum) || lngNum < -180 || lngNum > 180) {
        setMessage("La longitud debe ser un número válido entre -180 y 180.");
        setMessageType("error");
        return;
      }
      longitud = lngNum;
    }

    submittingRef.current = true;
    setSaving(true);
    setMessage("");

    try {
      const payload = {
        nombre,
        direccion: direccion || null,
        latitud,
        longitud
      };

      const response = isEditing
        ? await updateAdminDestino(form.idDestino, payload)
        : await createAdminDestino(payload);

      setMessage(
        response.message ||
          (isEditing
            ? "Destino actualizado correctamente."
            : "Destino creado correctamente.")
      );
      setMessageType("success");
      setShowForm(false);
      setForm(initialForm);

      await loadDestinos();
    } catch (error) {
      setMessage(error.message);
      setMessageType("error");
    } finally {
      submittingRef.current = false;
      setSaving(false);
    }
  }

  // Funciones Modal Confirmación
  function requestStatusChange(destino) {
    setConfirmAction({
      type: "status",
      destino,
      nextStatus: !destino.activo
    });
  }

  function requestDelete(destino) {
    setConfirmAction({
      type: "delete",
      destino
    });
  }

  async function executeConfirmAction() {
    if (!confirmAction || updatingId) return;

    const { type, destino, nextStatus } = confirmAction;
    setUpdatingId(destino.id_lugares);
    setMessage("");

    try {
      if (type === "status") {
        const response = await updateAdminDestinoStatus(destino.id_lugares, nextStatus);
        setDestinos((curr) =>
          curr.map((item) =>
            item.id_lugares === destino.id_lugares
              ? { ...item, ...response.data }
              : item
          )
        );
        setMessage(response.message || (nextStatus ? "Destino reactivado con éxito." : "Destino dado de baja."));
        setMessageType("success");

        if ((status === "ACTIVOS" && !nextStatus) || (status === "INACTIVOS" && nextStatus)) {
          await loadDestinos();
        }
      } else if (type === "delete") {
        const response = await deleteAdminDestino(destino.id_lugares);
        setDestinos((curr) => curr.filter((item) => item.id_lugares !== destino.id_lugares));
        setMessage(response.message || `Destino "${destino.nombre}" eliminado correctamente.`);
        setMessageType("success");
      }

      setConfirmAction(null);
    } catch (error) {
      setMessage(error.message);
      setMessageType("error");
    } finally {
      setUpdatingId(null);
    }
  }

  // Funciones de Importación Excel / CSV
  function openImportModal() {
    setImportFile(null);
    setImportRows([]);
    setImportSummary(null);
    setShowImportModal(true);
  }

  function closeImportModal() {
    if (importing) return;
    setShowImportModal(false);
    setImportFile(null);
    setImportRows([]);
    setImportSummary(null);
  }

  function handleFileSelected(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportFile(file);
    setImportSummary(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawJson = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });

        if (!rawJson || rawJson.length <= 1) {
          setMessage("El archivo seleccionado no contiene filas de datos.");
          setMessageType("error");
          setImportRows([]);
          return;
        }

        const header = rawJson[0].map((h) => String(h || "").toLowerCase().trim());
        const idxNombre = header.findIndex((h) => h.includes("nombre"));
        const idxDireccion = header.findIndex((h) => h.includes("direccion") || h.includes("dirección"));
        const idxLatitud = header.findIndex((h) => h.includes("latitud") || h.includes("lat"));
        const idxLongitud = header.findIndex((h) => h.includes("longitud") || h.includes("lon") || h.includes("lng"));

        const parsed = rawJson.slice(1).map((r) => {
          const rawNombre = String(idxNombre !== -1 ? r[idxNombre] : r[0] || "").trim();
          const rawDir = String(idxDireccion !== -1 ? r[idxDireccion] : r[1] || "").trim();
          const rawLat = idxLatitud !== -1 ? r[idxLatitud] : r[2];
          const rawLng = idxLongitud !== -1 ? r[idxLongitud] : r[3];

          const latNum = parseFloat(rawLat);
          const lngNum = parseFloat(rawLng);

          return {
            nombre: rawNombre,
            direccion: rawDir || null,
            latitud: !isNaN(latNum) && latNum >= -90 && latNum <= 90 ? latNum : null,
            longitud: !isNaN(lngNum) && lngNum >= -180 && lngNum <= 180 ? lngNum : null
          };
        }).filter((r) => r.nombre.length >= 2);

        setImportRows(parsed);
      } catch (err) {
        console.error("Error leyendo archivo:", err);
        setMessage("No se pudo procesar el archivo. Verifica que sea un formato válido (.xlsx, .xls o .csv).");
        setMessageType("error");
      }
    };

    reader.readAsArrayBuffer(file);
  }

  async function handleConfirmImport() {
    if (importRows.length === 0 || importing) return;

    setImporting(true);
    try {
      const response = await importAdminDestinos(importRows);
      setImportSummary(response.data);
      setMessage(response.message || "Importación completada con éxito.");
      setMessageType("success");
      await loadDestinos();
    } catch (error) {
      setMessage(error.message);
      setMessageType("error");
    } finally {
      setImporting(false);
    }
  }

  // Descarga de Plantillas
  function downloadTemplateExcel() {
    const wsData = [
      ["Nombre", "Direccion", "Latitud", "Longitud"],
      ["Base Principal Campeche", "Av. Gobernadores 100, Barrio de Sta Ana, 24050 San Francisco de Campeche, Camp.", 19.83589, -90.52257],
      ["Casa Uayamón", "Carretera Uayamón s/n, Campeche", 19.85, -90.65],
      ["Tienda Six (Jardines)", "Orquídeas 21, Jardines, 24060 San Francisco de Campeche, Camp.", 19.83267, -90.51675]
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Destinos");
    XLSX.writeFile(wb, "plantilla_destinos.xlsx");
  }

  function downloadTemplateCsv() {
    const csvContent =
      "\uFEFF" +
      "Nombre,Direccion,Latitud,Longitud\r\n" +
      '"Base Principal Campeche","Av. Gobernadores 100, Barrio de Sta Ana, 24050 San Francisco de Campeche, Camp.",19.83589,-90.52257\r\n' +
      '"Casa Uayamón","Carretera Uayamón s/n, Campeche",19.85000,-90.65000\r\n' +
      '"Tienda Six (Jardines)","Orquídeas 21, Jardines, 24060 San Francisco de Campeche, Camp.",19.83267,-90.51675\r\n';

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "plantilla_destinos.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <section className="destinos-page-promax">
      {/* HEADER PRINCIPAL */}
      <header className="destinos-header-promax">
        <div className="destinos-header-title-group">
          <span className="module-label">Módulo de Ubicaciones</span>
          <h1>Catálogo de Destinos</h1>
          <p>
            Administra los lugares operativos, paradas y destinos con geolocalización para la flota.
          </p>
        </div>

        <div className="destinos-header-btns">
          <button
            type="button"
            className="destinos-btn-secondary"
            onClick={downloadTemplateExcel}
            title="Descargar plantilla Excel para importar destinos"
          >
            <IconDownload size={16} />
            <span>Plantilla Excel</span>
          </button>

          {canCreate && (
            <button
              type="button"
              className="destinos-btn-secondary"
              onClick={openImportModal}
              title="Cargar archivo Excel o CSV masivo"
            >
              <IconUpload size={16} />
              <span>Importar Excel / CSV</span>
            </button>
          )}

          {canCreate && (
            <button
              type="button"
              className="destinos-btn-primary"
              onClick={openCreateForm}
              title="Registrar un nuevo destino"
            >
              <IconPlus size={18} />
              <span>Nuevo Destino</span>
            </button>
          )}
        </div>
      </header>

      {/* KPI STATS CARDS */}
      <div className="destinos-kpi-grid">
        <div
          className={`destinos-kpi-card ${status === "TODOS" && gpsFilter === "TODOS" ? "active" : ""}`}
          onClick={() => {
            setStatus("TODOS");
            setGpsFilter("TODOS");
          }}
          title="Ver todos los destinos"
        >
          <div className="destinos-kpi-info">
            <span className="destinos-kpi-label">Total Destinos</span>
            <span className="destinos-kpi-val">{kpiStats.total}</span>
            <span className="destinos-kpi-subtext">Lugares registrados</span>
          </div>
          <div className="destinos-kpi-icon-box destinos-kpi-blue">
            <IconMap size={24} />
          </div>
        </div>

        <div
          className={`destinos-kpi-card ${status === "ACTIVOS" ? "active" : ""}`}
          onClick={() => {
            setStatus("ACTIVOS");
            setGpsFilter("TODOS");
          }}
          title="Filtrar destinos activos"
        >
          <div className="destinos-kpi-info">
            <span className="destinos-kpi-label">Activos</span>
            <span className="destinos-kpi-val">{kpiStats.activos}</span>
            <span className="destinos-kpi-subtext">Habilitados para viajes</span>
          </div>
          <div className="destinos-kpi-icon-box destinos-kpi-emerald">
            <IconCheckCircle size={24} />
          </div>
        </div>

        <div
          className={`destinos-kpi-card ${status === "INACTIVOS" ? "active" : ""}`}
          onClick={() => {
            setStatus("INACTIVOS");
            setGpsFilter("TODOS");
          }}
          title="Filtrar destinos inactivos"
        >
          <div className="destinos-kpi-info">
            <span className="destinos-kpi-label">Inactivos</span>
            <span className="destinos-kpi-val">{kpiStats.inactivos}</span>
            <span className="destinos-kpi-subtext">Dados de baja temporal</span>
          </div>
          <div className="destinos-kpi-icon-box destinos-kpi-amber">
            <IconPower size={24} />
          </div>
        </div>

        <div
          className={`destinos-kpi-card ${gpsFilter === "CON_GPS" ? "active" : ""}`}
          onClick={() => {
            setGpsFilter((curr) => (curr === "CON_GPS" ? "TODOS" : "CON_GPS"));
          }}
          title="Filtrar destinos con coordenadas GPS registradas"
        >
          <div className="destinos-kpi-info">
            <span className="destinos-kpi-label">Con GPS</span>
            <span className="destinos-kpi-val">{kpiStats.conGps}</span>
            <span className="destinos-kpi-subtext">Georreferenciados</span>
          </div>
          <div className="destinos-kpi-icon-box destinos-kpi-indigo">
            <IconCompass size={24} />
          </div>
        </div>
      </div>

      {/* TOOLBAR PRO MAX */}
      <section className="destinos-toolbar-promax">
        <div className="destinos-search-box">
          <div className="destinos-search-icon">
            <IconSearch size={18} />
          </div>
          <input
            type="text"
            className="destinos-search-input"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Buscar por nombre de lugar, dirección o colonia..."
          />
          {search && (
            <button
              type="button"
              className="destinos-search-clear"
              onClick={() => setSearch("")}
              title="Limpiar búsqueda"
            >
              <IconX size={16} />
            </button>
          )}
        </div>

        <div className="destinos-filters-group">
          <div className="destinos-filter-field">
            <span>Estado:</span>
            <select
              className="destinos-filter-select"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="TODOS">Todos los estados</option>
              <option value="ACTIVOS">Solo Activos</option>
              <option value="INACTIVOS">Solo Inactivos</option>
            </select>
          </div>

          <div className="destinos-filter-field">
            <span>GPS:</span>
            <select
              className="destinos-filter-select"
              value={gpsFilter}
              onChange={(e) => {
                setGpsFilter(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="TODOS">Cualquier GPS</option>
              <option value="CON_GPS">Solo Con Coordenadas</option>
              <option value="SIN_GPS">Solo Sin Coordenadas</option>
            </select>
          </div>

          <span className="destinos-counter-badge">
            {totalFiltered} {totalFiltered === 1 ? "destino" : "destinos"}
          </span>

          {hasActiveFilters && (
            <button
              type="button"
              className="destinos-reset-filter-btn"
              onClick={handleResetFilters}
              title="Restablecer todos los filtros"
            >
              <IconRefresh size={14} style={{ marginRight: "4px", verticalAlign: "middle" }} />
              Restablecer
            </button>
          )}
        </div>
      </section>

      {/* MENSAJES DE ALERTA PRO MAX */}
      {message && (
        <div
          className={`destinos-alert-banner ${messageType === "error" ? "error" : "success"}`}
          role={messageType === "error" ? "alert" : "status"}
        >
          <div className="destinos-alert-icon-box">
            {messageType === "error" ? (
              <IconAlertTriangle size={20} />
            ) : (
              <IconCheckCircle size={20} />
            )}
          </div>
          <div style={{ flex: 1 }}>{message}</div>
          <button
            type="button"
            className="destinos-alert-close"
            onClick={() => setMessage("")}
            title="Cerrar notificación"
          >
            <IconX size={16} />
          </button>
        </div>
      )}

      {/* TABLA DE DESTINOS PRO MAX */}
      <section className="destinos-table-panel">
        {loading ? (
          <div style={{ padding: "48px 24px", textAlign: "center", color: "#64748b" }}>
            <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "#0284c7" }}>
              Cargando catálogo de destinos...
            </div>
            <p style={{ margin: "6px 0 0", fontSize: "0.85rem" }}>
              Sincronizando información de lugares con el servidor.
            </p>
          </div>
        ) : filteredDestinos.length === 0 ? (
          <div style={{ padding: "48px 24px", textAlign: "center", color: "#64748b" }}>
            <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#0f172a" }}>
              No se encontraron destinos
            </div>
            <p style={{ margin: "6px 0 16px", fontSize: "0.88rem" }}>
              {hasActiveFilters
                ? "No hay resultados que coincidan con los filtros seleccionados."
                : "Aún no hay destinos registrados en el sistema."}
            </p>
            {hasActiveFilters ? (
              <button
                type="button"
                className="destinos-btn-secondary"
                onClick={handleResetFilters}
              >
                Limpiar filtros de búsqueda
              </button>
            ) : canCreate ? (
              <button
                type="button"
                className="destinos-btn-primary"
                onClick={openCreateForm}
              >
                <IconPlus size={16} />
                <span>Registrar primer destino</span>
              </button>
            ) : null}
          </div>
        ) : (
          <>
            <div className="destinos-table-wrapper">
              <table className="destinos-table">
                <thead>
                  <tr>
                    <th>Lugar / Destino</th>
                    <th>Dirección</th>
                    <th>Geolocalización GPS</th>
                    <th className="col-estado">Estado</th>
                    <th style={{ textAlign: "right", paddingRight: "18px" }}>Acciones</th>
                  </tr>
                </thead>

                <tbody>
                  {paginatedDestinos.map((destino) => {
                    const hasCoords =
                      destino.latitud !== null &&
                      destino.longitud !== null &&
                      destino.latitud !== undefined &&
                      destino.longitud !== undefined;

                    return (
                      <tr key={destino.id_lugares}>
                        {/* Celda Nombre */}
                        <td>
                          <div className="destinos-name-cell">
                            <div
                              className={`destinos-avatar-pin ${
                                !destino.activo ? "inactive" : ""
                              }`}
                            >
                              <IconPin size={18} />
                            </div>
                            <div>
                              <div className="destinos-name-title">
                                {destino.nombre}
                              </div>
                              <div className="destinos-name-id">
                                ID #{destino.id_lugares}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Celda Dirección */}
                        <td>
                          <div className="destinos-dir-cell">
                            <span className="destinos-dir-icon">
                              <IconPin size={14} />
                            </span>
                            <span>
                              {destino.direccion || (
                                <span style={{ color: "#94a3b8", fontStyle: "italic" }}>
                                  Sin dirección registrada
                                </span>
                              )}
                            </span>
                          </div>
                        </td>

                        {/* Celda Coordenadas */}
                        <td>
                          {hasCoords ? (
                            <a
                              href={`https://www.google.com/maps?q=${destino.latitud},${destino.longitud}`}
                              target="_blank"
                              rel="noreferrer"
                              className="destinos-gps-chip"
                              title="Abrir ubicación exacta en Google Maps"
                            >
                              <IconCompass size={14} />
                              <span>
                                {Number(destino.latitud).toFixed(4)}, {Number(destino.longitud).toFixed(4)}
                              </span>
                              <IconExternal size={12} />
                            </a>
                          ) : (
                            <span className="destinos-no-gps-chip">
                              Sin coordenadas
                            </span>
                          )}
                        </td>

                        {/* Celda Estado (Palomita verde / Tache rojo idéntico a otras pestañas) */}
                        <td className="col-estado">
                          <span
                            className={`status-circle-icon ${
                              destino.activo ? "status-circle-vigente" : "status-circle-inactivo"
                            }`}
                            data-tooltip={destino.activo ? "Activo (Habilitado)" : "Inactivo (Dado de baja)"}
                            title={destino.activo ? "Activo (Habilitado)" : "Inactivo (Dado de baja)"}
                            aria-label={destino.activo ? "Activo" : "Inactivo"}
                          >
                            {destino.activo ? (
                              <IconCheck size={14} strokeWidth={2.8} />
                            ) : (
                              <IconCross size={14} strokeWidth={2.8} />
                            )}
                          </span>
                        </td>

                        {/* Celda Acciones (Solo botones con icono y tooltip emergente) */}
                        <td>
                          <div
                            className="destinos-actions-cell"
                            style={{ justifyContent: "flex-end" }}
                          >
                            <button
                              type="button"
                              className="destinos-action-btn destinos-btn-view"
                              onClick={() => setDetailDestino(destino)}
                              data-tooltip="Ver detalles"
                              title="Ver detalles completos"
                              aria-label="Ver detalles"
                            >
                              <IconEye size={16} />
                            </button>

                            {canEdit && (
                              <button
                                type="button"
                                className="destinos-action-btn destinos-btn-edit"
                                onClick={() => openEditForm(destino)}
                                data-tooltip="Editar destino"
                                title="Editar destino"
                                aria-label="Editar destino"
                              >
                                <IconPencil size={16} />
                              </button>
                            )}

                            {canEdit && (
                              <button
                                type="button"
                                className={`destinos-action-btn ${
                                  destino.activo
                                    ? "destinos-btn-deactivate"
                                    : "destinos-btn-activate"
                                }`}
                                onClick={() => requestStatusChange(destino)}
                                data-tooltip={
                                  destino.activo
                                    ? "Dar de baja temporalmente"
                                    : "Reactivar destino"
                                }
                                title={
                                  destino.activo
                                    ? "Dar de baja temporalmente"
                                    : "Reactivar destino"
                                }
                                aria-label={destino.activo ? "Dar de baja" : "Reactivar"}
                              >
                                <IconPower size={16} />
                              </button>
                            )}

                            {canEdit && (
                              <button
                                type="button"
                                className="destinos-action-btn destinos-btn-delete"
                                onClick={() => requestDelete(destino)}
                                data-tooltip="Eliminar"
                                title="Eliminar destino permanentemente"
                                aria-label="Eliminar"
                              >
                                <IconTrash size={16} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Paginación */}
            {totalFiltered > 0 && (
              <div className="table-pagination" style={{ padding: "16px 20px" }}>
                <span className="pagination-info" style={{ fontWeight: 600, color: "#64748b" }}>
                  Mostrando {Math.min((currentPage - 1) * itemsPerPage + 1, totalFiltered)} -{" "}
                  {Math.min(currentPage * itemsPerPage, totalFiltered)} de {totalFiltered} destinos
                </span>

                <div className="pagination-controls">
                  <button
                    type="button"
                    className="pagination-btn"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    Anterior
                  </button>

                  <span className="pagination-page-indicator">
                    Página {currentPage} de {totalPages}
                  </span>

                  <button
                    type="button"
                    className="pagination-btn"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {/* =========================================================
          MODAL 1: CREAR / EDITAR DESTINO (PRO MAX)
          ========================================================= */}
      {showForm && (
        <div
          className="modal-overlay"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeForm();
          }}
        >
          <section
            className="destinos-modal-card-promax"
            role="dialog"
            aria-modal="true"
            aria-labelledby="form-destination-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="destinos-modal-header-promax">
              <div className="destinos-modal-header-left">
                <div className="destinos-modal-header-icon blue">
                  {isEditing ? <IconPencil size={22} /> : <IconPin size={22} />}
                </div>
                <div className="destinos-modal-titles">
                  <h2 id="form-destination-title">
                    {isEditing ? "Editar Destino" : "Nuevo Destino"}
                  </h2>
                  <p>
                    {isEditing
                      ? "Modifica el nombre, dirección o geolocalización del lugar."
                      : "Registra un lugar disponible como origen o parada de viajes."}
                  </p>
                </div>
              </div>

              <button
                type="button"
                className="close-button"
                onClick={closeForm}
                aria-label="Cerrar formulario"
                disabled={saving}
              >
                <IconX size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="destinos-modal-body-promax">
                {/* Sección 1: Datos Principales */}
                <div className="destinos-modal-section">
                  <div className="destinos-modal-section-title">Información General</div>

                  <div className="destinos-form-field">
                    <label htmlFor="destino-nombre">
                      <span>Nombre del Lugar / Destino *</span>
                      <small style={{ color: "#94a3b8", fontWeight: 400 }}>Mínimo 2 caracteres</small>
                    </label>
                    <input
                      id="destino-nombre"
                      className="destinos-form-input"
                      name="nombre"
                      value={form.nombre}
                      onChange={handleFormChange}
                      placeholder="Ej. Casa Uayamón, Base Principal Campeche o Tienda Six (Jardines)"
                      minLength="2"
                      maxLength="150"
                      autoFocus
                      required
                      disabled={saving}
                    />
                  </div>

                  <div className="destinos-form-field">
                    <label htmlFor="destino-direccion">
                      <span>Dirección Completa</span>
                      <small style={{ color: "#94a3b8", fontWeight: 400 }}>Opcional</small>
                    </label>
                    <textarea
                      id="destino-direccion"
                      className="destinos-form-textarea"
                      name="direccion"
                      value={form.direccion}
                      onChange={handleFormChange}
                      placeholder="Calle, número, cruzamientos, colonia, ciudad y código postal..."
                      rows="3"
                      maxLength="500"
                      disabled={saving}
                    />
                  </div>
                </div>

                {/* Sección 2: Coordenadas GPS */}
                <div className="destinos-modal-section">
                  <div className="destinos-modal-section-title">Geolocalización GPS</div>

                  <div className="destinos-coords-2col">
                    <div className="destinos-form-field">
                      <label htmlFor="destino-latitud">
                        <span>Latitud (Norte/Sur)</span>
                      </label>
                      <input
                        id="destino-latitud"
                        type="number"
                        step="any"
                        className="destinos-form-input"
                        name="latitud"
                        value={form.latitud}
                        onChange={handleFormChange}
                        placeholder="Ej. 19.835890"
                        disabled={saving}
                      />
                    </div>

                    <div className="destinos-form-field">
                      <label htmlFor="destino-longitud">
                        <span>Longitud (Este/Oeste)</span>
                      </label>
                      <input
                        id="destino-longitud"
                        type="number"
                        step="any"
                        className="destinos-form-input"
                        name="longitud"
                        value={form.longitud}
                        onChange={handleFormChange}
                        placeholder="Ej. -90.522570"
                        disabled={saving}
                      />
                    </div>
                  </div>

                  {form.latitud && form.longitud && !isNaN(form.latitud) && !isNaN(form.longitud) && (
                    <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "4px" }}>
                      <a
                        href={`https://www.google.com/maps?q=${form.latitud},${form.longitud}`}
                        target="_blank"
                        rel="noreferrer"
                        className="destinos-gps-chip"
                      >
                        <IconCompass size={14} />
                        <span>Verificar coordenadas en Google Maps</span>
                        <IconExternal size={12} />
                      </a>
                    </div>
                  )}
                </div>
              </div>

              <div className="destinos-modal-footer-promax">
                <button
                  type="button"
                  className="destinos-btn-secondary"
                  onClick={closeForm}
                  disabled={saving}
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="destinos-btn-primary"
                  disabled={saving}
                >
                  {saving
                    ? "Guardando información..."
                    : isEditing
                    ? "Guardar Cambios"
                    : "Crear Destino"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* =========================================================
          MODAL 2: VER DETALLE DEL DESTINO (PRO MAX)
          ========================================================= */}
      {detailDestino && (
        <div
          className="modal-overlay"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setDetailDestino(null);
          }}
        >
          <section
            className="destinos-modal-card-promax"
            role="dialog"
            aria-modal="true"
            aria-labelledby="detail-destination-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="destinos-modal-header-promax">
              <div className="destinos-modal-header-left">
                <div className="destinos-modal-header-icon blue">
                  <IconMap size={22} />
                </div>
                <div className="destinos-modal-titles">
                  <h2 id="detail-destination-title">
                    {detailDestino.nombre}
                  </h2>
                  <p>Ficha de información de destino (ID #{detailDestino.id_lugares})</p>
                </div>
              </div>

              <button
                type="button"
                className="close-button"
                onClick={() => setDetailDestino(null)}
                aria-label="Cerrar detalles"
              >
                <IconX size={20} />
              </button>
            </div>

            <div className="destinos-modal-body-promax">
              <div className="destinos-detail-box">
                {/* Item 1: Estado */}
                <div className="destinos-detail-item">
                  <div className="destinos-detail-item-icon">
                    <IconPower size={18} />
                  </div>
                  <div className="destinos-detail-item-content">
                    <div className="destinos-detail-item-label">Estado Operativo</div>
                    <div style={{ marginTop: "4px" }}>
                      <span
                        className={`status-circle-icon ${
                          detailDestino.activo ? "status-circle-vigente" : "status-circle-inactivo"
                        }`}
                        data-tooltip={detailDestino.activo ? "Activo" : "Inactivo"}
                        title={
                          detailDestino.activo
                            ? "Activo (Disponible para viajes)"
                            : "Inactivo (Dado de baja temporal)"
                        }
                      >
                        {detailDestino.activo ? (
                          <IconCheck size={14} strokeWidth={2.8} />
                        ) : (
                          <IconCross size={14} strokeWidth={2.8} />
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Item 2: Dirección */}
                <div className="destinos-detail-item">
                  <div className="destinos-detail-item-icon">
                    <IconPin size={18} />
                  </div>
                  <div className="destinos-detail-item-content">
                    <div className="destinos-detail-item-label">Dirección Registrada</div>
                    <div className="destinos-detail-item-val">
                      {detailDestino.direccion || (
                        <span style={{ color: "#94a3b8", fontStyle: "italic" }}>
                          Sin dirección registrada.
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Item 3: GPS */}
                <div className="destinos-detail-item">
                  <div className="destinos-detail-item-icon">
                    <IconCompass size={18} />
                  </div>
                  <div className="destinos-detail-item-content">
                    <div className="destinos-detail-item-label">Coordenadas Geográficas</div>
                    {detailDestino.latitud !== null && detailDestino.longitud !== null ? (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px", marginTop: "4px" }}>
                        <span style={{ fontWeight: 700, color: "#0f172a" }}>
                          Lat: {detailDestino.latitud} | Long: {detailDestino.longitud}
                        </span>

                        <a
                          href={`https://www.google.com/maps?q=${detailDestino.latitud},${detailDestino.longitud}`}
                          target="_blank"
                          rel="noreferrer"
                          className="destinos-gps-chip"
                          style={{ padding: "6px 12px" }}
                        >
                          <IconExternal size={14} />
                          <span>Abrir en Google Maps</span>
                        </a>
                      </div>
                    ) : (
                      <div style={{ color: "#94a3b8", fontStyle: "italic", marginTop: "2px" }}>
                        No cuenta con coordenadas GPS configuradas.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="destinos-modal-footer-promax">
              <button
                type="button"
                className="destinos-btn-secondary"
                onClick={() => setDetailDestino(null)}
              >
                Cerrar
              </button>

              {canEdit && (
                <button
                  type="button"
                  className="destinos-btn-primary"
                  onClick={() => {
                    const d = detailDestino;
                    setDetailDestino(null);
                    openEditForm(d);
                  }}
                >
                  <IconPencil size={16} />
                  <span>Editar Destino</span>
                </button>
              )}
            </div>
          </section>
        </div>
      )}

      {/* =========================================================
          MODAL 3: CONFIRMACIÓN PERSONALIZADA (PRO MAX)
          ========================================================= */}
      {confirmAction && (
        <div
          className="modal-overlay"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !updatingId) setConfirmAction(null);
          }}
        >
          <section
            className="destinos-modal-card-promax"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-modal-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="destinos-modal-header-promax">
              <div className="destinos-modal-header-left">
                <div
                  className={`destinos-modal-header-icon ${
                    confirmAction.type === "delete"
                      ? "red"
                      : confirmAction.nextStatus
                      ? "emerald"
                      : "amber"
                  }`}
                >
                  {confirmAction.type === "delete" ? (
                    <IconTrash size={22} />
                  ) : confirmAction.nextStatus ? (
                    <IconCheckCircle size={22} />
                  ) : (
                    <IconAlertTriangle size={22} />
                  )}
                </div>

                <div className="destinos-modal-titles">
                  <h2 id="confirm-modal-title">
                    {confirmAction.type === "delete"
                      ? "Eliminar destino definitivamente"
                      : confirmAction.nextStatus
                      ? "Reactivar destino"
                      : "Dar de baja destino"}
                  </h2>
                  <p>
                    {confirmAction.type === "delete"
                      ? "Esta acción borrará el registro de la base de datos de manera permanente."
                      : confirmAction.nextStatus
                      ? "El destino volverá a estar disponible para el registro de nuevos viajes."
                      : "El lugar ya no aparecerá disponible para nuevos viajes, pero se preservará su historial."}
                  </p>
                </div>
              </div>

              <button
                type="button"
                className="close-button"
                onClick={() => setConfirmAction(null)}
                disabled={Boolean(updatingId)}
              >
                <IconX size={20} />
              </button>
            </div>

            <div className="destinos-modal-body-promax">
              <div className="destinos-detail-box">
                <div className="destinos-detail-item">
                  <div className="destinos-detail-item-icon">
                    <IconPin size={18} />
                  </div>
                  <div className="destinos-detail-item-content">
                    <div className="destinos-detail-item-label">Destino Afectado</div>
                    <div className="destinos-detail-item-val">
                      {confirmAction.destino.nombre}
                    </div>
                    {confirmAction.destino.direccion && (
                      <small style={{ color: "#64748b", marginTop: "2px" }}>
                        {confirmAction.destino.direccion}
                      </small>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="destinos-modal-footer-promax">
              <button
                type="button"
                className="destinos-btn-secondary"
                onClick={() => setConfirmAction(null)}
                disabled={Boolean(updatingId)}
              >
                Cancelar
              </button>

              <button
                type="button"
                className={
                  confirmAction.type === "delete"
                    ? "destinos-action-btn destinos-btn-delete"
                    : confirmAction.nextStatus
                    ? "destinos-btn-primary"
                    : "destinos-action-btn destinos-btn-deactivate"
                }
                style={
                  confirmAction.nextStatus
                    ? { padding: "10px 18px", fontSize: "0.88rem" }
                    : { width: "auto", padding: "10px 18px", fontSize: "0.88rem" }
                }
                onClick={executeConfirmAction}
                disabled={Boolean(updatingId)}
              >
                {updatingId
                  ? "Procesando..."
                  : confirmAction.type === "delete"
                  ? "Sí, eliminar definitivamente"
                  : confirmAction.nextStatus
                  ? "Sí, reactivar destino"
                  : "Sí, dar de baja"}
              </button>
            </div>
          </section>
        </div>
      )}

      {/* =========================================================
          MODAL 4: IMPORTACIÓN EXCEL / CSV (PRO MAX)
          ========================================================= */}
      {showImportModal && (
        <div
          className="modal-overlay"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !importing) closeImportModal();
          }}
        >
          <section
            className="destinos-modal-card-promax"
            role="dialog"
            aria-modal="true"
            aria-labelledby="import-modal-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="destinos-modal-header-promax">
              <div className="destinos-modal-header-left">
                <div className="destinos-modal-header-icon blue">
                  <IconUpload size={22} />
                </div>
                <div className="destinos-modal-titles">
                  <h2 id="import-modal-title">Importar Destinos Masivos</h2>
                  <p>
                    Carga masiva desde hojas de cálculo Excel (.xlsx, .xls) o archivos CSV.
                  </p>
                </div>
              </div>

              <button
                type="button"
                className="close-button"
                onClick={closeImportModal}
                disabled={importing}
              >
                <IconX size={20} />
              </button>
            </div>

            <div className="destinos-modal-body-promax">
              {/* Barra de descarga de plantilla */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 16px",
                  background: "#f8fafc",
                  borderRadius: "10px",
                  border: "1px solid #e2e8f0",
                  flexWrap: "wrap",
                  gap: "10px"
                }}
              >
                <div>
                  <strong style={{ fontSize: "0.86rem", color: "#1e293b", display: "block" }}>
                    ¿Necesitas la plantilla de ejemplo?
                  </strong>
                  <span style={{ fontSize: "0.78rem", color: "#64748b" }}>
                    Descárgala con las columnas requeridas (Nombre, Dirección, Latitud, Longitud).
                  </span>
                </div>

                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    type="button"
                    className="destinos-btn-secondary"
                    style={{ fontSize: "0.78rem", padding: "6px 12px" }}
                    onClick={downloadTemplateExcel}
                  >
                    <IconDownload size={14} />
                    <span>Excel (.xlsx)</span>
                  </button>

                  <button
                    type="button"
                    className="destinos-btn-secondary"
                    style={{ fontSize: "0.78rem", padding: "6px 12px" }}
                    onClick={downloadTemplateCsv}
                  >
                    <IconDownload size={14} />
                    <span>CSV (.csv)</span>
                  </button>
                </div>
              </div>

              {/* Input oculto y Dropzone */}
              <input
                type="file"
                ref={fileInputRef}
                accept=".xlsx, .xls, .csv"
                style={{ display: "none" }}
                onChange={handleFileSelected}
              />

              <div
                className={`destinos-dropzone-promax ${importFile ? "has-file" : ""}`}
                onClick={() => fileInputRef.current?.click()}
              >
                <div style={{ color: importFile ? "#15803d" : "#0284c7" }}>
                  {importFile ? <IconCheckCircle size={36} /> : <IconFile size={36} />}
                </div>

                <div>
                  <strong style={{ color: "#0f172a", fontSize: "0.95rem" }}>
                    {importFile ? importFile.name : "Haz clic aquí para seleccionar tu archivo"}
                  </strong>
                  <p style={{ margin: "4px 0 0", fontSize: "0.8rem", color: "#64748b" }}>
                    Formatos admitidos: .xlsx, .xls o .csv con encabezados estándar.
                  </p>
                </div>
              </div>

              {/* Vista previa de los datos detectados */}
              {importRows.length > 0 && (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <strong style={{ color: "#15803d", fontSize: "0.88rem" }}>
                      Se detectaron {importRows.length} destinos listos para importar.
                    </strong>
                    <small style={{ color: "#64748b" }}>
                      Mostrando las primeras 5 filas:
                    </small>
                  </div>

                  <div className="destinos-table-wrapper" style={{ border: "1px solid #e2e8f0", borderRadius: "10px" }}>
                    <table className="destinos-table" style={{ fontSize: "0.82rem" }}>
                      <thead>
                        <tr>
                          <th>Nombre</th>
                          <th>Dirección</th>
                          <th>Latitud</th>
                          <th>Longitud</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importRows.slice(0, 5).map((row, idx) => (
                          <tr key={idx}>
                            <td><strong>{row.nombre}</strong></td>
                            <td>{row.direccion || "—"}</td>
                            <td>{row.latitud ?? "—"}</td>
                            <td>{row.longitud ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Resumen tras importación */}
              {importSummary && (
                <div
                  style={{
                    padding: "14px 18px",
                    background: "#f0fdf4",
                    border: "1px solid #bbf7d0",
                    borderRadius: "10px",
                    color: "#166534"
                  }}
                >
                  <strong style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.92rem" }}>
                    <IconCheckCircle size={18} />
                    <span>¡Importación completada con éxito!</span>
                  </strong>
                  <ul style={{ margin: "8px 0 0", paddingLeft: "22px", fontSize: "0.84rem", lineHeight: 1.6 }}>
                    <li>Total registros procesados: <strong>{importSummary.total}</strong></li>
                    <li>Nuevos destinos dados de alta: <strong>{importSummary.inserted}</strong></li>
                    <li>Destinos actualizados o reactivados: <strong>{importSummary.updated}</strong></li>
                  </ul>
                </div>
              )}
            </div>

            <div className="destinos-modal-footer-promax">
              <button
                type="button"
                className="destinos-btn-secondary"
                onClick={closeImportModal}
                disabled={importing}
              >
                {importSummary ? "Cerrar" : "Cancelar"}
              </button>

              {importRows.length > 0 && !importSummary && (
                <button
                  type="button"
                  className="destinos-btn-primary"
                  onClick={handleConfirmImport}
                  disabled={importing}
                >
                  <IconUpload size={16} />
                  <span>
                    {importing
                      ? "Procesando importación..."
                      : `Confirmar e Importar (${importRows.length} destinos)`}
                  </span>
                </button>
              )}
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

export default DestinosPage;
