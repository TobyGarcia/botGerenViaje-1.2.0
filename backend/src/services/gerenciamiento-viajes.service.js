import { databasePool } from "../database/pool.js";
import { createTrip } from "./viajes.service.js";

/**
 * Calcula de manera centralizada el Análisis de Riesgo (Tabuladores A al G)
 */
export function calcularAnalisisRiesgo(data) {
  const ptsDistancia = Number(data.ptsDistancia || 1);
  const ptsClima = Number(data.ptsClima || 2);
  const ptsVehiculosPersonas = Number(data.ptsVehiculosPersonas || 1);
  const ptsCondicionesVia = Number(data.ptsCondicionesVia || 1);
  const ptsComunicaciones = Number(data.ptsComunicaciones || 0);
  const ptsHorasTrabajadas = Number(data.ptsHorasTrabajadas || 1);
  const ptsHoraTraslado = Number(data.ptsHoraTraslado || 1);

  const total = ptsDistancia + ptsClima + ptsVehiculosPersonas + ptsCondicionesVia + ptsComunicaciones + ptsHorasTrabajadas + ptsHoraTraslado;

  let nivelRiesgo = "BAJO";
  let autorizacionRequerida = "SUPERVISOR DIRECTO O QHSE";

  if (total > 23) {
    nivelRiesgo = "ALTO";
    autorizacionRequerida = "GERENCIA GENERAL Y QHSE";
  } else if (total >= 16) {
    nivelRiesgo = "MEDIO";
    autorizacionRequerida = "COORDINACIÓN DE ÁREA";
  }

  const esBloqueanteHoras = Boolean(data.esBloqueanteHoras || data.horasTotal >= 16 || ptsHorasTrabajadas >= 16);
  const requiereAprobacionNocturna = Boolean(ptsHoraTraslado >= 8);

  return {
    ptsDistancia,
    ptsClima,
    ptsVehiculosPersonas,
    ptsCondicionesVia,
    ptsComunicaciones,
    ptsHorasTrabajadas,
    ptsHoraTraslado,
    puntajeTotal: total,
    nivelRiesgo,
    autorizacionRequerida,
    esBloqueanteHoras,
    requiereAprobacionNocturna
  };
}

export async function createGerenciamientoViaje({ idConductor, data }) {
  const riesgo = calcularAnalisisRiesgo(data);

  if (riesgo.esBloqueanteHoras) {
    throw new Error("Horas de trabajo + Horas de Viaje >= 16 Horas: NO CONDUCIR (Riesgo Bloqueante).");
  }

  // 1. Si no existe un id_viaje previo, crear el viaje base en estado PENDIENTE
  let idViaje = data.idViaje || null;
  if (!idViaje && data.idVehiculo && data.idOrigen && data.idDestino) {
    try {
      const acompanantesFormateados = Array.isArray(data.acompanantes)
        ? data.acompanantes.map((nombre) => (typeof nombre === 'string' ? { nombre } : nombre))
        : [];

      const newTrip = await createTrip({
        idConductor,
        idVehiculo: Number(data.idVehiculo),
        idOrigen: Number(data.idOrigen),
        idDestino: Number(data.idDestino),
        acompanantes: acompanantesFormateados,
        kilometrajeInicial: Number(data.kilometraje || 0),
        motivo: data.motivo || `Gerenciamiento Fuera de Ciudad - Riesgo ${riesgo.nivelRiesgo}`
      });
      idViaje = newTrip.id_viajes || newTrip.idViaje || null;
    } catch (tripErr) {
      console.warn("No se pudo crear automáticamente el registro de viaje base:", tripErr.message);
    }
  }

  // Inicializar los sitios de reporte con la lista de puntos de ruta (sin hora inicial)
  const rutaPuntos = Array.isArray(data.rutaPuntos) ? data.rutaPuntos.filter(Boolean) : [];
  const sitiosReporte = rutaPuntos.map((punto) => ({
    punto,
    horaReportada: null
  }));

  const query = `
    INSERT INTO gerenciamiento_viajes (
      id_viaje, folio_documento, version_documento, area_responsable, departamento,
      fecha_emision, hora_salida, id_origen, id_destino, origen_texto, destino_texto,
      kilometraje, presion_arterial, examen_visual, glucosa, alcoholimetro,
      frecuencia_cardiaca, frecuencia_respiratoria, tipo_vehiculo, placa, modelo,
      color, vehiculo_empresa, nombre_contratista, numero_unidad, id_conductor,
      nombre_conductor, licencia_numero, licencia_tipo, licencia_vencimiento,
      telefono_conductor, ruta_puntos, tiempo_viaje_horas, acompanantes, sitios_reporte,
      conocimiento_riesgos_locales, prohibido_personal_ajeno, inspeccion_vehiculo_realizada,
      reunion_pre_caravana_realizada, pts_distancia, pts_clima, pts_vehiculos_personas,
      pts_condiciones_via, pts_comunicaciones, pts_horas_trabajadas, pts_hora_traslado,
      puntaje_total, nivel_riesgo, autorizacion_requerida, es_bloqueante_horas,
      requiere_aprobacion_nocturna, firma_conductor, nombre_conductor_firma, estado
    ) VALUES (
      $1, COALESCE($2, 'SII-MX-23-LOG-003'), COALESCE($3, '3.0'), COALESCE($4, 'Logística'), $5,
      $6, $7, $8, $9, $10, $11,
      $12, $13, $14, $15, $16,
      $17, $18, $19, $20, $21,
      $22, $23, $24, $25, $26,
      $27, $28, $29, $30,
      $31, $32::jsonb, $33, $34::jsonb, $35::jsonb,
      $36, $37, $38,
      $39, $40, $41, $42,
      $43, $44, $45, $46,
      $47, $48, $49, $50,
      $51, $52, $53, 'PENDIENTE'
    )
    RETURNING *;
  `;

  const values = [
    idViaje,
    data.folioDocumento || 'SII-MX-23-LOG-003',
    data.versionDocumento || '3.0',
    data.areaResponsable || 'Logística',
    data.departamento || null,
    data.fechaEmision || new Date().toISOString().split('T')[0],
    data.horaSalida || null,
    data.idOrigen || null,
    data.idDestino || null,
    data.origenTexto || null,
    data.destinoTexto || null,
    Number(data.kilometraje || 0),
    data.presionArterial || null,
    data.examenVisual || null,
    data.glucosa || null,
    Boolean(data.alcoholimetro),
    data.frecuenciaCardiaca || null,
    data.frecuenciaRespiratoria || null,
    data.tipoVehiculo || null,
    data.placa || null,
    data.modelo || null,
    data.color || null,
    data.vehiculoEmpresa !== undefined ? Boolean(data.vehiculoEmpresa) : true,
    data.nombreContratista || null,
    data.numeroUnidad || null,
    idConductor,
    data.nombreConductor || null,
    data.licenciaNumero || null,
    data.licenciaTipo || null,
    data.licenciaVencimiento || null,
    data.telefonoConductor || null,
    JSON.stringify(rutaPuntos),
    Number(data.tiempoViajeHoras || 0),
    JSON.stringify(data.acompanantes || []),
    JSON.stringify(sitiosReporte),
    data.conocimientoRiesgosLocales !== undefined ? Boolean(data.conocimientoRiesgosLocales) : true,
    data.prohibidoPersonalAjeno !== undefined ? Boolean(data.prohibidoPersonalAjeno) : true,
    data.inspeccionVehiculoRealizada !== undefined ? Boolean(data.inspeccionVehiculoRealizada) : true,
    Boolean(data.reunionPreCaravanaRealizada),
    riesgo.ptsDistancia,
    riesgo.ptsClima,
    riesgo.ptsVehiculosPersonas,
    riesgo.ptsCondicionesVia,
    riesgo.ptsComunicaciones,
    riesgo.ptsHorasTrabajadas,
    riesgo.ptsHoraTraslado,
    riesgo.puntajeTotal,
    riesgo.nivelRiesgo,
    riesgo.autorizacionRequerida,
    riesgo.esBloqueanteHoras,
    riesgo.requiereAprobacionNocturna,
    data.firmaConductor || null,
    data.nombreConductorFirma || data.nombreConductor || null
  ];

  const result = await databasePool.query(query, values);
  return result.rows[0];
}

export async function getGerenciamientoById(idGerenciamiento) {
  const result = await databasePool.query(`
    SELECT g.*,
      o.nombre AS origen_nombre,
      d.nombre AS destino_nombre
    FROM gerenciamiento_viajes g
    LEFT JOIN lugares o ON o.id_lugares = g.id_origen
    LEFT JOIN lugares d ON d.id_lugares = g.id_destino
    WHERE g.id_gerenciamiento = $1
  `, [idGerenciamiento]);
  return result.rows[0] ?? null;
}

export async function getGerenciamientoByViaje(idViaje) {
  const result = await databasePool.query(`
    SELECT g.*,
      o.nombre AS origen_nombre,
      d.nombre AS destino_nombre
    FROM gerenciamiento_viajes g
    LEFT JOIN lugares o ON o.id_lugares = g.id_origen
    LEFT JOIN lugares d ON d.id_lugares = g.id_destino
    WHERE g.id_viaje = $1
    ORDER BY g.id_gerenciamiento DESC
    LIMIT 1
  `, [idViaje]);
  return result.rows[0] ?? null;
}

export async function listGerenciamientos({ estado, nivelRiesgo, idConductor, limit = 50, offset = 0 } = {}) {
  let whereClauses = [];
  let values = [];
  let paramIndex = 1;

  if (estado) {
    whereClauses.push(`g.estado = $${paramIndex++}`);
    values.push(estado);
  }
  if (nivelRiesgo) {
    whereClauses.push(`g.nivel_riesgo = $${paramIndex++}`);
    values.push(nivelRiesgo);
  }
  if (idConductor) {
    whereClauses.push(`g.id_conductor = $${paramIndex++}`);
    values.push(idConductor);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  values.push(limit);
  const limitParam = `$${paramIndex++}`;
  values.push(offset);
  const offsetParam = `$${paramIndex++}`;

  const query = `
    SELECT g.*,
      c.nombre AS conductor_nombre,
      o.nombre AS origen_nombre,
      d.nombre AS destino_nombre
    FROM gerenciamiento_viajes g
    LEFT JOIN conductores c ON c.id_conductores = g.id_conductor
    LEFT JOIN lugares o ON o.id_lugares = g.id_origen
    LEFT JOIN lugares d ON d.id_lugares = g.id_destino
    ${whereSql}
    ORDER BY g.creado_en DESC
    LIMIT ${limitParam} OFFSET ${offsetParam}
  `;

  const result = await databasePool.query(query, values);
  return result.rows;
}

export async function aprovarGerenciamiento({ idGerenciamiento, idUsuarioAdmin, nombreAutorizador, firmaAutorizador, estado = 'APROBADO', observaciones = null }) {
  const client = await databasePool.connect();
  try {
    await client.query("BEGIN");

    const updateRes = await client.query(`
      UPDATE gerenciamiento_viajes
      SET estado = $1,
          id_usuario_autorizador = $2,
          nombre_autorizador_firma = $3,
          firma_autorizador = $4,
          fecha_firma_autorizador = CURRENT_TIMESTAMP,
          observaciones = COALESCE($5, observaciones),
          actualizado_en = CURRENT_TIMESTAMP
      WHERE id_gerenciamiento = $6
      RETURNING *
    `, [estado, idUsuarioAdmin, nombreAutorizador, firmaAutorizador, observaciones, idGerenciamiento]);

    const record = updateRes.rows[0];

    // Si fue APROBADO y tiene viaje vinculado, asegurar que el viaje quede listo en PENDIENTE para la inspección vehicular
    if (record && estado === 'APROBADO' && record.id_viaje) {
      await client.query(`
        UPDATE viajes
        SET id_estado_viaje = (SELECT id_estado_viaje FROM estados_viaje WHERE nombre = 'PENDIENTE' LIMIT 1),
            actualizado_en = CURRENT_TIMESTAMP
        WHERE id_viajes = $1
      `, [record.id_viaje]);
    }

    await client.query("COMMIT");
    return record ?? null;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function registrarReporteHoraPoint({ idGerenciamiento, puntoIndex, horaReportada }) {
  const currentRes = await databasePool.query(`
    SELECT sitios_reporte FROM gerenciamiento_viajes WHERE id_gerenciamiento = $1
  `, [idGerenciamiento]);

  if (currentRes.rows.length === 0) {
    throw new Error("No se encontró el gerenciamiento de viaje.");
  }

  let sitios = currentRes.rows[0].sitios_reporte || [];
  if (sitios[puntoIndex]) {
    sitios[puntoIndex].horaReportada = horaReportada || new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }

  const updateRes = await databasePool.query(`
    UPDATE gerenciamiento_viajes
    SET sitios_reporte = $1::jsonb,
        actualizado_en = CURRENT_TIMESTAMP
    WHERE id_gerenciamiento = $2
    RETURNING *
  `, [JSON.stringify(sitios), idGerenciamiento]);

  return updateRes.rows[0];
}
