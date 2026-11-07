import { createHash } from "node:crypto";
import { registerMileageReading } from "./kilometraje.service.js";

export function normalizeOdometerCorrection(value, reading) {
  if (value == null) return null;
  if (!Number.isSafeInteger(reading) || reading < 0 || reading > 2147483647 ||
      !Number.isSafeInteger(value.previousReading) || value.previousReading > 2147483647 || value.previousReading <= reading ||
      typeof value.reason !== "string" || value.reason.trim().length < 5 || value.reason.trim().length > 300 ||
      typeof value.photoBase64 !== "string" || value.photoBase64.length > 450000 ||
      !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(value.photoBase64)) {
    throw new Error("Reporta la diferencia con la lectura anterior, un motivo de 5 a 300 caracteres y una foto del odómetro.");
  }
  const photo = Buffer.from(value.photoBase64.split(",")[1], "base64");
  if (photo.length < 4 || photo.length > 320 * 1024 || photo[0] !== 255 || photo[1] !== 216 ||
      photo.at(-2) !== 255 || photo.at(-1) !== 217 || photo.toString("base64") !== value.photoBase64.split(",")[1]) {
    throw new Error("La foto del odómetro no es una imagen JPEG válida o supera 320 KB.");
  }
  return { previousReading: value.previousReading, reason: value.reason.trim(), photoBase64: value.photoBase64 };
}

export function correctionHash(correction, reading) {
  return createHash("sha256").update(JSON.stringify({ ...correction, reading })).digest("hex");
}

export async function saveOdometerCorrection(client, trip, correction, reading, currentReading) {
  if (!correction) return;
  if (Number(currentReading) !== correction.previousReading) throw new Error("La lectura de la unidad cambió. Actualiza el catálogo y vuelve a reportar la diferencia.");
  await client.query(`INSERT INTO ajustes_odometro_viaje
    (id_viajes,id_vehiculos,id_conductores,lectura_anterior,lectura_nueva,motivo,foto,request_hash)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8)`, [trip.id_viajes, trip.idVehiculo, trip.idConductor,
    correction.previousReading, reading, correction.reason, Buffer.from(correction.photoBase64.split(",")[1], "base64"), correctionHash(correction, reading)]);
}

// The caller already owns the vehicle lock and the trip-start transaction.
export async function confirmStartMileage(client, trip, reading, report) {
  if (!Number.isSafeInteger(reading) || reading < 0 || reading > 2147483647) throw new Error('Captura un kilometraje inicial válido, mayor o igual a cero.');
  const vehicle = (await client.query('SELECT kilometraje_actual FROM vehiculos WHERE id_vehiculos=$1 FOR UPDATE', [trip.id_vehiculos])).rows[0];
  if (!vehicle) throw new Error('No se encontró la unidad del viaje.');
  const correction = normalizeOdometerCorrection(report, reading);
  if (reading < Number(vehicle.kilometraje_actual) && !correction) throw new Error('La lectura es menor al registro. Reporta la diferencia con motivo y foto del odómetro.');
  const existing = (await client.query('SELECT aplicado_en FROM ajustes_odometro_viaje WHERE id_viajes=$1 FOR UPDATE', [trip.id_viajes])).rows[0];
  if (existing?.aplicado_en) throw new Error('El ajuste del viaje ya fue aplicado. Actualiza el estado del viaje.');
  await client.query('DELETE FROM ajustes_odometro_viaje WHERE id_viajes=$1 AND aplicado_en IS NULL', [trip.id_viajes]);
  await saveOdometerCorrection(client, { ...trip, idVehiculo: trip.id_vehiculos, idConductor: trip.id_conductores }, correction, reading, vehicle.kilometraje_actual);
  await client.query('UPDATE viajes SET kilometraje_inicial=$2 WHERE id_viajes=$1', [trip.id_viajes, reading]);
  await client.query('UPDATE gerenciamiento_viajes SET kilometraje=$2 WHERE id_viaje=$1', [trip.id_viajes, reading]);
  if (correction || reading !== Number(trip.kilometraje_inicial) || reading !== Number(vehicle.kilometraje_actual)) {
    const prior = await client.query(`UPDATE historial_kilometraje_vehiculos SET tipo_registro='CORRECCION',
      observaciones=COALESCE(observaciones,'') || ' Lectura provisional del registro; sustituida por la confirmada al iniciar.'
      WHERE id_viajes=$1 AND tipo_registro='INICIAL_VIAJE' RETURNING id_historial_kilometraje`, [trip.id_viajes]);
    trip.startMileagePreviousRecordId = prior.rows[0]?.id_historial_kilometraje ?? null;
  }
  if (!correction && (reading !== Number(trip.kilometraje_inicial) || reading !== Number(vehicle.kilometraje_actual))) await registerMileageReading({
    client, idVehiculo: trip.id_vehiculos, idViaje: trip.id_viajes, kilometraje: reading,
    idRegistroCorregido: trip.startMileagePreviousRecordId,
    tipoRegistro: 'INICIAL_VIAJE', origen: 'MINI_APP', observaciones: `Lectura confirmada al iniciar ${trip.folio}.`
  });
  trip.kilometraje_inicial = reading;
}

export async function applyOdometerCorrection(client, trip, recordedAt = null) {
  const report = (await client.query("SELECT * FROM ajustes_odometro_viaje WHERE id_viajes=$1 FOR UPDATE", [trip.id_viajes])).rows[0];
  if (!report || report.aplicado_en) return false;
  const current = (await client.query("SELECT kilometraje_actual FROM vehiculos WHERE id_vehiculos=$1 FOR UPDATE", [trip.id_vehiculos])).rows[0];
  if (Number(current?.kilometraje_actual) !== Number(report.lectura_anterior)) throw new Error("La lectura de la unidad cambió desde el reporte. Conservamos el viaje pendiente para evitar sobrescribir otro recorrido.");
  await registerMileageReading({ client, idVehiculo: trip.id_vehiculos, idViaje: trip.id_viajes,
    kilometraje: Number(report.lectura_nueva), tipoRegistro: "INICIAL_VIAJE", origen: "MINI_APP",
    idRegistroCorregido: trip.startMileagePreviousRecordId ?? null,
    observaciones: `Ajuste de odómetro al iniciar ${trip.folio}: ${report.lectura_anterior} → ${report.lectura_nueva} km. ${report.motivo}`,
    allowLower: true, replaceCurrent: true });
  await client.query("UPDATE ajustes_odometro_viaje SET aplicado_en=COALESCE($2::timestamptz,CURRENT_TIMESTAMP) WHERE id_viajes=$1", [trip.id_viajes, recordedAt]);
  return true;
}
