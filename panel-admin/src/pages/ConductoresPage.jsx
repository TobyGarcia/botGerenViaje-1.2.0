import {
  useEffect,
  useState
} from "react";

import {
  assignAdminConductorVehicle,
  getAdminConductores,
  getAdminVehiculos,
  updateAdminConductorStatus,
  approveAdminConductor,
  setAdminConductorPin,
  toggleAdminConductorActive
} from "../services/api.js";
import { downloadPinCardImage } from "../utils/downloadPinCard.js";
import {
  IconVerDetalle,
  IconCheck,
  IconCross,
  IconKey,
  IconPower,
  IconReactivar,
  IconEliminar,
  IconUsuarios,
  IconAlerta,
  IconSwap,
  IconReset,
  IconRol,
  IconPhone,
  IconIdCard,
  IconTelegram,
  IconCalendar,
  IconExternalLink,
  IconFileText
} from "../components/Icons.jsx";
import VehicleSelectDropdown from "../components/VehicleSelectDropdown.jsx";

function getLicenciaStatus(conductor) {
  if (!conductor?.licencia_vencimiento) {
    return {
      status: "sin_fecha",
      label: "Sin fecha de vencimiento",
      color: "#64748b"
    };
  }

  const normalized =
    typeof conductor.licencia_vencimiento === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(conductor.licencia_vencimiento)
      ? `${conductor.licencia_vencimiento}T23:59:59`
      : conductor.licencia_vencimiento;

  const expirationDate = new Date(normalized);
  if (Number.isNaN(expirationDate.getTime())) {
    return {
      status: "invalida",
      label: "Fecha inválida",
      color: "#64748b"
    };
  }

  const now = new Date();
  const diffTime = expirationDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  const formattedExp = formatDate(conductor.licencia_vencimiento);

  if (diffDays < 0) {
    return {
      status: "vencida",
      label: `Licencia vencida el ${formattedExp} (${Math.abs(diffDays)} días atrás)`,
      days: diffDays,
      color: "#dc2626"
    };
  }

  if (diffDays <= 30) {
    return {
      status: "por_vencer",
      label: `Licencia por vencer el ${formattedExp} (${diffDays} día${diffDays === 1 ? "" : "s"} restantes)`,
      days: diffDays,
      color: "#d97706"
    };
  }

  return {
    status: "vigente",
    label: `Licencia vigente (Vence: ${formattedExp})`,
    days: diffDays,
    color: "#16a34a"
  };
}

function getManejoComentadoStatus(conductor) {
  if (!conductor?.fecha_manejo_comentado) {
    return {
      status: "no_registrado",
      label: "Manejo comentado no registrado",
      color: "#dc2626"
    };
  }

  let evalDate;
  if (conductor.fecha_manejo_comentado instanceof Date) {
    evalDate = new Date(conductor.fecha_manejo_comentado.getTime());
  } else {
    const rawStr = String(conductor.fecha_manejo_comentado).trim();
    const dateMatch = rawStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (dateMatch) {
      const [, y, m, d] = dateMatch.map(Number);
      evalDate = new Date(y, m - 1, d);
    } else {
      evalDate = new Date(rawStr);
    }
  }

  if (Number.isNaN(evalDate.getTime())) {
    return {
      status: "no_registrado",
      label: "Fecha de manejo comentado no válida",
      color: "#dc2626"
    };
  }

  // Regla de vigencia semestral (6 meses = 180 días) según estándar operativo (consistente con backend)
  const vencimiento = new Date(evalDate.getFullYear(), evalDate.getMonth() + 6, evalDate.getDate());

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffDays = Math.ceil((vencimiento.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const formattedExp = vencimiento.toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });

  if (diffDays < 0) {
    return {
      status: "vencido",
      label: `Manejo comentado vencido (${formattedExp} - hace ${Math.abs(diffDays)} días)`,
      days: diffDays,
      color: "#dc2626"
    };
  }

  if (diffDays <= 30) {
    return {
      status: "por_vencer",
      label: `Manejo comentado por vencer (${formattedExp} - quedan ${diffDays} días)`,
      days: diffDays,
      color: "#d97706"
    };
  }

  return {
    status: "vigente",
    label: `Manejo comentado vigente (Vence: ${formattedExp} - quedan ${diffDays} días)`,
    days: diffDays,
    color: "#16a34a"
  };
}

function formatDate(value) {
  if (!value) {
    return "No registrada";
  }

  const normalizedValue =
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? `${value}T00:00:00`
      : value;

  const date =
    new Date(normalizedValue);

  if (Number.isNaN(date.getTime())) {
    return "Fecha no válida";
  }

  return date.toLocaleDateString(
    "es-MX",
    {
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }
  );
}

function ConductoresPage({ user }) {
  const [conductores, setConductores] =
    useState([]);

  const [search, setSearch] =
    useState("");

  const [status, setStatus] =
    useState("TODOS");

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const [loading, setLoading] =
    useState(true);

  const [message, setMessage] =
    useState("");

  const [messageType, setMessageType] =
    useState("success");

  const [updatingId, setUpdatingId] =
    useState(null);

  const [vehiculosOptions, setVehiculosOptions] =
    useState([]);

  const [assigningId, setAssigningId] =
    useState(null);

  const [approveModalConductor, setApproveModalConductor] =
    useState(null);

  const [selectedEmpresa, setSelectedEmpresa] = useState("TODAS");
  const [selectedUnidadFilter, setSelectedUnidadFilter] = useState("TODAS");
  const [onlyExpiringLicenses, setOnlyExpiringLicenses] = useState(false);
  const [onlyPendingApproval, setOnlyPendingApproval] = useState(false);

  // Estados para modales personalizados (reemplazan window.alert, window.confirm y window.prompt)
  const [pinModalConductor, setPinModalConductor] = useState(null);
  const [pinMode, setPinMode] = useState("auto"); // 'auto' | 'manual'
  const [manualPin, setManualPin] = useState("");
  const [pinModalError, setPinModalError] = useState("");
  const [savingPin, setSavingPin] = useState(false);

  const [pinSuccessData, setPinSuccessData] = useState(null);
  const [copiedSuccessPin, setCopiedSuccessPin] = useState(false);

  const [toggleActiveConductor, setToggleActiveConductor] = useState(null);
  const [deleteConfirmConductor, setDeleteConfirmConductor] = useState(null);

  async function loadVehiculos() {
    try {
      const res = await getAdminVehiculos({ status: "ACTIVOS" });
      setVehiculosOptions(res.data ?? []);
    } catch (err) {
      console.error("Error cargando vehículos:", err);
    }
  }

  async function loadConductores() {
    setLoading(true);

    try {
      const response =
        await getAdminConductores({
          search,
          status
        });

      setConductores(
        response.data ?? []
      );
      setCurrentPage(1);
    } catch (error) {
      setMessage(error.message);
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  }

  async function handleAssignVehicle(idConductor, idVehiculoVal) {
    setAssigningId(idConductor);
    try {
      const idVehiculo = idVehiculoVal ? Number(idVehiculoVal) : null;
      const res = await assignAdminConductorVehicle(idConductor, idVehiculo);
      setMessage(res.message || "Asignación vehicular actualizada.");
      setMessageType("success");
      await Promise.all([loadConductores(), loadVehiculos()]);
    } catch (err) {
      setMessage(err.message || "Error al asignar vehículo.");
      setMessageType("error");
    } finally {
      setAssigningId(null);
    }
  }

  async function handleApproveDriver(idConductor, aprobado) {
    try {
      setUpdatingId(idConductor);
      const res = await approveAdminConductor(idConductor, aprobado);
      if (res.data?.pinGenerado) {
        const cond = conductores.find((c) => c.id_conductores === idConductor) || approveModalConductor;
        setPinSuccessData({
          conductorNombre: cond?.nombre || "Conductor",
          pin: res.data.pinGenerado,
          isApproval: true
        });
      }
      setMessage(res.message || "Estado de aprobación actualizado.");
      setMessageType("success");
      await loadConductores();
    } catch (err) {
      setMessage(err.message || "Error al actualizar estado de aprobación.");
      setMessageType("error");
    } finally {
      setUpdatingId(null);
    }
  }

  function handleOpenPinModal(conductor) {
    setPinModalConductor(conductor);
    setPinMode("auto");
    setManualPin("");
    setPinModalError("");
  }

  async function handleSavePin() {
    if (!pinModalConductor) return;
    if (pinMode === "manual") {
      const clean = manualPin.trim();
      if (!/^\d{4}$/.test(clean)) {
        setPinModalError("El PIN debe constar de exactamente 4 dígitos numéricos.");
        return;
      }
    }

    try {
      setSavingPin(true);
      setPinModalError("");
      const res = await setAdminConductorPin(
        pinModalConductor.id_conductores,
        pinMode === "manual" ? manualPin.trim() : null
      );

      const generatedPin = res.data?.pin;
      setPinModalConductor(null);
      setPinSuccessData({
        conductorNombre: pinModalConductor.nombre,
        pin: generatedPin,
        isApproval: false
      });
      setMessage(res.message || "PIN asignado exitosamente.");
      setMessageType("success");
      await loadConductores();
    } catch (err) {
      setPinModalError(err.message || "Error al asignar PIN.");
    } finally {
      setSavingPin(false);
    }
  }

  function handleDownloadPinCard() {
    if (!pinSuccessData) return;
    downloadPinCardImage(pinSuccessData.conductorNombre, pinSuccessData.pin);
  }

  function handleCopyPin() {
    if (!pinSuccessData?.pin) return;
    navigator.clipboard.writeText(pinSuccessData.pin);
    setCopiedSuccessPin(true);
    setTimeout(() => setCopiedSuccessPin(false), 2000);
  }

  const canToggleActive =
    !user ||
    ["ADMINISTRADOR", "GERENTE", "GERENTE_GENERAL", "COORDINADOR", "COORDINADOR_AREA", "COORDINADOR_QHSE"].includes(user.rol);

  const canApprove =
    !user ||
    ["ADMINISTRADOR", "GERENTE", "GERENTE_GENERAL", "COORDINADOR", "COORDINADOR_AREA", "COORDINADOR_QHSE", "SUPERVISOR", "QHSE"].includes(user.rol);

  function handleOpenToggleActive(conductor) {
    setToggleActiveConductor(conductor);
  }

  async function confirmToggleActive() {
    if (!toggleActiveConductor) return;
    const conductor = toggleActiveConductor;
    const nuevoEstado = !conductor.activo;
    const accionTexto = nuevoEstado ? "reactivar" : "desactivar";

    setUpdatingId(conductor.id_conductores);
    setMessage("");

    try {
      const res = await toggleAdminConductorActive(conductor.id_conductores, nuevoEstado);
      setMessage(res.message || `Conductor ${nuevoEstado ? "reactivado" : "desactivado"} correctamente.`);
      setMessageType("success");

      setConductores((prev) =>
        prev.map((c) => (c.id_conductores === conductor.id_conductores ? { ...c, activo: nuevoEstado } : c))
      );

      if (approveModalConductor?.id_conductores === conductor.id_conductores) {
        setApproveModalConductor((prev) => (prev ? { ...prev, activo: nuevoEstado } : null));
      }
      setToggleActiveConductor(null);
    } catch (err) {
      setMessage(err.message || `Error al ${accionTexto} al conductor.`);
      setMessageType("error");
    } finally {
      setUpdatingId(null);
    }
  }

  useEffect(() => {
    loadVehiculos();
  }, []);

  useEffect(() => {
    const timeoutId =
      window.setTimeout(() => {
        loadConductores();
      }, 300);

    return () => {
      window.clearTimeout(
        timeoutId
      );
    };
  }, [search, status]);

  function handleOpenDelete(conductor) {
    setDeleteConfirmConductor(conductor);
  }

  async function confirmDeleteDriver() {
    if (!deleteConfirmConductor) return;
    const conductor = deleteConfirmConductor;

    setUpdatingId(conductor.id_conductores);
    setMessage("");

    try {
      const response = await updateAdminConductorStatus(
        conductor.id_conductores,
        false
      );

      setConductores((current) =>
        current.filter((item) => item.id_conductores !== conductor.id_conductores)
      );
      await loadConductores();

      setMessage(response.message || "Conductor eliminado permanentemente.");
      setMessageType("success");
      setDeleteConfirmConductor(null);
    } catch (error) {
      setMessage(error.message);
      setMessageType("error");
    } finally {
      setUpdatingId(null);
    }
  }

  // Lista única de empresas para el filtro
  const empresasList = Array.from(
    new Set(conductores.map((c) => c.empresa).filter(Boolean))
  ).sort();

  // Filtrado compuesto en cliente
  const filteredConductores = conductores.filter((conductor) => {
    if (selectedEmpresa !== "TODAS" && conductor.empresa !== selectedEmpresa) {
      return false;
    }
    if (selectedUnidadFilter === "CON_UNIDAD" && !conductor.id_vehiculo_asignado) {
      return false;
    }
    if (selectedUnidadFilter === "SIN_UNIDAD" && conductor.id_vehiculo_asignado) {
      return false;
    }
    if (onlyPendingApproval && conductor.aprobado_por_admin) {
      return false;
    }
    if (onlyExpiringLicenses) {
      const licStatus = getLicenciaStatus(conductor);
      if (licStatus.status !== "por_vencer" && licStatus.status !== "vencida") {
        return false;
      }
    }
    return true;
  });

  // Métricas para KPI Cards
  const totalConductoresCount = conductores.length;
  const pendientesAprobacionCount = conductores.filter((c) => !c.aprobado_por_admin).length;
  const aprobadosCount = conductores.filter((c) => c.aprobado_por_admin).length;
  const aprobadosPct = totalConductoresCount > 0 ? ((aprobadosCount / totalConductoresCount) * 100).toFixed(1) : "0.0";
  const unidadesAsignadasCount = conductores.filter((c) => c.id_vehiculo_asignado).length;
  const unidadesSinAsignarCount = Math.max(0, totalConductoresCount - unidadesAsignadasCount);
  const licenciasPorVencerCount = conductores.filter((c) => {
    const s = getLicenciaStatus(c).status;
    return s === "por_vencer" || s === "vencida";
  }).length;

  const handleResetFilters = () => {
    setSearch("");
    setStatus("TODOS");
    setSelectedEmpresa("TODAS");
    setSelectedUnidadFilter("TODAS");
    setOnlyExpiringLicenses(false);
    setOnlyPendingApproval(false);
    setCurrentPage(1);
  };

  const totalFiltered = filteredConductores.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / itemsPerPage));
  const paginatedConductores = filteredConductores.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <section className="module-page">
      <header className="module-header">
        <div>
          <span className="module-label">
            Administración
          </span>

          <h1>Conductores</h1>

          <p>
            Consulta, registra y controla el acceso y la vigencia operativa de los conductores.
          </p>
        </div>
      </header>

      {/* KPI Cards Grid */}
      <section className="conductores-kpis-grid" aria-label="Métricas de conductores">
        <div className="conductor-kpi-card">
          <div className="kpi-card-header">
            <span className="kpi-card-title">Total Conductores</span>
            <div className="kpi-icon-wrapper kpi-icon-blue">
              <IconUsuarios size={20} />
            </div>
          </div>
          <div className="kpi-card-value">{totalConductoresCount}</div>
          <div className="kpi-card-subtext">
            <span className="kpi-sub-pill kpi-pill-blue">Registrados</span> en plataforma
          </div>
        </div>

        <div
          className={`conductor-kpi-card kpi-card-clickable ${onlyPendingApproval ? "kpi-card-active" : ""}`}
          onClick={() => {
            setOnlyPendingApproval(!onlyPendingApproval);
            setCurrentPage(1);
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              setOnlyPendingApproval(!onlyPendingApproval);
              setCurrentPage(1);
            }
          }}
          title={onlyPendingApproval ? "Click para ver todos" : "Click para filtrar solo pendientes por aprobar"}
        >
          <div className="kpi-card-header">
            <span className="kpi-card-title">Pendientes por Aprobar</span>
            <div className="kpi-icon-wrapper kpi-icon-amber">
              <IconAlerta size={20} />
            </div>
          </div>
          <div className={`kpi-card-value ${pendientesAprobacionCount > 0 ? "kpi-val-amber" : ""}`}>
            {pendientesAprobacionCount}
          </div>
          <div className="kpi-card-subtext">
            <span className={`kpi-sub-pill ${pendientesAprobacionCount > 0 ? "kpi-pill-amber" : "kpi-pill-green"}`}>
              {pendientesAprobacionCount > 0 ? "Por revisar" : "Al día"}
            </span>{" "}
            {onlyPendingApproval ? "(Filtro activo)" : `${aprobadosPct}% aprobados`}
          </div>
        </div>

        <div
          className={`conductor-kpi-card kpi-card-clickable ${selectedUnidadFilter === "CON_UNIDAD" ? "kpi-card-active" : ""}`}
          onClick={() => {
            setSelectedUnidadFilter((prev) => (prev === "CON_UNIDAD" ? "TODAS" : "CON_UNIDAD"));
            setCurrentPage(1);
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              setSelectedUnidadFilter((prev) => (prev === "CON_UNIDAD" ? "TODAS" : "CON_UNIDAD"));
              setCurrentPage(1);
            }
          }}
          title={selectedUnidadFilter === "CON_UNIDAD" ? "Click para mostrar todas las unidades" : "Click para filtrar conductores con unidad asignada"}
        >
          <div className="kpi-card-header">
            <span className="kpi-card-title">Unidades Asignadas</span>
            <div className="kpi-icon-wrapper kpi-icon-indigo">
              <IconSwap size={20} />
            </div>
          </div>
          <div className="kpi-card-value">{unidadesAsignadasCount}</div>
          <div className="kpi-card-subtext">
            <span className="kpi-sub-pill kpi-pill-gray">{unidadesSinAsignarCount} sin asignar</span>{" "}
            {selectedUnidadFilter === "CON_UNIDAD" ? "(Filtro activo)" : ""}
          </div>
        </div>

        <div
          className={`conductor-kpi-card kpi-card-clickable ${onlyExpiringLicenses ? "kpi-card-active" : ""}`}
          onClick={() => {
            setOnlyExpiringLicenses(!onlyExpiringLicenses);
            setCurrentPage(1);
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              setOnlyExpiringLicenses(!onlyExpiringLicenses);
              setCurrentPage(1);
            }
          }}
          title={onlyExpiringLicenses ? "Click para mostrar todos los conductores" : "Click para filtrar solo conductores con licencia por vencer o vencida"}
        >
          <div className="kpi-card-header">
            <span className="kpi-card-title">Licencias por Vencer</span>
            <div className="kpi-icon-wrapper kpi-icon-amber">
              <IconAlerta size={20} />
            </div>
          </div>
          <div className="kpi-card-value kpi-val-amber">{licenciasPorVencerCount}</div>
          <div className="kpi-card-subtext">
            <span className="kpi-sub-pill kpi-pill-amber">Plazo &lt; 30 días</span> {onlyExpiringLicenses ? "(Filtro activo)" : "requieren atención"}
          </div>
        </div>
      </section>

      {/* Toolbar con filtros completos y botón de reset */}
      <section className="module-toolbar conductores-filter-toolbar">
        <label className="search-field">
          <span>Buscar</span>
          <input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setCurrentPage(1);
            }}
            placeholder="Buscar por nombre, licencia..."
          />
        </label>

        <label className="status-filter">
          <span>Estado</span>
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="TODOS">Todos</option>
            <option value="ACTIVOS">Activos</option>
            <option value="INACTIVOS">Inactivos</option>
          </select>
        </label>

        <label className="status-filter">
          <span>Empresa</span>
          <select
            value={selectedEmpresa}
            onChange={(event) => {
              setSelectedEmpresa(event.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="TODAS">Empresa: Todas</option>
            {empresasList.map((emp) => (
              <option key={emp} value={emp}>
                {emp}
              </option>
            ))}
          </select>
        </label>

        <label className="status-filter">
          <span>Unidades</span>
          <select
            value={selectedUnidadFilter}
            onChange={(event) => {
              setSelectedUnidadFilter(event.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="TODAS">Unidades: Todas</option>
            <option value="CON_UNIDAD">Con unidad</option>
            <option value="SIN_UNIDAD">Sin unidad</option>
          </select>
        </label>

        <div className="toolbar-reset-wrapper">
          <button
            type="button"
            className="filter-reset-btn"
            onClick={handleResetFilters}
            data-tooltip="Restablecer filtros"
            aria-label="Restablecer filtros"
          >
            <IconReset size={16} />
          </button>
        </div>
      </section>

      {message && (
        <p
          className={`module-message module-message-${messageType}`}
          role={
            messageType === "error"
              ? "alert"
              : "status"
          }
        >
          {message}
        </p>
      )}

      {onlyPendingApproval && (
        <div className="filter-active-notice">
          <IconAlerta size={16} className="notice-icon" />
          <span>Mostrando únicamente conductores pendientes de aprobación ({totalFiltered}).</span>
          <button type="button" className="notice-clear-btn" onClick={() => setOnlyPendingApproval(false)}>
            Quitar filtro
          </button>
        </div>
      )}

      {selectedUnidadFilter === "CON_UNIDAD" && (
        <div className="filter-active-notice">
          <IconSwap size={16} className="notice-icon" />
          <span>Mostrando únicamente conductores con unidad vehicular asignada ({totalFiltered}).</span>
          <button type="button" className="notice-clear-btn" onClick={() => setSelectedUnidadFilter("TODAS")}>
            Quitar filtro
          </button>
        </div>
      )}

      {onlyExpiringLicenses && (
        <div className="filter-active-notice">
          <IconAlerta size={16} className="notice-icon" />
          <span>Mostrando únicamente conductores con licencia vencida o por vencer en los próximos 30 días ({totalFiltered}).</span>
          <button type="button" className="notice-clear-btn" onClick={() => setOnlyExpiringLicenses(false)}>
            Quitar filtro
          </button>
        </div>
      )}

      <section className="table-panel">
        {loading ? (
          <p className="table-status">
            Cargando conductores...
          </p>
        ) : filteredConductores.length === 0 ? (
          <p className="table-status">
            No se encontraron conductores con los criterios seleccionados.
          </p>
        ) : (
          <>
            <div className="table-wrapper admin-table-desktop">
            <table className="admin-table conductores-table">
              <thead>
                <tr>
                  <th className="col-conductor">Conductor</th>
                  <th className="col-empresa">Empresa</th>
                  <th className="col-unidad">Unidad Asignada</th>
                  <th className="col-licencia">Licencia</th>
                  <th className="col-vencimiento">Vencimiento</th>
                  <th className="col-mc">Manejo Comentado</th>
                  <th className="col-estado">Estado</th>
                  {(!user || ["ADMINISTRADOR", "GERENTE", "GERENTE_GENERAL", "COORDINADOR", "COORDINADOR_AREA", "COORDINADOR_QHSE", "SUPERVISOR", "QHSE"].includes(user.rol)) && (
                    <th className="col-acciones">Acciones</th>
                  )}
                </tr>
              </thead>

              <tbody>
                {paginatedConductores.map((conductor) => {
                  const licStatus = getLicenciaStatus(conductor);
                  const mcStatus = getManejoComentadoStatus(conductor);

                  return (
                    <tr key={conductor.id_conductores}>
                      <td className="col-conductor">
                        <div className="conductor-name-group">
                          <strong className="conductor-name-cell">
                            {conductor.nombre}
                          </strong>
                          <span className="conductor-id-badge">
                            ID: CON-{String(conductor.id_conductores).padStart(4, "0")}
                          </span>
                        </div>
                      </td>

                      <td className="col-empresa">
                        <span className="empresa-pill-badge" title={conductor.empresa || "No registrada"}>
                          {conductor.empresa || "Sin registrar"}
                        </span>
                      </td>

                      <td className="col-unidad">
                        <VehicleSelectDropdown
                          value={conductor.id_vehiculo_asignado || ""}
                          options={vehiculosOptions}
                          onChange={(newVehiculoId) => handleAssignVehicle(conductor.id_conductores, newVehiculoId)}
                          disabled={!conductor.activo}
                          loading={assigningId === conductor.id_conductores}
                        />
                      </td>

                      <td className="col-licencia">
                        <span className="licencia-num">{conductor.licencia_numero || "N/A"}</span>
                      </td>

                      <td className="col-vencimiento">
                        <div className="status-cell-center">
                          <span
                            className={`status-circle-icon status-circle-${licStatus.status}`}
                            data-tooltip={licStatus.label}
                            aria-label={licStatus.label}
                          >
                            {licStatus.status === "vigente" ? (
                              <IconCheck size={13} strokeWidth={2.8} />
                            ) : licStatus.status === "por_vencer" ? (
                              <IconAlerta size={13} strokeWidth={2.2} />
                            ) : (
                              <IconCross size={13} strokeWidth={2.8} />
                            )}
                          </span>
                        </div>
                      </td>

                      <td className="col-mc">
                        <div className="status-cell-center">
                          <span
                            className={`status-circle-icon status-circle-${mcStatus.status}`}
                            data-tooltip={mcStatus.label}
                            aria-label={mcStatus.label}
                          >
                            {mcStatus.status === "vigente" ? (
                              <IconCheck size={13} strokeWidth={2.8} />
                            ) : mcStatus.status === "por_vencer" ? (
                              <IconAlerta size={13} strokeWidth={2.2} />
                            ) : (
                              <IconCross size={13} strokeWidth={2.8} />
                            )}
                          </span>
                        </div>
                      </td>

                      <td className="col-estado">
                        <div className="status-cell-center">
                          {!conductor.aprobado_por_admin ? (
                            canApprove ? (
                              <div className="aprobacion-actions-group">
                                <button
                                  type="button"
                                  className="conductor-action-btn btn-approve"
                                  disabled={updatingId === conductor.id_conductores}
                                  onClick={() => handleApproveDriver(conductor.id_conductores, true)}
                                  data-tooltip="Aprobar conductor"
                                  aria-label="Aprobar conductor"
                                >
                                  <IconCheck size={14} />
                                </button>
                                <button
                                  type="button"
                                  className="conductor-action-btn btn-reject"
                                  disabled={updatingId === conductor.id_conductores}
                                  onClick={() => handleApproveDriver(conductor.id_conductores, false)}
                                  data-tooltip="Rechazar conductor"
                                  aria-label="Rechazar conductor"
                                >
                                  <IconCross size={14} />
                                </button>
                              </div>
                            ) : (
                              <span
                                className="status-circle-icon status-circle-por_vencer"
                                data-tooltip="Pendiente de aprobación"
                                aria-label="Pendiente de aprobación"
                              >
                                <IconAlerta size={13} strokeWidth={2.2} />
                              </span>
                            )
                          ) : (
                            <button
                              type="button"
                              className={`estado-toggle-btn estado-pill-halo ${conductor.activo ? "halo-active" : "halo-inactive"}`}
                              onClick={() => handleOpenToggleActive(conductor)}
                              disabled={updatingId === conductor.id_conductores}
                              data-tooltip={conductor.activo ? "Activo (Clic para desactivar)" : "Inactivo (Clic para activar)"}
                              aria-label={conductor.activo ? "Activo" : "Inactivo"}
                            >
                              <span className="estado-inner-dot" />
                            </button>
                          )}
                        </div>
                      </td>

                      {(!user || ["ADMINISTRADOR", "GERENTE", "GERENTE_GENERAL", "COORDINADOR", "COORDINADOR_AREA", "COORDINADOR_QHSE", "SUPERVISOR", "QHSE"].includes(user.rol)) && (
                        <td className="col-acciones">
                          <div className="conductor-actions-cell">
                            <button
                              type="button"
                              className="conductor-action-btn btn-view-license"
                              onClick={() => setApproveModalConductor(conductor)}
                              data-tooltip="Ver Licencia"
                              aria-label="Ver Licencia"
                            >
                              <IconVerDetalle size={16} />
                            </button>

                            <button
                              type="button"
                              className="conductor-action-btn btn-pin"
                              disabled={updatingId === conductor.id_conductores}
                              onClick={() => handleOpenPinModal(conductor)}
                              data-tooltip={conductor.tiene_pin ? "Generar nuevo PIN" : "Asignar PIN"}
                              aria-label={conductor.tiene_pin ? "Generar nuevo PIN" : "Asignar PIN"}
                            >
                              <IconKey size={16} />
                            </button>

                            <button
                              type="button"
                              className="conductor-action-btn btn-role"
                              data-tooltip="Asignar rol"
                              aria-label="Asignar rol"
                            >
                              <IconRol size={16} />
                            </button>

                            {(!user || ["ADMINISTRADOR", "GERENTE_GENERAL"].includes(user.rol)) && (
                              <button
                                type="button"
                                className="conductor-action-btn btn-delete"
                                disabled={updatingId === conductor.id_conductores}
                                onClick={() => handleOpenDelete(conductor)}
                                data-tooltip="Eliminar permanentemente"
                                aria-label="Eliminar permanentemente"
                              >
                                <IconEliminar size={16} />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Vista móvil en tarjetas responsivas (pantallas <= 900px) */}
          <div className="conductores-cards-mobile">
            {paginatedConductores.map((conductor) => {
              const licStatus = getLicenciaStatus(conductor);
              const mcStatus = getManejoComentadoStatus(conductor);

              return (
                <article key={conductor.id_conductores} className="conductor-mobile-card">
                  <header className="conductor-mobile-header">
                    <div>
                      <h3 className="conductor-mobile-name">{conductor.nombre}</h3>
                      <div style={{ display: "flex", gap: "6px", alignItems: "center", marginTop: "2px" }}>
                        <span className="conductor-id-badge">
                          CON-{String(conductor.id_conductores).padStart(4, "0")}
                        </span>
                        <span className="empresa-pill-badge">
                          {conductor.empresa || "Sin empresa"}
                        </span>
                      </div>
                    </div>
                    <div className="conductor-mobile-badges">
                      {!conductor.aprobado_por_admin ? (
                        canApprove ? (
                          <div className="aprobacion-actions-group">
                            <button
                              type="button"
                              className="conductor-action-btn btn-approve"
                              disabled={updatingId === conductor.id_conductores}
                              onClick={() => handleApproveDriver(conductor.id_conductores, true)}
                              data-tooltip="Aprobar conductor"
                              aria-label="Aprobar conductor"
                            >
                              <IconCheck size={13} />
                            </button>
                            <button
                              type="button"
                              className="conductor-action-btn btn-reject"
                              disabled={updatingId === conductor.id_conductores}
                              onClick={() => handleApproveDriver(conductor.id_conductores, false)}
                              data-tooltip="Rechazar conductor"
                              aria-label="Rechazar conductor"
                            >
                              <IconCross size={13} />
                            </button>
                          </div>
                        ) : (
                          <span
                            className="status-circle-icon status-circle-por_vencer"
                            data-tooltip="Pendiente de aprobación"
                            aria-label="Pendiente de aprobación"
                          >
                            <IconAlerta size={12} strokeWidth={2.2} />
                          </span>
                        )
                      ) : (
                        <button
                          type="button"
                          className={`estado-toggle-btn estado-pill-halo ${conductor.activo ? "halo-active" : "halo-inactive"}`}
                          onClick={() => handleOpenToggleActive(conductor)}
                          disabled={updatingId === conductor.id_conductores}
                          data-tooltip={conductor.activo ? "Activo (Clic para desactivar)" : "Inactivo (Clic para activar)"}
                          aria-label={conductor.activo ? "Activo" : "Inactivo"}
                        >
                          <span className="estado-inner-dot" />
                        </button>
                      )}
                    </div>
                  </header>

                  <div className="conductor-mobile-grid">
                    <div className="conductor-mobile-field">
                      <span className="conductor-mobile-label">Licencia</span>
                      <span className="conductor-mobile-value" style={{ fontWeight: 600 }}>
                        {conductor.licencia_numero || "N/A"}
                      </span>
                    </div>

                    <div className="conductor-mobile-field">
                      <span className="conductor-mobile-label">Vencimiento</span>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span
                          className={`status-circle-icon status-circle-${licStatus.status}`}
                          data-tooltip={licStatus.label}
                          aria-label={licStatus.label}
                        >
                          {licStatus.status === "vigente" ? (
                            <IconCheck size={12} strokeWidth={2.8} />
                          ) : licStatus.status === "por_vencer" ? (
                            <IconAlerta size={12} strokeWidth={2.2} />
                          ) : (
                            <IconCross size={12} strokeWidth={2.8} />
                          )}
                        </span>
                        <span style={{ fontSize: "0.78rem", color: "#64748b" }}>
                          {licStatus.status === "vigente" ? "Vigente" : licStatus.status === "por_vencer" ? "Por vencer" : "Vencida"}
                        </span>
                      </div>
                    </div>

                    <div className="conductor-mobile-field full-width">
                      <span className="conductor-mobile-label">Manejo Comentado</span>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span className="conductor-mobile-value">{formatDate(conductor.fecha_manejo_comentado)}</span>
                        <span
                          className={`status-circle-icon status-circle-${mcStatus.status}`}
                          data-tooltip={mcStatus.label}
                          aria-label={mcStatus.label}
                        >
                          {mcStatus.status === "vigente" ? (
                            <IconCheck size={12} strokeWidth={2.8} />
                          ) : mcStatus.status === "por_vencer" ? (
                            <IconAlerta size={12} strokeWidth={2.2} />
                          ) : (
                            <IconCross size={12} strokeWidth={2.8} />
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="conductor-mobile-field full-width">
                      <span className="conductor-mobile-label">Unidad Asignada</span>
                      <div style={{ marginTop: "4px", width: "100%" }}>
                        <VehicleSelectDropdown
                          value={conductor.id_vehiculo_asignado || ""}
                          options={vehiculosOptions}
                          onChange={(newVehiculoId) => handleAssignVehicle(conductor.id_conductores, newVehiculoId)}
                          disabled={!conductor.activo}
                          loading={assigningId === conductor.id_conductores}
                          className="vehicle-select-mobile-full"
                        />
                      </div>
                    </div>
                  </div>

                {(!user || ["ADMINISTRADOR", "GERENTE", "GERENTE_GENERAL", "COORDINADOR", "COORDINADOR_AREA", "COORDINADOR_QHSE", "SUPERVISOR", "QHSE"].includes(user.rol)) && (
                  <footer className="conductor-mobile-actions">
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => setApproveModalConductor(conductor)}
                    >
                      Ver Licencia
                    </button>

                    <button
                      type="button"
                      className="secondary-button"
                      disabled={updatingId === conductor.id_conductores}
                      onClick={() => handleOpenPinModal(conductor)}
                      style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                    >
                      <IconKey size={15} />
                      <span>{conductor.tiene_pin ? "Nuevo PIN" : "Asignar PIN"}</span>
                    </button>

                    <button
                      type="button"
                      className="secondary-button btn-role-mobile"
                      style={{ color: "#7c3aed", borderColor: "#ddd6fe", background: "#f5f3ff", display: "inline-flex", alignItems: "center", gap: "6px" }}
                    >
                      <IconRol size={15} /> Asignar rol
                    </button>

                    {(!user || user.rol === "ADMINISTRADOR") && (
                      <button
                        type="button"
                        className="secondary-button"
                        style={{ color: "#991b1b", border: "1px solid #fecaca" }}
                        disabled={updatingId === conductor.id_conductores}
                        onClick={() => handleOpenDelete(conductor)}
                      >
                        Eliminar
                      </button>
                    )}
                  </footer>
                )}
              </article>
            );
          })}
        </div>

            {totalFiltered > 0 && (
              <div className="table-pagination">
                <span className="pagination-info">
                  Mostrando {Math.min((currentPage - 1) * itemsPerPage + 1, totalFiltered)} - {Math.min(currentPage * itemsPerPage, totalFiltered)} de {totalFiltered} conductores
                </span>
                <div className="pagination-controls">
                  <button
                    type="button"
                    className="pagination-btn"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    ← Anterior
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
                    Siguiente →
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {approveModalConductor && (() => {
        const modalLicStatus = getLicenciaStatus(approveModalConductor);
        const modalMcStatus = getManejoComentadoStatus(approveModalConductor);

        return (
          <div
            className="modal-overlay"
            role="presentation"
            onMouseDown={() => setApproveModalConductor(null)}
          >
            <section
              className="modal-card driver-review-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="approve-modal-title"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="driver-review-header">
                <div className="driver-review-header-left">
                  <div className="driver-review-icon-box">
                    <IconIdCard size={22} />
                  </div>
                  <div className="driver-review-title-group">
                    <h2 id="approve-modal-title">Revisión de Conductor</h2>
                    <p>Verifica los datos personales y el documento de licencia antes de autorizar la operación.</p>
                  </div>
                </div>

                <div className="driver-review-header-right">
                  <span className="conductor-id-badge">
                    CON-{String(approveModalConductor.id_conductores).padStart(4, "0")}
                  </span>
                  <button
                    type="button"
                    className="driver-review-close-btn"
                    onClick={() => setApproveModalConductor(null)}
                    aria-label="Cerrar modal"
                  >
                    <IconCross size={16} />
                  </button>
                </div>
              </div>

              <div className="driver-review-content">
                {/* Columna Izquierda: Información General */}
                <div className="driver-review-card">
                  <div className="driver-review-card-header">
                    <div className="driver-review-card-title">
                      <IconUsuarios size={18} className="card-title-icon" />
                      <span>Información General</span>
                    </div>

                    <span
                      className={`estado-pill-halo ${approveModalConductor.activo ? "halo-active" : "halo-inactive"}`}
                      data-tooltip={approveModalConductor.activo ? "Conductor Activo" : "Conductor Inactivo"}
                      aria-label={approveModalConductor.activo ? "Activo" : "Inactivo"}
                    >
                      <span className="estado-inner-dot" />
                    </span>
                  </div>

                  <div className="driver-review-fields-grid">
                    <div className="driver-field-item driver-field-full">
                      <span className="driver-field-label">Nombre Completo</span>
                      <span className="driver-field-value driver-field-name">
                        {approveModalConductor.nombre}
                      </span>
                    </div>

                    <div className="driver-field-item">
                      <span className="driver-field-label">Teléfono</span>
                      <span className="driver-field-value">
                        <IconPhone size={14} style={{ color: "#64748b" }} />
                        {approveModalConductor.telefono || "No registrado"}
                      </span>
                    </div>

                    <div className="driver-field-item">
                      <span className="driver-field-label">Empresa</span>
                      <span className="driver-field-value">
                        <span className="empresa-pill-badge">
                          {approveModalConductor.empresa || "Sin asignar"}
                        </span>
                      </span>
                    </div>

                    <div className="driver-field-item">
                      <span className="driver-field-label">No. Licencia</span>
                      <span className="driver-field-value">
                        <span className="licencia-num">
                          {approveModalConductor.licencia_numero || "N/A"}
                        </span>
                      </span>
                    </div>

                    <div className="driver-field-item">
                      <span className="driver-field-label">Tipo de Licencia</span>
                      <span className="driver-field-value">
                        {approveModalConductor.tipo_licencia || "No especificado"}
                      </span>
                    </div>

                    <div className="driver-field-item">
                      <span className="driver-field-label">Vencimiento Licencia</span>
                      <span className="driver-field-value">
                        <span style={{ fontWeight: 600 }}>
                          {formatDate(approveModalConductor.licencia_vencimiento)}
                        </span>
                        <span className={`driver-status-badge badge-${modalLicStatus.status}`}>
                          {modalLicStatus.status === "vigente" ? (
                            <IconCheck size={12} strokeWidth={2.8} />
                          ) : modalLicStatus.status === "por_vencer" ? (
                            <IconAlerta size={12} strokeWidth={2.2} />
                          ) : (
                            <IconCross size={12} strokeWidth={2.8} />
                          )}
                          <span>
                            {modalLicStatus.status === "vigente"
                              ? "Vigente"
                              : modalLicStatus.status === "por_vencer"
                              ? "Por vencer"
                              : "Vencida"}
                          </span>
                        </span>
                      </span>
                    </div>

                    <div className="driver-field-item">
                      <span className="driver-field-label">Manejo Comentado</span>
                      <span className="driver-field-value">
                        <span style={{ fontWeight: 600 }}>
                          {formatDate(approveModalConductor.fecha_manejo_comentado)}
                        </span>
                        <span className={`driver-status-badge badge-${modalMcStatus.status}`}>
                          {modalMcStatus.status === "vigente" ? (
                            <IconCheck size={12} strokeWidth={2.8} />
                          ) : modalMcStatus.status === "por_vencer" ? (
                            <IconAlerta size={12} strokeWidth={2.2} />
                          ) : (
                            <IconCross size={12} strokeWidth={2.8} />
                          )}
                          <span>
                            {modalMcStatus.status === "vigente"
                              ? "Vigente"
                              : modalMcStatus.status === "por_vencer"
                              ? "Por vencer"
                              : "Vencido"}
                          </span>
                        </span>
                      </span>
                    </div>

                    <div className="driver-field-item">
                      <span className="driver-field-label">Telegram Bot</span>
                      <span className="driver-field-value">
                        <span
                          className={`driver-status-badge ${
                            approveModalConductor.telegram_user_id
                              ? "badge-telegram-linked"
                              : "badge-telegram-unlinked"
                          }`}
                        >
                          <IconTelegram size={13} />
                          <span>
                            {approveModalConductor.telegram_user_id ? "Vinculado" : "Sin vincular"}
                          </span>
                        </span>
                      </span>
                    </div>

                    <div className="driver-field-item">
                      <span className="driver-field-label">Estatus Aprobación</span>
                      <span className="driver-field-value">
                        <span
                          className={`driver-status-badge ${
                            approveModalConductor.aprobado_por_admin
                              ? "badge-vigente"
                              : "badge-por_vencer"
                          }`}
                        >
                          {approveModalConductor.aprobado_por_admin ? (
                            <IconCheck size={12} strokeWidth={2.8} />
                          ) : (
                            <IconAlerta size={12} strokeWidth={2.2} />
                          )}
                          <span>
                            {approveModalConductor.aprobado_por_admin
                              ? "Aprobado"
                              : "Pendiente de Aprobación"}
                          </span>
                        </span>
                      </span>
                    </div>

                    <div className="driver-field-item">
                      <span className="driver-field-label">PIN de Acceso</span>
                      <span className="driver-field-value">
                        <IconKey size={14} style={{ color: "#64748b" }} />
                        <span style={{ fontWeight: 600, color: approveModalConductor.tiene_pin ? "#059669" : "#64748b" }}>
                          {approveModalConductor.tiene_pin ? "PIN Asignado" : "Sin PIN"}
                        </span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Columna Derecha: Documentos de Licencia */}
                <div className="driver-review-card">
                  <div className="driver-review-card-header">
                    <div className="driver-review-card-title">
                      <IconIdCard size={18} className="card-title-icon" />
                      <span>Documentos de Licencia</span>
                    </div>
                    <span className="driver-status-badge badge-sin_fecha">
                      2 Vistas
                    </span>
                  </div>

                  <div className="driver-doc-grid">
                    {/* Licencia Frente */}
                    <div className="driver-doc-slot">
                      <span className="driver-doc-slot-label">
                        <IconIdCard size={13} /> Frente
                      </span>
                      <div className="driver-doc-preview-box">
                        {approveModalConductor.licencia_url ? (
                          approveModalConductor.licencia_url.toLowerCase().endsWith(".pdf") ? (
                            <div className="driver-doc-pdf">
                              <IconFileText size={28} style={{ color: "#0284c7" }} />
                              <a
                                href={approveModalConductor.licencia_url}
                                target="_blank"
                                rel="noreferrer"
                                className="driver-doc-pdf-link"
                              >
                                <span>Abrir PDF</span>
                                <IconExternalLink size={13} />
                              </a>
                            </div>
                          ) : (
                            <>
                              <img
                                src={approveModalConductor.licencia_url}
                                alt={`Licencia frente de ${approveModalConductor.nombre}`}
                                className="driver-doc-img"
                              />
                              <div className="driver-doc-overlay">
                                <a
                                  href={approveModalConductor.licencia_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="driver-doc-overlay-btn"
                                >
                                  <span>Ampliar</span>
                                  <IconExternalLink size={13} />
                                </a>
                              </div>
                            </>
                          )
                        ) : (
                          <div className="driver-doc-empty">
                            <IconIdCard size={28} />
                            <span>Sin foto Frente</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Licencia Reverso */}
                    <div className="driver-doc-slot">
                      <span className="driver-doc-slot-label">
                        <IconIdCard size={13} /> Reverso
                      </span>
                      <div className="driver-doc-preview-box">
                        {approveModalConductor.licencia_reverso_url ? (
                          approveModalConductor.licencia_reverso_url.toLowerCase().endsWith(".pdf") ? (
                            <div className="driver-doc-pdf">
                              <IconFileText size={28} style={{ color: "#0284c7" }} />
                              <a
                                href={approveModalConductor.licencia_reverso_url}
                                target="_blank"
                                rel="noreferrer"
                                className="driver-doc-pdf-link"
                              >
                                <span>Abrir PDF</span>
                                <IconExternalLink size={13} />
                              </a>
                            </div>
                          ) : (
                            <>
                              <img
                                src={approveModalConductor.licencia_reverso_url}
                                alt={`Licencia reverso de ${approveModalConductor.nombre}`}
                                className="driver-doc-img"
                              />
                              <div className="driver-doc-overlay">
                                <a
                                  href={approveModalConductor.licencia_reverso_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="driver-doc-overlay-btn"
                                >
                                  <span>Ampliar</span>
                                  <IconExternalLink size={13} />
                                </a>
                              </div>
                            </>
                          )
                        ) : (
                          <div className="driver-doc-empty">
                            <IconIdCard size={28} />
                            <span>Sin foto Reverso</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="driver-doc-footer-hint">
                    <IconVerDetalle size={14} style={{ color: "#0284c7", flexShrink: 0 }} />
                    <span>Haz clic en una imagen para abrirla en resolución completa.</span>
                  </div>
                </div>
              </div>

              <div className="driver-review-footer">
                <div>
                  <span style={{ fontSize: "0.78rem", color: "#64748b" }}>
                    Registro verificado en plataforma
                  </span>
                </div>

                <div className="driver-review-footer-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => setApproveModalConductor(null)}
                    disabled={updatingId === approveModalConductor.id_conductores}
                  >
                    Cerrar
                  </button>

                  <button
                    type="button"
                    className="secondary-button"
                    style={{ fontSize: "0.85rem", padding: "8px 16px", display: "inline-flex", alignItems: "center", gap: "6px" }}
                    disabled={updatingId === approveModalConductor.id_conductores}
                    onClick={() => {
                      const cond = approveModalConductor;
                      setApproveModalConductor(null);
                      handleOpenPinModal(cond);
                    }}
                  >
                    <IconKey size={15} />
                    <span>{approveModalConductor.tiene_pin ? "Generar Nuevo PIN" : "Asignar PIN"}</span>
                  </button>

                  {canToggleActive && (
                    <button
                      type="button"
                      className={approveModalConductor.activo ? "danger-button" : "reactivate-button"}
                      style={{ fontSize: "0.85rem", padding: "8px 16px", display: "inline-flex", alignItems: "center", gap: "6px" }}
                      disabled={updatingId === approveModalConductor.id_conductores}
                      onClick={() => handleOpenToggleActive(approveModalConductor)}
                    >
                      {approveModalConductor.activo ? (
                        <>
                          <IconPower size={15} />
                          <span>Desactivar Conductor</span>
                        </>
                      ) : (
                        <>
                          <IconReactivar size={15} />
                          <span>Reactivar Conductor</span>
                        </>
                      )}
                    </button>
                  )}

                  {!approveModalConductor.aprobado_por_admin && (
                    <>
                      <button
                        type="button"
                        className="danger-button"
                        style={{ fontSize: "0.85rem", padding: "8px 16px", display: "inline-flex", alignItems: "center", gap: "6px" }}
                        disabled={updatingId === approveModalConductor.id_conductores}
                        onClick={async () => {
                          await handleApproveDriver(approveModalConductor.id_conductores, false);
                          setApproveModalConductor(null);
                        }}
                      >
                        <IconCross size={15} />
                        <span>Rechazar</span>
                      </button>
                      <button
                        type="button"
                        className="primary-button"
                        style={{ backgroundColor: "#16a34a", fontSize: "0.85rem", padding: "8px 16px", display: "inline-flex", alignItems: "center", gap: "6px" }}
                        disabled={updatingId === approveModalConductor.id_conductores}
                        onClick={async () => {
                          await handleApproveDriver(approveModalConductor.id_conductores, true);
                          setApproveModalConductor(null);
                        }}
                      >
                        <IconCheck size={15} />
                        <span>
                          {updatingId === approveModalConductor.id_conductores
                            ? "Procesando..."
                            : "Aprobar Conductor"}
                        </span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            </section>
          </div>
        );
      })()}

      {/* Modal 1: Asignar / Cambiar PIN */}
      {pinModalConductor && (
        <div className="modal-overlay" onClick={() => !savingPin && setPinModalConductor(null)}>
          <div
            className="modal-card"
            style={{ maxWidth: "440px", width: "100%" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="form-panel-header">
              <div>
                <h2>{pinModalConductor.tiene_pin ? "Cambiar PIN de Acceso" : "Asignar PIN de Acceso"}</h2>
                <p style={{ margin: "4px 0 0 0", color: "#64748b", fontSize: "0.85rem" }}>
                  Conductor: <strong>{pinModalConductor.nombre}</strong>
                </p>
              </div>
              <button
                type="button"
                className="close-button"
                disabled={savingPin}
                onClick={() => setPinModalConductor(null)}
              >
                <IconCross size={16} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "16px 0" }}>
              <p style={{ fontSize: "0.88rem", color: "#475569", margin: 0 }}>
                Elige cómo deseas establecer el PIN de 4 dígitos para este conductor:
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <label
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "10px",
                    padding: "12px",
                    borderRadius: "8px",
                    border: pinMode === "auto" ? "2px solid #2563eb" : "1px solid #e2e8f0",
                    background: pinMode === "auto" ? "#eff6ff" : "#f8fafc",
                    cursor: "pointer"
                  }}
                >
                  <input
                    type="radio"
                    name="pinMode"
                    value="auto"
                    checked={pinMode === "auto"}
                    onChange={() => {
                      setPinMode("auto");
                      setPinModalError("");
                    }}
                    style={{ marginTop: "2px" }}
                  />
                  <div>
                    <strong style={{ fontSize: "0.9rem", color: "#1e293b", display: "block" }}>
                      Generar automáticamente
                    </strong>
                    <span style={{ fontSize: "0.78rem", color: "#64748b" }}>
                      El sistema creará un PIN aleatorio y seguro de 4 dígitos.
                    </span>
                  </div>
                </label>

                <label
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "10px",
                    padding: "12px",
                    borderRadius: "8px",
                    border: pinMode === "manual" ? "2px solid #2563eb" : "1px solid #e2e8f0",
                    background: pinMode === "manual" ? "#eff6ff" : "#f8fafc",
                    cursor: "pointer"
                  }}
                >
                  <input
                    type="radio"
                    name="pinMode"
                    value="manual"
                    checked={pinMode === "manual"}
                    onChange={() => {
                      setPinMode("manual");
                      setPinModalError("");
                    }}
                    style={{ marginTop: "2px" }}
                  />
                  <div style={{ width: "100%" }}>
                    <strong style={{ fontSize: "0.9rem", color: "#1e293b", display: "block" }}>
                      Ingresar PIN manual
                    </strong>
                    <span style={{ fontSize: "0.78rem", color: "#64748b" }}>
                      Escribe un código numérico de exactamente 4 dígitos.
                    </span>

                    {pinMode === "manual" && (
                      <div style={{ marginTop: "10px" }}>
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={4}
                          placeholder="Ej. 4829"
                          value={manualPin}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, "").slice(0, 4);
                            setManualPin(val);
                            if (pinModalError) setPinModalError("");
                          }}
                          style={{
                            width: "100%",
                            padding: "10px 12px",
                            fontSize: "1.2rem",
                            letterSpacing: "4px",
                            textAlign: "center",
                            fontFamily: "monospace",
                            fontWeight: "bold",
                            borderRadius: "6px",
                            border: "1px solid #cbd5e1"
                          }}
                          autoFocus
                        />
                      </div>
                    )}
                  </div>
                </label>
              </div>

              {pinModalError && (
                <div style={{ padding: "8px 12px", background: "#fee2e2", color: "#991b1b", borderRadius: "6px", fontSize: "0.82rem", display: "flex", alignItems: "center", gap: "6px" }}>
                  <IconAlerta size={14} />
                  <span>{pinModalError}</span>
                </div>
              )}
            </div>

            <div className="form-actions" style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              <button
                type="button"
                className="secondary-button"
                disabled={savingPin}
                onClick={() => setPinModalConductor(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="primary-button"
                disabled={savingPin || (pinMode === "manual" && manualPin.length !== 4)}
                onClick={handleSavePin}
              >
                {savingPin ? "Guardando..." : "Asignar PIN"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: PIN Asignado con Éxito */}
      {pinSuccessData && (
        <div className="modal-overlay" onClick={() => setPinSuccessData(null)}>
          <div
            className="modal-card"
            style={{ maxWidth: "420px", width: "100%", textAlign: "center" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                width: "52px",
                height: "52px",
                borderRadius: "50%",
                background: "#ecfdf5",
                border: "1px solid #a7f3d0",
                color: "#059669",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "8px auto 14px auto"
              }}
            >
              <IconCheck size={28} strokeWidth={2.8} />
            </div>
            <h2 style={{ fontSize: "1.25rem", color: "#1e293b", margin: "0 0 6px 0" }}>
              {pinSuccessData.isApproval ? "¡Conductor Aprobado!" : "¡PIN Asignado con Éxito!"}
            </h2>
            <p style={{ fontSize: "0.88rem", color: "#64748b", margin: "0 0 16px 0" }}>
              {pinSuccessData.isApproval
                ? `El conductor ${pinSuccessData.conductorNombre} ha sido aprobado. Se le generó el siguiente PIN para el bot:`
                : `Se asignó el nuevo PIN de acceso para ${pinSuccessData.conductorNombre}:`}
            </p>

            <div
              style={{
                background: "#f1f5f9",
                border: "2px dashed #94a3b8",
                borderRadius: "10px",
                padding: "16px",
                margin: "0 0 16px 0",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "10px"
              }}
            >
              <span
                style={{
                  fontSize: "2.4rem",
                  fontWeight: "bold",
                  letterSpacing: "8px",
                  fontFamily: "monospace",
                  color: "#0f172a"
                }}
              >
                {pinSuccessData.pin}
              </span>

              <div style={{ display: "flex", gap: "8px", justifyContent: "center", flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="secondary-button"
                  style={{
                    fontSize: "0.85rem",
                    padding: "6px 14px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px"
                  }}
                  onClick={() => {
                    navigator.clipboard.writeText(pinSuccessData.pin);
                    setCopiedSuccessPin(true);
                    setTimeout(() => setCopiedSuccessPin(false), 2000);
                  }}
                >
                  {copiedSuccessPin ? "¡Copiado!" : "Copiar PIN"}
                </button>

                <button
                  type="button"
                  className="primary-button"
                  style={{
                    backgroundColor: "#059669",
                    fontSize: "0.85rem",
                    padding: "6px 14px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px"
                  }}
                  onClick={() => {
                    downloadPinCardImage({
                      nombre: pinSuccessData.conductorNombre,
                      pin: pinSuccessData.pin
                    });
                  }}
                  title="Descargar imagen digital con el PIN y nombre del conductor"
                >
                  Guardar Imagen
                </button>
              </div>
            </div>

            <p style={{ fontSize: "0.8rem", color: "#475569", margin: "0 0 20px 0" }}>
              Entrégale este PIN al conductor para que pueda iniciar sesión en el bot de Telegram de la empresa.
            </p>

            <div style={{ display: "flex", justifyContent: "center" }}>
              <button
                type="button"
                className="primary-button"
                style={{ width: "100%", padding: "10px" }}
                onClick={() => setPinSuccessData(null)}
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Confirmación Activar / Desactivar */}
      {toggleActiveConductor && (
        <div className="modal-overlay" onClick={() => updatingId !== toggleActiveConductor.id_conductores && setToggleActiveConductor(null)}>
          <div
            className="modal-card"
            style={{ maxWidth: "440px", width: "100%" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="form-panel-header">
              <div>
                <h2>{toggleActiveConductor.activo ? "¿Desactivar Conductor?" : "¿Reactivar Conductor?"}</h2>
                <p style={{ margin: "4px 0 0 0", color: "#64748b", fontSize: "0.85rem" }}>
                  Conductor: <strong>{toggleActiveConductor.nombre}</strong>
                </p>
              </div>
              <button
                type="button"
                className="close-button"
                disabled={updatingId === toggleActiveConductor.id_conductores}
                onClick={() => setToggleActiveConductor(null)}
              >
                <IconCross size={16} />
              </button>
            </div>

            <div style={{ padding: "16px 0", fontSize: "0.9rem", color: "#334155", lineHeight: "1.5" }}>
              {toggleActiveConductor.activo ? (
                <>
                  <p style={{ margin: "0 0 10px 0" }}>
                    ¿Estás seguro de que deseas <strong>desactivar</strong> a este conductor?
                  </p>
                  <ul style={{ margin: 0, paddingLeft: "20px", color: "#64748b", fontSize: "0.85rem" }}>
                    <li>No podrá iniciar sesión en el bot de Telegram.</li>
                    <li>No podrá iniciar nuevos viajes.</li>
                    <li>Si tiene un viaje actualmente en curso, el sistema rechazará la desactivación.</li>
                  </ul>
                </>
              ) : (
                <>
                  <p style={{ margin: "0 0 10px 0" }}>
                    ¿Estás seguro de que deseas <strong>reactivar</strong> a este conductor?
                  </p>
                  <p style={{ margin: 0, color: "#64748b", fontSize: "0.85rem" }}>
                    El conductor podrá volver a acceder al bot de Telegram y comenzar viajes con normalidad.
                  </p>
                </>
              )}
            </div>

            <div className="form-actions" style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              <button
                type="button"
                className="secondary-button"
                disabled={updatingId === toggleActiveConductor.id_conductores}
                onClick={() => setToggleActiveConductor(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={toggleActiveConductor.activo ? "danger-button" : "primary-button"}
                style={!toggleActiveConductor.activo ? { backgroundColor: "#16a34a" } : {}}
                disabled={updatingId === toggleActiveConductor.id_conductores}
                onClick={confirmToggleActive}
              >
                {updatingId === toggleActiveConductor.id_conductores
                  ? "Procesando..."
                  : toggleActiveConductor.activo
                  ? "Sí, desactivar"
                  : "Sí, reactivar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 4: Confirmación Eliminar */}
      {deleteConfirmConductor && (
        <div className="modal-overlay" onClick={() => updatingId !== deleteConfirmConductor.id_conductores && setDeleteConfirmConductor(null)}>
          <div
            className="modal-card"
            style={{ maxWidth: "440px", width: "100%" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="form-panel-header">
              <div>
                <h2 style={{ color: "#b91c1c" }}>¿Eliminar Conductor?</h2>
                <p style={{ margin: "4px 0 0 0", color: "#64748b", fontSize: "0.85rem" }}>
                  Conductor: <strong>{deleteConfirmConductor.nombre}</strong>
                </p>
              </div>
              <button
                type="button"
                className="close-button"
                disabled={updatingId === deleteConfirmConductor.id_conductores}
                onClick={() => setDeleteConfirmConductor(null)}
              >
                <IconCross size={16} />
              </button>
            </div>

            <div style={{ padding: "16px 0", fontSize: "0.9rem", color: "#334155", lineHeight: "1.5" }}>
              <p style={{ margin: "0 0 10px 0" }}>
                ¿Estás seguro de que deseas eliminar permanentemente a <strong>{deleteConfirmConductor.nombre}</strong>?
              </p>
              <div style={{ padding: "10px", background: "#fef2f2", borderLeft: "4px solid #ef4444", borderRadius: "4px", fontSize: "0.82rem", color: "#991b1b", display: "flex", alignItems: "flex-start", gap: "8px" }}>
                <IconAlerta size={16} style={{ flexShrink: 0, marginTop: "1px" }} />
                <span><strong>Advertencia:</strong> Se desvinculará y eliminará su usuario de Telegram. Sus viajes históricos se conservarán para fines de auditoría.</span>
              </div>
            </div>

            <div className="form-actions" style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              <button
                type="button"
                className="secondary-button"
                disabled={updatingId === deleteConfirmConductor.id_conductores}
                onClick={() => setDeleteConfirmConductor(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="danger-button"
                disabled={updatingId === deleteConfirmConductor.id_conductores}
                onClick={confirmDeleteDriver}
              >
                {updatingId === deleteConfirmConductor.id_conductores ? "Eliminando..." : "Sí, eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default ConductoresPage;

