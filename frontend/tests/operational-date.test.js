import test from "node:test";
import assert from "node:assert/strict";
import { formatOperationalDate } from "../src/utils/operational-date.js";

test("muestra fechas operativas sin exponer hora UTC", () => {
  assert.equal(formatOperationalDate("2026-10-08T06:00:00.000Z"), "08/10/2026");
  assert.equal(formatOperationalDate("2026-10-08"), "08/10/2026");
});

test("conserva vacío y valores no reconocidos", () => {
  assert.equal(formatOperationalDate(null), "");
  assert.equal(formatOperationalDate("sin-fecha"), "sin-fecha");
});
