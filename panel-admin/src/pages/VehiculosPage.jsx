import {
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";

import {
  createAdminVehiculo,
  createAdminVehiculoKilometraje,
  getAdminVehiculoDetalle,
  getAdminVehiculoKilometraje,
  getAdminVehiculoKilometrajeResumen,
  getAdminVehiculos,
  getAdminUsers,
  updateAdminVehiculoMantenimiento,
  updateAdminVehiculo,
  updateAdminVehiculoStatus
} from "../services/api.js";

import {
  IconHistorial,
  IconVerDetalle,
  IconEditar,
  IconMantenimiento,
  IconEliminar,
  IconReactivar,
  IconReloj,
  IconUnidades,
  IconCheck,
  IconViajes,
  IconAlerta,
  IconCross,
  IconCoche,
  IconShield,
  IconUsuarios
} from "../components/Icons.jsx";

const initialForm = {
  marca: "",
  modelo: "",
  numeroEconomico: "",
  placas: "",
  numeroPoliza: "",
  seguroVencimiento: "",
  numeroSerie: "",
  tipoVehiculo: "",
  tipoPropiedad: "EMPRESARIAL",
  color: "",
  tipoPersonalAsignado: "",
  idConductorAsignado: "",
  idSupervisorAsignado: "",
  personalAsignadoNombre: ""
};

function formatVehicleDate(value) {
  if (!value) return "Sin capturar";
  const datePart = String(value).match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (datePart) {
    const [y, m, d] = datePart.split("-").map(Number);
    const dateObj = new Date(y, m - 1, d);
    if (!isNaN(dateObj.getTime())) {
      return dateObj.toLocaleDateString("es-MX");
    }
  }
  const fallbackDate = new Date(value);
  return !isNaN(fallbackDate.getTime()) ? fallbackDate.toLocaleDateString("es-MX") : "Sin capturar";
}

function renderVehicleStatusCircle(vehiculo) {
  if (vehiculo.en_mantenimiento) {
    const dias = vehiculo.dias_en_mantenimiento ?? 0;
    const motivo = vehiculo.motivo_mantenimiento ? `: ${vehiculo.motivo_mantenimiento}` : "";
    const tooltip = `En mantenimiento (${dias} ${dias === 1 ? "día" : "días"})${motivo}`;
    return (
      <div className="status-cell-center">
        <span
          className="status-circle-icon status-circle-por_vencer"
          title={tooltip}
          aria-label={tooltip}
        >
          <IconMantenimiento size={13} />
        </span>
      </div>
    );
  }

  if (!vehiculo.activo) {
    const tooltip = "Inactivo / Fuera de servicio";
    return (
      <div className="status-cell-center">
        <span
          className="status-circle-icon status-circle-vencido"
          title={tooltip}
          aria-label={tooltip}
        >
          <IconCross size={13} strokeWidth={2.8} />
        </span>
      </div>
    );
  }

  if (vehiculo.disponibilidad === "EN_VIAJE") {
    const folio = vehiculo.folio_viaje_en_curso ? ` (Folio: ${vehiculo.folio_viaje_en_curso})` : "";
    const tooltip = `En viaje${folio} - Operando`;
    return (
      <div className="status-cell-center">
        <span
          className="status-circle-icon status-circle-viaje"
          title={tooltip}
          aria-label={tooltip}
        >
          <IconViajes size={13} strokeWidth={2.2} />
        </span>
      </div>
    );
  }

  // DISPONIBLE
  const tooltip = "Disponible - Lista para operar";
  return (
    <div className="status-cell-center">
      <span
        className="status-circle-icon status-circle-vigente"
        title={tooltip}
        aria-label={tooltip}
      >
        <IconCheck size={13} strokeWidth={2.8} />
      </span>
    </div>
  );
}

function VehiculosPage({ user }) {
  const canManageMileage = user?.rol === "ADMINISTRADOR";
  const canEditVehicle = user?.rol === "ADMINISTRADOR";
  const [vehiculos, setVehiculos] = useState([]);
  const [allVehiculos, setAllVehiculos] = useState([]);
  const [onlyEnViaje, setOnlyEnViaje] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("TODOS");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const [maintenanceModalVehicle, setMaintenanceModalVehicle] = useState(null);
  const [maintenanceReason, setMaintenanceReason] = useState("");
  const [maintenanceSaving, setMaintenanceSaving] = useState(false);

  const [loading, setLoading] =
    useState(true);

  const [message, setMessage] =
    useState("");

  const [messageType, setMessageType] =
    useState("success");

  const [showForm, setShowForm] =
    useState(false);

  const [form, setForm] =
    useState(initialForm);

  const [saving, setSaving] =
    useState(false);

  const [editingVehicle, setEditingVehicle] = useState(null);

  const [updatingId, setUpdatingId] =
    useState(null);

  const [mileageVehicle, setMileageVehicle] = useState(null);
  const [mileageHistory, setMileageHistory] = useState([]);
  const [mileageSummary, setMileageSummary] = useState(null);
  const [mileageLoading, setMileageLoading] = useState(false);
  const [mileageSaving, setMileageSaving] = useState(false);
  const [mileageForm, setMileageForm] = useState({ kilometraje: "", observaciones: "" });
  const [detailVehicle, setDetailVehicle] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [deleteConfirmVehicle, setDeleteConfirmVehicle] = useState(null);
  const [repairConfirmVehicle, setRepairConfirmVehicle] = useState(null);

  const [supervisoresOptions, setSupervisoresOptions] = useState([]);

  useEffect(() => {
    async function loadOptions() {
      try {
        const userRes = await getAdminUsers();
        setSupervisoresOptions((userRes.data ?? []).filter((u) => u.activo));
      } catch (err) {
        console.error("Error cargando opciones de supervisores:", err);
      }
    }
    loadOptions();
  }, []);

  const submittingRef =
    useRef(false);

  async function loadVehiculos() {
    setLoading(true);

    try {
      const [responseFiltered, responseAll] = await Promise.all([
        getAdminVehiculos({
          search,
          status
        }),
        getAdminVehiculos({
          status: "TODOS"
        })
      ]);

      setVehiculos(
        responseFiltered.data ?? []
      );
      setAllVehiculos(
        responseAll.data ?? []
      );
      setCurrentPage(1);
    } catch (error) {
      setMessage(error.message);
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeoutId =
      window.setTimeout(() => {
        loadVehiculos();
      }, 300);

    return () => {
      window.clearTimeout(
        timeoutId
      );
    };
  }, [search, status]);

  useEffect(() => {
    if (!showForm) {
      return undefined;
    }

    function handleKeyDown(event) {
      if (
        event.key === "Escape" &&
        !saving
      ) {
        closeForm();
      }
    }

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow =
      "hidden";

    window.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown
      );

      document.body.style.overflow =
        previousOverflow;
    };
  }, [showForm, saving]);

  function handleChange(event) {
    const {
      name,
      value
    } = event.target;

    setForm((current) => ({
      ...current,
      [name]:
        name === "placas"
          ? value.toUpperCase()
          : value
    }));

    setMessage("");
  }

function formatIsoDate(value) {
  if (!value) return "";
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const str = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.slice(0, 10);
  }
  const dateObj = new Date(str);
  if (!isNaN(dateObj.getTime())) {
    const y = dateObj.getUTCFullYear();
    const m = String(dateObj.getUTCMonth() + 1).padStart(2, "0");
    const d = String(dateObj.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return "";
}

  async function openForm(vehiculo = null) {
    let fullVehicle = vehiculo;
    if (vehiculo && vehiculo.id_vehiculos && (!vehiculo.numero_serie || !vehiculo.numero_poliza || !vehiculo.seguro_vencimiento)) {
      try {
        const res = await getAdminVehiculoDetalle(vehiculo.id_vehiculos);
        if (res?.data) {
          fullVehicle = { ...vehiculo, ...res.data };
        }
      } catch (err) {
        console.warn("Aviso al consultar detalle completo de vehículo:", err.message);
      }
    }

    setForm(fullVehicle ? {
      marca: fullVehicle.marca || "",
      modelo: fullVehicle.modelo || "",
      numeroEconomico: fullVehicle.numero_economico || fullVehicle.numeroEconomico || "",
      placas: fullVehicle.placas || "",
      numeroPoliza: fullVehicle.numero_poliza || fullVehicle.numeroPoliza || "",
      seguroVencimiento: formatIsoDate(fullVehicle.seguro_vencimiento || fullVehicle.seguroVencimiento),
      numeroSerie: fullVehicle.numero_serie || fullVehicle.numeroSerie || "",
      tipoVehiculo: fullVehicle.tipo_vehiculo || fullVehicle.tipoVehiculo || "",
      tipoPropiedad: fullVehicle.tipo_propiedad || fullVehicle.tipoPropiedad || "EMPRESARIAL",
      color: fullVehicle.color || "",
      idSupervisorAsignado: fullVehicle.id_supervisor_asignado ? String(fullVehicle.id_supervisor_asignado) : (fullVehicle.idSupervisorAsignado ? String(fullVehicle.idSupervisorAsignado) : ""),
      personalAsignadoNombre: fullVehicle.personal_asignado_nombre || fullVehicle.personal_asignado || ""
    } : initialForm);
    setEditingVehicle(fullVehicle);
    setMessage("");
    setShowForm(true);
  }

  function closeForm() {
    if (saving) {
      return;
    }

    setShowForm(false);
    setForm(initialForm);
    setEditingVehicle(null);
  }

  function handleOverlayMouseDown(
    event
  ) {
    if (
      event.target ===
      event.currentTarget
    ) {
      closeForm();
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (submittingRef.current) {
      return;
    }

    submittingRef.current = true;
    setSaving(true);
    setMessage("");

    try {
      const response = editingVehicle
        ? await updateAdminVehiculo(editingVehicle.id_vehiculos, form)
        : await createAdminVehiculo(form);

      setMessage(
        response.message ||
        "Vehículo creado correctamente."
      );

      setMessageType("success");
      setShowForm(false);
      setForm(initialForm);
      setEditingVehicle(null);

      await loadVehiculos();
    } catch (error) {
      setMessage(error.message);
      setMessageType("error");
    } finally {
      submittingRef.current = false;
      setSaving(false);
    }
  }

  function handleStatusChange(vehiculo) {
    if (vehiculo.activo) {
      setDeleteConfirmVehicle(vehiculo);
    } else {
      handleReactivateVehicle(vehiculo);
    }
  }

  async function handleConfirmDeleteVehicle() {
    if (!deleteConfirmVehicle) return;
    const vehiculo = deleteConfirmVehicle;
    setUpdatingId(vehiculo.id_vehiculos);
    setMessage("");

    try {
      const response = await updateAdminVehiculoStatus(vehiculo.id_vehiculos, false);
      setVehiculos((current) =>
        current.filter((item) => item.id_vehiculos !== vehiculo.id_vehiculos)
      );
      await loadVehiculos();
      setMessage(response.message || "Unidad dada de baja correctamente.");
      setMessageType("success");
      setDeleteConfirmVehicle(null);
    } catch (error) {
      setMessage(error.message);
      setMessageType("error");
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleReactivateVehicle(vehiculo) {
    setUpdatingId(vehiculo.id_vehiculos);
    setMessage("");

    try {
      const response = await updateAdminVehiculoStatus(vehiculo.id_vehiculos, true);
      await loadVehiculos();
      setMessage(response.message || "Unidad reactivada exitosamente.");
      setMessageType("success");
    } catch (error) {
      setMessage(error.message);
      setMessageType("error");
    } finally {
      setUpdatingId(null);
    }
  }

  async function openMileage(vehiculo) {
    setMileageVehicle(vehiculo);
    setMileageHistory([]);
    setMileageSummary(null);
    setMileageForm({ kilometraje: "", observaciones: "" });
    setMileageLoading(true);
    try {
      const [historyResponse, summaryResponse] = await Promise.all([
        getAdminVehiculoKilometraje(vehiculo.id_vehiculos),
        getAdminVehiculoKilometrajeResumen(vehiculo.id_vehiculos)
      ]);
      setMileageHistory(historyResponse.data.historial ?? []);
      setMileageSummary(summaryResponse.data);
    } catch (error) {
      setMessage(error.message);
      setMessageType("error");
    } finally { setMileageLoading(false); }
  }

  async function openDetail(vehiculo) {
    setDetailVehicle(null);
    setDetailLoading(true);
    try {
      const response = await getAdminVehiculoDetalle(vehiculo.id_vehiculos);
      setDetailVehicle(response.data);
    } catch (error) {
      setMessage(error.message);
      setMessageType("error");
    } finally {
      setDetailLoading(false);
    }
  }

  function handleMaintenanceChange(vehiculo) {
    if (vehiculo.en_mantenimiento) {
      setRepairConfirmVehicle(vehiculo);
    } else {
      setMaintenanceModalVehicle(vehiculo);
      setMaintenanceReason("");
    }
  }

  async function handleConfirmRepairVehicle() {
    if (!repairConfirmVehicle) return;
    const vehiculo = repairConfirmVehicle;

    setUpdatingId(vehiculo.id_vehiculos);
    try {
      const response = await updateAdminVehiculoMantenimiento(vehiculo.id_vehiculos, false);
      setMessage(response.message || "Vehículo reparado y reintegrado a unidades disponibles.");
      setMessageType("success");
      setRepairConfirmVehicle(null);
      await loadVehiculos();
      if (detailVehicle?.id_vehiculos === vehiculo.id_vehiculos) {
        await openDetail(vehiculo);
      }
    } catch (error) {
      setMessage(error.message);
      setMessageType("error");
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleSendToMaintenance(e) {
    e?.preventDefault();
    if (!maintenanceModalVehicle) return;
    if (!maintenanceReason.trim()) {
      setMessage("Por favor especifica el motivo del mantenimiento antes de continuar.");
      setMessageType("error");
      return;
    }

    setMaintenanceSaving(true);
    try {
      const response = await updateAdminVehiculoMantenimiento(
        maintenanceModalVehicle.id_vehiculos,
        true,
        maintenanceReason.trim()
      );
      setMessage(response.message || "Vehículo enviado a mantenimiento correctamente.");
      setMessageType("success");
      setMaintenanceModalVehicle(null);
      setMaintenanceReason("");
      await loadVehiculos();
      if (detailVehicle?.id_vehiculos === maintenanceModalVehicle.id_vehiculos) {
        await openDetail(maintenanceModalVehicle);
      }
    } catch (error) {
      setMessage(error.message);
      setMessageType("error");
    } finally {
      setMaintenanceSaving(false);
    }
  }

  async function saveMileage(event) {
    event.preventDefault();
    if (!mileageVehicle || mileageSaving) return;
    setMileageSaving(true);
    try {
      const response = await createAdminVehiculoKilometraje(mileageVehicle.id_vehiculos, {
        kilometraje: Number(mileageForm.kilometraje), observaciones: mileageForm.observaciones
      });
      setMessage(response.message);
      setMessageType("success");
      await openMileage(mileageVehicle);
      await loadVehiculos();
    } catch (error) { setMessage(error.message); setMessageType("error"); }
    finally { setMileageSaving(false); }
  }

  const metrics = useMemo(() => {
    const list = allVehiculos.length > 0 ? allVehiculos : vehiculos;
    const total = list.length;
    const disponibles = list.filter((v) => v.activo && !v.en_mantenimiento && v.disponibilidad !== "EN_VIAJE").length;
    const enMantenimiento = list.filter((v) => v.en_mantenimiento).length;
    const enViaje = list.filter((v) => v.activo && v.disponibilidad === "EN_VIAJE").length;
    const inactivos = list.filter((v) => !v.activo).length;
    const disponiblesPct = total > 0 ? Math.round((disponibles / total) * 100) : 0;
    return {
      total,
      disponibles,
      enMantenimiento,
      enViaje,
      inactivos,
      disponiblesPct
    };
  }, [allVehiculos, vehiculos]);

  const handleKpiClick = (filterType) => {
    setCurrentPage(1);
    if (filterType === "TODOS") {
      setStatus("TODOS");
      setOnlyEnViaje(false);
    } else if (filterType === "DISPONIBLES") {
      if (status === "ACTIVOS" && !onlyEnViaje) {
        setStatus("TODOS");
      } else {
        setStatus("ACTIVOS");
        setOnlyEnViaje(false);
      }
    } else if (filterType === "MANTENIMIENTO") {
      if (status === "MANTENIMIENTO") {
        setStatus("TODOS");
      } else {
        setStatus("MANTENIMIENTO");
        setOnlyEnViaje(false);
      }
    } else if (filterType === "EN_VIAJE") {
      if (onlyEnViaje) {
        setOnlyEnViaje(false);
      } else {
        setStatus("TODOS");
        setOnlyEnViaje(true);
      }
    } else if (filterType === "INACTIVOS") {
      if (status === "INACTIVOS") {
        setStatus("TODOS");
      } else {
        setStatus("INACTIVOS");
        setOnlyEnViaje(false);
      }
    }
  };

  const displayVehiculos = useMemo(() => {
    if (onlyEnViaje) {
      return vehiculos.filter((v) => v.disponibilidad === "EN_VIAJE");
    }
    return vehiculos;
  }, [vehiculos, onlyEnViaje]);

  const totalFiltered = displayVehiculos.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / itemsPerPage));
  const paginatedVehiculos = displayVehiculos.slice(
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

          <h1>Unidades</h1>

          <p>
            Consulta, registra y controla las unidades vehiculares de la flota.
          </p>
        </div>

        <button
          type="button"
          className="primary-button"
          onClick={() => openForm()}
        >
          + Nueva unidad
        </button>
      </header>

      {/* KPI Cards Grid */}
      <section className="unidades-kpis-grid" aria-label="Métricas clave de unidades">
        <div
          className={`unidad-kpi-card kpi-card-clickable ${status === "TODOS" && !onlyEnViaje ? "kpi-card-active" : ""}`}
          onClick={() => handleKpiClick("TODOS")}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleKpiClick("TODOS"); }}
          title="Ver todas las unidades de la flota"
        >
          <div className="kpi-card-header">
            <span className="kpi-card-title">Total Unidades</span>
            <div className="kpi-icon-wrapper kpi-icon-blue">
              <IconUnidades size={20} />
            </div>
          </div>
          <div className="kpi-card-value">{metrics.total}</div>
          <div className="kpi-card-subtext">
            <span className="kpi-sub-pill kpi-pill-blue">Flota total</span> registradas
          </div>
        </div>

        <div
          className={`unidad-kpi-card kpi-card-clickable ${status === "ACTIVOS" && !onlyEnViaje ? "kpi-card-active kpi-active-green" : ""}`}
          onClick={() => handleKpiClick("DISPONIBLES")}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleKpiClick("DISPONIBLES"); }}
          title="Filtrar unidades disponibles y operativas"
        >
          <div className="kpi-card-header">
            <span className="kpi-card-title">Disponibles</span>
            <div className="kpi-icon-wrapper kpi-icon-green">
              <IconCheck size={20} />
            </div>
          </div>
          <div className="kpi-card-value">{metrics.disponibles}</div>
          <div className="kpi-card-subtext">
            <span className="kpi-sub-pill kpi-pill-green">{metrics.disponiblesPct}% de la flota</span> listas para ruta
          </div>
        </div>

        <div
          className={`unidad-kpi-card kpi-card-clickable ${status === "MANTENIMIENTO" ? "kpi-card-active kpi-active-amber" : ""}`}
          onClick={() => handleKpiClick("MANTENIMIENTO")}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleKpiClick("MANTENIMIENTO"); }}
          title="Filtrar unidades actualmente en mantenimiento"
        >
          <div className="kpi-card-header">
            <span className="kpi-card-title">En Mantenimiento</span>
            <div className="kpi-icon-wrapper kpi-icon-amber">
              <IconMantenimiento size={20} />
            </div>
          </div>
          <div className={`kpi-card-value ${metrics.enMantenimiento > 0 ? "kpi-val-amber" : ""}`}>
            {metrics.enMantenimiento}
          </div>
          <div className="kpi-card-subtext">
            <span className={`kpi-sub-pill ${metrics.enMantenimiento > 0 ? "kpi-pill-amber" : "kpi-pill-green"}`}>
              {metrics.enMantenimiento > 0 ? "En taller" : "Sin unidades"}
            </span>{" "}
            {metrics.enMantenimiento > 0 ? "atención requerida" : "al día"}
          </div>
        </div>

        <div
          className={`unidad-kpi-card kpi-card-clickable ${onlyEnViaje ? "kpi-card-active kpi-active-indigo" : ""}`}
          onClick={() => handleKpiClick("EN_VIAJE")}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleKpiClick("EN_VIAJE"); }}
          title="Filtrar unidades con viaje en curso"
        >
          <div className="kpi-card-header">
            <span className="kpi-card-title">En Viaje</span>
            <div className="kpi-icon-wrapper kpi-icon-indigo">
              <IconViajes size={20} />
            </div>
          </div>
          <div className="kpi-card-value">{metrics.enViaje}</div>
          <div className="kpi-card-subtext">
            <span className="kpi-sub-pill kpi-pill-blue">En ruta</span> {onlyEnViaje ? "(Filtro activo)" : "operando"}
          </div>
        </div>

        <div
          className={`unidad-kpi-card kpi-card-clickable ${status === "INACTIVOS" && !onlyEnViaje ? "kpi-card-active kpi-active-gray" : ""}`}
          onClick={() => handleKpiClick("INACTIVOS")}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleKpiClick("INACTIVOS"); }}
          title="Filtrar unidades inactivas o dadas de baja"
        >
          <div className="kpi-card-header">
            <span className="kpi-card-title">Inactivas</span>
            <div className="kpi-icon-wrapper kpi-icon-gray">
              <IconAlerta size={20} />
            </div>
          </div>
          <div className="kpi-card-value">{metrics.inactivos}</div>
          <div className="kpi-card-subtext">
            <span className="kpi-sub-pill kpi-pill-gray">Bajas</span> fuera de servicio
          </div>
        </div>
      </section>

      <section className="module-toolbar">
        <label className="search-field">
          <span>Buscar</span>

          <input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setCurrentPage(1);
            }}
            placeholder="Marca, modelo, número económico o placas"
          />
        </label>

        <label className="status-filter">
          <span>Estado</span>

          <select
            value={onlyEnViaje ? "EN_VIAJE" : status}
            onChange={(event) => {
              const val = event.target.value;
              setCurrentPage(1);
              if (val === "EN_VIAJE") {
                setStatus("TODOS");
                setOnlyEnViaje(true);
              } else {
                setOnlyEnViaje(false);
                setStatus(val);
              }
            }}
          >
            <option value="TODOS">
              Todos
            </option>

            <option value="ACTIVOS">
              Disponibles
            </option>

            <option value="MANTENIMIENTO">
              En Mantenimiento
            </option>

            <option value="EN_VIAJE">
              En Viaje
            </option>

            <option value="INACTIVOS">
              Inactivos
            </option>
          </select>
        </label>
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

      <section className="table-panel">
        {loading ? (
          <p className="table-status">
            Cargando unidades...
          </p>
        ) : displayVehiculos.length === 0 ? (
          <p className="table-status">
            No se encontraron unidades.
          </p>
        ) : (
          <>
            <div className="table-wrapper">
              <table className="admin-table">
                {status === "MANTENIMIENTO" ? (
                  <thead>
                    <tr>
                      <th>Unidad</th>
                      <th>Placas</th>
                      <th>Personal asignado</th>
                      <th>Tiempo en Mantenimiento</th>
                      <th>Motivo del Mantenimiento</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                ) : (
                  <thead>
                    <tr>
                      <th>Unidad</th>
                      <th>Placas</th>
                      <th>Color</th>
                      <th>Personal asignado</th>
                      <th>Kilometraje actual</th>
                      <th style={{ textAlign: "center", width: "90px" }}>Estado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                )}

                <tbody>
                  {paginatedVehiculos.map((vehiculo) => (
                    <tr key={vehiculo.id_vehiculos}>
                      <td className="vehicle-name-cell">
                        <div className="vehicle-title-wrap">
                          <span className="vehicle-title-text">
                            {vehiculo.marca || vehiculo.nombre} {vehiculo.modelo || ""}
                          </span>
                          {vehiculo.numero_economico ? (
                            <span className="vehicle-eco-tag" title={`No. Económico: ${vehiculo.numero_economico}`}>
                              <span className="vehicle-eco-label">ECO</span>
                              <span className="vehicle-eco-val">{vehiculo.numero_economico}</span>
                            </span>
                          ) : (
                            <span className="vehicle-eco-tag vehicle-eco-tag--empty" title="Sin número económico asignado">
                              Sin No. Eco
                            </span>
                          )}
                        </div>
                      </td>

                      <td>{vehiculo.placas}</td>

                      {status === "MANTENIMIENTO" ? (
                        <>
                          <td>{vehiculo.personal_asignado || "—"}</td>
                          <td>
                            <span style={{ padding: "4px 10px", borderRadius: "12px", background: "#fef2f2", color: "#b91c1c", fontWeight: "bold", fontSize: "0.85rem", border: "1px solid #fecaca", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                              <IconReloj size={14} /> {vehiculo.dias_en_mantenimiento ?? 0} {vehiculo.dias_en_mantenimiento === 1 ? "día" : "días"}
                            </span>
                          </td>
                          <td style={{ maxWidth: "250px", wordBreak: "break-word" }}>
                            {vehiculo.motivo_mantenimiento || "Sin especificar"}
                          </td>
                        </>
                      ) : (
                        <>
                          <td>{vehiculo.color || "—"}</td>
                          <td>{vehiculo.personal_asignado || "—"}</td>
                          <td>{vehiculo.kilometraje_actual ?? 0} km</td>
                          <td>
                            {renderVehicleStatusCircle(vehiculo)}
                          </td>
                        </>
                      )}

                      <td>
                        <div className="table-action-icons">
                          <button
                            type="button"
                            className="action-icon-btn action-icon-history"
                            onClick={() => openMileage(vehiculo)}
                            title="Ver historial de kilometraje"
                            aria-label="Ver historial de kilometraje"
                          >
                            <IconHistorial size={16} />
                          </button>
                          <button
                            type="button"
                            className="action-icon-btn action-icon-detail"
                            onClick={() => openDetail(vehiculo)}
                            title="Ver detalle de unidad"
                            aria-label="Ver detalle de unidad"
                          >
                            <IconVerDetalle size={16} />
                          </button>
                          {canEditVehicle && (
                            <button
                              type="button"
                              className="action-icon-btn action-icon-edit"
                              onClick={() => openForm(vehiculo)}
                              title="Editar unidad"
                              aria-label="Editar unidad"
                            >
                              <IconEditar size={16} />
                            </button>
                          )}
                          {canEditVehicle && (
                            <button
                              type="button"
                              className={`action-icon-btn action-icon-maintenance ${vehiculo.en_mantenimiento ? "active-maintenance" : ""}`}
                              disabled={updatingId === vehiculo.id_vehiculos || vehiculo.disponibilidad === "EN_VIAJE"}
                              onClick={() => handleMaintenanceChange(vehiculo)}
                              title={vehiculo.en_mantenimiento ? "Retirar de mantenimiento" : "Poner en mantenimiento"}
                              aria-label={vehiculo.en_mantenimiento ? "Retirar de mantenimiento" : "Poner en mantenimiento"}
                            >
                              <IconMantenimiento size={16} />
                            </button>
                          )}
                          {canEditVehicle && (
                            <button
                              type="button"
                              className={`action-icon-btn ${vehiculo.activo ? "action-icon-delete" : "action-icon-restore"}`}
                              disabled={updatingId === vehiculo.id_vehiculos}
                              onClick={() => handleStatusChange(vehiculo)}
                              title={vehiculo.activo ? "Dar de baja unidad" : "Reactivar unidad"}
                              aria-label={vehiculo.activo ? "Dar de baja unidad" : "Reactivar unidad"}
                            >
                              {vehiculo.activo ? <IconEliminar size={16} /> : <IconReactivar size={16} />}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalFiltered > 0 && (
              <div className="table-pagination">
                <span className="pagination-info">
                  Mostrando {Math.min((currentPage - 1) * itemsPerPage + 1, totalFiltered)} - {Math.min(currentPage * itemsPerPage, totalFiltered)} de {totalFiltered} unidades
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

      {showForm && (
        <div
          className="modal-overlay"
          role="presentation"
          onMouseDown={handleOverlayMouseDown}
        >
          <section
            className="modal-card vehicle-form-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-vehicle-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="vehicle-modal-header">
              <div className="vehicle-modal-header-left">
                <div className="vehicle-modal-icon-box vehicle-icon-box-primary">
                  {editingVehicle ? <IconEditar size={22} /> : <IconCoche size={22} />}
                </div>
                <div className="vehicle-modal-title-group">
                  <h2 id="new-vehicle-title">
                    {editingVehicle ? "Editar Unidad" : "Registrar Nueva Unidad"}
                  </h2>
                  <p>
                    {editingVehicle
                      ? "Actualiza las especificaciones técnicas, póliza y asignación de la unidad."
                      : "Ingresa los datos del vehículo para integrarlo a la flotilla activa."}
                  </p>
                </div>
              </div>

              <div className="vehicle-modal-header-right">
                {editingVehicle?.numero_economico && (
                  <span className="vehicle-eco-tag" title="Número económico">
                    <span className="vehicle-eco-label">ECO</span>
                    <span className="vehicle-eco-val">{editingVehicle.numero_economico}</span>
                  </span>
                )}
                {editingVehicle?.placas && (
                  <span className="vehicle-placa-badge" title="Placas">
                    {editingVehicle.placas}
                  </span>
                )}
                <button
                  type="button"
                  className="close-button"
                  onClick={closeForm}
                  aria-label="Cerrar formulario"
                  disabled={saving}
                >
                  <IconCross size={16} />
                </button>
              </div>
            </div>

            <form className="vehicle-modal-form" onSubmit={handleSubmit}>
              <div className="vehicle-modal-scrollable">
                {/* Sección 1: Datos Técnicos y Estéticos */}
                <div className="vehicle-form-section-card">
                  <div className="vehicle-form-section-header">
                    <div className="vehicle-form-section-icon">
                      <IconCoche size={16} />
                    </div>
                    <span>Especificaciones Principales</span>
                  </div>

                  <div className="vehicle-form-grid-2">
                    <div className="vehicle-form-field">
                      <label htmlFor="vehiculo-marca">
                        Marca <span className="field-required">*</span>
                      </label>
                      <input
                        id="vehiculo-marca"
                        name="marca"
                        value={form.marca}
                        onChange={handleChange}
                        placeholder="Ej. Chevrolet, Toyota, Ford"
                        minLength="2"
                        required
                        disabled={saving}
                      />
                    </div>

                    <div className="vehicle-form-field">
                      <label htmlFor="vehiculo-modelo">
                        Modelo <span className="field-required">*</span>
                      </label>
                      <input
                        id="vehiculo-modelo"
                        name="modelo"
                        value={form.modelo}
                        onChange={handleChange}
                        placeholder="Ej. Trax, Hilux, Versa"
                        required
                        disabled={saving}
                      />
                    </div>

                    <div className="vehicle-form-field">
                      <label htmlFor="vehiculo-tipo">
                        Tipo de Vehículo <span className="field-required">*</span>
                      </label>
                      <input
                        id="vehiculo-tipo"
                        name="tipoVehiculo"
                        value={form.tipoVehiculo}
                        onChange={handleChange}
                        placeholder="Ej. Camioneta SUV, Sedán, Pick-up"
                        required
                        disabled={saving}
                      />
                    </div>

                    <div className="vehicle-form-field">
                      <label htmlFor="vehiculo-color">Color</label>
                      <input
                        id="vehiculo-color"
                        name="color"
                        value={form.color}
                        onChange={handleChange}
                        placeholder="Ej. Blanco / Rojo / Plata"
                        disabled={saving}
                      />
                    </div>
                  </div>
                </div>

                {/* Sección 2: Identificación y Registro Operativo */}
                <div className="vehicle-form-section-card">
                  <div className="vehicle-form-section-header">
                    <div className="vehicle-form-section-icon">
                      <IconUnidades size={16} />
                    </div>
                    <span>Identificación y Registro Operativo</span>
                  </div>

                  <div className="vehicle-form-grid-3">
                    <div className="vehicle-form-field">
                      <label htmlFor="vehiculo-eco">
                        Número Económico <span className="field-required">*</span>
                      </label>
                      <input
                        id="vehiculo-eco"
                        name="numeroEconomico"
                        value={form.numeroEconomico}
                        onChange={handleChange}
                        placeholder="Ej. AUTO-001, AQR-05"
                        required
                        disabled={saving}
                      />
                    </div>

                    <div className="vehicle-form-field">
                      <label htmlFor="vehiculo-placas">
                        Placas <span className="field-required">*</span>
                      </label>
                      <input
                        id="vehiculo-placas"
                        name="placas"
                        value={form.placas}
                        onChange={handleChange}
                        placeholder="Ej. CR-1234-A"
                        style={{ textTransform: "uppercase", letterSpacing: "0.5px" }}
                        required
                        disabled={saving}
                      />
                    </div>

                    <div className="vehicle-form-field">
                      <label htmlFor="vehiculo-propiedad">Propiedad</label>
                      <select
                        id="vehiculo-propiedad"
                        name="tipoPropiedad"
                        value={form.tipoPropiedad}
                        onChange={handleChange}
                        disabled={saving}
                      >
                        <option value="EMPRESARIAL">Empresarial</option>
                        <option value="PATRIMONIAL">Patrimonial</option>
                      </select>
                    </div>

                    <div className="vehicle-form-field" style={{ gridColumn: "1 / -1" }}>
                      <label htmlFor="vehiculo-vin">
                        Número de Serie (VIN) <span className="field-required">*</span>
                      </label>
                      <input
                        id="vehiculo-vin"
                        name="numeroSerie"
                        value={form.numeroSerie}
                        onChange={handleChange}
                        placeholder="Ej. 3GNAXJEV9LS123456"
                        style={{ fontFamily: "monospace", letterSpacing: "1px" }}
                        required
                        disabled={saving}
                      />
                    </div>
                  </div>
                </div>

                {/* Sección 3: Póliza de Seguro y Supervisión */}
                <div className="vehicle-form-section-card">
                  <div className="vehicle-form-section-header">
                    <div className="vehicle-form-section-icon">
                      <IconShield size={16} />
                    </div>
                    <span>Seguro Vehicular y Asignación</span>
                  </div>

                  <div className="vehicle-form-grid-2">
                    <div className="vehicle-form-field">
                      <label htmlFor="vehiculo-poliza">
                        Número de Póliza <span className="field-required">*</span>
                      </label>
                      <input
                        id="vehiculo-poliza"
                        name="numeroPoliza"
                        value={form.numeroPoliza}
                        onChange={handleChange}
                        placeholder="Ej. POL-98765432-MX"
                        required
                        disabled={saving}
                      />
                    </div>

                    <div className="vehicle-form-field">
                      <label htmlFor="vehiculo-vencimiento">
                        Vencimiento del Seguro <span className="field-required">*</span>
                      </label>
                      <input
                        id="vehiculo-vencimiento"
                        type="date"
                        name="seguroVencimiento"
                        value={form.seguroVencimiento}
                        onChange={handleChange}
                        required
                        disabled={saving}
                      />
                    </div>

                    <div className="vehicle-form-field" style={{ gridColumn: "1 / -1" }}>
                      <label htmlFor="vehiculo-supervisor">
                        Personal Asignado (Supervisor a cargo)
                      </label>
                      <select
                        id="vehiculo-supervisor"
                        name="idSupervisorAsignado"
                        value={form.idSupervisorAsignado}
                        onChange={(e) => {
                          const id = e.target.value;
                          const userObj = supervisoresOptions.find(
                            (u) => String(u.id_usuarios_admin) === String(id)
                          );
                          setForm((cur) => ({
                            ...cur,
                            idSupervisorAsignado: id,
                            personalAsignadoNombre: userObj ? userObj.nombre : ""
                          }));
                        }}
                        disabled={saving}
                      >
                        <option value="">-- Sin supervisor asignado --</option>
                        {supervisoresOptions.map((u) => (
                          <option key={u.id_usuarios_admin} value={u.id_usuarios_admin}>
                            {u.nombre} ({u.rol})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Tarjeta de previsualización en vivo */}
                <div className="vehicle-form-preview-card">
                  <div className="vehicle-form-preview-label">
                    <span>Previsualización del Vehículo:</span>
                  </div>
                  <div className="vehicle-form-preview-content">
                    <div className="vehicle-form-preview-name">
                      {`${form.marca} ${form.modelo}`.replace(/\s+/g, " ").trim() || "Marca y Modelo"}
                    </div>
                    <div className="vehicle-form-preview-tags">
                      <span className="vehicle-eco-tag" style={{ fontSize: "0.78rem", padding: "2px 8px" }}>
                        <span className="vehicle-eco-label">ECO</span>
                        <span className="vehicle-eco-val">{form.numeroEconomico || "---"}</span>
                      </span>
                      {form.placas && (
                        <span className="vehicle-placa-badge" style={{ fontSize: "0.78rem", padding: "2px 6px" }}>
                          {form.placas}
                        </span>
                      )}
                      {form.tipoVehiculo && (
                        <span className="vehicle-preview-type-pill">
                          {form.tipoVehiculo}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Botones de acción footer */}
              <div className="vehicle-modal-footer">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={closeForm}
                  disabled={saving}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="primary-button vehicle-submit-btn"
                  disabled={saving}
                >
                  {saving ? (
                    "Guardando..."
                  ) : (
                    <>
                      <IconCheck size={16} />
                      {editingVehicle ? "Guardar Cambios" : "Guardar Unidad"}
                    </>
                  )}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {mileageVehicle && (
        <div
          className="modal-overlay"
          role="presentation"
          onMouseDown={() => !mileageSaving && setMileageVehicle(null)}
        >
          <section
            className="modal-card vehicle-mileage-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mileage-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="vehicle-modal-header">
              <div className="vehicle-modal-header-left">
                <div className="vehicle-modal-icon-box vehicle-icon-box-sky">
                  <IconHistorial size={22} />
                </div>
                <div className="vehicle-modal-title-group">
                  <h2 id="mileage-title">Historial de Kilometraje</h2>
                  <p>
                    {mileageVehicle.marca || mileageVehicle.nombre} {mileageVehicle.modelo || ""}
                  </p>
                </div>
              </div>

              <div className="vehicle-modal-header-right">
                {mileageVehicle.numero_economico && (
                  <span className="vehicle-eco-tag" title="Número económico">
                    <span className="vehicle-eco-label">ECO</span>
                    <span className="vehicle-eco-val">{mileageVehicle.numero_economico}</span>
                  </span>
                )}
                <button
                  type="button"
                  className="close-button"
                  onClick={() => setMileageVehicle(null)}
                  aria-label="Cerrar historial"
                  disabled={mileageSaving}
                >
                  <IconCross size={16} />
                </button>
              </div>
            </div>

            {mileageLoading ? (
              <div style={{ padding: "48px 24px", textAlign: "center" }}>
                <p className="table-status">Cargando historial de kilometraje...</p>
              </div>
            ) : (
              <div className="vehicle-modal-scrollable vehicle-mileage-body">
                {/* 3 KPI Cards ejecutivos */}
                <div className="vehicle-mileage-kpis">
                  <div className="vehicle-mileage-kpi-card">
                    <div className="mileage-kpi-icon-wrap" style={{ background: "#e0f2fe", color: "#0284c7" }}>
                      <IconReloj size={18} />
                    </div>
                    <div className="mileage-kpi-info">
                      <span className="mileage-kpi-label">Odómetro Actual</span>
                      <strong className="mileage-kpi-val" style={{ color: "#0284c7" }}>
                        {Number(mileageSummary?.kilometraje_actual ?? mileageVehicle.kilometraje_actual ?? 0).toLocaleString("es-MX")} km
                      </strong>
                    </div>
                  </div>

                  <div className="vehicle-mileage-kpi-card">
                    <div className="mileage-kpi-icon-wrap" style={{ background: "#f0fdf4", color: "#16a34a" }}>
                      <IconViajes size={18} />
                    </div>
                    <div className="mileage-kpi-info">
                      <span className="mileage-kpi-label">Viajes Registrados</span>
                      <strong className="mileage-kpi-val" style={{ color: "#16a34a" }}>
                        {mileageSummary?.total_viajes ?? 0}
                      </strong>
                    </div>
                  </div>

                  <div className="vehicle-mileage-kpi-card">
                    <div className="mileage-kpi-icon-wrap" style={{ background: "#faf5ff", color: "#9333ea" }}>
                      <IconUnidades size={18} />
                    </div>
                    <div className="mileage-kpi-info">
                      <span className="mileage-kpi-label">Distancia Recorrida</span>
                      <strong className="mileage-kpi-val" style={{ color: "#9333ea" }}>
                        {Number(mileageSummary?.kilometros_recorridos ?? 0).toLocaleString("es-MX")} km
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Gráfica de evolución estilizada si hay datos */}
                {mileageHistory.length > 1 && (
                  <div className="vehicle-mileage-chart-card">
                    <div className="vehicle-mileage-chart-header">
                      <span>Evolución de lecturas recientes</span>
                      <span className="chart-count-badge">Últimos {Math.min(mileageHistory.length, 20)} registros</span>
                    </div>
                    <div className="vehicle-mileage-bars" aria-label="Evolución de kilometraje">
                      {mileageHistory.slice(0, 20).reverse().map((row, idx) => {
                        const maxKm = Math.max(1, Number(mileageSummary?.kilometraje_actual || row.kilometraje));
                        const pct = Math.max(12, Math.min(100, (Number(row.kilometraje) / maxKm) * 100));
                        return (
                          <div key={row.id_historial_kilometraje || idx} className="mileage-bar-col">
                            <div
                              className="mileage-bar-fill"
                              style={{ height: `${pct}%` }}
                              data-tooltip={`${Number(row.kilometraje).toLocaleString("es-MX")} km`}
                            />
                            <span className="mileage-bar-label">
                              {new Date(row.fecha_lectura).toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit" })}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Tabla de bitácora estilizada */}
                <div className="vehicle-mileage-table-card">
                  <div className="vehicle-mileage-table-header">
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <IconHistorial size={16} style={{ color: "#0284c7" }} />
                      <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "#0f172a" }}>Bitácora de Lecturas</span>
                    </div>
                    <span className="table-row-count-badge">{mileageHistory.length} lecturas</span>
                  </div>

                  <div className="vehicle-mileage-table-wrap">
                    <table className="vehicle-mileage-table">
                      <thead>
                        <tr>
                          <th>Fecha y Hora</th>
                          <th>Odómetro</th>
                          <th>Tipo Registro</th>
                          <th>Folio Viaje</th>
                          <th>Observaciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {mileageHistory.length ? (
                          mileageHistory.map((row) => (
                            <tr key={row.id_historial_kilometraje}>
                              <td style={{ whiteSpace: "nowrap", color: "#475569" }}>
                                {new Date(row.fecha_lectura).toLocaleString("es-MX", {
                                  year: "numeric",
                                  month: "short",
                                  day: "2-digit",
                                  hour: "2-digit",
                                  minute: "2-digit"
                                })}
                              </td>
                              <td>
                                <strong style={{ color: "#0284c7", fontFamily: "monospace", fontSize: "0.92rem" }}>
                                  {Number(row.kilometraje).toLocaleString("es-MX")} km
                                </strong>
                              </td>
                              <td>
                                <span className={`mileage-type-pill pill-${(row.tipo_registro || "MANUAL").toLowerCase()}`}>
                                  {row.tipo_registro === "INICIAL_VIAJE"
                                    ? "Inicio de Viaje"
                                    : row.tipo_registro === "FINAL_VIAJE"
                                    ? "Fin de Viaje"
                                    : row.tipo_registro === "MANUAL"
                                    ? "Ajuste Manual"
                                    : row.tipo_registro}
                                </span>
                              </td>
                              <td>
                                {row.folio ? (
                                  <span className="mileage-folio-badge">#{row.folio}</span>
                                ) : (
                                  <span style={{ color: "#94a3b8" }}>—</span>
                                )}
                              </td>
                              <td style={{ color: "#334155", maxWidth: "240px" }} title={row.observaciones || ""}>
                                {row.observaciones || "—"}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="5" style={{ textAlign: "center", padding: "32px 16px", color: "#64748b" }}>
                              Aún no hay registros de kilometraje para esta unidad.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Formulario de ajuste manual */}
                {canManageMileage && (
                  <form className="vehicle-mileage-form-card" onSubmit={saveMileage}>
                    <div className="vehicle-mileage-form-header">
                      <IconReloj size={16} style={{ color: "#0284c7" }} />
                      <span>Registrar Ajuste Manual de Odómetro</span>
                    </div>

                    <div className="vehicle-mileage-form-grid">
                      <div className="vehicle-form-field">
                        <label htmlFor="manual-km">
                          Nuevo Kilometraje <span className="field-required">*</span>
                        </label>
                        <div className="vehicle-km-input-wrap">
                          <input
                            id="manual-km"
                            type="number"
                            min="0"
                            step="1"
                            value={mileageForm.kilometraje}
                            onChange={(event) =>
                              setMileageForm((current) => ({ ...current, kilometraje: event.target.value }))
                            }
                            placeholder="Ej. 25400"
                            required
                            disabled={mileageSaving}
                          />
                          <span className="km-unit-badge">km</span>
                        </div>
                      </div>

                      <div className="vehicle-form-field">
                        <label htmlFor="manual-obs">
                          Motivo u Observaciones <span className="field-required">*</span>
                        </label>
                        <input
                          id="manual-obs"
                          type="text"
                          value={mileageForm.observaciones}
                          onChange={(event) =>
                            setMileageForm((current) => ({ ...current, observaciones: event.target.value }))
                          }
                          placeholder="Ej. Calibración en taller, lectura física tras servicio..."
                          required
                          disabled={mileageSaving}
                        />
                      </div>
                    </div>

                    <div className="vehicle-mileage-form-footer">
                      <button
                        type="submit"
                        className="primary-button"
                        style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                        disabled={mileageSaving || !mileageForm.kilometraje}
                      >
                        <IconCheck size={16} />
                        {mileageSaving ? "Guardando lectura..." : "Registrar Lectura"}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

            <div className="vehicle-modal-footer">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setMileageVehicle(null)}
                disabled={mileageSaving}
              >
                Cerrar
              </button>
            </div>
          </section>
        </div>
      )}

      {(detailLoading || detailVehicle) && (
        <div className="modal-overlay" role="presentation" onMouseDown={() => !detailLoading && setDetailVehicle(null)}>
          <section
            className="modal-card vehicle-detail-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="vehicle-detail-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="vehicle-detail-header">
              <div className="vehicle-detail-header-left">
                <div className="vehicle-detail-icon-box">
                  <IconCoche size={24} />
                </div>
                <div className="vehicle-detail-title-group">
                  <h2 id="vehicle-detail-title">Detalle de Unidad</h2>
                  <p>
                    {detailVehicle
                      ? `${detailVehicle.marca || detailVehicle.nombre} ${detailVehicle.modelo || ""}`.trim()
                      : "Cargando información..."}
                  </p>
                </div>
              </div>

              <div className="vehicle-detail-header-right">
                {detailVehicle?.numero_economico && (
                  <span className="vehicle-eco-tag" style={{ fontSize: "0.82rem", padding: "4px 10px" }} title="Número económico">
                    <span className="vehicle-eco-label">ECO</span>
                    <span className="vehicle-eco-val">{detailVehicle.numero_economico}</span>
                  </span>
                )}
                <button
                  type="button"
                  className="close-button"
                  onClick={() => setDetailVehicle(null)}
                  aria-label="Cerrar detalle"
                  disabled={detailLoading}
                >
                  ×
                </button>
              </div>
            </div>

            {detailLoading ? (
              <div style={{ padding: "40px 20px", textAlign: "center" }}>
                <p className="table-status">Cargando información del vehículo...</p>
              </div>
            ) : detailVehicle && (
              <div className="vehicle-detail-content">
                {/* Banner de Mantenimiento si aplica */}
                {detailVehicle.en_mantenimiento && (
                  <div className="vehicle-maintenance-alert-box">
                    <div className="vehicle-maintenance-alert-header">
                      <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <IconMantenimiento size={16} /> En Mantenimiento ({detailVehicle.dias_en_mantenimiento ?? 0} {detailVehicle.dias_en_mantenimiento === 1 ? "día" : "días"})
                      </span>
                      <span style={{ fontSize: "0.75rem", background: "#fef3c7", padding: "2px 8px", borderRadius: "999px", color: "#b45309", fontWeight: 700 }}>
                        Atención Requerida
                      </span>
                    </div>
                    <div className="vehicle-maintenance-alert-reason">
                      <strong>Motivo:</strong> {detailVehicle.motivo_mantenimiento || "Sin registrar"}
                    </div>
                  </div>
                )}

                {/* Banner de Viaje Activo si aplica */}
                {detailVehicle.folio_viaje_en_curso && (
                  <div className="vehicle-trip-active-box">
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <IconViajes size={18} />
                      <span><strong>Viaje en Curso:</strong> Folio #{detailVehicle.folio_viaje_en_curso}</span>
                    </div>
                    <span>{detailVehicle.conductor_viaje_en_curso || "Conductor asignado"}</span>
                  </div>
                )}

                {/* Tarjeta 1: Operación y Asignación */}
                <div className="vehicle-detail-section-card">
                  <div className="vehicle-detail-section-title">
                    <IconUsuarios size={16} />
                    <span>Operación y Asignación</span>
                  </div>

                  <div className="vehicle-detail-grid-3">
                    <div className="vehicle-field-block">
                      <span className="vehicle-field-label">Estado Operativo</span>
                      <div className="vehicle-field-value" style={{ gap: "8px" }}>
                        {renderVehicleStatusCircle(detailVehicle)}
                        <span style={{ fontSize: "0.88rem", fontWeight: 700 }}>
                          {detailVehicle.en_mantenimiento
                            ? "En Mantenimiento"
                            : !detailVehicle.activo
                            ? "Inactivo"
                            : detailVehicle.disponibilidad === "EN_VIAJE"
                            ? "En Viaje"
                            : "Disponible"}
                        </span>
                      </div>
                    </div>

                    <div className="vehicle-field-block">
                      <span className="vehicle-field-label">Personal Asignado</span>
                      <span className="vehicle-field-value">
                        {detailVehicle.personal_asignado ? (
                          <span>{detailVehicle.personal_asignado}</span>
                        ) : (
                          <span style={{ color: "#94a3b8", fontWeight: 500, fontStyle: "italic" }}>
                            Sin asignar
                          </span>
                        )}
                      </span>
                    </div>

                    <div className="vehicle-field-block">
                      <span className="vehicle-field-label">Kilometraje Actual</span>
                      <span className="vehicle-field-value vehicle-km-highlight">
                        <IconReloj size={15} style={{ color: "#0284c7" }} />
                        {Number(detailVehicle.kilometraje_actual ?? 0).toLocaleString("es-MX")} km
                      </span>
                    </div>
                  </div>
                </div>

                {/* Tarjeta 2: Identificación y Especificaciones */}
                <div className="vehicle-detail-section-card">
                  <div className="vehicle-detail-section-title">
                    <IconCoche size={16} />
                    <span>Identificación del Vehículo</span>
                  </div>

                  <div className="vehicle-detail-grid-3">
                    <div className="vehicle-field-block">
                      <span className="vehicle-field-label">Placas</span>
                      <div className="vehicle-field-value">
                        <span className="vehicle-placa-badge">{detailVehicle.placas || "—"}</span>
                      </div>
                    </div>

                    <div className="vehicle-field-block">
                      <span className="vehicle-field-label">Tipo de Vehículo</span>
                      <span className="vehicle-field-value" style={{ textTransform: "capitalize" }}>
                        {detailVehicle.tipo_vehiculo || "Sin capturar"}
                      </span>
                    </div>

                    <div className="vehicle-field-block">
                      <span className="vehicle-field-label">Color</span>
                      <span className="vehicle-field-value" style={{ textTransform: "capitalize" }}>
                        {detailVehicle.color || "Sin capturar"}
                      </span>
                    </div>

                    <div className="vehicle-field-block">
                      <span className="vehicle-field-label">Tipo de Propiedad</span>
                      <span className="vehicle-field-value">
                        <span style={{ padding: "2px 8px", borderRadius: "6px", background: "#f1f5f9", fontSize: "0.78rem", fontWeight: 700, color: "#334155" }}>
                          {detailVehicle.tipo_propiedad || "EMPRESARIAL"}
                        </span>
                      </span>
                    </div>

                    <div className="vehicle-field-block" style={{ gridColumn: "span 2" }}>
                      <span className="vehicle-field-label">Número de Serie (VIN)</span>
                      <div className="vehicle-field-value">
                        <span className="vehicle-vin-code">{detailVehicle.numero_serie || "Sin capturar"}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tarjeta 3: Póliza de Seguro */}
                <div className="vehicle-detail-section-card">
                  <div className="vehicle-detail-section-title">
                    <IconShield size={16} />
                    <span>Póliza y Seguro Vehicular</span>
                  </div>

                  <div className="vehicle-detail-grid-2">
                    <div className="vehicle-field-block">
                      <span className="vehicle-field-label">Número de Póliza</span>
                      <span className="vehicle-field-value" style={{ fontFamily: "monospace", letterSpacing: "0.5px" }}>
                        {detailVehicle.numero_poliza || "Sin capturar"}
                      </span>
                    </div>

                    <div className="vehicle-field-block">
                      <span className="vehicle-field-label">Vencimiento del Seguro</span>
                      <span className="vehicle-field-value">
                        <IconShield size={15} style={{ color: "#16a34a" }} />
                        {formatVehicleDate(detailVehicle.seguro_vencimiento)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {detailVehicle && !detailLoading && (
              <div className="vehicle-detail-footer">
                <button
                  type="button"
                  className="secondary-button"
                  style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 14px", fontSize: "0.85rem" }}
                  onClick={() => {
                    const v = detailVehicle;
                    setDetailVehicle(null);
                    openMileage(v);
                  }}
                  title="Consultar historial de lecturas de kilometraje"
                >
                  <IconHistorial size={16} /> Historial KM
                </button>

                <div className="vehicle-detail-footer-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    style={{ padding: "8px 16px", fontSize: "0.85rem" }}
                    onClick={() => setDetailVehicle(null)}
                  >
                    Cerrar
                  </button>
                  {canEditVehicle && (
                    <button
                      type="button"
                      className="primary-button"
                      style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 16px", fontSize: "0.85rem" }}
                      onClick={() => {
                        const vehicle = detailVehicle;
                        setDetailVehicle(null);
                        openForm(vehicle);
                      }}
                    >
                      <IconEditar size={16} /> Editar datos
                    </button>
                  )}
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      {/* Modal para ingresar motivo de mantenimiento */}
      {maintenanceModalVehicle && (
        <div
          className="modal-overlay"
          role="presentation"
          onMouseDown={() => !maintenanceSaving && setMaintenanceModalVehicle(null)}
        >
          <section
            className="modal-card vehicle-maintenance-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="maintenance-modal-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="vehicle-modal-header">
              <div className="vehicle-modal-header-left">
                <div className="vehicle-modal-icon-box vehicle-icon-box-amber">
                  <IconMantenimiento size={22} />
                </div>
                <div className="vehicle-modal-title-group">
                  <h2 id="maintenance-modal-title">Enviar a Mantenimiento</h2>
                  <p>
                    {maintenanceModalVehicle.marca || maintenanceModalVehicle.nombre} {maintenanceModalVehicle.modelo || ""}
                  </p>
                </div>
              </div>

              <div className="vehicle-modal-header-right">
                {maintenanceModalVehicle.numero_economico && (
                  <span className="vehicle-eco-tag" title="Número económico">
                    <span className="vehicle-eco-label">ECO</span>
                    <span className="vehicle-eco-val">{maintenanceModalVehicle.numero_economico}</span>
                  </span>
                )}
                <button
                  type="button"
                  className="close-button"
                  onClick={() => setMaintenanceModalVehicle(null)}
                  disabled={maintenanceSaving}
                  aria-label="Cerrar modal"
                >
                  <IconCross size={16} />
                </button>
              </div>
            </div>

            <form onSubmit={handleSendToMaintenance}>
              <div className="vehicle-modal-scrollable" style={{ padding: "16px 20px" }}>
                {/* Banner de advertencia */}
                <div className="vehicle-maintenance-alert-banner">
                  <IconAlerta size={20} style={{ flexShrink: 0, marginTop: "2px", color: "#d97706" }} />
                  <div>
                    <strong>Atención operativa:</strong>
                    <p style={{ margin: "2px 0 0 0", fontSize: "0.84rem", color: "#92400e", lineHeight: "1.4" }}>
                      Al enviar esta unidad a mantenimiento, su estado cambiará a <strong>NO DISPONIBLE: MANTENIMIENTO</strong>, se bloqueará para nuevos viajes y comenzará a registrarse el tiempo en taller.
                    </p>
                  </div>
                </div>

                {/* Resumen rápido de la unidad */}
                <div className="vehicle-confirm-unit-strip">
                  <div>
                    <span className="strip-label">Unidad</span>
                    <span className="strip-value">{maintenanceModalVehicle.marca || maintenanceModalVehicle.nombre} {maintenanceModalVehicle.modelo || ""}</span>
                  </div>
                  <div>
                    <span className="strip-label">Placas</span>
                    <span className="strip-value">{maintenanceModalVehicle.placas || "—"}</span>
                  </div>
                  <div>
                    <span className="strip-label">Odómetro</span>
                    <span className="strip-value">{Number(maintenanceModalVehicle.kilometraje_actual ?? 0).toLocaleString("es-MX")} km</span>
                  </div>
                </div>

                <div className="vehicle-form-field" style={{ marginTop: "16px" }}>
                  <label htmlFor="maint-reason" style={{ fontWeight: 600, color: "#1e293b", display: "block", marginBottom: "6px" }}>
                    Motivo del mantenimiento / Falla reportada <span className="field-required">*</span>
                  </label>
                  <textarea
                    id="maint-reason"
                    required
                    rows="4"
                    value={maintenanceReason}
                    onChange={(e) => setMaintenanceReason(e.target.value)}
                    placeholder="Describe detalladamente el motivo del ingreso a taller, fallas mecánicas detectadas o servicio preventivo requerido..."
                    className="vehicle-maintenance-textarea"
                    disabled={maintenanceSaving}
                  />
                  <span style={{ fontSize: "0.76rem", color: "#64748b", marginTop: "4px", display: "block" }}>
                    Este motivo quedará visible en la bitácora y en la ficha técnica de la unidad.
                  </span>
                </div>
              </div>

              <div className="vehicle-modal-footer">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setMaintenanceModalVehicle(null)}
                  disabled={maintenanceSaving}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="primary-button"
                  style={{ background: "#d97706", display: "inline-flex", alignItems: "center", gap: "6px" }}
                  disabled={maintenanceSaving || !maintenanceReason.trim()}
                >
                  <IconMantenimiento size={16} />
                  {maintenanceSaving ? "Enviando a taller..." : "Confirmar Envío a Taller"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* Modal Confirmación de Eliminación / Baja de Unidad */}
      {deleteConfirmVehicle && (
        <div
          className="modal-overlay"
          role="presentation"
          onMouseDown={() => updatingId !== deleteConfirmVehicle.id_vehiculos && setDeleteConfirmVehicle(null)}
        >
          <section
            className="modal-card vehicle-confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-confirm-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="vehicle-modal-header">
              <div className="vehicle-modal-header-left">
                <div className="vehicle-modal-icon-box vehicle-icon-box-danger">
                  <IconEliminar size={22} />
                </div>
                <div className="vehicle-modal-title-group">
                  <h2 id="delete-confirm-title" style={{ color: "#b91c1c" }}>
                    ¿Dar de Baja la Unidad?
                  </h2>
                  <p>Esta acción modificará el estado operativo de la unidad.</p>
                </div>
              </div>

              <button
                type="button"
                className="close-button"
                disabled={updatingId === deleteConfirmVehicle.id_vehiculos}
                onClick={() => setDeleteConfirmVehicle(null)}
                aria-label="Cerrar diálogo"
              >
                <IconCross size={16} />
              </button>
            </div>

            <div style={{ padding: "16px 20px" }}>
              <div className="vehicle-confirm-unit-card">
                <div className="vehicle-confirm-unit-main">
                  <strong style={{ fontSize: "0.95rem", color: "#0f172a" }}>
                    {deleteConfirmVehicle.marca || deleteConfirmVehicle.nombre} {deleteConfirmVehicle.modelo || ""}
                  </strong>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "6px" }}>
                    {deleteConfirmVehicle.numero_economico && (
                      <span className="vehicle-eco-tag" style={{ fontSize: "0.78rem", padding: "2px 8px" }}>
                        <span className="vehicle-eco-label">ECO</span>
                        <span className="vehicle-eco-val">{deleteConfirmVehicle.numero_economico}</span>
                      </span>
                    )}
                    {deleteConfirmVehicle.placas && (
                      <span className="vehicle-placa-badge" style={{ fontSize: "0.78rem", padding: "2px 6px" }}>
                        {deleteConfirmVehicle.placas}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="vehicle-confirm-warning-box">
                <IconAlerta size={18} style={{ flexShrink: 0, marginTop: "2px", color: "#dc2626" }} />
                <span>
                  <strong>Advertencia:</strong> La unidad se marcará como <strong>INACTIVA</strong> y no estará disponible para nuevos viajes. Sus viajes históricos, lecturas de odómetro y registros contables se conservarán íntegros para auditoría.
                </span>
              </div>
            </div>

            <div className="vehicle-modal-footer">
              <button
                type="button"
                className="secondary-button"
                disabled={updatingId === deleteConfirmVehicle.id_vehiculos}
                onClick={() => setDeleteConfirmVehicle(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="danger-button"
                disabled={updatingId === deleteConfirmVehicle.id_vehiculos}
                onClick={handleConfirmDeleteVehicle}
                style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
              >
                <IconEliminar size={16} />
                {updatingId === deleteConfirmVehicle.id_vehiculos ? "Dando de baja..." : "Sí, dar de baja"}
              </button>
            </div>
          </section>
        </div>
      )}

      {/* Modal Confirmación de Reparación / Reintegro a Servicio */}
      {repairConfirmVehicle && (
        <div
          className="modal-overlay"
          role="presentation"
          onMouseDown={() => updatingId !== repairConfirmVehicle.id_vehiculos && setRepairConfirmVehicle(null)}
        >
          <section
            className="modal-card vehicle-confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="repair-confirm-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="vehicle-modal-header">
              <div className="vehicle-modal-header-left">
                <div className="vehicle-modal-icon-box vehicle-icon-box-emerald">
                  <IconCheck size={22} />
                </div>
                <div className="vehicle-modal-title-group">
                  <h2 id="repair-confirm-title" style={{ color: "#047857" }}>
                    ¿Reintegrar Unidad a Servicio?
                  </h2>
                  <p>Finalizar periodo de mantenimiento preventivo o correctivo.</p>
                </div>
              </div>

              <button
                type="button"
                className="close-button"
                disabled={updatingId === repairConfirmVehicle.id_vehiculos}
                onClick={() => setRepairConfirmVehicle(null)}
                aria-label="Cerrar diálogo"
              >
                <IconCross size={16} />
              </button>
            </div>

            <div style={{ padding: "16px 20px" }}>
              <div className="vehicle-confirm-unit-card">
                <div className="vehicle-confirm-unit-main">
                  <strong style={{ fontSize: "0.95rem", color: "#0f172a" }}>
                    {repairConfirmVehicle.marca || repairConfirmVehicle.nombre} {repairConfirmVehicle.modelo || ""}
                  </strong>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "6px" }}>
                    {repairConfirmVehicle.numero_economico && (
                      <span className="vehicle-eco-tag" style={{ fontSize: "0.78rem", padding: "2px 8px" }}>
                        <span className="vehicle-eco-label">ECO</span>
                        <span className="vehicle-eco-val">{repairConfirmVehicle.numero_economico}</span>
                      </span>
                    )}
                    {repairConfirmVehicle.placas && (
                      <span className="vehicle-placa-badge" style={{ fontSize: "0.78rem", padding: "2px 6px" }}>
                        {repairConfirmVehicle.placas}
                      </span>
                    )}
                  </div>
                </div>
                {repairConfirmVehicle.dias_en_mantenimiento !== undefined && (
                  <div style={{ textAlign: "right" }}>
                    <span style={{ fontSize: "0.75rem", color: "#64748b", display: "block" }}>Tiempo en taller</span>
                    <span style={{ fontSize: "0.9rem", fontWeight: 700, color: "#b45309" }}>
                      {repairConfirmVehicle.dias_en_mantenimiento} {repairConfirmVehicle.dias_en_mantenimiento === 1 ? "día" : "días"}
                    </span>
                  </div>
                )}
              </div>

              <div className="vehicle-confirm-success-box">
                <IconCheck size={18} style={{ flexShrink: 0, marginTop: "2px", color: "#059669" }} />
                <span>
                  La unidad se marcará como <strong>reparada</strong> y su estado regresará inmediatamente a <strong>DISPONIBLE</strong>, quedando habilitada para nuevos viajes y conductores.
                </span>
              </div>
            </div>

            <div className="vehicle-modal-footer">
              <button
                type="button"
                className="secondary-button"
                disabled={updatingId === repairConfirmVehicle.id_vehiculos}
                onClick={() => setRepairConfirmVehicle(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="primary-button"
                style={{ background: "#059669", display: "inline-flex", alignItems: "center", gap: "6px" }}
                disabled={updatingId === repairConfirmVehicle.id_vehiculos}
                onClick={handleConfirmRepairVehicle}
              >
                <IconCheck size={16} />
                {updatingId === repairConfirmVehicle.id_vehiculos ? "Reintegrando..." : "Confirmar Reintegro"}
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

export default VehiculosPage;
