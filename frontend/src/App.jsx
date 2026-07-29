import {
  useEffect,
  useRef,
  useState
} from "react";

import {
  autenticarTelegram,
  createViaje,
  finalizarViaje,
  getConductores,
  getLugares,
  getVehiculos,
  getViajeActivo,
  iniciarViaje,
  registrarUbicacion
} from "./services/api.js";
import RegistroConductor from "./components/RegistroConductor.jsx";

const initialForm = {
  idConductor: "",
  idVehiculo: "",
  idOrigen: "",
  idDestino: "",
  acompanantes: "",
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

const [gpsStatus, setGpsStatus] =
  useState("GPS detenido.");

const [lastLocation, setLastLocation] =
  useState(null);

const LOCATION_INTERVAL_MS = 15000;

const [kilometrajeFinal, setKilometrajeFinal] =
  useState("");

const [finishingTrip, setFinishingTrip] =
  useState(false);

const [finishedTrip, setFinishedTrip] =
  useState(null);

  const [telegramAuth, setTelegramAuth] =
    useState(null);

  const [telegramAuthLoading, setTelegramAuthLoading] =
    useState(true);

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

      try {
      const telegramWebApp =
        window.Telegram?.WebApp;

      if (!telegramWebApp) {
        setMessage(
          "Esta aplicación debe abrirse desde el bot de Telegram."
        );
        setMessageType("error");
        return;
      }

      telegramWebApp.ready();
      telegramWebApp.expand();

      const initData =
        telegramWebApp.initData || "";

      if (!initData) {
        setMessage(
          "No se recibió la información de autenticación de Telegram. Cierra esta ventana y vuelve a abrirla desde el botón del bot."
        );
        setMessageType("error");
        return;
      }

      const authenticationResponse =
        await autenticarTelegram(initData);

        setTelegramAuth(authenticationResponse.data);
      } catch (error) {

        setMessage(
          error.message ||
          "No fue posible autenticar al usuario de Telegram."
        );

        setMessageType("error");
      } finally {
        setTelegramAuthLoading(false);
      }
    }

    authenticateTelegramUser();
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

        setGpsStatus(
          activeTrip.ultimaUbicacion
            ? "Viaje recuperado. El GPS está detenido; puedes reiniciarlo."
            : "Viaje recuperado. GPS detenido."
        );
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
  return () => {
    if (
      geolocationWatchRef.current !== null
    ) {
      navigator.geolocation.clearWatch(
        geolocationWatchRef.current
      );
    }
  };
}, []);

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

  if (!navigator.geolocation) {
    setGpsStatus(
      "Este dispositivo no admite geolocalización."
    );
    return;
  }

  if (
    geolocationWatchRef.current !== null
  ) {
    navigator.geolocation.clearWatch(
      geolocationWatchRef.current
    );
  }

  setGpsStatus(
    "Solicitando permiso de ubicación..."
  );

  lastLocationSentAtRef.current=0;

  const watchId =
    navigator.geolocation.watchPosition(
      (position) => {
        setTrackingGps(true);

        setGpsStatus(
          "GPS activo. Enviando ubicación..."
        );

        sendPosition(idViaje, position);
      },

      (error) => {
        setTrackingGps(false);

        const messages = {
          1: "El permiso de ubicación fue rechazado.",
          2: "La ubicación no está disponible.",
          3: "Se agotó el tiempo para obtener la ubicación."
        };

        setGpsStatus(
          messages[error.code] ||
          "No fue posible obtener la ubicación."
        );
      },

      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 5000
      }
    );

  geolocationWatchRef.current = watchId;
}
function handleStopGps() {
  if (
    geolocationWatchRef.current !== null
  ) {
    navigator.geolocation.clearWatch(
      geolocationWatchRef.current
    );

    geolocationWatchRef.current = null;
  }

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

    if (!Number.isInteger(finalMileage) || finalMileage < initialMileage) {
    setMessage(
      "El kilometraje final no puede ser menor al kilometraje inicial."
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
      handleStopGps();

    const response = await finalizarViaje (
      idViaje,
      finalMileage
    );
    const finishedData =
      response.data ?? {};

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
    } catch (error) {
      setMessage(error.message);
      setMessageType("error");
    } finally {
      setFinishingTrip(false);
    }
  }

  function handleChange(event) {
    const { name, value } = event.target;

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
      setMessage(error.message);
      setMessageType("error");
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
      
    } catch (error) {
      setMessage(error.message);
      setMessageType("error");
    } finally {
      startingTripRef.current = false;
      setStartingTrip(false);
    }
  }

  function handleNewTrip(){
    handleStopGps();

    setForm({
      ...initialForm,
      idConductor: telegramAuth?.conductor?.id_conductores
        ? String(telegramAuth.conductor.id_conductores)
        : ""
    });
    setCreatedTrip(null);
    setStartedTrip(null);
    setFinishedTrip(null);
    setKilometrajeFinal("");
    setLastLocation(null);
    setGpsStatus("GPS detenido.");
    setMessage("");
    setMessageType("error");

    lastLocationSentAtRef.current = 0;
    sendingLocationRef.current=false;
  }

  if (telegramAuthLoading) {
    return <p className="loading-message">Validando identidad de Telegram...</p>;
  }

  if (!telegramAuth?.authenticated) {
    return <p className="loading-message">Acceso no autorizado.</p>;
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
          </select>
        </label>

        <label>
          Acompañantes
          <input
            type="text"
            name="acompanantes"
            value={form.acompanantes}
            onChange={handleChange}
            placeholder="Juan Pérez, María López"
          />
        </label>

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
          : startedTrip
            ? "status-in-progress"
            : "status-pending"
        }
      >
        {finishedTrip
        ? "FINALIZADO"
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

    {!startedTrip && !finishedTrip && (
      <button
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

    {startedTrip && !finishedTrip && (
      <section className="gps-panel">
  <h3>Rastreo GPS</h3>

  <p>{gpsStatus}</p>

  {!trackingGps ? (
    <button
      type="button"
      className="gps-button"
      onClick={handleStartGps}
    >
      📍 Iniciar rastreo GPS
    </button>
  ) : (
    <button
      type="button"
      className="stop-gps-button"
      onClick={handleStopGps}
    >
      Detener rastreo GPS
    </button>
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
            startedTrip.kilometrajeInicial ??
            startedTrip.kilometraje_inicial ??
            0
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

    {finishedTrip && (
      <button
        type="button"
        className="new-trip-button"
        onClick={handleNewTrip}
      >
        Registrar otro viaje
      </button>
    )}
  </section>
)}
    </main>
  );
}

export default App;
