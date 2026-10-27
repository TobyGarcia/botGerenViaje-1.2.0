import test from "node:test";
import assert from "node:assert/strict";
import { offlineTripNotice } from "../src/services/offline-trip-notice.js";
const active = { localId: -1, startedAt: "2026-10-27T19:16:34Z", synced: false,
  serverTrip: { idViaje: 11, folio: "VJ-20261027-0010", estado: "EN_CURSO" } };

test("un inicio ya sincronizado no anuncia un cierre inexistente ni conserva la tarjeta", () => {
  assert.equal(offlineTripNotice([active]), "");
  assert.equal(offlineTripNotice([active], "No se pudo renovar el permiso"), "");
  assert.equal(offlineTripNotice([]), "");
  assert.equal(offlineTripNotice([{ localId: -1 }]), "");
});
test("solo informa cierre cuando el viaje realmente terminó en el teléfono", () => {
  assert.match(offlineTripNotice([{ ...active, serverTrip: null }]), /Inicio de viaje/);
  const finished = { ...active, finishedAt: "2026-10-27T20:00:00Z" };
  assert.match(offlineTripNotice([finished]), /Cierre pendiente/);
  const gpsOnly = { ...finished, serverTrip: { ...active.serverTrip, estado: "FINALIZADO" } };
  assert.match(offlineTripNotice([gpsOnly]), /ubicaciones/);
  assert.equal(offlineTripNotice([{ ...gpsOnly, synced: true }]), "");
});
test("no oculta otros viajes pendientes cuando el viaje seleccionado ya está sincronizado", () => {
  const message = offlineTripNotice([active, { ...active, localId: -2, serverTrip: null }]);
  assert.match(message, /Inicio de viaje/);assert.doesNotMatch(message, /Cierre/);
});
