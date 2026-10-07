import { databasePool } from "../database/pool.js";
import { findTelegramUserById } from "./telegram-user.service.js";
import { saveTripLocation } from "./ubicaciones.service.js";

// La columna latitud/longitud es numeric(10,7): comparar con esa misma
// resolución evita reinsertar un punto que la base guardaría idéntico.
const COORDINATE_DECIMALS = 7;

// Telegram reenvía la ubicación en vivo aunque el vehículo no se haya movido.
// Sin este mínimo, una unidad detenida generaría cientos de filas repetidas.
const MIN_SECONDS_BETWEEN_POINTS = 5;

function roundCoordinate(value) {
  return Number(Number(value).toFixed(COORDINATE_DECIMALS));
}

export async function findActiveTripByDriver(idConductor) {
  const result = await databasePool.query(
    `
      SELECT
        v.id_viajes,
        v.folio
      FROM viajes v

      INNER JOIN estados_viaje ev
        ON ev.id_estado_viaje = v.id_estado_viaje

      WHERE v.id_conductores = $1
        AND ev.nombre = 'EN_CURSO'

      ORDER BY v.id_viajes DESC

      LIMIT 1
    `,
    [idConductor]
  );

  return result.rows[0] ?? null;
}

async function findLastTripLocation(idViaje) {
  const result = await databasePool.query(
    `
      SELECT
        latitud,
        longitud,
        fecha_gps
      FROM ubicaciones_viaje
      WHERE id_viajes = $1
      ORDER BY fecha_gps DESC, id_ubicaciones_viaje DESC
      LIMIT 1
    `,
    [idViaje]
  );

  return result.rows[0] ?? null;
}

/**
 * Registra un punto de la ubicación en vivo de Telegram contra el viaje en
 * curso del conductor. Devuelve el resultado con `skipped` cuando el punto no
 * aportaba información nueva, para que el bot no responda como si fuera error.
 */
export async function registerLiveLocation({
  telegramUserId,
  latitude,
  longitude,
  accuracy = null,
  heading = null,
  gpsTimestamp = new Date()
}) {
  const telegramUser = await findTelegramUserById(telegramUserId);

  if (
    !telegramUser?.activo ||
    !telegramUser?.conductor_activo ||
    !telegramUser.id_conductores
  ) {
    return { saved: false, reason: "SIN_CONDUCTOR" };
  }

  const trip = await findActiveTripByDriver(
    telegramUser.id_conductores
  );

  if (!trip) {
    return { saved: false, reason: "SIN_VIAJE_EN_CURSO" };
  }

  const lastLocation = await findLastTripLocation(
    trip.id_viajes
  );

  if (lastLocation) {
    const sameCoordinates =
      roundCoordinate(lastLocation.latitud) === roundCoordinate(latitude) &&
      roundCoordinate(lastLocation.longitud) === roundCoordinate(longitude);

    const secondsSinceLast =
      (gpsTimestamp.getTime() - new Date(lastLocation.fecha_gps).getTime()) / 1000;

    if (sameCoordinates || secondsSinceLast < MIN_SECONDS_BETWEEN_POINTS) {
      return { saved: false, reason: "SIN_CAMBIO", trip };
    }
  }

  // Telegram no entrega velocidad en la ubicación en vivo, solo rumbo (course).
  // Queda en NULL y se deriva de los puntos consecutivos si se necesita.
  const location = await saveTripLocation({
    idViaje: trip.id_viajes,
    latitude,
    longitude,
    accuracy,
    speed: null,
    heading,
    gpsTimestamp,
    origen: "TELEGRAM_LIVE"
  });

  return { saved: true, trip, location };
}
