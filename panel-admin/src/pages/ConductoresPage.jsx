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
  toggleAdminConductorActive,
  getAdminConductorRole,
  assignAdminConductorRole
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
  IconFileText,
  IconManejoComentado
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

  const rawStr = String(conductor.licencia_vencimiento).trim();
  const dateMatch = rawStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  let expirationDate;
  if (dateMatch) {
    const [, y, m, d] = dateMatch.map(Number);
    expirationDate = new Date(y, m - 1, d);
  } else if (conductor.licencia_vencimiento instanceof Date) {
    const d = conductor.licencia_vencimiento;
    expirationDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  } else {
    const d = new Date(rawStr);
    expirationDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  if (Number.isNaN(expirationDate.getTime())) {
    return {
      status: "invalida",
      label: "Fecha inválida",
      color: "#64748b"
    };
  }

  const today = new Date();
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const diffTime = expirationDate.getTime() - todayMidnight.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  const formattedExp = formatDate(conductor.licencia_vencimiento);

  if (diffDays < 0) {
    const diasPasados = Math.abs(diffDays);
    return {
      status: "vencida",
      label: `Licencia vencida el ${formattedExp} (${diasPasados} ${diasPasados === 1 ? "día atrás" : "días atrás"})`,
      days: diffDays,
      color: "#dc2626"
    };
  }

  if (diffDays <= 30) {
    return {
      status: "por_vencer",
      label:
        diffDays === 0
          ? `Licencia por vencer el ${formattedExp} (vence hoy)`
          : `Licencia por vencer el ${formattedExp} (${diffDays} ${diffDays === 1 ? "día restante" : "días restantes"})`,
      days: diffDays,
      color: "#d97706"
    };
  }

  return {
    status: "vigente",
    label: `Licencia vigente (Vence: ${formattedExp} - quedan ${diffDays} días)`,
    days: diffDays,
    color: "#16a34a"
  };
}

function getManejoComentadoStatus(conductor) {
  const fecha = conductor?.fecha_vencimiento_manejo_comentado || conductor?.fecha_manejo_comentado;

  if (conductor?.estado_manejo_comentado === "PENDIENTE") {
    return {
      status: "pendiente",
      label: "Manejo comentado: Cálculo pendiente",
      color: "#d97706"
    };
  }

  if (conductor?.estado_manejo_comentado === "REPROBADO") {
    return {
      status: "reprobado",
      label: "Manejo comentado reprobado",
      color: "#dc2626"
    };
  }

  if (!fecha || conductor?.estado_manejo_comentado === "SIN_REGISTRO") {
    return {
      status: "no_registrado",
      label: "Manejo comentado no registrado",
      color: "#dc2626"
    };
  }

  const rawStr = String(fecha).trim();
  const dateMatch = rawStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  let expDate;
  if (dateMatch) {
    const [, y, m, d] = dateMatch.map(Number);
    expDate = new Date(y, m - 1, d);
  } else if (fecha instanceof Date) {
    const d = fecha;
    expDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  } else {
    const d = new Date(rawStr);
    expDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  if (Number.isNaN(expDate.getTime())) {
    return {
      status: "no_registrado",
      label: "Fecha de manejo comentado no válida",
      color: "#dc2626"
    };
  }

  const today = new Date();
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const diffTime = expDate.getTime() - todayMidnight.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  const formattedExp = formatDate(fecha);

  if (diffDays < 0) {
    const diasPasados = Math.abs(diffDays);
    return {
      status: "vencido",
      label: `Manejo comentado vencido (${formattedExp} - hace ${diasPasados} ${diasPasados === 1 ? "día" : "días"})`,
      days: diffDays,
      color: "#dc2626"
    };
  }

  if (diffDays <= 30) {
    return {
      status: "por_vencer",
      label:
        diffDays === 0
          ? `Manejo comentado por vencer (${formattedExp} - vence hoy)`
          : `Manejo comentado por vencer (${formattedExp} - ${diffDays === 1 ? "queda 1 día" : `quedan ${diffDays} días`})`,
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

function getRoleBadge(rol, idConductor) {
  const normalized = String(rol || "").toUpperCase();
  const idTooltip = idConductor ? `ID: CON-${String(idConductor).padStart(4, "0")}` : "";

  if (!normalized || normalized === "CONDUCTOR") {
    return (
      <span
        className="conductor-role-badge badge-conductor"
        title={idTooltip}
        data-tooltip={idTooltip}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "4px",
          padding: "2px 8px",
          borderRadius: "6px",
          fontSize: "0.72rem",
          fontWeight: 700,
          letterSpacing: "0.03em",
          background: "#eef2ff",
          color: "#4338ca",
          border: "1px solid #c7d2fe",
          width: "fit-content"
        }}
      >
        CONDUCTOR
      </span>
    );
  }

  let style = {
    background: "#f1f5f9",
    color: "#334155",
    border: "1px solid #cbd5e1"
  };

  if (normalized === "ADMINISTRADOR") {
    style = { background: "#fee2e2", color: "#991b1b", border: "1px solid #fecaca" };
  } else if (["GERENTE", "GERENTE_GENERAL"].includes(normalized)) {
    style = { background: "#fce7f3", color: "#9d174d", border: "1px solid #fbcfe8" };
  } else if (["COORDINADOR", "COORDINADOR_AREA", "COORDINADOR_QHSE"].includes(normalized)) {
    style = { background: "#fef9c3", color: "#854d0e", border: "1px solid #fef08a" };
  } else if (normalized === "SUPERVISOR") {
    style = { background: "#dcfce7", color: "#166534", border: "1px solid #bbf7d0" };
  } else if (normalized === "QHSE") {
    style = { background: "#ecfdf5", color: "#065f46", border: "1px solid #a7f3d0" };
  } else if (normalized === "INSTRUCTOR") {
    style = { background: "#e0f2fe", color: "#0369a1", border: "1px solid #bae6fd" };
  } else if (normalized === "OPERADOR") {
    style = { background: "#f1f5f9", color: "#334155", border: "1px solid #cbd5e1" };
  }

  return (
    <span
      className={`conductor-role-badge badge-${normalized.toLowerCase()}`}
      title={idTooltip ? `${normalized} (${idTooltip})` : normalized}
      data-tooltip={idTooltip ? `${normalized} (${idTooltip})` : normalized}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        padding: "2px 8px",
        borderRadius: "6px",
        fontSize: "0.72rem",
        fontWeight: 700,
        letterSpacing: "0.03em",
        width: "fit-content",
        ...style
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "currentColor" }} />
      {normalized}
    </span>
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
  const [selectedRoleFilter, setSelectedRoleFilter] = useState("TODOS");
  const [selectedUnidadFilter, setSelectedUnidadFilter] = useState("TODAS");
  const [onlyExpiringLicenses, setOnlyExpiringLicenses] = useState(false);
  const [onlyExpiringManejoComentado, setOnlyExpiringManejoComentado] = useState(false);
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

  // Estados para Modal de Asignación y Gestión de Roles
  const [roleModalConductor, setRoleModalConductor] = useState(null);
  const [roleModalData, setRoleModalData] = useState(null);
  const [roleModalLoading, setRoleModalLoading] = useState(false);
  const [roleModalSaving, setRoleModalSaving] = useState(false);
  const [roleModalError, setRoleModalError] = useState("");
  const [roleForm, setRoleForm] = useState({
    rol: "OPERADOR",
    username: "",
    correo: "",
    activo: true
  });

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

      const generatedPin = res.data?.pinGenerado || res.data?.pin || (pinMode === "manual" ? manualPin.trim() : null);
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
    downloadPinCardImage({
      nombre: pinSuccessData.conductorNombre,
      pin: pinSuccessData.pin
    });
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

  const canAssignRole =
    !user ||
    ["ADMINISTRADOR", "GERENTE", "GERENTE_GENERAL", "COORDINADOR", "COORDINADOR_AREA", "COORDINADOR_QHSE"].includes(user.rol);

  const canDeleteConductor = (conductor) => {
    if (!conductor) return false;
    if (!user) return true;
    const callerRol = user.rol || "";

    // No permitir auto-eliminación
    if (user.id_conductores && conductor.id_conductores && Number(user.id_conductores) === Number(conductor.id_conductores)) {
      return false;
    }
    if (user.id_usuarios_admin && conductor.id_usuarios_admin && Number(user.id_usuarios_admin) === Number(conductor.id_usuarios_admin)) {
      return false;
    }

    if (["ADMINISTRADOR", "GERENTE_GENERAL"].includes(callerRol)) {
      return true;
    }

    const targetRol = conductor.rol_administrativo || null;
    if (!targetRol) {
      // Conductor regular sin rol administrativo:
      // Gerente, Coordinador y Supervisor pueden eliminarlo
      return [
        "GERENTE",
        "COORDINADOR",
        "COORDINADOR_AREA",
        "COORDINADOR_QHSE",
        "SUPERVISOR",
        "QHSE",
        "INSTRUCTOR"
      ].includes(callerRol);
    }

    // Conductor con rol administrativo asignado:
    // Solo un Gerente puede eliminar a un Coordinador, Supervisor y roles operativos
    if (["GERENTE"].includes(callerRol)) {
      return [
        "COORDINADOR",
        "COORDINADOR_AREA",
        "COORDINADOR_QHSE",
        "SUPERVISOR",
        "QHSE",
        "INSTRUCTOR",
        "OPERADOR",
        "CONSULTA"
      ].includes(targetRol);
    }

    // Un Coordinador puede eliminar a un Supervisor y roles operativos
    if (["COORDINADOR", "COORDINADOR_AREA", "COORDINADOR_QHSE"].includes(callerRol)) {
      return [
        "SUPERVISOR",
        "QHSE",
        "INSTRUCTOR",
        "OPERADOR",
        "CONSULTA"
      ].includes(targetRol);
    }

    // Un Supervisor solo puede eliminar a cualquier conductor regular (sin rol)
    return false;
  };

  const getAllowedRoleOptions = () => {
    const callerRol = user?.rol || "ADMINISTRADOR";
    if (["ADMINISTRADOR", "GERENTE_GENERAL"].includes(callerRol)) {
      return [
        { value: "ADMINISTRADOR", label: "👑 ADMINISTRADOR — Control y Acceso Total al Sistema" },
        { value: "GERENTE", label: "GERENTE — Aprueba Viajes de Riesgo ALTO (> 23 pts)" },
        { value: "COORDINADOR", label: "COORDINADOR DE ÁREA — Aprueba Viajes de Riesgo MEDIO (16-22 pts)" },
        { value: "SUPERVISOR", label: "SUPERVISOR — Aprueba Viajes de Riesgo BAJO e Inspecciones" },
        { value: "QHSE", label: "QHSE — Auditoría y Control de Riesgos" },
        { value: "INSTRUCTOR", label: "INSTRUCTOR — Manejo Comentado y Capacitación" },
        { value: "OPERADOR", label: "OPERADOR — Módulo de Operaciones Diarias" },
        { value: "CONSULTA", label: "CONSULTA — Solo Lectura" }
      ];
    }
    if (["GERENTE"].includes(callerRol)) {
      return [
        { value: "COORDINADOR", label: "COORDINADOR DE ÁREA — Aprueba Viajes de Riesgo MEDIO" },
        { value: "SUPERVISOR", label: "SUPERVISOR — Aprueba Viajes de Riesgo BAJO e Inspecciones" },
        { value: "QHSE", label: "QHSE — Auditoría y Control de Riesgos" },
        { value: "INSTRUCTOR", label: "INSTRUCTOR — Manejo Comentado y Capacitación" },
        { value: "OPERADOR", label: "OPERADOR — Módulo de Operaciones Diarias" },
        { value: "CONSULTA", label: "CONSULTA — Solo Lectura" }
      ];
    }
    if (["COORDINADOR", "COORDINADOR_AREA", "COORDINADOR_QHSE"].includes(callerRol)) {
      return [
        { value: "SUPERVISOR", label: "SUPERVISOR — Aprueba Viajes de Riesgo BAJO e Inspecciones" },
        { value: "QHSE", label: "QHSE — Auditoría y Control de Riesgos" },
        { value: "INSTRUCTOR", label: "INSTRUCTOR — Manejo Comentado y Capacitación" },
        { value: "OPERADOR", label: "OPERADOR — Módulo de Operaciones Diarias" },
        { value: "CONSULTA", label: "CONSULTA — Solo Lectura" }
      ];
    }
    return [];
  };

  async function handleOpenRoleModal(conductor) {
    setRoleModalConductor(conductor);
    setRoleModalData(null);
    setRoleModalLoading(true);
    setRoleModalError("");

    // Generar sugerencia limpia de username a partir del nombre
    const cleanUsername = (conductor.nombre || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, ".")
      .replace(/\.+/g, ".")
      .replace(/^\.|\.$/g, "")
      .slice(0, 25);

    let defaultRole = "OPERADOR";
    if (user?.rol === "ADMINISTRADOR") defaultRole = "SUPERVISOR";
    else if (["GERENTE", "GERENTE_GENERAL"].includes(user?.rol)) defaultRole = "COORDINADOR";
    else if (["COORDINADOR", "COORDINADOR_AREA", "COORDINADOR_QHSE"].includes(user?.rol)) defaultRole = "SUPERVISOR";

    setRoleForm({
      rol: conductor.rol_administrativo || defaultRole,
      username: conductor.admin_username || cleanUsername,
      correo: conductor.admin_correo || conductor.correo || "",
      activo: conductor.admin_activo !== false
    });

    try {
      const res = await getAdminConductorRole(conductor.id_conductores);
      if (res?.data) {
        setRoleModalData(res.data);
        if (res.data.usuarioAdmin) {
          setRoleForm({
            rol: res.data.usuarioAdmin.rol || defaultRole,
            username: res.data.usuarioAdmin.username || cleanUsername,
            correo: res.data.usuarioAdmin.correo || conductor.admin_correo || conductor.correo || "",
            activo: res.data.usuarioAdmin.activo !== false
          });
        }
      }
    } catch (err) {
      console.error("Error al cargar datos de rol:", err);
      setRoleModalError(err.message || "No fue posible consultar el rol del conductor.");
    } finally {
      setRoleModalLoading(false);
    }
  }

  async function handleSubmitRole(e, overrideModo = null) {
    if (e && e.preventDefault) e.preventDefault();
    if (!roleModalConductor) return;

    const hasLinkedUser = Boolean(roleModalConductor.id_usuarios_admin || roleModalData?.usuarioAdmin);
    const modo = overrideModo || (hasLinkedUser ? "ACTUALIZAR" : "NUEVO");

    if (overrideModo === "REVOCAR") {
      if (!window.confirm(`¿Estás seguro de revocar el rol administrativo de ${roleModalConductor.nombre}? El perfil volverá a ser exclusivamente conductor.`)) {
        return;
      }
    }

    setRoleModalSaving(true);
    setRoleModalError("");

    try {
      const res = await assignAdminConductorRole(roleModalConductor.id_conductores, {
        modo,
        data: roleForm
      });

      setMessage(res.message || "Rol actualizado correctamente.");
      setMessageType("success");
      setRoleModalConductor(null);
      await loadConductores();
    } catch (err) {
      console.error("Error asignando rol:", err);
      setRoleModalError(err.message || "Ocurrió un error al procesar la asignación de rol.");
    } finally {
      setRoleModalSaving(false);
    }
  }

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
    if (!canDeleteConductor(conductor)) {
      setMessage("No tienes permisos suficientes para eliminar a este usuario.");
      setMessageType("error");
      return;
    }
    setDeleteConfirmConductor(conductor);
  }

  async function confirmDeleteDriver() {
    if (!deleteConfirmConductor) return;
    const conductor = deleteConfirmConductor;

    if (!canDeleteConductor(conductor)) {
      setMessage("No tienes permisos suficientes para eliminar a este usuario.");
      setMessageType("error");
      setDeleteConfirmConductor(null);
      return;
    }

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
      await Promise.all([loadConductores(), loadVehiculos()]);

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
    if (selectedRoleFilter !== "TODOS") {
      const targetRol = conductor.rol_administrativo ? String(conductor.rol_administrativo).toUpperCase() : "";
      if (selectedRoleFilter === "CONDUCTOR") {
        if (targetRol) return false;
      } else if (selectedRoleFilter === "GERENTE") {
        if (!["GERENTE", "GERENTE_GENERAL"].includes(targetRol)) return false;
      } else if (selectedRoleFilter === "COORDINADOR") {
        if (!["COORDINADOR", "COORDINADOR_AREA", "COORDINADOR_QHSE"].includes(targetRol)) return false;
      } else {
        if (targetRol !== selectedRoleFilter) return false;
      }
    }
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
    if (onlyExpiringManejoComentado) {
      const mcStatus = getManejoComentadoStatus(conductor);
      if (mcStatus.status !== "por_vencer" && mcStatus.status !== "vencido") {
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
  const unidadesSinAsignarCount = vehiculosOptions.filter((v) => !v.id_conductor_asignado).length;
  const licenciasPorVencerCount = conductores.filter((c) => {
    const s = getLicenciaStatus(c).status;
    return s === "por_vencer" || s === "vencida";
  }).length;
  const manejosPorVencerCount = conductores.filter((c) => {
    const s = getManejoComentadoStatus(c).status;
    return s === "por_vencer" || s === "vencido";
  }).length;

  const handleResetFilters = () => {
    setSearch("");
    setStatus("TODOS");
    setSelectedEmpresa("TODAS");
    setSelectedRoleFilter("TODOS");
    setSelectedUnidadFilter("TODAS");
    setOnlyExpiringLicenses(false);
    setOnlyExpiringManejoComentado(false);
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

        <div
          className={`conductor-kpi-card kpi-card-clickable ${onlyExpiringManejoComentado ? "kpi-card-active" : ""}`}
          onClick={() => {
            setOnlyExpiringManejoComentado(!onlyExpiringManejoComentado);
            setCurrentPage(1);
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              setOnlyExpiringManejoComentado(!onlyExpiringManejoComentado);
              setCurrentPage(1);
            }
          }}
          title={onlyExpiringManejoComentado ? "Click para mostrar todos los conductores" : "Click para filtrar conductores con manejo comentado por vencer o vencido"}
        >
          <div className="kpi-card-header">
            <span className="kpi-card-title">Manejo Comentado</span>
            <div className="kpi-icon-wrapper kpi-icon-purple">
              <IconManejoComentado size={20} />
            </div>
          </div>
          <div className={`kpi-card-value ${manejosPorVencerCount > 0 ? "kpi-val-purple" : ""}`}>{manejosPorVencerCount}</div>
          <div className="kpi-card-subtext">
            <span className={`kpi-sub-pill ${manejosPorVencerCount > 0 ? "kpi-pill-purple" : "kpi-pill-green"}`}>
              {manejosPorVencerCount > 0 ? "Plazo < 30 días" : "Al día"}
            </span>{" "}
            {onlyExpiringManejoComentado ? "(Filtro activo)" : "por vencer"}
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
          <span>Rol</span>
          <select
            value={selectedRoleFilter}
            onChange={(event) => {
              setSelectedRoleFilter(event.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="TODOS">Rol: Todos</option>
            <option value="CONDUCTOR">Solo Conductor</option>
            <option value="ADMINISTRADOR">Administrador</option>
            <option value="GERENTE">Gerente</option>
            <option value="COORDINADOR">Coordinador</option>
            <option value="SUPERVISOR">Supervisor</option>
            <option value="QHSE">QHSE</option>
            <option value="INSTRUCTOR">Instructor</option>
            <option value="OPERADOR">Operador</option>
            <option value="CONSULTA">Consulta</option>
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

      {onlyExpiringManejoComentado && (
        <div className="filter-active-notice notice-purple">
          <IconManejoComentado size={16} className="notice-icon" />
          <span>Mostrando únicamente conductores con manejo comentado vencido o por vencer en los próximos 30 días ({totalFiltered}).</span>
          <button type="button" className="notice-clear-btn" onClick={() => setOnlyExpiringManejoComentado(false)}>
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
                          {getRoleBadge(conductor.rol_administrativo, conductor.id_conductores)}
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

                            {canAssignRole && (
                              <button
                                type="button"
                                className="conductor-action-btn btn-role"
                                disabled={updatingId === conductor.id_conductores}
                                onClick={() => handleOpenRoleModal(conductor)}
                                data-tooltip={conductor.rol_administrativo ? `Rol: ${conductor.rol_administrativo}` : "Asignar rol"}
                                aria-label="Asignar rol"
                              >
                                <IconRol size={16} />
                              </button>
                            )}

                            {canDeleteConductor(conductor) && (
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
                      <div style={{ display: "flex", gap: "6px", alignItems: "center", marginTop: "4px", flexWrap: "wrap" }}>
                        {getRoleBadge(conductor.rol_administrativo, conductor.id_conductores)}
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

                    {canAssignRole && (
                      <button
                        type="button"
                        className="secondary-button btn-role-mobile"
                        disabled={updatingId === conductor.id_conductores}
                        onClick={() => handleOpenRoleModal(conductor)}
                        style={{ color: "#7c3aed", borderColor: "#ddd6fe", background: "#f5f3ff", display: "inline-flex", alignItems: "center", gap: "6px" }}
                      >
                        <IconRol size={15} /> {conductor.rol_administrativo ? `Rol: ${conductor.rol_administrativo}` : "Asignar rol"}
                      </button>
                    )}

                    {canDeleteConductor(conductor) && (
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
                              : modalMcStatus.status === "vencido"
                              ? "Vencido"
                              : "Sin registrar"}
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
                <span><strong>Advertencia:</strong> Se desvinculará y eliminará su usuario de Telegram{deleteConfirmConductor.rol_administrativo ? ` y su cuenta administrativa con rol ${deleteConfirmConductor.rol_administrativo}` : ""}. Sus viajes históricos se conservarán para fines de auditoría.</span>
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

      {/* Modal: Asignación y Gestión de Roles de Conductores */}
      {roleModalConductor && (
        <div
          className="modal-overlay"
          onClick={() => !roleModalSaving && setRoleModalConductor(null)}
        >
          <div
            className="modal-card"
            style={{ maxWidth: "580px", width: "100%", padding: "24px", maxHeight: "90vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="form-panel-header">
              <div>
                <h2>
                  <IconRol size={20} style={{ verticalAlign: "middle", marginRight: 8, color: "#7c3aed" }} />
                  {roleModalConductor.rol_administrativo ? "Gestión de Rol Administrativo" : "Asignar Rol a Conductor"}
                </h2>
                <p style={{ margin: "4px 0 0 0", color: "#64748b", fontSize: "0.85rem" }}>
                  Personal: <strong>{roleModalConductor.nombre}</strong> {roleModalConductor.empresa ? `(${roleModalConductor.empresa})` : ""}
                </p>
              </div>
              <button
                type="button"
                className="close-button"
                disabled={roleModalSaving}
                onClick={() => setRoleModalConductor(null)}
              >
                <IconCross size={16} />
              </button>
            </div>

            {roleModalLoading ? (
              <div style={{ textAlign: "center", padding: "32px 0", color: "#64748b" }}>
                <p>Consultando perfil y permisos del conductor...</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "16px" }}>
                {/* Ficha Resumen del Conductor */}
                <div
                  style={{
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: "10px",
                    padding: "12px 16px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                    fontSize: "0.85rem"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "6px" }}>
                    <span style={{ color: "#64748b" }}>Estado del Conductor:</span>
                    <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                      {getRoleBadge(roleModalConductor.rol_administrativo, roleModalConductor.id_conductores)}
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: "6px",
                          fontSize: "0.72rem",
                          fontWeight: "bold",
                          background: roleModalConductor.aprobado_por_admin ? "#dcfce7" : "#fef3c7",
                          color: roleModalConductor.aprobado_por_admin ? "#166534" : "#92400e",
                          border: roleModalConductor.aprobado_por_admin ? "1px solid #bbf7d0" : "1px solid #fde68a"
                        }}
                      >
                        {roleModalConductor.aprobado_por_admin ? "Aprobado" : "Pendiente de Aprobación"}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "8px", color: "#334155" }}>
                    <div>
                      <span style={{ color: "#64748b", display: "block", fontSize: "0.75rem" }}>Teléfono:</span>
                      <strong>{roleModalConductor.telefono || "No registrado"}</strong>
                    </div>
                    <div>
                      <span style={{ color: "#64748b", display: "block", fontSize: "0.75rem" }}>Telegram:</span>
                      <strong>
                        {roleModalConductor.telegram_username
                          ? `@${roleModalConductor.telegram_username}`
                          : (roleModalConductor.telegram_user_id ? `ID: ${roleModalConductor.telegram_user_id}` : "No vinculado")}
                      </strong>
                    </div>
                  </div>

                  {!roleModalConductor.aprobado_por_admin && (
                    <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: "6px", padding: "6px 10px", fontSize: "0.78rem", color: "#065f46", display: "flex", alignItems: "center", gap: "6px" }}>
                      <IconCheck size={14} />
                      <span>Al asignar un rol, este conductor quedará <strong>aprobado automáticamente</strong> en el sistema.</span>
                    </div>
                  )}
                </div>

                {roleModalError && (
                  <div style={{ background: "#fef2f2", borderLeft: "4px solid #ef4444", borderRadius: "4px", padding: "10px 12px", color: "#991b1b", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "8px" }}>
                    <IconAlerta size={16} style={{ flexShrink: 0 }} />
                    <span>{roleModalError}</span>
                  </div>
                )}

                {/* Si ya tiene rol administrativo vinculado */}
                {roleModalConductor.rol_administrativo ? (
                  <form onSubmit={(e) => handleSubmitRole(e, "ACTUALIZAR")} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                    <div style={{ background: "#f5f3ff", border: "1px solid #ddd6fe", borderRadius: "8px", padding: "10px 14px", fontSize: "0.85rem", color: "#5b21b6" }}>
                      Cuenta vinculada: <strong>@{roleForm.username}</strong> {roleForm.correo ? `(${roleForm.correo})` : ""}
                    </div>

                    <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "0.88rem", fontWeight: 600, color: "#1e293b" }}>
                      Rol Administrativo *
                      <select
                        value={roleForm.rol}
                        onChange={(e) => setRoleForm({ ...roleForm, rol: e.target.value })}
                        style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #cadde6", fontSize: "0.9rem", background: "#ffffff" }}
                      >
                        {getAllowedRoleOptions().map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                      <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "0.88rem", fontWeight: 600, color: "#1e293b" }}>
                        Nombre de Usuario *
                        <input
                          type="text"
                          required
                          value={roleForm.username}
                          onChange={(e) => setRoleForm({ ...roleForm, username: e.target.value })}
                          placeholder="usuario"
                          style={{ padding: "9px 12px", borderRadius: "8px", border: "1px solid #cadde6", fontSize: "0.9rem" }}
                        />
                      </label>

                      <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "0.88rem", fontWeight: 600, color: "#1e293b" }}>
                        Correo Electrónico
                        <input
                          type="email"
                          value={roleForm.correo}
                          onChange={(e) => setRoleForm({ ...roleForm, correo: e.target.value })}
                          placeholder="usuario@empresa.com"
                          style={{ padding: "9px 12px", borderRadius: "8px", border: "1px solid #cadde6", fontSize: "0.9rem" }}
                        />
                      </label>
                    </div>

                    <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.88rem", cursor: "pointer", marginTop: "4px" }}>
                      <input
                        type="checkbox"
                        checked={roleForm.activo}
                        onChange={(e) => setRoleForm({ ...roleForm, activo: e.target.checked })}
                      />
                      <span style={{ fontWeight: 600, color: "#334155" }}>Acceso a plataforma activo</span>
                    </label>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "12px", paddingTop: "12px", borderTop: "1px solid #e2e8f0" }}>
                      {roleModalData?.usuarioAdmin?.id_usuarios_admin === user?.idUsuarioAdmin ? (
                        <span style={{ fontSize: "0.8rem", color: "#64748b", fontStyle: "italic" }}>
                          (Tu propia sesión activa)
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="secondary-button"
                          style={{ color: "#dc2626", borderColor: "#fecaca" }}
                          disabled={roleModalSaving || (roleModalData?.usuarioAdmin?.rol === "ADMINISTRADOR" && user?.rol !== "ADMINISTRADOR")}
                          onClick={(e) => handleSubmitRole(e, "REVOCAR")}
                        >
                          Revocar Rol Administrativo
                        </button>
                      )}

                      <div style={{ display: "flex", gap: "8px" }}>
                        <button
                          type="button"
                          className="secondary-button"
                          disabled={roleModalSaving}
                          onClick={() => setRoleModalConductor(null)}
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          className="primary-button"
                          disabled={roleModalSaving}
                        >
                          {roleModalSaving ? "Guardando..." : "Guardar Cambios"}
                        </button>
                      </div>
                    </div>
                  </form>
                ) : (
                  /* Conductor SIN rol administrativo aún - Formulario directo */
                  <form onSubmit={(e) => handleSubmitRole(e, "NUEVO")} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                    <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "0.88rem", fontWeight: 600, color: "#1e293b" }}>
                      Rol a Asignar *
                      <select
                        value={roleForm.rol}
                        onChange={(e) => setRoleForm({ ...roleForm, rol: e.target.value })}
                        style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #cadde6", fontSize: "0.9rem", background: "#ffffff" }}
                      >
                        {getAllowedRoleOptions().map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                      <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "0.88rem", fontWeight: 600, color: "#1e293b" }}>
                        Nombre de Usuario *
                        <input
                          type="text"
                          required
                          value={roleForm.username}
                          onChange={(e) => setRoleForm({ ...roleForm, username: e.target.value })}
                          placeholder="carlos.ramirez"
                          style={{ padding: "9px 12px", borderRadius: "8px", border: "1px solid #cadde6", fontSize: "0.9rem" }}
                        />
                      </label>

                      <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "0.88rem", fontWeight: 600, color: "#1e293b" }}>
                        Correo Electrónico
                        <input
                          type="email"
                          value={roleForm.correo}
                          onChange={(e) => setRoleForm({ ...roleForm, correo: e.target.value })}
                          placeholder="usuario@itzamna.mx"
                          style={{ padding: "9px 12px", borderRadius: "8px", border: "1px solid #cadde6", fontSize: "0.9rem" }}
                        />
                      </label>
                    </div>

                    <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: "8px", padding: "10px 12px", fontSize: "0.82rem", color: "#1e40af", display: "flex", alignItems: "center", gap: "8px" }}>
                      <IconKey size={16} style={{ flexShrink: 0 }} />
                      <span>El <strong>PIN de 4 dígitos</strong> del conductor se sincronizará de forma inmediata para su inicio de sesión en plataforma o terminales.</span>
                    </div>

                    <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "8px", paddingTop: "12px", borderTop: "1px solid #e2e8f0" }}>
                      <button
                        type="button"
                        className="secondary-button"
                        disabled={roleModalSaving}
                        onClick={() => setRoleModalConductor(null)}
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className="primary-button"
                        style={{ background: "#7c3aed", borderColor: "#6d28d9" }}
                        disabled={roleModalSaving}
                      >
                        {roleModalSaving ? "Asignando..." : "Asignar Rol y Habilitar"}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

export default ConductoresPage;

