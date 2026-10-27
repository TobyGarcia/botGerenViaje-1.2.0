import test from "node:test";
import assert from "node:assert/strict";
import { odometerCorrectionPayload } from "../src/utils/odometer-correction.js";
const report = { vehicleId: 2, reading: 900, previousReading: 1000, confirmed: true, reason: " Error de captura ", photoBase64: "photo" };
test("una lectura menor requiere reporte con foto y motivo para esa misma unidad y lectura", () => {
  assert.deepEqual(odometerCorrectionPayload(report, "2", "900", 1000), { previousReading: 1000, reason: "Error de captura", photoBase64: "photo" });
  for (const value of [null, { ...report, confirmed: false }, { ...report, photoBase64: "" }, { ...report, reason: "x" }, { ...report, vehicleId: 3 }, { ...report, reading: 899 }]) {
    assert.throws(() => odometerCorrectionPayload(value, 2, 900, 1000), /confirma el reporte/);
  }
  assert.equal(odometerCorrectionPayload(null, 2, 1000, 1000), null);
  assert.throws(() => odometerCorrectionPayload(null, 2, "", 1000), /válida/);
});
