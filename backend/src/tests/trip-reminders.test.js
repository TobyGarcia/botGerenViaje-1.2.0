import test from "node:test";
import assert from "node:assert/strict";
import { dueTripReminderSlots } from "../services/trip-reminders.service.js";

const start = new Date("2026-10-08T14:00:00.000Z"); // 08:00 México
const afterMinutes = minutes => new Date(+start + minutes * 60000);

test("activa las ventanas de 45 minutos y una hora sin acumular ambas", () => {
  assert.deepEqual(dueTripReminderSlots(start, afterMinutes(44)), []);
  assert.deepEqual(dueTripReminderSlots(start, afterMinutes(45)), [{ tipo: "45_MIN", numero: 1 }]);
  assert.deepEqual(dueTripReminderSlots(start, afterMinutes(60)), [{ tipo: "1_HORA", numero: 1 }]);
});

test("identifica cada bloque vigente de seis horas", () => {
  const midnight = new Date("2026-10-08T06:00:00.000Z");
  assert.equal(dueTripReminderSlots(midnight, new Date(+midnight + 6 * 3600000))[0].numero, 1);
  assert.equal(dueTripReminderSlots(midnight, new Date(+midnight + 12 * 3600000))[0].numero, 2);
});

test("añade un único aviso de 24 horas aunque pasen varios días", () => {
  const at24 = dueTripReminderSlots(start, afterMinutes(24 * 60));
  const at72 = dueTripReminderSlots(start, afterMinutes(72 * 60));
  assert.deepEqual(at24.filter(slot => slot.tipo === "24_HORAS"), [{ tipo: "24_HORAS", numero: 1 }]);
  assert.deepEqual(at72.filter(slot => slot.tipo === "24_HORAS"), [{ tipo: "24_HORAS", numero: 1 }]);
});

test("genera un recordatorio único por fecha al cierre operativo", () => {
  const slots = dueTripReminderSlots(start, new Date("2026-10-09T00:00:00.000Z"));
  assert.equal(slots.some(slot => slot.tipo === "CIERRE_OPERATIVO" && slot.numero === 20261008), true);
});

test("no programa fechas anteriores o inválidas", () => {
  assert.deepEqual(dueTripReminderSlots(start, new Date(+start - 1)), []);
  assert.deepEqual(dueTripReminderSlots("fecha-inválida", new Date()), []);
});
