import { useEffect, useState } from "react";

import {
  createViaje,
  getConductores,
  getLugares,
  getVehiculos
} from "./services/api.js";

const initialForm = {
  idConductor: "",
  idVehiculo: "",
  idOrigen: "",
  idDestino: "",
  acompanantes: "",
  kilometrajeInicial: "",
  motivo: ""
};

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

  const selectedDriver = conductores.find(
    (conductor) => String(conductor.id_conductores) === form.idConductor
  );
  const selectedVehicle = vehiculos.find(
    (vehiculo) => String(vehiculo.id_vehiculos) === form.idVehiculo
  );
  const currentDate = new Intl.DateTimeFormat("es-MX", {
    dateStyle: "long"
  }).format(new Date());

  useEffect(() => {
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
  }, []);

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

    setSaving(true);
    setMessage("");

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

      setCreatedTrip(response.data);
      setMessage(`Viaje creado correctamente. Folio: ${response.data.folio}`);
      setMessageType("success");
      setForm(initialForm);
    } catch (error) {
      setMessage(error.message);
      setMessageType("error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="loading-message">Cargando catálogos...</p>;
  }

  return (
    <main className="container">
      <h1>Nuevo viaje</h1>

      <section className="summary-card" aria-label="Fecha actual">
        <span>Fecha actual</span>
        <strong>{currentDate}</strong>
      </section>

      <form onSubmit={handleSubmit}>
        <label>
          Conductor
          <select
            name="idConductor"
            value={form.idConductor}
            onChange={handleChange}
            required
          >
            <option value="">Seleccione un conductor</option>
            {conductores.map((conductor) => (
              <option key={conductor.id_conductores} value={conductor.id_conductores}>
                {conductor.nombre}
              </option>
            ))}
          </select>
        </label>

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
              {selectedDriver.licencia_vencimiento
                ? new Date(`${selectedDriver.licencia_vencimiento}T00:00:00`).toLocaleDateString("es-MX")
                : "No registrado"}
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

      {message && (
        <p className={`message message-${messageType}`} role={messageType === "error" ? "alert" : "status"} aria-live="polite">
          {message}
        </p>
      )}

      {createdTrip && (
        <section className="result-card" aria-labelledby="viaje-registrado-title">
          <h2 id="viaje-registrado-title">Viaje registrado</h2>
          <p><strong>Folio:</strong> {createdTrip.folio}</p>
          <p><strong>Conductor:</strong> {createdTrip.conductor}</p>
          <p><strong>Unidad:</strong> {createdTrip.vehiculo}</p>
          <p><strong>Número económico:</strong> {createdTrip.numeroEconomico}</p>
          <p><strong>Estado:</strong> PENDIENTE</p>
        </section>
      )}
    </main>
  );
}

export default App;
