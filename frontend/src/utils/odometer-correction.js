export function odometerCorrectionPayload(report, vehicleId, reading, previousReading) {
  if (!Number.isSafeInteger(Number(reading)) || Number(reading) < 0 || String(reading).trim() === "") throw new Error("Captura una lectura de odómetro válida.");
  if (!Number.isFinite(Number(previousReading)) || Number(reading) >= Number(previousReading)) return null;
  if (!report?.confirmed || String(report.vehicleId) !== String(vehicleId) || Number(report.reading) !== Number(reading) ||
      Number(report.previousReading) !== Number(previousReading) || (report.reason || "").trim().length < 5 || !report.photoBase64) {
    throw new Error("Para usar una lectura menor, confirma el reporte, escribe el motivo y toma una foto del odómetro.");
  }
  return { previousReading: Number(previousReading), reason: report.reason.trim(), photoBase64: report.photoBase64 };
}
