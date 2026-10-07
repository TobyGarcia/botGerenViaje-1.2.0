import test from "node:test";
import assert from "node:assert/strict";
import { isExpiredNeverStartedPendingTrip, isSamePendingTripRequest } from "../services/viajes.service.js";

const request = {
  idVehiculo: 9,
  idOrigen: 2,
  idDestino: 3,
  kilometrajeInicial: 69506,
  motivo: "Traslado operativo",
  acompanantes: [{ nombre: "Acompañante" }]
};

test("reconoce un reintento idéntico de un viaje pendiente", () => {
  assert.equal(isSamePendingTripRequest({
    estado: "PENDIENTE",
    id_vehiculos: 9,
    id_origen: 2,
    id_destino: 3,
    kilometraje_inicial: 69506,
    motivo: "Traslado operativo",
    acompanantes: [{ nombre: "Acompañante" }]
  }, request), true);
});

test("no reutiliza un viaje en curso ni una solicitud diferente", () => {
  assert.equal(isSamePendingTripRequest({
    estado: "EN_CURSO",
    id_vehiculos: 9,
    id_origen: 2,
    id_destino: 3,
    kilometraje_inicial: 69506,
    motivo: "Traslado operativo",
    acompanantes: [{ nombre: "Acompañante" }]
  }, request), false);
  assert.equal(isSamePendingTripRequest({
    estado: "PENDIENTE",
    id_vehiculos: 9,
    id_origen: 2,
    id_destino: 4,
    kilometraje_inicial: 69506,
    motivo: "Traslado operativo",
    acompanantes: [{ nombre: "Acompañante" }]
  }, request), false);
});

test("solo vence un viaje pendiente de un día anterior que nunca inició", () => {
  const currentDay = "2026-10-07";
  assert.equal(isExpiredNeverStartedPendingTrip({
    estado: "PENDIENTE", fecha: "2026-10-06", hora_salida: null
  }, currentDay), true);
  assert.equal(isExpiredNeverStartedPendingTrip({
    estado: "PENDIENTE", fecha: currentDay, hora_salida: null
  }, currentDay), false);
  assert.equal(isExpiredNeverStartedPendingTrip({
    estado: "EN_CURSO", fecha: "2026-10-06", hora_salida: "2026-10-06T12:00:00"
  }, currentDay), false);
  assert.equal(isExpiredNeverStartedPendingTrip({
    estado: "PENDIENTE", fecha: "2026-10-06", hora_salida: "2026-10-06T12:00:00"
  }, currentDay), false);
});
