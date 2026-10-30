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

test("descubre solo releases publicados del canal testing y selecciona mayor código", async () => {
  const originalFetch = globalThis.fetch;
  const previous = process.env.ANDROID_UPDATE_DISCOVERY;
  const previousRaw = process.env.ANDROID_UPDATE_TESTING;
  const base = "https://github.com/TobyGarcia/botGerenViaje-1.2.0/releases/download/";
  const release = (code, draft = false) => ({ tag_name: `android-testing-v1.1.0-${code}`, draft, prerelease: true,
    assets: ["update.json", "gv-mobility.apk"].map((name) => ({ name, browser_download_url: `${base}android-testing-v1.1.0-${code}/${name}` })) });
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(url);
    return { ok: true, json: async () => url.startsWith("https://api.github.com/")
      ? [release(99, true), release(2), release(3)]
      : { versionCode: 3, versionName: "1.1.0", channel: "testing", sha256: "a".repeat(64), downloadUrl: `${base}android-testing-v1.1.0-3/gv-mobility.apk` } };
  };
  try {
    process.env.ANDROID_UPDATE_DISCOVERY = "testing";
    delete process.env.ANDROID_UPDATE_TESTING;
    const response = { set() {}, status() { return this; }, json(value) { this.value = value; } };
    await androidUpdateController({ query: { channel: "testing" } }, response);
    assert.equal(response.value.versionCode, 3);
    assert.equal(response.value.available, true);
    await androidUpdateController({ query: { channel: "testing" } }, response);
    assert.equal(calls.length, 2);
    await androidUpdateController({ query: { channel: "stable" } }, response);
    assert.equal(response.value.available, false);
  } finally {
    globalThis.fetch = originalFetch;
    if (previous === undefined) delete process.env.ANDROID_UPDATE_DISCOVERY;
    else process.env.ANDROID_UPDATE_DISCOVERY = previous;
    if (previousRaw === undefined) delete process.env.ANDROID_UPDATE_TESTING;
    else process.env.ANDROID_UPDATE_TESTING = previousRaw;
  }
});
