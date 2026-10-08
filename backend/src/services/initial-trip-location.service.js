const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function nullableNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export function normalizeInitialTripLocation(value, referenceTime = new Date()) {
  const clientLocationId = String(value?.clientLocationId || "");
  const latitud = Number(value?.latitud);
  const longitud = Number(value?.longitud);
  const precisionMetros = nullableNumber(value?.precisionMetros ?? value?.precision_metros);
  const velocidad = nullableNumber(value?.velocidad);
  const direccion = nullableNumber(value?.direccion);
  const fechaGps = new Date(value?.fechaGps ?? value?.fecha_gps);
  const reference = new Date(referenceTime);
  const origenCaptura = ["PWA", "TELEGRAM_MINI_APP"].includes(value?.origenCaptura) ? value.origenCaptura : "MINI_APP";
  const isBackground = Boolean(value?.isBackground);
  const fechaGuardadoLocal = new Date(value?.fechaGuardadoLocal || value?.fechaGps || value?.fecha_gps);

  if (!UUID_PATTERN.test(clientLocationId)) throw new Error("La primera ubicación GPS no tiene un identificador válido.");
  if (!Number.isFinite(latitud) || latitud < -90 || latitud > 90) throw new Error("La latitud de la primera ubicación GPS no es válida.");
  if (!Number.isFinite(longitud) || longitud < -180 || longitud > 180) throw new Error("La longitud de la primera ubicación GPS no es válida.");
  if (latitud === 0 && longitud === 0) throw new Error("La primera ubicación GPS no contiene coordenadas válidas.");
  if (Number.isNaN(precisionMetros) || (precisionMetros !== null && precisionMetros < 0)) throw new Error("La precisión de la primera ubicación GPS no es válida.");
  if (Number.isNaN(velocidad) || (velocidad !== null && velocidad < 0)) throw new Error("La velocidad de la primera ubicación GPS no es válida.");
  if (Number.isNaN(direccion) || (direccion !== null && (direccion < 0 || direccion > 360))) throw new Error("La dirección de la primera ubicación GPS no es válida.");
  if (Number.isNaN(fechaGps.getTime()) || Number.isNaN(reference.getTime())) throw new Error("La fecha de la primera ubicación GPS no es válida.");

  const age = reference.getTime() - fechaGps.getTime();
  if (age > 5 * 60 * 1000 || age < -60 * 1000) throw new Error("La primera ubicación GPS debe obtenerse inmediatamente antes de iniciar el viaje.");

  if (Number.isNaN(fechaGuardadoLocal.getTime())) throw new Error("La fecha de guardado local de la primera ubicación GPS no es válida.");
  return { clientLocationId, latitud, longitud, precisionMetros, velocidad, direccion, fechaGps,
    origenCaptura, isBackground, fechaGuardadoLocal };
}

export async function insertInitialTripLocation(client, idViaje, value, referenceTime = new Date()) {
  const location = normalizeInitialTripLocation(value, referenceTime);
  await client.query(`INSERT INTO ubicaciones_viaje
    (id_viajes,client_location_id,latitud,longitud,precision_metros,velocidad,direccion,fecha_gps,
     es_punto_intermedio,nombre_punto,origen,en_segundo_plano,guardado_local_en)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,FALSE,NULL,$9,$10,$11)
    ON CONFLICT (id_viajes,client_location_id) WHERE client_location_id IS NOT NULL DO NOTHING`,
  [idViaje, location.clientLocationId, location.latitud, location.longitud, location.precisionMetros,
    location.velocidad, location.direccion, location.fechaGps, location.origenCaptura,
    location.isBackground, location.fechaGuardadoLocal]);
  return location;
}
