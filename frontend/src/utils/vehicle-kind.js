const normalize = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

export function isTrailer(vehicle) {
  const type = normalize(vehicle?.tipo_vehiculo);
  if (/\b(remolque|semirremolque|semiremolque|trailer|dolly|lowboy)\b/.test(type)) return true;
  // Respect a classified motor vehicle; descriptions are only a legacy fallback.
  if (type && !["n/a", "sin registro", "sin tipo"].includes(type)) return false;
  const description = normalize(`${vehicle?.nombre || ""} ${vehicle?.marca || ""} ${vehicle?.modelo || ""}`);
  return /\b(remolque|semirremolque|semiremolque|trailer|dolly|lowboy|plana|cama baja)\b/.test(description);
}
