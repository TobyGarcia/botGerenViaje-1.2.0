import test from "node:test";
import assert from "node:assert/strict";
import { apiFetch, readApiJson } from "../src/services/http-transport.js";

test("APK envía API del mismo dominio por HTTP nativo y serializa JSON", async () => {
  let called;
  const response = await apiFetch("https://gvmobility.aspromex.mx/api/conductor/auth/login-pin", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin: "TEST" })
  }, { native: true, http: { request: async args => {
    called = args; return { status: 200, headers: { "Content-Type": "application/json; charset=utf-8" }, data: { success: true, data: { token: "fake-test-token" } } };
  } } });
  assert.deepEqual(called.data, { pin: "TEST" });
  assert.equal(called.url, "https://gvmobility.aspromex.mx/api/conductor/auth/login-pin");
  assert.equal((await readApiJson(response)).success, true);
});
test("rechaza HTML, vacío y null en vez de devolver un login nulo", async () => {
  for (const body of ["<html>assets locales</html>", "", "null"]) {
    await assert.rejects(readApiJson(new Response(body, { status: 200 })), { code: "INVALID_API_RESPONSE" });
  }
});
test("PWA conserva fetch y native respeta cancelación previa", async () => {
  let calls = 0;
  await apiFetch("https://testing.example/api", {}, { native: false, fetch: async () => { calls++; return new Response('{}'); } });
  await assert.rejects(apiFetch("https://testing.example/api", { signal: AbortSignal.abort() }, { native: true }), { name: "AbortError" });
  assert.equal(calls, 1);
});
test("errores de red nativos permiten el acceso offline previamente autorizado", async () => {
  for (const message of ["Unable to resolve host", "Connection timed out"]) {
    await assert.rejects(apiFetch("https://testing.example/api", {}, { native: true, http: { request: async () => { throw new Error(message); } } }),
      { code: message.includes("timed out") ? "NETWORK_TIMEOUT" : "NETWORK_ERROR" });
  }
});
