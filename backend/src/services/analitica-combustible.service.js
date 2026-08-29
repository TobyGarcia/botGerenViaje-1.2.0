import { databasePool } from "../database/pool.js";

const FUEL_PERCENT_MAP = {
  E: 0,
  "1/4": 25,
  "1/2": 50,
  "3/4": 75,
  F: 100
};

export async function getAdminAnaliticaCombustible({ idVehiculo = null, dateFrom = null, dateTo = null } = {}) {
  const params = [];
  const conditions = [];

  if (idVehiculo) {
    params.push(Number(idVehiculo));
    conditions.push(`i.id_vehiculos = $${params.length}`);
  }

  if (dateFrom) {
    params.push(dateFrom);
    conditions.push(`i.fecha_operativa >= $${params.length}::date`);
  }

  if (dateTo) {
    params.push(dateTo);
    conditions.push(`i.fecha_operativa <= $${params.length}::date`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const query = `
    SELECT
      i.id_inspeccion,
      i.id_viajes,
      i.id_vehiculos,
      i.id_conductores,
      i.fecha_operativa,
      i.combustible,
      i.estado AS estado_inspeccion,
      i.creado_en AS fecha_inspeccion,
      v.folio,
      v.kilometraje_inicial,
      v.kilometraje_final,
      v.kilometros_recorridos,
      v.fecha AS fecha_viaje,
      v.hora_salida,
      v.hora_llegada,
      ev.nombre AS estado_viaje,
      vh.nombre AS vehiculo_nombre,
      vh.numero_economico,
      vh.placas,
      vh.marca,
      vh.modelo,
      c.nombre AS conductor_nombre
    FROM inspecciones_vehiculares i
    INNER JOIN viajes v ON v.id_viajes = i.id_viajes
    INNER JOIN vehiculos vh ON vh.id_vehiculos = i.id_vehiculos
    INNER JOIN conductores c ON c.id_conductores = i.id_conductores
    INNER JOIN estados_viaje ev ON ev.id_estado_viaje = v.id_estado_viaje
    ${whereClause}
    ORDER BY vh.numero_economico ASC, i.fecha_operativa ASC, i.creado_en ASC
  `;

  const result = await databasePool.query(query, params);
  const rows = result.rows;

  // Procesar lecturas cronológicas y calcular deltas por vehículo
  const lecturasPorVehiculo = {};
  let totalKmMonitoreados = 0;
  let sumaPorcentajesCombustible = 0;
  let cantidadLecturas = rows.length;

  rows.forEach((row) => {
    const fuelPercent = FUEL_PERCENT_MAP[row.combustible] ?? 0;
    sumaPorcentajesCombustible += fuelPercent;

    if (!lecturasPorVehiculo[row.id_vehiculos]) {
      lecturasPorVehiculo[row.id_vehiculos] = {
        id_vehiculos: row.id_vehiculos,
        vehiculo_nombre: row.vehiculo_nombre,
        numero_economico: row.numero_economico,
        placas: row.placas,
        marca: row.marca,
        modelo: row.modelo,
        lecturas: []
      };
    }

    const prevLectura = lecturasPorVehiculo[row.id_vehiculos].lecturas.slice(-1)[0];
    let kmDeltaDesdeAnterior = null;
    let consumoDeltaPorcentaje = null;

    if (prevLectura) {
      kmDeltaDesdeAnterior = row.kilometraje_inicial - prevLectura.kilometraje_inicial;
      if (kmDeltaDesdeAnterior < 0) kmDeltaDesdeAnterior = 0;
      consumoDeltaPorcentaje = prevLectura.combustible_porcentaje - fuelPercent;
    }

    if (row.kilometros_recorridos && row.kilometros_recorridos > 0) {
      totalKmMonitoreados += Number(row.kilometros_recorridos);
    } else if (kmDeltaDesdeAnterior && kmDeltaDesdeAnterior > 0) {
      totalKmMonitoreados += kmDeltaDesdeAnterior;
    }

    lecturasPorVehiculo[row.id_vehiculos].lecturas.push({
      id_inspeccion: row.id_inspeccion,
      id_viajes: row.id_viajes,
      folio: row.folio,
      fecha_operativa: row.fecha_operativa,
      fecha_inspeccion: row.fecha_inspeccion,
      conductor_nombre: row.conductor_nombre,
      combustible: row.combustible,
      combustible_porcentaje: fuelPercent,
      kilometraje_inicial: Number(row.kilometraje_inicial),
      kilometraje_final: row.kilometraje_final ? Number(row.kilometraje_final) : null,
      kilometros_recorridos: row.kilometros_recorridos ? Number(row.kilometros_recorridos) : null,
      km_delta_anterior: kmDeltaDesdeAnterior,
      consumo_delta_porcentaje: consumoDeltaPorcentaje,
      estado_viaje: row.estado_viaje,
      estado_inspeccion: row.estado_inspeccion
    });
  });

  const promedioCombustible = cantidadLecturas > 0 ? Math.round(sumaPorcentajesCombustible / cantidadLecturas) : 0;

  // Formatear respuesta plana y agrupada por vehículo
  const vehiculosResumen = Object.values(lecturasPorVehiculo).map((v) => {
    const kmTotalVehiculo = v.lecturas.reduce((acc, curr) => acc + (curr.kilometros_recorridos || curr.km_delta_anterior || 0), 0);
    const lecturasConCombustibleUsado = v.lecturas.filter((l) => l.consumo_delta_porcentaje !== null && l.consumo_delta_porcentaje > 0);
    
    let kmPorcentajeConsumidoPromedio = null;
    if (lecturasConCombustibleUsado.length > 0) {
      const totalKmUtil = lecturasConCombustibleUsado.reduce((acc, curr) => acc + (curr.km_delta_anterior || 0), 0);
      const totalPctUtil = lecturasConCombustibleUsado.reduce((acc, curr) => acc + curr.consumo_delta_porcentaje, 0);
      if (totalPctUtil > 0) {
        kmPorcentajeConsumidoPromedio = Math.round((totalKmUtil / totalPctUtil) * 10) / 10;
      }
    }

    return {
      ...v,
      total_lecturas: v.lecturas.length,
      km_total_monitoreado: kmTotalVehiculo,
      km_por_porcentaje_promedio: kmPorcentajeConsumidoPromedio
    };
  });

  return {
    kpis: {
      total_inspecciones: cantidadLecturas,
      total_km_monitoreados: totalKmMonitoreados,
      promedio_combustible_inicial: promedioCombustible,
      total_vehiculos_analizados: vehiculosResumen.length
    },
    vehiculos: vehiculosResumen,
    lecturas_lineales: rows.map((row) => ({
      id_inspeccion: row.id_inspeccion,
      id_viajes: row.id_viajes,
      id_vehiculos: row.id_vehiculos,
      vehiculo: `${row.vehiculo_nombre} (${row.numero_economico})`,
      numero_economico: row.numero_economico,
      folio: row.folio,
      conductor: row.conductor_nombre,
      fecha_operativa: row.fecha_operativa,
      combustible: row.combustible,
      combustible_porcentaje: FUEL_PERCENT_MAP[row.combustible] ?? 0,
      kilometraje_inicial: Number(row.kilometraje_inicial),
      kilometros_recorridos: row.kilometros_recorridos ? Number(row.kilometros_recorridos) : 0,
      estado_viaje: row.estado_viaje
    }))
  };
}
