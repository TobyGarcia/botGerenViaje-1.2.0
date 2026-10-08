import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migrationUrl = new URL("../../../database/migrations/036_diagnostico_origen_gps.sql", import.meta.url);
const runnerUrl = new URL("../../../database/scripts/migrate.sql", import.meta.url);

test("la migración GPS es repetible y forma parte del ejecutor", async () => {
  const [migration, runner] = await Promise.all([
    readFile(migrationUrl, "utf8"),
    readFile(runnerUrl, "utf8")
  ]);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS origen/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS en_segundo_plano/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS guardado_local_en/);
  assert.match(migration, /'TELEGRAM_MINI_APP','PWA'/);
  assert.match(runner, /036_diagnostico_origen_gps\.sql/);
  assert.match(runner, /037_recordatorios_viajes\.sql/);
});
