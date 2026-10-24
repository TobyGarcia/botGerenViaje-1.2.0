import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { writeAuditLog, sanitizeAuditDetails } from "./audit-log.service.js";
import { publishTelegramAudit } from "./telegram-audit.service.js";

export const auditContext = new AsyncLocalStorage();
export const validRequestId = value => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));

// No messages, stack arguments or database error.detail: these can contain row data.
export function safeError(error) {
  const safe = {};
  for (const key of ["code", "constraint", "table", "routine", "name"]) {
    const value = String(error?.[key] || "");
    if (/^[a-zA-Z0-9_.-]{1,100}$/.test(value)) safe[key] = value;
  }
  if (error && !safe.code) {
    const message = String(error.message || "").toLowerCase();
    const reasons = [
      [/inspecci/, "INSPECCION_NO_VALIDA"], [/asignaci|unidad.*ocupad/, "ASIGNACION_CONFLICTO"],
      [/viaje.*curso|viaje.*pendiente/, "VIAJE_ACTIVO"], [/kilometraje|od.metro/, "KILOMETRAJE_INVALIDO"],
      [/permiso.*venc|horario/, "PERMISO_HORARIO"], [/gps|ubicaci.n/, "GPS_NO_VALIDO"],
      [/licencia/, "LICENCIA_NO_VALIDA"], [/pin/, "PIN_NO_VALIDO"], [/conductor/, "CONDUCTOR_NO_VALIDO"]
    ];
    safe.code = reasons.find(([pattern]) => pattern.test(message))?.[1] || "APPLICATION_ERROR";
  }
  return safe;
}

export function createAuditWriter({ persist = entry => process.env.AUDIT_PERSISTENCE === "false" ? Promise.resolve() : writeAuditLog(entry),
  output = entry => { if (process.env.AUDIT_STDOUT !== "false") console.log(JSON.stringify(entry)); }, capacity = 200 } = {}) {
  const queue = [];
  let active = false;
  let draining;
  let overflowReported = false;
  const print = value => { try { output(value); } catch {} };
  async function drain() {
    if (active) return draining;
    active = true;
    draining = (async () => {
      while (queue.length) {
        const entry = queue.shift();
        try { await persist(entry); }
        catch (error) {
          print({ type: "audit_write_error", requestId: entry.requestId, ...safeError(error) });
          publishTelegramAudit({ level: 'CRITICAL', event: 'AUDIT_WRITE_FAILED', step: 'audit.database',
            result: 'ERROR', errorCode: safeError(error).code, requestId: entry.requestId });
        }
      }
    })();
    try { await draining; }
    finally { active = false; overflowReported = false; }
  }
  return {
    write(entry) {
      entry = { ...entry, details: sanitizeAuditDetails(entry.details || {}) };
      print({ timestamp: new Date().toISOString(), type: "operation_audit", ...entry });
      publishTelegramAudit(entry);
      if (queue.length >= capacity) {
        if (!overflowReported) print({ type: "audit_queue_full", capacity });
        overflowReported = true;
        return;
      }
      queue.push(entry);
      void drain();
    },
    async flush() { while (active || queue.length) { if (active) await draining; else await drain(); } }
  };
}

export const auditWriter = createAuditWriter();

export function recordOperation({ event = "OPERACION", step, result, level = "INFO", details = {}, tripId, durationMs = 0, error } = {}) {
  try {
    const context = auditContext.getStore() || {};
    const request = context.request;
    const actor = request?.adminUser || request?.driverUser;
    const meta = sanitizeAuditDetails(details);
    auditWriter.write({
      eventId: randomUUID(), requestId: context.requestId || randomUUID(), level, event,
      step, result, version: process.env.APP_VERSION || "local",
      tripId: Number.isSafeInteger(Number(tripId)) && tripId != null ? Number(tripId) : null,
      errorCode: safeError(error).code || (error ? "APPLICATION_ERROR" : null),
      method: request?.method || "INTERNAL", path: request?.path || "/internal",
      status: level === "ERROR" ? 500 : level === "WARN" ? 409 : 200,
      durationMs: Math.max(0, Math.round(durationMs)),
      actorType: request?.adminUser ? "ADMIN" : request?.driverUser ? "CONDUCTOR" : "ANONIMO",
      actorId: actor?.id_usuarios_admin ?? actor?.id_usuario_admin ?? actor?.id_conductores ?? null,
      actorName: actor?.nombre ?? null,
      actorEmail: request?.adminUser ? (actor?.email ?? actor?.correo ?? null) : null,
      authSource: request?.authSource || (request?.adminUser ? "ADMIN_SESSION" : null),
      details: { ...meta, ...safeError(error) }
    });
  } catch { /* Telemetry must never change a business result. */ }
}

function identifiers(args, value) {
  const input = args[0] || {};
  const result = value && typeof value === "object" ? value : {};
  return {
    idViaje: input.idViaje ?? result.id_viajes ?? result.idViaje,
    idConductor: input.idConductor,
    idVehiculo: input.idVehiculo,
    idInspeccion: input.idInspeccion ?? result.id_inspeccion,
    folio: result.folio,
    cantidad: Array.isArray(input.ubicaciones) ? input.ubicaciones.length : undefined,
    reutilizado: result.reused, insertadas: result.inserted, duplicadas: result.duplicates,
    tipoAsignacion: result.type, inspeccionRequerida: result.requiereInspeccion
  };
}

// A completed function is not necessarily a committed transaction: explicit COMMIT events
// below are the source of truth for persistence.
export function traceOperation(step, fn) {
  return async function (...args) {
    const parent = auditContext.getStore();
    return auditContext.run(parent || { requestId: randomUUID() }, async () => {
      const start = performance.now();
      const ids = identifiers(args);
      if (step === "initial-trip-location.insertInitialTripLocation") ids.idViaje = args[1];
      recordOperation({ step, result: "INICIADO", details: ids, tripId: ids.idViaje });
      try {
        const value = await fn.apply(this, args);
        const done = identifiers(args, value);
        done.idViaje ??= ids.idViaje;
        recordOperation({ step, result: "COMPLETADO", details: done, tripId: done.idViaje, durationMs: performance.now() - start });
        return value;
      } catch (error) {
        // Existing business validations throw plain Error. DB/network/programming faults are errors.
        const expected = (error?.status >= 400 && error?.status < 500) ||
          (!error?.status && !error?.code && error?.constructor === Error && safeError(error).code !== "APPLICATION_ERROR");
        recordOperation({ step, result: expected ? "RECHAZADO" : "ERROR", level: expected ? "WARN" : "ERROR",
          details: ids, tripId: ids.idViaje, error, durationMs: performance.now() - start });
        throw error;
      }
    });
  };
}
