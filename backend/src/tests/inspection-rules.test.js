import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { databasePool } from "../database/pool.js";
import { getApprovalForStart, saveInspection } from "../services/inspecciones.service.js";

async function withMockedQuery(mock, action) {
  const original = databasePool.query;
  databasePool.query = mock;
  try {
    return await action();
  } finally {
    databasePool.query = original;
  }
}

describe("Reglas de inspección vehicular", () => {
  test("reutiliza únicamente la fecha operativa exacta para el mismo conductor y vehículo", async () => {
    let capturedSql = "";
    await withMockedQuery(async (sql) => {
      capturedSql = sql;
      return { rows: [] };
    }, () => getApprovalForStart(25, 7));

    assert.match(capturedSql, /i\.id_vehiculos = v\.id_vehiculos/);
    assert.match(capturedSql, /i\.id_conductores = \$2/);
    assert.match(capturedSql, /i\.fecha_operativa = .*INTERVAL '2 hours'.*::date/s);
    assert.match(capturedSql, /uso_posterior\.id_conductores <> i\.id_conductores/);
    assert.match(capturedSql, /uso_posterior\.hora_salida > i\.actualizado_en/);
    assert.doesNotMatch(capturedSql, /CURRENT_DATE - INTERVAL '1 day'/);
  });

  test("marca fuera de horario antes de las 06:00 y desde las 18:00", async () => {
    async function storedFlag(hour) {
      let call = 0;
      let insertParams;
      await withMockedQuery(async (_sql, params) => {
        call += 1;
        if (call === 1) return { rows: [{ id_viajes: 1, id_vehiculos: 9, estado: null }] };
        if (call === 2) return { rows: [{ fecha: "2026-10-07", hora: hour }] };
        insertParams = params;
        return { rows: [{ id_inspeccion: 1 }] };
      }, () => saveInspection({
        idViaje: 1,
        idConductor: 7,
        data: {
          combustible: 50,
          tipoAsignacion: "TEMPORAL",
          danos: {},
          checklist: {},
          firma: "firma-prueba"
        }
      }));
      return insertParams[12];
    }

    assert.equal(await storedFlag(5), true);
    assert.equal(await storedFlag(6), false);
    assert.equal(await storedFlag(17), false);
    assert.equal(await storedFlag(18), true);
  });
});
