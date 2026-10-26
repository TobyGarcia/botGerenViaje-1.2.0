import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveApiOrigin } from "../src/services/api-origin.js";
test("APK remota de pruebas nunca selecciona producción por variable heredada", () => {
  assert.equal(resolveApiOrigin({ native: true, configuredUrl: "https://gv.aspromex.mx", location: {
    protocol: "https:", origin: "https://gvmobility.aspromex.mx"
  } }), "https://gvmobility.aspromex.mx");
});
test("APK empaquetada exige un servidor explícito; web mantiene mismo origen", () => {
  assert.throws(() => resolveApiOrigin({ native: true }), /no tiene configurado/);
  assert.equal(resolveApiOrigin(), "");
  assert.equal(resolveApiOrigin({ native: true, configuredUrl: "https://testing.example/api/" }), "https://testing.example");
});
