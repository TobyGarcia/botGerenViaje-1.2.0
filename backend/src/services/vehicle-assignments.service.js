const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function validDate(value) {
  if (!ISO_DATE.test(String(value || ""))) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(+date) && date.toISOString().slice(0, 10) === value;
}

export async function ensureVehicleAssignment({ client, idConductor, idVehiculo, operationalDate, temporaryUse = null }) {
  const vehicle = (await client.query(
    `SELECT id_vehiculos, id_conductor_asignado FROM vehiculos
     WHERE id_vehiculos=$1 AND activo=TRUE AND en_mantenimiento=FALSE FOR UPDATE`,
    [idVehiculo]
  )).rows[0];
  if (!vehicle) throw new Error("El vehículo no existe, está inactivo o en mantenimiento.");
  if (Number(vehicle.id_conductor_asignado) === Number(idConductor)) {
    return { type: "PERMANENTE", idAssignment: null };
  }

  const existing = (await client.query(
    `SELECT id_asignacion_temporal FROM asignaciones_temporales_vehiculo
     WHERE id_conductores=$1 AND id_vehiculos=$2 AND estado='ACTIVA'
       AND $3::date BETWEEN fecha_inicio AND fecha_fin
     ORDER BY fecha_fin DESC LIMIT 1`,
    [idConductor, idVehiculo, operationalDate]
  )).rows[0];
  if (existing) return { type: "TEMPORAL", idAssignment: existing.id_asignacion_temporal };

  const mode = String(temporaryUse?.mode || "").toUpperCase();
  let start = operationalDate;
  let end = operationalDate;
  if (mode === "PERIODO") {
    start = String(temporaryUse.start || "");
    end = String(temporaryUse.end || "");
    if (!validDate(start) || !validDate(end) || end < start) {
      throw new Error("El periodo temporal no es válido.");
    }
  } else if (mode !== "SOLO_HOY") {
    throw new Error("La unidad no es la asignación permanente. Selecciona uso temporal solo hoy u otro periodo.");
  }
  if (operationalDate < start || operationalDate > end) {
    throw new Error("El periodo temporal debe incluir la fecha operativa del viaje.");
  }

  await client.query("SELECT pg_advisory_xact_lock(hashtext('asignacion-conductor:' || $1))", [String(idConductor)]);
  await client.query("SELECT pg_advisory_xact_lock(hashtext('asignacion-vehiculo:' || $1))", [String(idVehiculo)]);

  const activeTripWithAnotherVehicle = (await client.query(
    `SELECT 1 FROM viajes v
     INNER JOIN estados_viaje e ON e.id_estado_viaje=v.id_estado_viaje
     WHERE v.id_conductores=$1 AND v.id_vehiculos<>$2 AND e.nombre='EN_CURSO'
     LIMIT 1`,
    [idConductor, idVehiculo]
  )).rowCount > 0;
  if (activeTripWithAnotherVehicle) {
    throw new Error("El conductor tiene un viaje en curso con otra unidad y debe finalizarlo antes de cambiar de vehículo.");
  }

  const vehicleInUseByAnotherDriver = (await client.query(
    `SELECT 1 FROM viajes v
     INNER JOIN estados_viaje e ON e.id_estado_viaje=v.id_estado_viaje
     WHERE v.id_vehiculos=$2 AND v.id_conductores<>$1 AND e.nombre='EN_CURSO'
     LIMIT 1`,
    [idConductor, idVehiculo]
  )).rowCount > 0;
  if (vehicleInUseByAnotherDriver) {
    throw new Error("La unidad tiene un viaje en curso con otro conductor y no está disponible.");
  }

  await client.query(
    `UPDATE asignaciones_temporales_vehiculo
     SET estado='CANCELADA', actualizado_en=CURRENT_TIMESTAMP
     WHERE estado='ACTIVA'
       AND fecha_inicio <= $4::date AND fecha_fin >= $3::date
       AND ((id_conductores=$1 AND id_vehiculos<>$2)
         OR (id_vehiculos=$2 AND id_conductores<>$1))`,
    [idConductor, idVehiculo, start, end]
  );

  const conflict = (await client.query(
    `SELECT 1 FROM asignaciones_temporales_vehiculo
     WHERE estado='ACTIVA' AND fecha_inicio <= $4::date AND fecha_fin >= $3::date
       AND ((id_conductores=$1 AND id_vehiculos<>$2) OR (id_vehiculos=$2 AND id_conductores<>$1))
     LIMIT 1`,
    [idConductor, idVehiculo, start, end]
  )).rowCount > 0;
  if (conflict) throw new Error("El conductor o la unidad ya tiene otra asignación temporal en ese periodo.");

  const assignment = (await client.query(
    `INSERT INTO asignaciones_temporales_vehiculo
       (id_conductores,id_vehiculos,fecha_inicio,fecha_fin,origen)
     VALUES ($1,$2,$3,$4,'CONDUCTOR')
     ON CONFLICT (id_conductores,id_vehiculos,fecha_inicio,fecha_fin)
     DO UPDATE SET estado='ACTIVA', actualizado_en=CURRENT_TIMESTAMP
     RETURNING id_asignacion_temporal`,
    [idConductor, idVehiculo, start, end]
  )).rows[0];
  return { type: "TEMPORAL", idAssignment: assignment.id_asignacion_temporal, start, end };
}
