import {
  useEffect,
  useRef,
  useState
} from "react";
import "./App.css";

import {
  autenticarTelegram,
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
} from "./services/api.js";
import RegistroConductor from "./pages/RegistroConductor.jsx";
import InspeccionVehicular from "./pages/InspeccionVehicular.jsx";
import {
  captureAndQueueLocation,
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
  const [form, setForm] = useState(initialForm);
  const [listaAcompanantes, setListaAcompanantes] = useState([""]);
  const [conductores, setConductores] = useState([]);
  const [vehiculos, setVehiculos] = useState([]);
  const [lugares, setLugares] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("error");
  const [createdTrip, setCreatedTrip] = useState(null);
  const [startingTrip, setStartingTrip] = useState(false);
  const [startedTrip, setStartedTrip] = useState(null);
  const savingRef = useRef(false);
  const startingTripRef = useRef(false);
  const geolocationWatchRef = useRef(null);
const lastLocationSentAtRef = useRef(0);
const sendingLocationRef = useRef(false);

  const [trackingGps, setTrackingGps] =
    useState(false);
  const [modalAlertMessage, setModalAlertMessage] = useState("");

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

  const [telegramAuth, setTelegramAuth] =
    useState(null);

  const [telegramAuthLoading, setTelegramAuthLoading] =
    useState(true);

  const [telegramAuthError, setTelegramAuthError] =
    useState("");

  const [telegramAuthAttempt, setTelegramAuthAttempt] =
    useState(0);

  const telegramAuthStartedRef = useRef(false);

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

  useEffect(() => {
    async function authenticateTelegramUser() {
      if (telegramAuthStartedRef.current) {
        return;
      }

      telegramAuthStartedRef.current = true;
      setTelegramAuthError("");

      try {
      const telegramWebApp =
        window.Telegram?.WebApp;

      if (!telegramWebApp) {
        setTelegramAuthError(
          "Esta aplicación debe abrirse desde el bot de Telegram."
        );
        return;
      }

      telegramWebApp.ready();
      telegramWebApp.expand();

      const initData =
        telegramWebApp.initData || "";

      if (!initData) {
        setTelegramAuthError(
          "No se recibió la información de autenticación de Telegram. Cierra esta ventana y vuelve a abrirla desde el botón del bot."
        );
        return;
      }

      const authenticationResponse =
        await autenticarTelegram(initData);

        setTelegramAuth(authenticationResponse.data);
      } catch (error) {

        setTelegramAuthError(
          error.message ||
          "No fue posible autenticar al usuario de Telegram."
        );
      } finally {
        telegramAuthStartedRef.current = false;
        setTelegramAuthLoading(false);
      }
    }

    authenticateTelegramUser();
  }, [telegramAuthAttempt]);

  function retryTelegramAuthentication() {
    if (telegramAuthLoading) {
      return;
    }

    setTelegramAuth(null);
    setTelegramAuthError("");
    setTelegramAuthLoading(true);
    setTelegramAuthAttempt((current) =>
      current + 1
    );
  }

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
  
  // nuevo use effect para poder usar si recargamos o perdemos conexión
  useEffect(() => {
  async function loadInitialData() {
    try {
      const [
        conductoresResponse,
        vehiculosResponse,
        lugaresResponse,
        activeTripResponse
      ] = await Promise.all([
        getConductores(),
        getVehiculos(),
        getLugares(),
        getViajeActivo()
      ]);

      setConductores(
        conductoresResponse.data ?? []
      );

      setVehiculos(
        vehiculosResponse.data ?? []
      );

      setLugares(
        lugaresResponse.data ?? []
      );

      const activeTrip =
        activeTripResponse.data;

      if (!activeTrip) {
        stopTracking();
        return;
      }

      const normalizedTrip = {
        idViaje:
          activeTrip.idViaje,

        id_viajes:
          activeTrip.idViaje,

        folio:
          activeTrip.folio,

        conductor:
          activeTrip.conductor?.nombre,

        vehiculo:
          activeTrip.vehiculo?.nombre,

        numeroEconomico:
          activeTrip.vehiculo
            ?.numeroEconomico,

        estado:
          activeTrip.estado,

        kilometrajeInicial:
          activeTrip.kilometrajeInicial,

        horaSalida:
          activeTrip.horaSalida,

        origen:
          activeTrip.origen?.nombre,

        destino:
          activeTrip.destino?.nombre
      };

      setCreatedTrip(normalizedTrip);

      if (
        activeTrip.estado === "EN_CURSO"
      ) {
        setStartedTrip(normalizedTrip);

        setKilometrajeFinal(
          String(
            activeTrip.kilometrajeInicial ??
            ""
          )
        );

        setLastLocation(
          activeTrip.ultimaUbicacion
        );

        if (activeTrip.ultimaUbicacion) {
          setTrackingInfo((current) => ({
            ...current,
            lastCapture: activeTrip.ultimaUbicacion.gpsTimestamp,
            latitude: Number(activeTrip.ultimaUbicacion.latitude),
            longitude: Number(activeTrip.ultimaUbicacion.longitude)
          }));
        }

        setGpsStatus("Reanudando seguimiento GPS...");
        await startTracking(activeTrip.idViaje);
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
      setMessage(error.message);
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  }

  loadInitialData();
}, []);

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

  async function handleSubmit(event) {
    event.preventDefault();

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

      setCreatedTrip({
        ...response.data,
        kilometrajeInicial:
          response.data.kilometrajeInicial ??
          response.data.kilometraje_inicial ??
          kilometrajeInicial
      });
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
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.close();
      return;
    }

    window.close();
  }

  if (telegramAuthLoading) {
    return <p className="loading-message">Validando identidad de Telegram...</p>;
  }

  if (telegramAuthError) {
    return (
      <main className="telegram-auth-error">
        <h1>No fue posible validar tu acceso</h1>

        <p>{telegramAuthError}</p>

        <button
          type="button"
          onClick={retryTelegramAuthentication}
        >
          Reintentar
        </button>
      </main>
    );
  }

  if (!telegramAuth?.authenticated) {
    return (
      <p className="loading-message">
        No fue posible validar tu acceso.
      </p>
    );
  }

  if (telegramAuth.estadoRegistro === "BLOQUEADO" || !telegramAuth.usuario?.activo) {
    return <p className="loading-message">Tu acceso está restringido.</p>;
  }

  if (!telegramAuth.registered || telegramAuth.estadoRegistro === "PENDIENTE" || !telegramAuth.conductor) {
    return (
      <RegistroConductor
        telegramAuth={telegramAuth}
        onRegistered={(registration) => {
          setTelegramAuth((current) => ({
            ...current,
            ...registration,
            usuario: {
              ...current.usuario,
              ...registration.usuario
            },
            registered: true,
            estadoRegistro: "COMPLETO",
            conductor: normalizeConductor(registration.conductor)
          }));
        }}
      />
    );
  }

  if (loading) {
    return <p className="loading-message">Cargando catálogos...</p>;
  }

  // Telegram WebView maneja de forma inconsistente los portales superpuestos.
  // La inspección es una pantalla propia para que no dependa del stacking del chat.
  if (inspectionOpen && inspection?.required) {
    return (
      <main className="inspection-page">
        <InspeccionVehicular
          context={inspection.context}
          estado={inspection.inspection?.estado}
          onSubmit={submitInspection}
          saving={inspectionSaving}
          onClose={() => setInspectionOpen(false)}
        />
      </main>
    );
  }

  return (
    <main className="container">
      <h1>
        {createdTrip
        ? "GERENCIAMIENTO DE VIAJE"
        : "Nuevo viaje"}
      </h1>

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

      {!createdTrip && (
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

        <label>
          Unidad
          <select name="idVehiculo" value={form.idVehiculo} onChange={handleChange} required>
            <option value="">Seleccione una unidad</option>
            {vehiculos.map((vehiculo) => (
              <option key={vehiculo.id_vehiculos} value={vehiculo.id_vehiculos}>
                {vehiculo.nombre} — {vehiculo.numero_economico}
              </option>
            ))}
          </select>
        </label>

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
      )}

     

      {message && (
        <p className={`message message-${messageType}`} role={messageType === "error" ? "alert" : "status"} aria-live="polite">
          {message}
        </p>
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
  <button
    type="button"
    className="gps-button"
    onClick={() => syncPendingLocations(startedTrip.idViaje ?? startedTrip.id_viajes)}
  >
    Reintentar sincronización
  </button>
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
  );
}

export default App;
