import test from "node:test";
import assert from "node:assert/strict";
import { dueTripReminderSlots } from "../services/trip-reminders.service.js";

const start = new Date("2026-10-08T14:00:00.000Z"); // 08:00 México
const at = minutes => new Date(+start + minutes * 60000);

test("programa los recordatorios de 45 minutos y una hora una sola vez", () => {
  assert.deepEqual(dueTripReminderSlots(start, at(44)), []);
  assert.deepEqual(dueTripReminderSlots(start, at(45)), [{ tipo: "45_MIN", numero: 1 }]);
  assert.deepEqual(dueTripReminderSlots(start, at(60)), [{ tipo: "1_HORA", numero: 1 }]);
});

test("genera un identificador distinto por cada bloque de seis horas", () => {
  const midnightStart = new Date("2026-10-08T06:00:00.000Z");
  const slots = dueTripReminderSlots(midnightStart, new Date(+midnightStart + (12 * 60 + 1) * 60000));
  assert.deepEqual(slots, [{ tipo: "6_HORAS", numero: 2 }]);
});

test("un viaje antiguo recibe solo el recordatorio vigente y no una ráfaga", () => {
  const slots = dueTripReminderSlots(start, new Date("2026-10-10T16:00:00.000Z"));
  assert.equal(slots.length, 1);
  assert.equal(slots[0].tipo, "6_HORAS");
});

test("incluye el cierre operativo desde las 18:00 de México", () => {
  const slots = dueTripReminderSlots(start, new Date("2026-10-09T00:00:00.000Z"));
  assert.equal(slots.some(slot => slot.tipo === "CIERRE_OPERATIVO" && slot.numero === 20261008), true);
});

test("no programa recordatorios para fechas anteriores al inicio", () => {
  assert.deepEqual(dueTripReminderSlots(start, new Date(+start - 1)), []);
});
