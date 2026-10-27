// `synced` means the complete journey has closed and uploaded, not just its start.
export function offlineTripNotice(records, error = "") {
  const pending = records.filter(record => !record.synced && record.startedAt);
  const serverStarted = record => Number(record.serverTrip?.idViaje ?? record.serverTrip?.id_viajes) > 0 &&
    ["EN_CURSO", "FINALIZADO", "CANCELADO"].includes(record.serverTrip?.estado);
  const starts = pending.filter(record => !serverStarted(record));
  const closures = pending.filter(record => record.finishedAt && serverStarted(record) &&
    !["FINALIZADO", "CANCELADO"].includes(record.serverTrip?.estado));
  const locations = pending.filter(record => record.finishedAt && serverStarted(record) &&
    ["FINALIZADO", "CANCELADO"].includes(record.serverTrip?.estado));
  const details = [];
  if (starts.length) details.push(starts.length === 1 ? "Inicio de viaje guardado en el teléfono; pendiente de sincronizar." : `${starts.length} inicios de viaje pendientes de sincronizar.`);
  if (closures.length) details.push(closures.length === 1 ? `Cierre pendiente de sincronizar: ${closures[0].serverTrip.folio || "viaje guardado"}.` : `${closures.length} cierres de viaje pendientes de sincronizar.`);
  if (locations.length) details.push("Hay ubicaciones de viajes finalizados pendientes de confirmar.");
  if (!details.length) return "";
  if (error) details.push(error);
  return details.join(" ");
}
