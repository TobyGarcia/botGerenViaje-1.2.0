import {
  useEffect,
  useRef,
  useState
} from "react";
import "./App.css";

import {
  cancelarViaje,
  createLugar,
  createViaje,
  finalizarViaje,
  getConductores,
  getLugares,
  getVehiculos,
  getViajeActivo,
  getInspeccionVehicular,
  enviarInspeccionVehicular,
  iniciarViaje,
  registrarUbicacion,
  getGerenciamientoViajePorViaje,
  registrarReporteHoraGerenciamiento,
  getDriverSession,
  logoutDriver,
  autenticarTelegram
} from "./services/api.js";
import RegistroConductor from "./pages/RegistroConductor.jsx";
import InspeccionVehicular from "./pages/InspeccionVehicular.jsx";
import GerenciamientoForm from "./components/GerenciamientoForm.jsx";
import PinLoginForm from "./components/PinLoginForm.jsx";
import TopBar from "./components/TopBar.jsx";
import OfflineBanner from "./components/OfflineBanner.jsx";
import PwaInstallPrompt from "./components/PwaInstallPrompt.jsx";

import {
  captureAndQueueLocation,
  captureIntermediatePoint,
  setTrackingStatusListener,
  startTracking,
  stopTracking,
  syncPendingLocations
} from "./services/tracking-service.js";

const initialForm = {
  idConductor: "",
  idVehiculo: "",
  idOrigen: "",
  idDestino: "",
  acompanantes: "",
  viajaAcompanado: false,
  kilometrajeInicial: "",
  motivo: ""
};

function formatDate(value) {
  if (!value) {
    return "No registrada";
  }

  const normalizedValue =
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? `${value}T00:00:00`
      : value;
  const date = new Date(normalizedValue);

  if (Number.isNaN(date.getTime())) {
    return "Fecha no válida";
  }

  return date.toLocaleDateString("es-MX", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
}

function getCachedJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function normalizeConductor(conductor) {
  if (!conductor) {
    return conductor;
  }

  return {
    ...conductor,
    licencia_vencimiento:
      conductor.licencia_vencimiento ??
      conductor.licenciaVencimiento
  };
}

function App() {
  const [form, setForm] = useState(() => {
    const cached = getCachedJson("cached_driver", null);
    return {
      ...initialForm,
      idConductor: cached?.id_conductores ? String(cached.id_conductores) : ""
    };
  });
  const [listaAcompanantes, setListaAcompanantes] = useState([""]);
  const [conductores, setConductores] = useState(() => getCachedJson("cached_conductores", []));
  const [vehiculos, setVehiculos] = useState(() => getCachedJson("cached_vehiculos", []));
  const [lugares, setLugares] = useState(() => getCachedJson("cached_lugares", []));
  const [loading, setLoading] = useState(() => {
    const token = localStorage.getItem("driver_token");
    const cached = getCachedJson("cached_driver", null);
    const cLug = getCachedJson("cached_lugares", []);
    const cVeh = getCachedJson("cached_vehiculos", []);
    const hasCachedCatalogs = cLug.length > 0 && cVeh.length > 0;
    return Boolean(token && cached && !hasCachedCatalogs);
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("error");
  const [createdTrip, setCreatedTrip] = useState(() => getCachedJson("cached_active_trip", null));
  const [startingTrip, setStartingTrip] = useState(false);
  const [startedTrip, setStartedTrip] = useState(() => {
    const trip = getCachedJson("cached_active_trip", null);
    return trip?.estado === "EN_CURSO" ? trip : null;
  });
  const savingRef = useRef(false);
  const startingTripRef = useRef(false);
  const geolocationWatchRef = useRef(null);
const lastLocationSentAtRef = useRef(0);
const sendingLocationRef = useRef(false);

  const [trackingGps, setTrackingGps] =
    useState(false);
  const [modalAlertMessage, setModalAlertMessage] = useState("");
  const [activeTabMode, setActiveTabMode] = useState("urban"); // "urban" | "gerenciamiento"
  const [gerenciamientoPendiente, setGerenciamientoPendiente] = useState(null);

  // Estado para modal/formulario de nuevo destino
  const [showAddDestinoModal, setShowAddDestinoModal] = useState(false);
  const [newDestinoForm, setNewDestinoForm] = useState({ nombre: "", direccion: "" });
  const [savingNewDestino, setSavingNewDestino] = useState(false);

  async function handleSaveNewDestino(e) {
    e.preventDefault();
    const nombre = newDestinoForm.nombre.trim();
    if (!nombre) return;

    setSavingNewDestino(true);
    try {
      const response = await createLugar({
        nombre,
        direccion: newDestinoForm.direccion.trim()
      });
      const nuevoLugar = response.data;

      // Recargar catálogo de lugares
      const lugaresRes = await getLugares();
      const nuevosLugares = lugaresRes.data ?? [];
      setLugares(nuevosLugares);

      // Asignar el nuevo destino automáticamente al formulario de viaje
      if (nuevoLugar?.id_lugares) {
        setForm((current) => ({
          ...current,
          idDestino: String(nuevoLugar.id_lugares)
        }));
      }

      setMessage(`Destino "${nuevoLugar.nombre || nombre}" registrado y seleccionado correctamente.`);
      setMessageType("success");
      setShowAddDestinoModal(false);
      setNewDestinoForm({ nombre: "", direccion: "" });
    } catch (err) {
      setMessage(err.message || "Error al agregar nuevo destino.");
      setMessageType("error");
    } finally {
      setSavingNewDestino(false);
    }
  }

  function triggerModalError(errMsg) {
    setMessage("");
    setMessageType("error");
    setModalAlertMessage(errMsg);
    if (window.Telegram?.WebApp?.showAlert) {
      try {
        window.Telegram.WebApp.showAlert(errMsg);
      } catch {
        // Ignorar si falla showAlert nativo de Telegram
      }
    }
  }



const [gpsStatus, setGpsStatus] =
  useState("GPS detenido.");

const [lastLocation, setLastLocation] =
  useState(null);

const [trackingInfo, setTrackingInfo] = useState({
  active: false,
  status: "Detenido",
  pending: 0,
  connection: navigator.onLine ? "En línea" : "Sin conexión",
  lastCapture: null
});

const [kilometrajeFinal, setKilometrajeFinal] =
  useState("");

const [finishingTrip, setFinishingTrip] =
  useState(false);

const [finishedTrip, setFinishedTrip] =
  useState(null);

const [cancelledTrip, setCancelledTrip] =
  useState(null);

  const [cancellingTrip, setCancellingTrip] =
  useState(false);
  const [inspection, setInspection] = useState(null);
  const [inspectionSaving, setInspectionSaving] = useState(false);
  const [inspectionOpen, setInspectionOpen] = useState(false);
  const [inspectionStatus, setInspectionStatus] = useState("idle");
  const [inspectionError, setInspectionError] = useState("");
  const [gerenciamientoDoc, setGerenciamientoDoc] = useState(null);

  useEffect(() => {
    const idViaje = startedTrip?.idViaje ?? startedTrip?.id_viajes ?? createdTrip?.idViaje ?? createdTrip?.id_viajes;
    if (idViaje) {
      getGerenciamientoViajePorViaje(idViaje)
        .then((res) => setGerenciamientoDoc(res.data))
        .catch(() => setGerenciamientoDoc(null));
    } else {
      setGerenciamientoDoc(null);
    }
  }, [startedTrip?.idViaje, startedTrip?.id_viajes, createdTrip?.idViaje, createdTrip?.id_viajes]);

  const [telegramAuth, setTelegramAuth] = useState(() => {
    const token = localStorage.getItem("driver_token");
    const cached = getCachedJson("cached_driver", null);
    if (token && cached) {
      return {
        authenticated: true,
        registered: true,
        estadoRegistro: "COMPLETO",
        conductor: cached
      };
    }
    return null;
  });
  const [telegramAuthLoading, setTelegramAuthLoading] = useState(() => {
    const token = localStorage.getItem("driver_token");
    const cached = getCachedJson("cached_driver", null);
    if (token && cached) return false;
    if (!token) return false;
    return true;
  });
  const [telegramAuthError, setTelegramAuthError] = useState("");
  const [showPinLogin, setShowPinLogin] = useState(() => {
    const token = localStorage.getItem("driver_token");
    const cached = getCachedJson("cached_driver", null);
    return !(token && cached);
  });
  const [showConductorRegister, setShowConductorRegister] = useState(false);
  const [onlineRefreshVersion, setOnlineRefreshVersion] = useState(0);

  function handlePinLoginSuccess(conductor, token) {
    const normalized = normalizeConductor(conductor);
    if (normalized) {
      localStorage.setItem("cached_driver", JSON.stringify(normalized));
    }
    const tokenToSave = token || localStorage.getItem("driver_token") || `driver_session_${normalized?.id_conductores || "active"}`;
    localStorage.setItem("driver_token", tokenToSave);
    setTelegramAuth({
      authenticated: true,
      registered: true,
      estadoRegistro: "COMPLETO",
      conductor: normalized
    });
    setShowPinLogin(false);
    setTelegramAuthError("");
  }

  async function handleLogout() {
    if (startedTrip && startedTrip.estado === "EN_CURSO") {
      const confirmed = window.confirm(
        "Tienes un viaje en curso. Si cierras sesión, el viaje seguirá registrado en el sistema y podrás retomarlo volviendo a ingresar con tu PIN. ¿Deseas salir?"
      );
      if (!confirmed) return;
    }

    try {
      await logoutDriver();
    } catch {
      // Ignorar fallo de red
    }

    stopTracking();
    localStorage.removeItem("driver_token");
    localStorage.removeItem("cached_driver");
    localStorage.removeItem("offline_driver_pin_digest");
    setTelegramAuth(null);
    setCreatedTrip(null);
    setStartedTrip(null);
    setFinishedTrip(null);
    setCancelledTrip(null);
    setKilometrajeFinal("");
    setLastLocation(null);
    setForm(initialForm);
    setShowPinLogin(true);
    setMessage("");
  }

  const authenticatedDriver = telegramAuth?.conductor ?? null;
  const selectedDriver = authenticatedDriver ?? conductores.find(
    (conductor) => String(conductor.id_conductores) === form.idConductor
  );
  const selectedVehicle = vehiculos.find(
    (vehiculo) => String(vehiculo.id_vehiculos) === form.idVehiculo
  );
  const currentDate = new Intl.DateTimeFormat("es-MX", {
    dateStyle: "long"
  }).format(new Date());

  // Soporte PWA Offline y Telegram Mini App: mantener la sesión iniciada sin volver a pedir PIN al quedar sin red
  useEffect(() => {
    let active = true;
    const token = localStorage.getItem("driver_token");
    const cachedDriver = getCachedJson("cached_driver", null);
    const telegramInitData = window.Telegram?.WebApp?.initData || "";

    // Si ya existe un perfil de conductor guardado localmente en este celular:
    if (cachedDriver) {
      if (!token) {
        localStorage.setItem("driver_token", `driver_session_${cachedDriver.id_conductores || "active"}`);
      }
      setTelegramAuth({
        authenticated: true,
        registered: true,
        estadoRegistro: "COMPLETO",
        conductor: cachedDriver
      });
      setTelegramAuthLoading(false);
      setShowPinLogin(false);
      return () => { active = false; };
    }

    // Si se está ejecutando dentro de Telegram Mini App y hay initData disponible
    if (telegramInitData && navigator.onLine) {
      autenticarTelegram(telegramInitData)
        .then((response) => {
          if (!active) return;
          if (response?.data?.authenticated && response?.data?.registered && response?.data?.conductor) {
            handlePinLoginSuccess(response.data.conductor, response.data.token);
          } else if (response?.data?.authenticated && !response?.data?.registered) {
            setShowConductorRegister(true);
            setShowPinLogin(false);
          } else {
            setShowPinLogin(true);
          }
        })
        .catch(() => {
          if (active) setShowPinLogin(true);
        })
        .finally(() => {
          if (active) setTelegramAuthLoading(false);
        });
      return () => { active = false; };
    }

    // Recuperar y persistir el perfil si hay token pero una versión anterior
    // de la PWA todavía no había creado cached_driver.
    if (token && navigator.onLine) {
      getDriverSession()
        .then((response) => {
          if (!active || !response?.data?.conductor) return;
          handlePinLoginSuccess(response.data.conductor);
        })
        .catch(() => {
          if (active) setShowPinLogin(true);
        })
        .finally(() => {
          if (active) setTelegramAuthLoading(false);
        });
    } else {
      setShowPinLogin(true);
      setTelegramAuthLoading(false);
    }

    return () => { active = false; };
  }, []);

  useEffect(() => {
    const idConductor = telegramAuth?.conductor?.id_conductores;
    if (telegramAuth?.registered && idConductor) {
      setForm((current) => {
        const normalizedId = String(idConductor);

        if (current.idConductor === normalizedId) {
          return current;
        }

        return {
        ...current,
          idConductor: normalizedId
        };
      });
    }
  }, [telegramAuth?.registered, telegramAuth?.conductor?.id_conductores]);

  useEffect(() => {
    const driverId = telegramAuth?.conductor?.id_conductores;
    const authAssignedId = telegramAuth?.conductor?.id_vehiculo_asignado;

    if (vehiculos.length > 0 && (driverId || authAssignedId)) {
      const assignedVehicle = vehiculos.find(
        (v) => (driverId && String(v.id_conductor_asignado) === String(driverId)) ||
               (authAssignedId && String(v.id_vehiculos) === String(authAssignedId))
      );

      if (assignedVehicle) {
        setForm((cur) => {
          if (!cur.idVehiculo || cur.idVehiculo === "") {
            return {
              ...cur,
              idVehiculo: String(assignedVehicle.id_vehiculos),
              kilometrajeInicial: assignedVehicle.kilometraje_actual ?? cur.kilometrajeInicial
            };
          }
          return cur;
        });
      }
    }
  }, [telegramAuth?.conductor?.id_conductores, telegramAuth?.conductor?.id_vehiculo_asignado, vehiculos]);

/*  useEffect(() => {
    async function loadCatalogs() {
      try {
        const [conductoresResponse, vehiculosResponse, lugaresResponse] =
          await Promise.all([
            getConductores(),
            getVehiculos(),
            getLugares()
          ]);

        setConductores(conductoresResponse.data ?? []);
        setVehiculos(vehiculosResponse.data ?? []);
        setLugares(lugaresResponse.data ?? []);
      } catch (error) {
        setMessage(error.message);
        setMessageType("error");
      } finally {
        setLoading(false);
      }
    }

    loadCatalogs();
  }, []);*/
  
  useEffect(() => {
    if (!telegramAuth?.conductor?.id_conductores) {
      setLoading(false);
      return;
    }

    async function loadInitialData() {
      const cCond = getCachedJson("cached_conductores", []);
      const cVeh = getCachedJson("cached_vehiculos", []);
      const cLug = getCachedJson("cached_lugares", []);
      const hasCached = cCond.length > 0 && cVeh.length > 0 && cLug.length > 0;
      if (!hasCached) {
        setLoading(true);
      }
      try {
        const [
          conductoresResponse,
          vehiculosResponse,
          lugaresResponse,
          activeTripResponse
        ] = await Promise.all([
          getConductores().catch((err) => ({ _error: err, data: null })),
          getVehiculos().catch((err) => ({ _error: err, data: null })),
          getLugares().catch((err) => ({ _error: err, data: null })),
          getViajeActivo().catch((err) => ({ _error: err, data: null }))
        ]);

        if (conductoresResponse?.data) {
          setConductores(conductoresResponse.data);
          localStorage.setItem("cached_conductores", JSON.stringify(conductoresResponse.data));
        }
        if (vehiculosResponse?.data) {
          setVehiculos(vehiculosResponse.data);
          localStorage.setItem("cached_vehiculos", JSON.stringify(vehiculosResponse.data));
        }
        if (lugaresResponse?.data) {
          setLugares(lugaresResponse.data);
          localStorage.setItem("cached_lugares", JSON.stringify(lugaresResponse.data));
        }

        // Si la petición a /api/viajes/activo falló por error de red/tiempo de espera
        if (activeTripResponse?._error) {
          console.warn("Error de red al consultar viaje activo:", activeTripResponse._error?.message);
          const cachedActive = getCachedJson("cached_active_trip", null);
          if (cachedActive) {
            setCreatedTrip(cachedActive);
            if (cachedActive.estado === "EN_CURSO") {
              setStartedTrip(cachedActive);
              setKilometrajeFinal(String(cachedActive.kilometrajeInicial ?? cachedActive.kilometraje_inicial ?? ""));
              setGpsStatus("Reanudando seguimiento GPS en modo sin conexión...");
              void startTracking(cachedActive.idViaje).catch(() => {});
            }
            setMessage("Modo sin conexión: mostrando datos del viaje guardados en este dispositivo.");
            setMessageType("success");
          }
          return;
        }

        const activeTrip = activeTripResponse?.data;

        if (!activeTrip) {
          localStorage.removeItem("cached_active_trip");
          setCreatedTrip(null);
          setStartedTrip(null);
          stopTracking();
          return;
        }

        const normalizedTrip = {
          idViaje: activeTrip.idViaje,
          id_viajes: activeTrip.idViaje,
          folio: activeTrip.folio,
          conductor: activeTrip.conductor?.nombre,
          vehiculo: activeTrip.vehiculo?.nombre,
          numeroEconomico: activeTrip.vehiculo?.numeroEconomico,
          estado: activeTrip.estado,
          kilometrajeInicial: activeTrip.kilometrajeInicial,
          horaSalida: activeTrip.horaSalida,
          origen: activeTrip.origen?.nombre,
          destino: activeTrip.destino?.nombre
        };

        localStorage.setItem("cached_active_trip", JSON.stringify(normalizedTrip));
        setCreatedTrip(normalizedTrip);

        if (activeTrip.estado === "EN_CURSO") {
          setStartedTrip(normalizedTrip);
          setKilometrajeFinal(String(activeTrip.kilometrajeInicial ?? ""));
          setLastLocation(activeTrip.ultimaUbicacion);

          if (activeTrip.ultimaUbicacion) {
            setTrackingInfo((current) => ({
              ...current,
              lastCapture: activeTrip.ultimaUbicacion.gpsTimestamp,
              latitude: Number(activeTrip.ultimaUbicacion.latitude),
              longitude: Number(activeTrip.ultimaUbicacion.longitude)
            }));
          }

          // La geolocalización puede requerir permiso o tardar. No debe bloquear
          // la carga de la pantalla ni mantener la PWA en "Cargando catálogos".
          setGpsStatus("Reanudando seguimiento GPS...");
          void startTracking(activeTrip.idViaje).catch((trackingError) => {
            console.warn("No fue posible iniciar el seguimiento GPS:", trackingError);
            setGpsStatus("GPS pendiente de autorización.");
          });
        } else {
          stopTracking();
        }

        setMessage(
          activeTrip.estado === "EN_CURSO"
            ? "Se recuperó un viaje en curso."
            : "Se recuperó un viaje pendiente."
        );
        setMessageType("success");
      } catch (error) {
        console.warn("Error cargando catálogos iniciales, usando datos locales:", error.message);
        if (!navigator.onLine) {
          setMessage("Modo sin conexión: mostrando datos de viaje guardados en este dispositivo.");
          setMessageType("success");
        } else {
          setMessage(error.message);
          setMessageType("error");
        }
      } finally {
        setLoading(false);
      }
    }

    loadInitialData();
  }, [telegramAuth?.conductor?.id_conductores, onlineRefreshVersion]);

  useEffect(() => {
    setTrackingStatusListener((update) => {
      setTrackingInfo((current) => ({ ...current, ...update }));
      setTrackingGps(Boolean(update.active));
      if (update.status) setGpsStatus(update.status);
    });

    return () => {
      setTrackingStatusListener(null);
      stopTracking({ clearState: false });
    };
  }, []);

  useEffect(() => {
    async function resumeWhenVisible() {
      try {
        if (document.visibilityState !== "visible") return;
        const response = await getViajeActivo();
        if (response.data?.estado === "EN_CURSO") {
          await syncPendingLocations(response.data.idViaje);
          await startTracking(response.data.idViaje);
        } else {
          stopTracking();
        }
      } catch (error) {
        console.warn("No fue posible reanudar el seguimiento GPS:", error);
      }
    }

    function syncWhenOnline() {
      const idViaje = startedTrip?.idViaje ?? createdTrip?.idViaje;
      if (idViaje) syncPendingLocations(idViaje);
      // Refrescar catálogos, viaje activo, inspección y estado operativo.
      // Antes sólo se sincronizaba GPS y la pantalla quedaba con datos antiguos.
      setOnlineRefreshVersion((current) => current + 1);
    }

    document.addEventListener("visibilitychange", resumeWhenVisible);
    window.addEventListener("online", syncWhenOnline);
    return () => {
      document.removeEventListener("visibilitychange", resumeWhenVisible);
      window.removeEventListener("online", syncWhenOnline);
    };
  }, [startedTrip?.idViaje, createdTrip?.idViaje]);

  async function sendPosition(
  idViaje,
  position
) {
  const now = Date.now();

  if (
    now - lastLocationSentAtRef.current <
    LOCATION_INTERVAL_MS
  ) {
    return;
  }

  if (sendingLocationRef.current) {
    return;
  }

  sendingLocationRef.current = true;
  lastLocationSentAtRef.current = now;

  try {
    const coordinates = position.coords;

    const response = await registrarUbicacion(
      idViaje,
      {
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        accuracy: coordinates.accuracy,
        speed: coordinates.speed,
        heading: coordinates.heading,
        gpsTimestamp:
          new Date(
            position.timestamp
          ).toISOString()
      }
    );

    setLastLocation(response.data);

    setGpsStatus(
      "Ubicación enviada correctamente."
    );
  } catch (error) {
    console.error(
      "Error enviando ubicación:",
      error
    );

    setGpsStatus(error.message);
  } finally {
    sendingLocationRef.current = false;
  }
}
function handleStartGps() {
  if(finishedTrip) {
    setGpsStatus(
      "el Viaje ya fue finalizado"
    );

    return;
  }
  const idViaje =
    startedTrip?.idViaje ??
    startedTrip?.id_viajes ??
    createdTrip?.idViaje ??
    createdTrip?.id_viajes;

  if (!idViaje) {
    setGpsStatus(
      "No se encontró el viaje activo."
    );
    return;
  }

  startTracking(idViaje);
}
function handleStopGps() {
  stopTracking({ clearState: false });
  setTrackingGps(false);
  setGpsStatus("GPS detenido.");
}

const [savingIntermediatePoint, setSavingIntermediatePoint] = useState(false);

async function handleAddIntermediatePoint() {
  const idViaje = startedTrip?.idViaje ?? startedTrip?.id_viajes;
  if (!idViaje) return;
  const note = window.prompt("Ingresa un nombre o motivo del punto intermedio (ej. Parada técnica, Gasolinera, Descanso):", "Parada técnica");
  if (note === null) return;
  setSavingIntermediatePoint(true);
  setMessage("");
  try {
    await captureIntermediatePoint(idViaje, note || "Punto Intermedio");
    setMessage("📍 Punto intermedio registrado con éxito.");
    setMessageType("success");
  } catch (err) {
    setMessage(err.message || "Error al registrar el punto intermedio.");
    setMessageType("error");
  } finally {
    setSavingIntermediatePoint(false);
  }
}

  async function handleFinishTrip(event) {
    event.preventDefault();

  const idViaje =
    startedTrip?.idViaje ??
    startedTrip?.id_viajes ??
    createdTrip?.idViaje ??
    createdTrip?.id_viajes;

    if (!idViaje) {
    setMessage(
      "No se encontró el identificador del viaje"
    );
    setMessageType("error");
    return;
  }
  
    const finalMileage = Number(kilometrajeFinal);

  const initialMileage =
    Number(
      startedTrip?.kilometrajeInicial ??
      startedTrip?.kilometraje_inicial ??
      createdTrip?.kilometrajeInicial ??
      createdTrip?.kilometraje_inicial
    );

    if (!Number.isInteger(finalMileage) || finalMileage <= initialMileage) {
    setMessage(
      "El kilometraje final debe ser mayor al kilometraje inicial."
    );
    setMessageType("error");
    return;
    }

    const confirmed = window.confirm(
      "¿Confirmas que deseas finalizar el viaje? Se detendrá el GPS y se registrará la hora de llegada."
    );

    if (!confirmed) {
      return;
    }

    setFinishingTrip(true);
    setMessage("");

    try {
      stopTracking({ clearState: false });
      await captureAndQueueLocation(idViaje);
      await syncPendingLocations(idViaje);

    const response = await finalizarViaje (
      idViaje,
      finalMileage
    );
    const finishedData =
      response.data ?? {};

    // Obtiene el kilometraje ya confirmado por el servidor para el siguiente viaje.
    const vehiclesResponse = await getVehiculos();
    const refreshedVehicles = vehiclesResponse.data ?? [];
    setVehiculos(refreshedVehicles);
    setForm((current) => {
      const selectedVehicle = refreshedVehicles.find(
        (vehicle) => String(vehicle.id_vehiculos) === String(current.idVehiculo)
      );
      return {
        ...current,
        kilometrajeInicial: selectedVehicle?.kilometraje_actual ?? current.kilometrajeInicial
      };
    });

    setFinishedTrip(finishedData);
    setStartedTrip((current) =>({
      ...current,
      ...finishedData,
      estado: "FINALIZADO"
    }));

    setCreatedTrip((current) =>({
      ...current,
      ...finishedData,
      estado: "FINALIZADO"
    }));

      setMessage("Viaje finalizado correctamente.");
      setMessageType("success");
      stopTracking();
      await syncPendingLocations(idViaje);
    } catch (error) {
      setMessage(error.message);
      setMessageType("error");
      await startTracking(idViaje);
    } finally {
      setFinishingTrip(false);
    }
  }

  async function handleCancelTrip() {
    const idViaje =
      startedTrip?.idViaje ??
      startedTrip?.id_viajes ??
      createdTrip?.idViaje ??
      createdTrip?.id_viajes;

    if (!idViaje) {
      setMessage("No se encontró el identificador del viaje.");
      setMessageType("error");
      return;
    }

    const confirmed = window.confirm(
      startedTrip
        ? "¿Confirmas que deseas cancelar este viaje en curso? Se detendrá el GPS."
        : "¿Confirmas que deseas cancelar este viaje?"
    );

    if (!confirmed) {
      return;
    }

    setCancellingTrip(true);
    setMessage("");

    try {
      const response = await cancelarViaje(idViaje);
      const cancelledData = response.data ?? {};

      stopTracking();
      setCancelledTrip(cancelledData);
      setStartedTrip(null);
      setCreatedTrip((current) => ({
        ...current,
        ...cancelledData,
        estado: "CANCELADO"
      }));
      setMessage("Viaje cancelado correctamente.");
      setMessageType("success");
    } catch (error) {
      setMessage(error.message);
      setMessageType("error");
    } finally {
      setCancellingTrip(false);
    }
  }

  function handleChange(event) {
    const { name, value } = event.target;

    if (name === "idDestino" && value === "NUEVO_DESTINO") {
      setShowAddDestinoModal(true);
      return;
    }

    setForm((current) => {
      const updatedForm = { ...current, [name]: value };

      if (name === "idVehiculo") {
        const vehicle = vehiculos.find(
          (item) => String(item.id_vehiculos) === value
        );
        updatedForm.kilometrajeInicial = vehicle?.kilometraje_actual ?? "";
      }

      if (name === "idOrigen" && value === current.idDestino) {
        updatedForm.idDestino = "";
      }

      if (name === "idDestino" && value === current.idOrigen) {
        updatedForm.idOrigen = "";
      }

      return updatedForm;
    });

    setMessage("");
  }

function isOutsideOperatingHours() {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const currentTotal = hours * 60 + minutes;
  const startTotal = 6 * 60 + 30; // 06:30 -> 390
  const endTotal = 18 * 60;       // 18:00 -> 1080
  return currentTotal < startTotal || currentTotal > endTotal;
}

  async function handleSubmit(event) {
    event.preventDefault();

    if (isOutsideOperatingHours()) {
      triggerModalError("⛔ El horario operativo para viajes locales/urbanos es de 6:30 AM a 6:00 PM. Al estar fuera de este horario, debes realizar un Gerenciamiento de Viaje.");
      setActiveTabMode("gerenciamiento");
      return;
    }

    if (savingRef.current) {
      return;
    }

    const kilometrajeInicial = Number(form.kilometrajeInicial);
    const kilometrajeRegistrado = Number(selectedVehicle?.kilometraje_actual);

    if (!selectedDriver?.licencia_vigente) {
      setMessage("Selecciona un conductor con licencia vigente.");
      setMessageType("error");
      return;
    }

    if (form.idOrigen === form.idDestino) {
      setMessage("El origen y el destino deben ser diferentes.");
      setMessageType("error");
      return;
    }

    if (
      !Number.isInteger(kilometrajeInicial) ||
      kilometrajeInicial < kilometrajeRegistrado
    ) {
      setMessage("El kilometraje inicial no puede ser menor al registrado.");
      setMessageType("error");
      return;
    }

    savingRef.current = true;
    setSaving(true);
    setMessage("");
    setCreatedTrip(null);
    setStartedTrip(null);
    setFinishedTrip(null);
    setCancelledTrip(null);

    try {
      const acompanantes = form.acompanantes
        .split(",")
        .map((nombre) => nombre.trim())
        .filter(Boolean)
        .map((nombre) => ({ nombre }));

      const response = await createViaje({
        idConductor: Number(form.idConductor),
        idVehiculo: Number(form.idVehiculo),
        idOrigen: Number(form.idOrigen),
        idDestino: Number(form.idDestino),
        acompanantes,
        kilometrajeInicial,
        motivo: form.motivo.trim()
      });

      const createdData = {
        ...response.data,
        idViaje: response.data.idViaje || response.data.id_viajes,
        kilometrajeInicial:
          response.data.kilometrajeInicial ??
          response.data.kilometraje_inicial ??
          kilometrajeInicial
      };
      setCreatedTrip(createdData);
      localStorage.setItem("cached_active_trip", JSON.stringify(createdData));
      setMessage(`Viaje creado correctamente. Folio: ${response.data.folio}`);
      setMessageType("success");
      setForm({
        ...initialForm,
        idConductor: telegramAuth?.conductor?.id_conductores
          ? String(telegramAuth.conductor.id_conductores)
          : ""
      });
    } catch (error) {
      triggerModalError(error.message);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }

  }

  async function handleStartTrip() {
    if (startingTripRef.current || startedTrip) {
      return;
    }

    const idViaje =
      createdTrip?.id_viajes ??
      createdTrip?.idViaje;

    if (!idViaje) {
      setMessage("No se encontró el identificador del viaje.");
      setMessageType("error");
      return;
    }

    const confirmed = window.confirm(
      "¿Confirmas que deseas iniciar este viaje? La hora de salida se registrará automáticamente."
    );

    if (!confirmed) {
      return;
    }

    startingTripRef.current = true;
    setStartingTrip(true);
    setMessage("");

    try {
      const response = await iniciarViaje(idViaje);
      const startedData = response.data ?? {};
      const horaSalida =
        startedData.horaSalida ??
        startedData.hora_salida;
      const estado =
        startedData.estado?.nombre ??
        startedData.estado ??
        "EN_CURSO";
      const normalizedTrip = {
        ...createdTrip,
        ...startedData,
        estado,
        horaSalida
      };

      setStartedTrip(normalizedTrip);
      setCreatedTrip(normalizedTrip);
      localStorage.setItem("cached_active_trip", JSON.stringify(normalizedTrip));
      setKilometrajeFinal(
        String(
          normalizedTrip.kilometrajeInicial ??
          normalizedTrip.kilometraje_inicial ??
          ""
        )
      );
      setMessage("Viaje iniciado correctamente.");
      setMessageType("success");
      await startTracking(idViaje);
      
    } catch (error) {
      setMessage(error.message);
      setMessageType("error");
    } finally {
      startingTripRef.current = false;
      setStartingTrip(false);
    }
  }

  async function loadInspection(idViaje) {
    if (!idViaje) return;
    setInspectionStatus("loading");
    setInspectionError("");
    try {
      const response = await getInspeccionVehicular(idViaje);
      setInspection(response.data);
      setInspectionStatus("ready");
    } catch (error) {
      setInspection(null);
      setInspectionStatus("error");
      setInspectionError(error.message || "No fue posible validar la inspección vehicular.");
    }
  }

  async function submitInspection(data) {
    const idViaje = createdTrip?.id_viajes ?? createdTrip?.idViaje;
    setInspectionSaving(true);
    try {
      await enviarInspeccionVehicular(idViaje, data);
      await loadInspection(idViaje);
      setInspectionOpen(false);
      setMessage("Inspección enviada. Espera la aprobación administrativa."); setMessageType("success");
    } catch (error) { setMessage(error.message); setMessageType("error"); }
    finally { setInspectionSaving(false); }
  }

  useEffect(() => {
    const idViaje = createdTrip?.id_viajes ?? createdTrip?.idViaje;
    if (idViaje && !startedTrip && !finishedTrip && !cancelledTrip) loadInspection(idViaje);
  }, [createdTrip?.id_viajes, createdTrip?.idViaje, startedTrip, finishedTrip, cancelledTrip]);

  useEffect(() => {
    const idViaje = createdTrip?.id_viajes ?? createdTrip?.idViaje;
    if (!idViaje || inspection?.inspection?.estado !== "PENDIENTE_APROBACION") return undefined;
    const timer = window.setInterval(() => loadInspection(idViaje), 15000);
    return () => window.clearInterval(timer);
  }, [createdTrip?.id_viajes, createdTrip?.idViaje, inspection?.inspection?.estado]);

  function handleNewTrip(){
    stopTracking();

    setForm({
      ...initialForm,
      idConductor: telegramAuth?.conductor?.id_conductores
        ? String(telegramAuth.conductor.id_conductores)
        : ""
    });
    setCreatedTrip(null);
    setStartedTrip(null);
    setFinishedTrip(null);
    setCancelledTrip(null);
    setKilometrajeFinal("");
    setLastLocation(null);
    setGpsStatus("GPS detenido.");
    setMessage("");
    setMessageType("error");
    setInspection(null);
    setInspectionOpen(false);
    setInspectionStatus("idle");
    setInspectionError("");

    lastLocationSentAtRef.current = 0;
    sendingLocationRef.current=false;
  }

  function handleExitApp() {
    handleLogout();
  }

  if (telegramAuthLoading) {
    return (
      <div className="app-shell">
        <TopBar conductor={null} onLogout={handleLogout} />
        <p className="loading-message">Verificando sesión...</p>
      </div>
    );
  }

  if (showPinLogin || !telegramAuth?.authenticated || !telegramAuth?.conductor) {
    if (showConductorRegister) {
      return (
        <div className="app-shell" style={{ minHeight: "100vh", overflowY: "auto" }}>
          <TopBar conductor={null} onLogout={handleLogout} />
          <main className="container" style={{ paddingBottom: "40px" }}>
            <button
              type="button"
              className="secondary-button"
              onClick={() => setShowConductorRegister(false)}
              style={{ marginBottom: "16px", background: "#ffffff", color: "#334155", border: "1px solid #cbd5e1" }}
            >
              ← Volver al inicio por PIN
            </button>
            <RegistroConductor
              telegramAuth={telegramAuth}
              onRegistered={(data) => {
                setShowConductorRegister(false);
                if (data?.conductor) {
                  handlePinLoginSuccess(data.conductor);
                }
              }}
            />
          </main>
        </div>
      );
    }

    return (
      <div className="pin-view-shell">
        <TopBar conductor={null} onLogout={handleLogout} />
        <main className="pin-view-main">
          <PinLoginForm
            onSuccess={handlePinLoginSuccess}
            onRegisterClick={() => setShowConductorRegister(true)}
          />
        </main>
      </div>
    );
  }

  if (telegramAuth.estadoRegistro === "BLOQUEADO" || (telegramAuth.conductor && !telegramAuth.conductor.activo)) {
    return (
      <div className="app-shell">
        <TopBar conductor={authenticatedDriver} onLogout={handleLogout} />
        <p className="loading-message">Tu acceso de conductor está inactivo o restringido.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="app-shell">
        <TopBar conductor={authenticatedDriver} onLogout={handleLogout} />
        <p className="loading-message">Cargando catálogos...</p>
      </div>
    );
  }

  // Telegram WebView maneja de forma inconsistente los portales superpuestos.
  // La inspección es una pantalla propia para que no dependa del stacking del chat.
  if (inspectionOpen && inspection?.required) {
    return (
      <div className="app-shell">
        <TopBar conductor={authenticatedDriver} onLogout={handleLogout} />
        <main className="inspection-page">
          <InspeccionVehicular
            context={inspection.context}
            estado={inspection.inspection?.estado}
            onSubmit={submitInspection}
            saving={inspectionSaving}
            onClose={() => setInspectionOpen(false)}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <TopBar conductor={authenticatedDriver} onLogout={handleLogout} />
      <main className="container">
        <PwaInstallPrompt />
        <OfflineBanner idViaje={createdTrip?.idViaje} />
        <h1>
        {createdTrip
        ? "GERENCIAMIENTO DE VIAJE"
        : activeTabMode === "gerenciamiento"
          ? "GERENCIAMIENTO DE VIAJES"
          : "Nuevo viaje"}
      </h1>

      {/* Tabs Selector de Modo de Viaje */}
      {!createdTrip && (
        <div style={{ display: "flex", gap: "8px", marginBottom: "14px", background: "#e2e8f0", padding: "4px", borderRadius: "10px" }}>
          <button
            type="button"
            onClick={() => setActiveTabMode("urban")}
            style={{
              flex: 1,
              padding: "10px 8px",
              borderRadius: "8px",
              border: 0,
              fontWeight: "bold",
              fontSize: "0.88rem",
              background: activeTabMode === "urban" ? "#ffffff" : "transparent",
              color: activeTabMode === "urban" ? "#0f172a" : "#64748b",
              boxShadow: activeTabMode === "urban" ? "0 2px 6px rgba(0,0,0,0.1)" : "none",
              cursor: "pointer"
            }}
          >
            🚗 Viaje Urbano / Local
          </button>
          <button
            type="button"
            onClick={() => setActiveTabMode("gerenciamiento")}
            style={{
              flex: 1,
              padding: "10px 8px",
              borderRadius: "8px",
              border: 0,
              fontWeight: "bold",
              fontSize: "0.88rem",
              background: activeTabMode === "gerenciamiento" ? "linear-gradient(135deg, #1e3a8a, #0284c7)" : "transparent",
              color: activeTabMode === "gerenciamiento" ? "#ffffff" : "#64748b",
              boxShadow: activeTabMode === "gerenciamiento" ? "0 2px 6px rgba(0,0,0,0.15)" : "none",
              cursor: "pointer"
            }}
          >
            🗺️ Gerenciamiento Fuera de Ciudad
          </button>
        </div>
      )}

      <section className="summary-card" aria-label="Fecha actual">
        <span>Fecha actual</span>
        <strong>{currentDate}</strong>
      </section>

      <section className="information-panel">
          <p>
            <strong>Usuario Telegram:</strong>{" "}
            {telegramAuth.usuario?.firstName || "Usuario autenticado"}
          </p>

          <p>
            <strong>Registro:</strong>{" "}
            {telegramAuth.registered
              ? "COMPLETO"
              : telegramAuth.estadoRegistro || "PENDIENTE"}
          </p>

          {telegramAuth.conductor && (
            <p>
              <strong>Conductor:</strong>{" "}
              {telegramAuth.conductor.nombre}
            </p>
          )}
      </section>

      {!createdTrip && !gerenciamientoPendiente && activeTabMode === "gerenciamiento" && (
        <GerenciamientoForm
          telegramAuth={telegramAuth}
          conductores={conductores}
          vehiculos={vehiculos}
          lugares={lugares}
          onCancel={() => setActiveTabMode("urban")}
          onComplete={(gerenData) => {
            setActiveTabMode("urban");
            setGerenciamientoPendiente(gerenData);
            if (gerenData?.id_viaje) {
              setCreatedTrip({
                id_viajes: gerenData.id_viaje,
                idViaje: gerenData.id_viaje,
                folio: gerenData.folio_documento || `GEREN-${gerenData.id_gerenciamiento}`,
                conductor: telegramAuth?.conductor?.nombre || "Conductor",
                vehiculo: gerenData.tipo_vehiculo || "Vehículo",
                numeroEconomico: gerenData.numero_unidad || "N/A",
                kilometrajeInicial: gerenData.kilometraje || 0,
                estado: "PENDIENTE_APROBACION"
              });
            }
            setMessage("✅ Gerenciamiento de Viaje registrado exitosamente. En espera de aprobación por supervisión.");
            setMessageType("success");
          }}
        />
      )}

      {!createdTrip && activeTabMode === "urban" && (
        <>
          {isOutsideOperatingHours() && (
            <div style={{ background: "#fff7ed", border: "1.5px solid #fdba74", color: "#c2410c", padding: "12px 14px", borderRadius: "10px", marginBottom: "14px", fontSize: "0.88rem" }}>
              <strong>⚠️ Fuera de Horario Operativo Urbano (6:30 AM - 6:00 PM)</strong>
              <p style={{ margin: "4px 0 8px 0", fontSize: "0.82rem", color: "#475569" }}>
                Los viajes locales solo pueden registrarse de 6:30 AM a 6:00 PM. Después de este horario se debe realizar un Gerenciamiento de Viaje.
              </p>
              <button
                type="button"
                onClick={() => setActiveTabMode("gerenciamiento")}
                style={{ background: "#ea580c", color: "#ffffff", border: 0, padding: "8px 16px", borderRadius: "6px", fontWeight: "bold", cursor: "pointer", fontSize: "0.82rem" }}
              >
                🗺️ Ir a Gerenciamiento de Viajes
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit}>
          <section className="information-panel" aria-label="Conductor autenticado">
            <p><strong>Conductor:</strong> {telegramAuth.conductor.nombre}</p>
            <p><strong>Licencia:</strong>{" "}
              <span className={telegramAuth.conductor.licencia_vigente ? "status-valid" : "status-invalid"}>
                {telegramAuth.conductor.licencia_vigente ? "Vigente" : "No vigente"}
              </span>
            </p>
          </section>

        {selectedDriver && (
          <section className="information-panel" aria-label="Información de licencia">
            <p><strong>Número de licencia:</strong> {selectedDriver.licencia_numero || "No registrado"}</p>
            <p>
              <strong>Estado:</strong>{" "}
              <span className={selectedDriver.licencia_vigente ? "status-valid" : "status-invalid"}>
                {selectedDriver.licencia_vigente ? "Vigente" : "No vigente"}
              </span>
            </p>
            <p>
              <strong>Vencimiento:</strong>{" "}
              {formatDate(
                selectedDriver.licencia_vencimiento ??
                selectedDriver.licenciaVencimiento
              )}
            </p>
            {!selectedDriver.licencia_vigente && (
              <p className="validation-error" role="alert">
                Este conductor no puede iniciar un viaje porque su licencia no está vigente.
              </p>
            )}
          </section>
        )}

        {(() => {
          const driverId = telegramAuth?.conductor?.id_conductores;
          const authAssignedId = telegramAuth?.conductor?.id_vehiculo_asignado;
          const assignedVehicle = vehiculos.find(
            (v) => (driverId && String(v.id_conductor_asignado) === String(driverId)) ||
                   (authAssignedId && String(v.id_vehiculos) === String(authAssignedId))
          );
          return (
            <>
              {assignedVehicle && (
                <div style={{ backgroundColor: "#e0f2fe", color: "#0369a1", padding: "10px 14px", borderRadius: "8px", border: "1px solid #bae6fd", marginBottom: "12px", fontSize: "0.9rem", fontWeight: "bold" }}>
                  📌 Unidad pre-asignada por tu supervisor: {assignedVehicle.nombre} ({assignedVehicle.numero_economico})
                </div>
              )}

              <label>
                Unidad
                <select name="idVehiculo" value={form.idVehiculo} onChange={handleChange} required>
                  <option value="">Seleccione una unidad</option>
                  {vehiculos.map((vehiculo) => (
                    <option key={vehiculo.id_vehiculos} value={vehiculo.id_vehiculos}>
                      {vehiculo.nombre} — {vehiculo.numero_economico} {String(vehiculo.id_vehiculos) === String(assignedVehicle?.id_vehiculos) ? " (Asignada por supervisor)" : ""}
                    </option>
                  ))}
                </select>
              </label>
            </>
          );
        })()}

        {selectedVehicle && (
          <section className="information-panel" aria-label="Información del vehículo">
            <p><strong>Unidad:</strong> {selectedVehicle.nombre}</p>
            <p><strong>Número económico:</strong> {selectedVehicle.numero_economico}</p>
            <p><strong>Placas:</strong> {selectedVehicle.placas || "No registradas"}</p>
            <p><strong>Kilometraje registrado:</strong> {Number(selectedVehicle.kilometraje_actual).toLocaleString("es-MX")} km</p>
          </section>
        )}

        <label>
          Kilometraje inicial
          <input
            type="number"
            name="kilometrajeInicial"
            value={form.kilometrajeInicial}
            onChange={handleChange}
            min={selectedVehicle?.kilometraje_actual ?? 0}
            step="1"
            required
          />
          <small>Confirma el kilometraje mostrado en el odómetro.</small>
        </label>

        <label>
          Origen
          <select name="idOrigen" value={form.idOrigen} onChange={handleChange} required>
            <option value="">Seleccione el origen</option>
            {lugares.map((lugar) => (
              <option
                key={lugar.id_lugares}
                value={lugar.id_lugares}
                disabled={String(lugar.id_lugares) === form.idDestino}
              >
                {lugar.nombre}
              </option>
            ))}
          </select>
        </label>

        <label>
          Destino
          <select name="idDestino" value={form.idDestino} onChange={handleChange} required>
            <option value="">Seleccione el destino</option>
            {lugares.map((lugar) => (
              <option
                key={lugar.id_lugares}
                value={lugar.id_lugares}
                disabled={String(lugar.id_lugares) === form.idOrigen}
              >
                {lugar.nombre}
              </option>
            ))}
            <option value="NUEVO_DESTINO">➕ Agregar nuevo destino...</option>
          </select>
          <div style={{ marginTop: "4px", textAlign: "right" }}>
            <button
              type="button"
              className="btn-link"
              onClick={() => setShowAddDestinoModal(true)}
              style={{
                background: "none",
                border: "none",
                color: "#2e81ab",
                fontSize: "0.84rem",
                fontWeight: "700",
                cursor: "pointer",
                padding: "2px 0",
                textDecoration: "underline"
              }}
            >
              ➕ ¿No encuentras tu destino? Agrégalo aquí
            </button>
          </div>
        </label>

        {(() => {
          const selectedVehicle = vehiculos.find((v) => String(v.id_vehiculos) === String(form.idVehiculo));
          const vehicleTypeStr = String(selectedVehicle?.tipo_vehiculo || selectedVehicle?.nombre || "").toLowerCase();

          let maxAcompanantes = 4;
          if (vehicleTypeStr.includes("maquinaria") || vehicleTypeStr.includes("retro") || vehicleTypeStr.includes("remolque") || vehicleTypeStr.includes("mecanica") || vehicleTypeStr.includes("tractor")) {
            maxAcompanantes = 1;
          } else if (vehicleTypeStr.includes("auto") || vehicleTypeStr.includes("sedan") || vehicleTypeStr.includes("hatchback") || vehicleTypeStr.includes("automovil")) {
            maxAcompanantes = 3;
          } else if (vehicleTypeStr.includes("camioneta") || vehicleTypeStr.includes("pickup") || vehicleTypeStr.includes("suv") || vehicleTypeStr.includes("van")) {
            maxAcompanantes = 4;
          }

          const updateFormAcompanantes = (newList) => {
            const joinedStr = newList.filter((s) => s.trim() !== "").join(", ");
            setForm((cur) => ({ ...cur, acompanantes: joinedStr }));
          };

          const handleCompanionChange = (index, value) => {
            const newList = [...listaAcompanantes];
            newList[index] = value;
            setListaAcompanantes(newList);
            updateFormAcompanantes(newList);
          };

          const addCompanionField = () => {
            if (listaAcompanantes.length < maxAcompanantes) {
              const newList = [...listaAcompanantes, ""];
              setListaAcompanantes(newList);
              updateFormAcompanantes(newList);
            }
          };

          const removeCompanionField = (index) => {
            const newList = listaAcompanantes.filter((_, i) => i !== index);
            const finalList = newList.length === 0 ? [""] : newList;
            setListaAcompanantes(finalList);
            updateFormAcompanantes(finalList);
          };

          const toggleViajaAcompanado = () => {
            setForm((current) => {
              const nextState = !current.viajaAcompanado;
              if (!nextState) {
                setListaAcompanantes([""]);
                return { ...current, viajaAcompanado: false, acompanantes: "" };
              }
              return { ...current, viajaAcompanado: true };
            });
          };

          return (
            <div className="companions-container">
              <div className="companions-header">
                <div className="companions-title-group">
                  <span>Acompañantes</span>
                  {form.viajaAcompanado && (
                    <span className="companions-count-badge">
                      {listaAcompanantes.filter((s) => s.trim() !== "").length} / {maxAcompanantes} máx.
                    </span>
                  )}
                </div>
                <div className="companions-controls">
                  {form.viajaAcompanado && (
                    <button
                      type="button"
                      className="add-companion-btn"
                      onClick={addCompanionField}
                      disabled={listaAcompanantes.length >= maxAcompanantes}
                      title={listaAcompanantes.length >= maxAcompanantes ? `Límite de ${maxAcompanantes} alcanzado` : "Agregar acompañante"}
                    >
                      + Agregar
                    </button>
                  )}
                  <button
                    type="button"
                    className={`companions-toggle ${form.viajaAcompanado ? "companions-toggle-active" : ""}`}
                    role="switch"
                    aria-checked={form.viajaAcompanado}
                    onClick={toggleViajaAcompanado}
                  >
                    <span className="companions-toggle-track" aria-hidden="true">
                      <span className="companions-toggle-thumb" />
                    </span>
                  </button>
                </div>
              </div>

              {form.viajaAcompanado && (
                <div className="companions-inputs-wrapper">
                  <small className="companions-rule-hint">
                    {maxAcompanantes === 4 ? "Camioneta: Máximo 4 acompañantes." : maxAcompanantes === 3 ? "Auto: Máximo 3 acompañantes." : "Maquinaria: Máximo 1 acompañante."}
                  </small>
                  {listaAcompanantes.map((nombre, index) => (
                    <div key={index} className="companion-row">
                      <input
                        type="text"
                        value={nombre}
                        onChange={(e) => handleCompanionChange(index, e.target.value)}
                        placeholder={`Nombre del acompañante ${index + 1}`}
                        required={index === 0}
                      />
                      {listaAcompanantes.length > 1 && (
                        <button
                          type="button"
                          className="remove-companion-btn"
                          onClick={() => removeCompanionField(index)}
                          title="Quitar acompañante"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        <label>
          Motivo de movilización
          <textarea name="motivo" value={form.motivo} onChange={handleChange} required />
        </label>

        <button type="submit" disabled={saving || !selectedDriver?.licencia_vigente}>
          {saving ? "Guardando..." : "Crear viaje"}
        </button>
        </form>
        </>
      )}

     

      {message && (
        <p className={`message message-${messageType}`} role={messageType === "error" ? "alert" : "status"} aria-live="polite">
          {message}
        </p>
      )}

{gerenciamientoPendiente && (
  <section className="result-card" style={{ background: "#fff7ed", border: "1.5px solid #fdba74", marginBottom: "16px" }}>
    <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
      <span style={{ fontSize: "2rem" }}>⏳</span>
      <div>
        <h2 style={{ margin: 0, color: "#c2410c", fontSize: "1.15rem" }}>
          GERENCIAMIENTO PENDIENTE DE APROBACIÓN
        </h2>
        <p style={{ margin: "2px 0 0", fontSize: "0.85rem", color: "#475569" }}>
          Folio Documento: <strong>{gerenciamientoPendiente.folio_documento || "SII-MX-23-LOG-003"}</strong>
        </p>
      </div>
    </div>

    <div style={{ background: "#ffffff", padding: "14px", borderRadius: "8px", border: "1px solid #fed7aa", fontSize: "0.88rem", display: "grid", gap: "6px", marginBottom: "12px" }}>
      <div><strong>Conductor:</strong> {telegramAuth?.conductor?.nombre || "Conductor"}</div>
      <div><strong>Evaluación de Riesgo:</strong> <span style={{ padding: "3px 10px", borderRadius: "10px", background: gerenciamientoPendiente.nivel_riesgo === "ALTO" ? "#fee2e2" : gerenciamientoPendiente.nivel_riesgo === "MEDIO" ? "#fef9c3" : "#dcfce7", color: gerenciamientoPendiente.nivel_riesgo === "ALTO" ? "#991b1b" : gerenciamientoPendiente.nivel_riesgo === "MEDIO" ? "#854d0e" : "#166534", fontWeight: "bold" }}>RIESGO {gerenciamientoPendiente.nivel_riesgo || "EVALUADO"}</span></div>
      <div><strong>Autorización Requerida:</strong> <strong>{gerenciamientoPendiente.autorizacion_requerida || "SUPERVISIÓN / QHSE"}</strong></div>
      <div><strong>Estado Actual:</strong> <span style={{ padding: "3px 10px", borderRadius: "10px", background: "#ea580c", color: "#ffffff", fontWeight: "bold" }}>PENDIENTE DE APROBACIÓN POR SUPERVISOR</span></div>
    </div>

    <div style={{ background: "#eff6ff", padding: "10px 12px", borderRadius: "8px", border: "1px solid #bfdbfe", fontSize: "0.83rem", color: "#1e40af" }}>
      📲 <strong>Notificación Enviada:</strong> Se envió la alerta automática al grupo de supervisores en Telegram. Tan pronto como autoricen tu Gerenciamiento e Inspección Vehicular, podrás iniciar el recorrido.
    </div>
  </section>
)}

{createdTrip && (
  <section className="result-card">
    <h2>
      {finishedTrip
      ? "Viaje finalizado"
      : cancelledTrip
        ? "Viaje cancelado"
      :startedTrip
        ? "Viaje en curso"
        : "Viaje registrado"}
    </h2>

    <p>
      <strong>Folio:</strong>{" "}
      {createdTrip.folio}
    </p>

    <p>
      <strong>Conductor:</strong>{" "}
      {startedTrip?.conductor ??
        createdTrip.conductor}
    </p>

    <p>
      <strong>Unidad:</strong>{" "}
      {startedTrip?.vehiculo ??
        createdTrip.vehiculo}
    </p>

    <p>
      <strong>Número económico:</strong>{" "}
      {startedTrip?.numeroEconomico ??
        createdTrip.numeroEconomico}
    </p>

    <p>
      <strong>Kilometraje inicial:</strong>{" "}
      {Number(
          startedTrip?.kilometrajeInicial ??
          startedTrip?.kilometraje_inicial ??
          createdTrip.kilometrajeInicial ??
          createdTrip.kilometraje_inicial
      ).toLocaleString("es-MX")}{" "}
      km
    </p>

    <p>
      <strong>Estado:</strong>{" "}
      <span
        className={
          finishedTrip
          ? "status-finished"
          : cancelledTrip
            ? "status-cancelled"
          : startedTrip
            ? "status-in-progress"
            : "status-pending"
        }
      >
        {finishedTrip
        ? "FINALIZADO"
        : cancelledTrip
          ? "CANCELADO"
        : startedTrip
          ? "EN_CURSO"
          : "PENDIENTE"}
      </span>
    </p>

    {startedTrip?.horaSalida ? (
      <p>
        <strong>Hora de salida:</strong>{" "}
        {new Date(
          startedTrip.horaSalida
        ).toLocaleString("es-MX", {
          dateStyle: "medium",
          timeStyle: "medium"
        })}
      </p>
    ) : (
      <p>
        La hora de salida se registrará al
        iniciar el viaje.
      </p>
    )}

    {finishedTrip?.horaLlegada && (
      <p>
        <strong>Hora de llegada:</strong>{" "}
        {new Date(finishedTrip.horaLlegada).toLocaleString("es-MX", {
          dateStyle: "medium",
          timeStyle: "medium"
        })}
      </p>
    )}

    {finishedTrip?.kilometrosRecorridos !== undefined && (
      <p>
        <strong>Kilómetros recorridos:</strong>{" "}
        {Number(finishedTrip.kilometrosRecorridos).toLocaleString("es-MX")} km
      </p>
    )}

    {!startedTrip && !finishedTrip && !cancelledTrip && (
      inspectionStatus === "loading" || inspectionStatus === "idle" ? <button
        type="button"
        className="start-trip-button inspection-required-button"
        disabled
      >
        Validando inspección vehicular...
      </button> : inspectionStatus === "error" ? <div className="inspection-load-error" role="alert">
        <p>No se pudo cargar la inspección: {inspectionError}</p>
        <button
          type="button"
          className="inspection-secondary-button"
          onClick={() => loadInspection(createdTrip?.id_viajes ?? createdTrip?.idViaje)}
        >
          Reintentar inspección
        </button>
      </div> : inspection?.required ? <button
        type="button"
        className="start-trip-button inspection-required-button"
        onClick={() => setInspectionOpen(true)}
      >
        {inspection.inspection?.estado === "PENDIENTE_APROBACION" ? "Ver estado de inspección" : "Completar inspección vehicular"}
      </button> : <button
        type="button"
        className="start-trip-button"
        onClick={handleStartTrip}
        disabled={startingTrip}
      >
        {startingTrip
          ? "Iniciando viaje..."
          : "▶ Iniciar viaje"}
      </button>
    )}

    {!finishedTrip && !cancelledTrip && (
      <button
        type="button"
        className="cancel-trip-button"
        onClick={handleCancelTrip}
        disabled={cancellingTrip || startingTrip}
      >
        {cancellingTrip ? "Cancelando viaje..." : "Cancelar viaje"}
      </button>
    )}

    {startedTrip && !finishedTrip && !cancelledTrip && (
      <section className="gps-panel">
  <h3>Rastreo GPS</h3>

  <p><strong>Seguimiento GPS:</strong> {trackingInfo.active ? "Activo" : "Detenido"}</p>
  <p><strong>Estado:</strong> {trackingInfo.status || gpsStatus}</p>
  <p><strong>Última captura:</strong> {trackingInfo.lastCapture ? new Date(trackingInfo.lastCapture).toLocaleTimeString("es-MX") : "Aún no disponible"}</p>
  <p><strong>Latitud:</strong> {Number.isFinite(trackingInfo.latitude) ? trackingInfo.latitude.toFixed(6) : "Aún no disponible"}</p>
  <p><strong>Longitud:</strong> {Number.isFinite(trackingInfo.longitude) ? trackingInfo.longitude.toFixed(6) : "Aún no disponible"}</p>
  <p><strong>Pendientes:</strong> {trackingInfo.pending ?? 0}</p>
  <p><strong>Conexión:</strong> {trackingInfo.connection}</p>
  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", margin: "12px 0" }}>
    <button
      type="button"
      className="gps-button"
      onClick={() => syncPendingLocations(startedTrip.idViaje ?? startedTrip.id_viajes)}
    >
      Reintentar sincronización
    </button>

    <button
      type="button"
      className="primary-button"
      style={{ backgroundColor: "#dc2626", borderColor: "#b91c1c", color: "#ffffff", padding: "8px 14px", fontWeight: "bold" }}
      onClick={handleAddIntermediatePoint}
      disabled={savingIntermediatePoint}
    >
      {savingIntermediatePoint ? "Guardando punto..." : "📍 Añadir Punto Intermedio"}
    </button>
  </div>

  {/* Sitios de Reporte para viajes de Gerenciamiento en Curso */}
  {gerenciamientoDoc && gerenciamientoDoc.sitios_reporte && gerenciamientoDoc.sitios_reporte.length > 0 && (
    <div style={{ background: "#ffffff", padding: "14px", borderRadius: "8px", border: "1px solid #cbd5e1", margin: "14px 0" }}>
      <h4 style={{ margin: "0 0 10px", color: "#1e3a8a", fontSize: "0.95rem", borderBottom: "1px solid #e2e8f0", paddingBottom: "6px" }}>
        📌 Sitios de Reporte de la Ruta
      </h4>
      <div style={{ display: "grid", gap: "8px" }}>
        {gerenciamientoDoc.sitios_reporte.map((sitio, index) => (
          <div key={index} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f8fafc", padding: "8px 12px", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
            <div>
              <strong style={{ color: "#0f172a" }}>Punto {index + 1}:</strong> {sitio.punto}
            </div>
            {sitio.horaReportada ? (
              <span style={{ background: "#dcfce7", color: "#166534", padding: "4px 10px", borderRadius: "12px", fontSize: "0.82rem", fontWeight: "bold" }}>
                ✅ Reportado: {sitio.horaReportada}
              </span>
            ) : (
              <button
                type="button"
                onClick={async () => {
                  const nowStr = new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
                  try {
                    const updated = await registrarReporteHoraGerenciamiento(gerenciamientoDoc.id_gerenciamiento, { puntoIndex: index, horaReportada: nowStr });
                    setGerenciamientoDoc(updated.data);
                    setMessage(`Punto ${sitio.punto} reportado exitosamente a las ${nowStr}.`);
                    setMessageType("success");
                  } catch (err) {
                    setMessage(err.message || "Error al registrar reporte.");
                    setMessageType("error");
                  }
                }}
                style={{ background: "#0284c7", color: "#ffffff", border: 0, padding: "6px 12px", borderRadius: "6px", fontWeight: "bold", fontSize: "0.82rem", cursor: "pointer" }}
              >
                ⏱️ Marcar Hora ({new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })})
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )}
  <form className="finish-trip-form" onSubmit={handleFinishTrip}>
      <h3>Finalizar viaje</h3>

      <label>
        Kilometraje final

        <input
          type="number"
          value={kilometrajeFinal}
          onChange={(event) => {
            setKilometrajeFinal(event.target.value);
            setMessage("");
          }}
          min={
            Number(
              startedTrip.kilometrajeInicial ??
              startedTrip.kilometraje_inicial ??
              0
            ) + 1
          }
          step="1"
          required
        />
        <small>
          Captura el kilometraje actual del odómetro.
        </small>
      </label>
      <button
        type="submit"
        className="finish-trip-button"
        disabled={finishingTrip}
      >
        {finishingTrip ? "Finalizando viaje..." : "■ Finalizar viaje"}
      </button>
    </form>
  {lastLocation && (
    <div className="location-details">
      <p>
        <strong>Latitud:</strong>{" "}
        {Number(
          lastLocation.latitude
        ).toFixed(6)}
      </p>

      <p>
        <strong>Longitud:</strong>{" "}
        {Number(
          lastLocation.longitude
        ).toFixed(6)}
      </p>

      <p>
        <strong>Precisión:</strong>{" "}
        {lastLocation.accuracy !== null
          ? `${Math.round(
              Number(lastLocation.accuracy)
            )} metros`
          : "No disponible"}
      </p>

      <p>
        <strong>Último envío:</strong>{" "}
        {new Date(
          lastLocation.serverTimestamp
        ).toLocaleTimeString("es-MX")}
      </p>
    </div>
  )}
</section>
    )}

    {(finishedTrip || cancelledTrip) && (
      <div className="completed-trip-actions">
        <button
          type="button"
          className="new-trip-button"
          onClick={handleNewTrip}
        >
          Registrar otro viaje
        </button>
        <button
          type="button"
          className="exit-app-button"
          onClick={handleExitApp}
        >
          Salir
        </button>
      </div>
    )}
  </section>
)}
      {showAddDestinoModal && (
        <div className="modal-overlay" style={{ position: "fixed", inset: 0, zIndex: 10000, display: "grid", placeItems: "center", background: "rgba(8, 25, 34, 0.65)", backdropFilter: "blur(3px)", padding: "16px" }}>
          <div className="modal-card" style={{ width: "min(480px, 100%)", background: "#fff", borderRadius: "16px", padding: "24px", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
            <h2 style={{ margin: "0 0 8px", fontSize: "1.3rem", color: "#000000" }}>➕ Registrar Nuevo Destino</h2>
            <p style={{ margin: "0 0 18px", fontSize: "0.88rem", color: "#5b7b8a" }}>
              Escribe el nombre del nuevo destino si no aparece en el catálogo. Se seleccionará automáticamente para tu viaje.
            </p>

            <form onSubmit={handleSaveNewDestino} style={{ display: "grid", gap: "14px", padding: 0, border: "none", boxShadow: "none" }}>
              <label style={{ display: "grid", gap: "6px", fontWeight: "700" }}>
                Nombre del destino *
                <input
                  type="text"
                  placeholder="Ej. Pozo Akal-C, Planta Coatzacoalcos..."
                  value={newDestinoForm.nombre}
                  onChange={(e) => setNewDestinoForm((prev) => ({ ...prev, nombre: e.target.value }))}
                  required
                  autoFocus
                />
              </label>

              <label style={{ display: "grid", gap: "6px", fontWeight: "700" }}>
                Dirección / Referencia (Opcional)
                <input
                  type="text"
                  placeholder="Ej. Carretera Fed. KM 45"
                  value={newDestinoForm.direccion}
                  onChange={(e) => setNewDestinoForm((prev) => ({ ...prev, direccion: e.target.value }))}
                />
              </label>

              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "10px" }}>
                <button
                  type="button"
                  onClick={() => setShowAddDestinoModal(false)}
                  disabled={savingNewDestino}
                  style={{ padding: "10px 16px", borderRadius: "8px", background: "#f1f5f9", color: "#475569", border: "1px solid #cbd5e1", fontWeight: "700", cursor: "pointer", width: "auto" }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingNewDestino}
                  style={{ padding: "10px 18px", borderRadius: "8px", background: "var(--primary-gradient)", color: "#fff", border: 0, fontWeight: "800", cursor: "pointer", width: "auto" }}
                >
                  {savingNewDestino ? "Guardando..." : "Guardar y Seleccionar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </main>
    </div>
  );
}

export default App;
