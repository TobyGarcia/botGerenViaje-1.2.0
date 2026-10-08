import test from "node:test";
import assert from "node:assert/strict";
import { dueTripReminderSlots } from "../services/trip-reminders.service.js";

const start = new Date("2026-10-08T14:00:00.000Z");
const after = milliseconds => new Date(+start + milliseconds);

test("no recuerda un viaje antes de cumplir 24 horas", () => {
  assert.deepEqual(dueTripReminderSlots(start, after(24 * 60 * 60000 - 1)), []);
});

test("genera un único recordatorio al cumplir 24 horas", () => {
  assert.deepEqual(dueTripReminderSlots(start, after(24 * 60 * 60000)), [
    { tipo: "24_HORAS", numero: 1 }
  ]);
});

test("después de varios días conserva el mismo identificador para no repetirlo", () => {
  assert.deepEqual(dueTripReminderSlots(start, after(72 * 60 * 60000)), [
    { tipo: "24_HORAS", numero: 1 }
  ]);
});

test("no programa recordatorios para fechas anteriores o inválidas", () => {
  assert.deepEqual(dueTripReminderSlots(start, after(-1)), []);
  assert.deepEqual(dueTripReminderSlots("fecha-inválida", new Date()), []);
});
