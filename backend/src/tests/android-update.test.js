import { test } from "node:test";
import assert from "node:assert/strict";
import { androidUpdateController } from "../controllers/android-update.controller.js";

test("no ofrece versiones sin configurar y rechaza enlaces de otros repositorios", async () => {
  const previous = process.env.ANDROID_UPDATE_TESTING;
  const response = () => ({ code: 200, set() {}, status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; } });
  try {
    delete process.env.ANDROID_UPDATE_TESTING;
    const empty = response();
    await androidUpdateController({ query: {} }, empty);
    assert.equal(empty.data.available, false);
    process.env.ANDROID_UPDATE_TESTING = JSON.stringify({ versionCode: 2, versionName: "1.1.0", channel: "testing", sha256: "a".repeat(64), downloadUrl: "https://github.com/other/repository/releases/download/v1/app.apk" });
    const invalid = response();
    await androidUpdateController({ query: {} }, invalid);
    assert.equal(invalid.code, 503);
    const validManifest = JSON.parse(process.env.ANDROID_UPDATE_TESTING);
    validManifest.downloadUrl = "https://github.com/TobyGarcia/botGerenViaje-1.2.0/releases/download/test/gv-mobility.apk";
    process.env.ANDROID_UPDATE_TESTING = JSON.stringify(validManifest);
    const valid = response();
    await androidUpdateController({ query: {} }, valid);
    assert.equal(valid.data.versionCode, 2);
    assert.equal(valid.data.available, true);
  } finally {
    if (previous === undefined) delete process.env.ANDROID_UPDATE_TESTING;
    else process.env.ANDROID_UPDATE_TESTING = previous;
  }
});
