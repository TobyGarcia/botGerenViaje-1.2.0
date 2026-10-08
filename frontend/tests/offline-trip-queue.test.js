import test from "node:test";
import assert from "node:assert/strict";

const values = new Map();
globalThis.window = {
  location: { pathname: "/" },
  localStorage: {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
    clear: () => values.clear()
  }
};
Object.defineProperty(globalThis, "navigator", { value: { onLine: false }, configurable: true });

const {
  getOfflineTrip,
  getOfflineTrips,
  getPendingOfflineTrips,
  getSyncableOfflineTrips,
  hasUnfinishedOfflineTrip,
  saveOfflineTrip,
  storeServerMapping,
  resolveOfflineTripId
} = await import("../src/services/offline-trip-storage.js");
const { startOfflineTrip } = await import("../src/services/offline-trips.js");

function record({ clientId, localId, finishedAt = null, synced = false }) {
  return {
    clientId,
    localId,
    trip: { idConductor: 7, idVehiculo: 3, kilometrajeInicial: 100 },
    display: {},
    startedAt: "2026-10-07T15:00:00.000Z",
    finishedAt,
    synced
  };
}

test.beforeEach(() => values.clear());

test("migra el registro único anterior a una cola sin perderlo", () => {
  const previous = record({ clientId: "legacy", localId: -1, finishedAt: "2026-10-07T16:00:00.000Z" });
  window.localStorage.setItem("gv_offline_trip_v1:7", JSON.stringify(previous));
  assert.deepEqual(getOfflineTrips(7), [previous]);
  assert.equal(getOfflineTrip(7, -1)?.clientId, "legacy");
});

test("permite varios viajes finalizados pendientes y localiza cada uno", () => {
  const first = record({ clientId: "first", localId: -1, finishedAt: "2026-10-07T16:00:00.000Z" });
  const second = record({ clientId: "second", localId: -2, finishedAt: "2026-10-07T17:00:00.000Z" });
  saveOfflineTrip(first);
  saveOfflineTrip(second);
  assert.equal(getPendingOfflineTrips(7).length, 2);
  assert.equal(getOfflineTrip(7, -1)?.clientId, "first");
  assert.equal(getOfflineTrip(7, -2)?.clientId, "second");
  assert.equal(hasUnfinishedOfflineTrip(7), false);
});

test("solo bloquea un viaje nuevo cuando otro no ha finalizado", () => {
  const active = record({ clientId: "active", localId: -3 });
  saveOfflineTrip(active);
  assert.equal(hasUnfinishedOfflineTrip(7), true);
  saveOfflineTrip({ ...active, finishedAt: "2026-10-07T17:30:00.000Z" });
  assert.equal(hasUnfinishedOfflineTrip(7), false);
});

test("actualiza un viaje sin duplicarlo y conserva todos los pendientes", () => {
  const first = record({ clientId: "same", localId: -4 });
  saveOfflineTrip(first);
  saveOfflineTrip({ ...first, finishedAt: "2026-10-07T18:00:00.000Z", kilometrajeFinal: 120 });
  assert.equal(getOfflineTrips(7).length, 1);
  assert.equal(getOfflineTrip(7, -4)?.kilometrajeFinal, 120);
});

test("ordena la sincronización por la hora real de inicio", () => {
  saveOfflineTrip({ ...record({ clientId: "late", localId: -8, finishedAt: "2026-10-07T18:00:00.000Z" }), startedAt: "2026-10-07T17:00:00.000Z" });
  saveOfflineTrip({ ...record({ clientId: "early", localId: -7, finishedAt: "2026-10-07T16:00:00.000Z" }), startedAt: "2026-10-07T15:00:00.000Z" });
  assert.deepEqual(getSyncableOfflineTrips(7).map(item => item.localId), [-7, -8]);
});

test("mantiene un mapeo GPS independiente para cada viaje local", () => {
  window.localStorage.setItem("cached_driver", JSON.stringify({ id_conductores: 7 }));
  storeServerMapping(-10, 101, 7);
  storeServerMapping(-11, 102, 7);
  assert.equal(resolveOfflineTripId(-10), 101);
  assert.equal(resolveOfflineTripId(-11), 102);
});

test("no inicia un viaje local sin una primera ubicación GPS guardada", () => {
  const NativeDate = Date;
  const fixedNow = "2026-10-08T15:00:00.000Z";
  globalThis.Date = class extends NativeDate {
    constructor(value) { super(value === undefined ? fixedNow : value); }
    static now() { return +new NativeDate(fixedNow); }
  };
  const now = new Date();
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City",
    year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now).map(part => [part.type, part.value]));
  const local = {
    ...record({ clientId: "gps-required", localId: -20 }),
    startedAt: null,
    grant: { driverId: 7, vehicleId: 3, day: `${parts.year}-${parts.month}-${parts.day}`,
      issuedAt: new Date(now.getTime() - 60000).toISOString(), expiresAt: new Date(now.getTime() + 60000).toISOString() }
  };
  saveOfflineTrip(local);
  assert.throws(() => startOfflineTrip(7, -20), /primera ubicación GPS/);
  assert.equal(getOfflineTrip(7, -20).startedAt, null);

  const initialLocation = { clientLocationId: "123e4567-e89b-42d3-a456-426614174000", idViaje: -20,
    latitud: 19.4, longitud: -99.1, fechaGps: now.toISOString() };
  try {
    const started = startOfflineTrip(7, -20, initialLocation);
    assert.equal(started.estado, "EN_CURSO");
    assert.deepEqual(getOfflineTrip(7, -20).initialLocation, initialLocation);
  } finally {
    globalThis.Date = NativeDate;
  }
});
