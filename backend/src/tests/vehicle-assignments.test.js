import test from "node:test";
import assert from "node:assert/strict";
import { ensureVehicleAssignment } from "../services/vehicle-assignments.service.js";

function clientWith(handler) {
  return { query: async (sql, params = []) => handler(String(sql), params) };
}

test("acepta la unidad permanente sin crear asignación temporal", async () => {
  let inserts = 0;
  const client = clientWith((sql) => {
    if (sql.includes("FROM vehiculos")) return { rows: [{ id_vehiculos: 5, id_conductor_asignado: 7 }] };
    if (sql.includes("INSERT INTO")) inserts += 1;
    return { rows: [], rowCount: 0 };
  });
  const result = await ensureVehicleAssignment({ client, idConductor: 7, idVehiculo: 5, operationalDate: "2026-10-07" });
  assert.equal(result.type, "PERMANENTE");
  assert.equal(inserts, 0);
});

test("reutiliza una asignación temporal vigente", async () => {
  const client = clientWith((sql) => {
    if (sql.includes("FROM vehiculos")) return { rows: [{ id_vehiculos: 5, id_conductor_asignado: 20 }] };
    if (sql.includes("FROM asignaciones_temporales_vehiculo")) return { rows: [{ id_asignacion_temporal: 91 }], rowCount: 1 };
    throw new Error("No debía crear otra asignación");
  });
  const result = await ensureVehicleAssignment({ client, idConductor: 7, idVehiculo: 5, operationalDate: "2026-10-07" });
  assert.deepEqual(result, { type: "TEMPORAL", idAssignment: 91 });
});

test("crea la opción solo hoy usando la fecha operativa", async () => {
  let insertParams;
  const client = clientWith((sql, params) => {
    if (sql.includes("FROM vehiculos")) return { rows: [{ id_vehiculos: 5, id_conductor_asignado: null }] };
    if (sql.includes("SELECT id_asignacion_temporal")) return { rows: [], rowCount: 0 };
    if (sql.includes("pg_advisory_xact_lock")) return { rows: [], rowCount: 1 };
    if (sql.includes("FROM viajes v")) return { rows: [], rowCount: 0 };
    if (sql.includes("UPDATE asignaciones_temporales")) return { rows: [], rowCount: 0 };
    if (sql.includes("SELECT 1 FROM asignaciones")) return { rows: [], rowCount: 0 };
    if (sql.includes("INSERT INTO asignaciones")) { insertParams = params; return { rows: [{ id_asignacion_temporal: 92 }], rowCount: 1 }; }
    throw new Error(`Consulta inesperada: ${sql}`);
  });
  const result = await ensureVehicleAssignment({ client, idConductor: 7, idVehiculo: 5,
    operationalDate: "2026-10-07", temporaryUse: { mode: "SOLO_HOY" } });
  assert.equal(result.type, "TEMPORAL");
  assert.deepEqual(insertParams, [7, 5, "2026-10-07", "2026-10-07"]);
});

test("rechaza periodos invertidos y traslapes", async () => {
  const base = (conflict) => clientWith((sql) => {
    if (sql.includes("FROM vehiculos")) return { rows: [{ id_vehiculos: 5, id_conductor_asignado: null }] };
    if (sql.includes("SELECT id_asignacion_temporal")) return { rows: [], rowCount: 0 };
    if (sql.includes("pg_advisory_xact_lock")) return { rows: [], rowCount: 1 };
    if (sql.includes("FROM viajes v")) return { rows: [], rowCount: 0 };
    if (sql.includes("UPDATE asignaciones_temporales")) return { rows: [], rowCount: 0 };
    if (sql.includes("SELECT 1 FROM asignaciones")) return { rows: conflict ? [{}] : [], rowCount: conflict ? 1 : 0 };
    return { rows: [], rowCount: 0 };
  });
  await assert.rejects(ensureVehicleAssignment({ client: base(false), idConductor: 7, idVehiculo: 5,
    operationalDate: "2026-10-07", temporaryUse: { mode: "PERIODO", start: "2026-10-08", end: "2026-10-07" } }), /periodo temporal/);
  await assert.rejects(ensureVehicleAssignment({ client: base(true), idConductor: 7, idVehiculo: 5,
    operationalDate: "2026-10-07", temporaryUse: { mode: "PERIODO", start: "2026-10-07", end: "2026-10-09" } }), /otra asignación temporal/);
});

test("cancela la asignación anterior al cambiar de unidad sin viaje activo", async () => {
  let cancelledWith;
  const client = clientWith((sql, params) => {
    if (sql.includes("FROM vehiculos")) return { rows: [{ id_vehiculos: 5, id_conductor_asignado: null }] };
    if (sql.includes("SELECT id_asignacion_temporal")) return { rows: [], rowCount: 0 };
    if (sql.includes("pg_advisory_xact_lock")) return { rows: [], rowCount: 1 };
    if (sql.includes("FROM viajes v")) return { rows: [], rowCount: 0 };
    if (sql.includes("UPDATE asignaciones_temporales")) { cancelledWith = params; return { rows: [], rowCount: 1 }; }
    if (sql.includes("SELECT 1 FROM asignaciones")) return { rows: [], rowCount: 0 };
    if (sql.includes("INSERT INTO asignaciones")) return { rows: [{ id_asignacion_temporal: 93 }], rowCount: 1 };
    throw new Error(`Consulta inesperada: ${sql}`);
  });

  const result = await ensureVehicleAssignment({ client, idConductor: 7, idVehiculo: 5,
    operationalDate: "2026-10-08", temporaryUse: { mode: "SOLO_HOY" } });

  assert.deepEqual(cancelledWith, [7, 5, "2026-10-08", "2026-10-08"]);
  assert.equal(result.idAssignment, 93);
});

test("impide cambiar de unidad mientras existe un viaje en curso", async () => {
  let cancelled = false;
  const client = clientWith((sql) => {
    if (sql.includes("FROM vehiculos")) return { rows: [{ id_vehiculos: 5, id_conductor_asignado: null }] };
    if (sql.includes("SELECT id_asignacion_temporal")) return { rows: [], rowCount: 0 };
    if (sql.includes("pg_advisory_xact_lock")) return { rows: [], rowCount: 1 };
    if (sql.includes("FROM viajes v")) return { rows: [{}], rowCount: 1 };
    if (sql.includes("UPDATE asignaciones_temporales")) cancelled = true;
    return { rows: [], rowCount: 0 };
  });

  await assert.rejects(ensureVehicleAssignment({ client, idConductor: 7, idVehiculo: 5,
    operationalDate: "2026-10-08", temporaryUse: { mode: "SOLO_HOY" } }), /viaje en curso/);
  assert.equal(cancelled, false);
});

test("impide tomar una unidad que otro conductor usa en un viaje activo", async () => {
  let activeTripQueries = 0;
  let cancelled = false;
  const client = clientWith((sql) => {
    if (sql.includes("FROM vehiculos")) return { rows: [{ id_vehiculos: 5, id_conductor_asignado: 9 }] };
    if (sql.includes("SELECT id_asignacion_temporal")) return { rows: [], rowCount: 0 };
    if (sql.includes("pg_advisory_xact_lock")) return { rows: [], rowCount: 1 };
    if (sql.includes("FROM viajes v")) {
      activeTripQueries += 1;
      return activeTripQueries === 1 ? { rows: [], rowCount: 0 } : { rows: [{}], rowCount: 1 };
    }
    if (sql.includes("UPDATE asignaciones_temporales")) cancelled = true;
    return { rows: [], rowCount: 0 };
  });

  await assert.rejects(ensureVehicleAssignment({ client, idConductor: 7, idVehiculo: 5,
    operationalDate: "2026-10-08", temporaryUse: { mode: "SOLO_HOY" } }), /otro conductor/);
  assert.equal(cancelled, false);
});
