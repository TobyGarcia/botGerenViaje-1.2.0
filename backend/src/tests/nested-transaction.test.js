import test from "node:test";
import assert from "node:assert/strict";
import { databasePool } from "../database/pool.js";
import { createTrip, startTrip, finishTrip } from "../services/viajes.service.js";

test("las operaciones de viaje reutilizan la transacción externa", async () => {
  const originalConnect = databasePool.connect;
  databasePool.connect = async () => {
    throw new Error("No debe solicitar otra conexión");
  };

  try {
    for (const operation of [
      () => createTrip({
        idConductor: 1,
        idVehiculo: 1,
        idOrigen: 1,
        idDestino: 2,
        acompanantes: [],
        kilometrajeInicial: 1,
        motivo: "prueba"
      }, { client: fakeExternalClient() }),
      () => startTrip({ idViaje: 1 }, { client: fakeExternalClient() }),
      () => finishTrip({ idViaje: 1, kilometrajeFinal: 2 }, { client: fakeExternalClient() })
    ]) {
      await assert.rejects(operation, /consulta detenida para la prueba/);
    }
  } finally {
    databasePool.connect = originalConnect;
  }
});

test("el pool limita consultas y transacciones abandonadas", () => {
  assert.equal(databasePool.options.statement_timeout, 30000);
  assert.equal(databasePool.options.query_timeout, 35000);
  assert.equal(databasePool.options.idle_in_transaction_session_timeout, 60000);
  assert.equal(databasePool.options.application_name, "gv-backend");
});

function fakeExternalClient() {
  return {
    async query(sql) {
      assert.notEqual(sql, "BEGIN");
      assert.notEqual(sql, "ROLLBACK");
      assert.notEqual(sql, "COMMIT");
      throw new Error("consulta detenida para la prueba");
    },
    release() {
      assert.fail("No debe liberar una conexión que pertenece a la transacción externa");
    }
  };
}
