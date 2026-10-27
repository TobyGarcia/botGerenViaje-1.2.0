import test from "node:test";
import assert from "node:assert/strict";
import { createCameraSession, cameraErrorMessage } from "../src/services/camera-session.js";

test("solicita cámara trasera sin micrófono y libera la cámara al cerrar", async () => {
  let constraints, stopped = 0;
  const stream = { getTracks: () => [{ stop: () => stopped++ }] };
  const session = createCameraSession({ getUserMedia: async value => { constraints = value; return stream; } });
  assert.equal(await session.start(), stream);
  assert.deepEqual(constraints, { video: { facingMode: { ideal: "environment" } }, audio: false });
  session.stop(); session.stop(); assert.equal(stopped, 1);
});
test("cierra una cámara concedida después de desmontar el visor", async () => {
  let grant, stopped = false;
  const session = createCameraSession({ getUserMedia: () => new Promise(resolve => { grant = resolve; }) });
  const pending = session.start("user"); session.stop();
  grant({ getTracks: () => [{ stop: () => { stopped = true; } }] });
  assert.equal(await pending, null); assert.equal(stopped, true);
});
test("denegar permisos no abre galería y permite explicar el problema", async () => {
  const failure = Object.assign(new Error("denied"), { name: "NotAllowedError" });
  const session = createCameraSession({ getUserMedia: async () => { throw failure; } });
  await assert.rejects(session.start(), failure);
  assert.match(cameraErrorMessage(failure), /Permite el acceso/);
  await assert.rejects(createCameraSession(null).start(), /CAMERA_UNSUPPORTED/);
});
