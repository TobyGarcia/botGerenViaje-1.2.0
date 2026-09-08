import { databasePool } from "../database/pool.js";
import { createTrip } from "./viajes.service.js";
import { saveInspection } from "./inspecciones.service.js";

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

  // Obtener datos por defecto del conductor si no vienen en data
  let cLicNumero = data.licenciaNumero || data.licencia_numero || null;
  let cLicTipo = data.licenciaTipo || data.licencia_tipo || null;
  let cLicVenc = data.licenciaVencimiento || data.licencia_vencimiento || null;
  let cTelefono = data.telefonoConductor || data.telefono_conductor || null;
  let cNombre = data.nombreConductor || data.nombre_conductor || null;

  if (idConductor) {
    try {
      const cRes = await databasePool.query(
        "SELECT nombre, licencia_numero, tipo_licencia, licencia_vencimiento, telefono FROM conductores WHERE id_conductores = $1",
        [idConductor]
      );
      if (cRes.rows[0]) {
        const c = cRes.rows[0];
        cNombre = cNombre || c.nombre;
        cLicNumero = cLicNumero || c.licencia_numero;
        cLicTipo = cLicTipo || c.tipo_licencia;
        cLicVenc = cLicVenc || c.licencia_vencimiento;
        cTelefono = cTelefono || c.telefono;
      }
    } catch (cErr) {
      console.warn("No se pudieron obtener datos del conductor para el gerenciamiento:", cErr.message);
    }
  }

  // Resoluciones dinámicas de Vehículo, Origen y Destino para la creación del viaje base
  let idVehiculo = data.idVehiculo ? Number(data.idVehiculo) : null;
  let idOrigen = data.idOrigen ? Number(data.idOrigen) : null;
  let idDestino = data.idDestino ? Number(data.idDestino) : null;

  if (!idVehiculo && (data.numeroUnidad || data.placa)) {
    try {
      const vRes = await databasePool.query(
        "SELECT id_vehiculos FROM vehiculos WHERE numero_economico = $1 OR placas = $2 OR nombre ILIKE $3 LIMIT 1",
        [data.numeroUnidad || "", data.placa || "", `%${data.numeroUnidad || data.placa}%`]
      );
      if (vRes.rows[0]) idVehiculo = vRes.rows[0].id_vehiculos;
    } catch (vErr) {}
  }
  if (!idVehiculo) {
    try {
      const vFirst = await databasePool.query("SELECT id_vehiculos FROM vehiculos WHERE activo = TRUE LIMIT 1");
      if (vFirst.rows[0]) idVehiculo = vFirst.rows[0].id_vehiculos;
    } catch (vErr) {}
  }

  if (!idOrigen && data.origenTexto) {
    try {
      const oRes = await databasePool.query("SELECT id_lugares FROM lugares WHERE nombre ILIKE $1 AND activo = TRUE LIMIT 1", [`%${data.origenTexto.trim()}%`]);
      if (oRes.rows[0]) idOrigen = oRes.rows[0].id_lugares;
    } catch (oErr) {}
  }
  if (!idOrigen) {
    try {
      const oFirst = await databasePool.query("SELECT id_lugares FROM lugares WHERE activo = TRUE ORDER BY id_lugares ASC LIMIT 1");
      if (oFirst.rows[0]) idOrigen = oFirst.rows[0].id_lugares;
    } catch (oErr) {}
  }

  if (!idDestino && data.destinoTexto) {
    try {
      const dRes = await databasePool.query("SELECT id_lugares FROM lugares WHERE nombre ILIKE $1 AND activo = TRUE LIMIT 1", [`%${data.destinoTexto.trim()}%`]);
      if (dRes.rows[0]) idDestino = dRes.rows[0].id_lugares;
    } catch (dErr) {}
  }
  if (!idDestino) {
    try {
      const dFirst = await databasePool.query("SELECT id_lugares FROM lugares WHERE activo = TRUE AND id_lugares != $1 ORDER BY id_lugares DESC LIMIT 1", [idOrigen || 0]);
      if (dFirst.rows[0]) idDestino = dFirst.rows[0].id_lugares;
    } catch (dErr) {}
  }

  // 1. Si no existe un id_viaje previo, crear el viaje base en estado PENDIENTE
  let idViaje = data.idViaje || null;
  if (!idViaje && idVehiculo && idOrigen && idDestino) {
    try {
      const acompanantesFormateados = Array.isArray(data.acompanantes)
        ? data.acompanantes.map((nombre) => (typeof nombre === 'string' ? { nombre } : nombre))
        : [];
      const newTrip = await createTrip({
        idConductor,
        idVehiculo,
        idOrigen,
        idDestino,
        acompanantes: acompanantesFormateados,
        kilometrajeInicial: Number(data.kilometraje || 0),
        motivo: data.motivo || `Gerenciamiento Fuera de Ciudad - Riesgo ${riesgo.nivelRiesgo}`,
        esGerenciamiento: true
      });
      idViaje = newTrip.id_viajes || newTrip.idViaje || null;
    } catch (tripErr) {
      console.error("[Gerenciamiento] Error al crear automáticamente el viaje base:", tripErr.message);
    }
  }

  // 2. Si se incluyeron datos de Inspección Vehicular en el formato de Gerenciamiento, registrarlos automáticamente
  if (idViaje && (data.inspeccionData || data.checklist)) {
    try {
      const rawTipo = String(data.tipoAsignacion || data.inspeccionData?.tipoAsignacion || "").toUpperCase();
      const tipoAsignacion = rawTipo === "TEMPORAL" ? "TEMPORAL" : "PERMANENTE";
      let combustible = data.inspeccionData?.combustible || data.combustible || "3/4";
      if (!['E', '1/4', '1/2', '3/4', 'F'].includes(combustible)) {
        combustible = "3/4";
      }

      const inspPayload = {
        combustible,
        tipoAsignacion,
        asignacionInicio: data.inspeccionData?.asignacionInicio || null,
        asignacionFin: data.inspeccionData?.asignacionFin || null,
        checklist: data.inspeccionData?.checklist || data.checklist || {},
        danos: data.inspeccionData?.danos || data.danos || {},
        observaciones: data.inspeccionData?.observaciones || data.observacionesVehiculo || data.observaciones || null,
        firma: data.inspeccionData?.firma || data.firmaConductor || null,
        esDiaSiguiente: Boolean(data.inspeccionData?.esDiaSiguiente || data.esDiaSiguiente)
      };
      await saveInspection({ idViaje, idConductor, data: inspPayload });
    } catch (inspErr) {
      console.error("[Gerenciamiento] Error al vincular la inspección vehicular:", inspErr.message);
    }
  }

  // Inicializar los sitios de reporte con la lista de puntos de ruta
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
    idOrigen,
    idDestino,
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
    data.vehiculoEmpresa !== false,
    data.nombreContratista || null,
    data.numeroUnidad || null,
    idConductor,
    cNombre,
    cLicNumero,
    cLicTipo,
    cLicVenc,
    cTelefono,
    JSON.stringify(rutaPuntos),
    Number(data.tiempoViajeHoras || 1),
    JSON.stringify(Array.isArray(data.acompanantes) ? data.acompanantes : []),
    JSON.stringify(sitiosReporte),
    data.conocimientoRiesgosLocales !== false,
    data.prohibidoPersonalAjeno !== false,
    data.inspeccionVehiculoRealizada !== false,
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
    data.nombreConductorFirma || cNombre || null
  ];

  const result = await databasePool.query(query, values);
  const created = result.rows[0];
  if (created?.id_gerenciamiento) {
    const full = await getGerenciamientoById(created.id_gerenciamiento);
    if (full) return full;
  }
  return created;
}

export async function getGerenciamientoById(idGerenciamiento) {
  const result = await databasePool.query(`
    SELECT g.*,
      COALESCE(NULLIF(g.nombre_conductor, ''), c.nombre) AS nombre_conductor,
      COALESCE(NULLIF(g.licencia_numero, ''), c.licencia_numero, 'N/A') AS licencia_numero,
      COALESCE(NULLIF(g.licencia_tipo, ''), c.tipo_licencia, 'Chofer') AS licencia_tipo,
      COALESCE(g.licencia_vencimiento, c.licencia_vencimiento) AS licencia_vencimiento,
      COALESCE(NULLIF(g.telefono_conductor, ''), c.telefono, 'N/A') AS telefono_conductor,
      o.nombre AS origen_nombre,
      d.nombre AS destino_nombre,
      i.id_inspeccion,
      i.combustible AS inspeccion_combustible,
      i.checklist AS inspeccion_checklist,
      i.danos AS inspeccion_danos,
      i.observaciones_conductor AS inspeccion_observaciones,
      i.estado AS inspeccion_estado,
      i.es_dia_siguiente AS inspeccion_es_dia_siguiente,
      i.firma_conductor AS inspeccion_firma_conductor,
      i.fecha_operativa AS inspeccion_fecha_operativa
    FROM gerenciamiento_viajes g
    LEFT JOIN conductores c ON c.id_conductores = g.id_conductor
    LEFT JOIN lugares o ON o.id_lugares = g.id_origen
    LEFT JOIN lugares d ON d.id_lugares = g.id_destino
    LEFT JOIN inspecciones_vehiculares i ON i.id_viajes = g.id_viaje
    WHERE g.id_gerenciamiento = $1
  `, [idGerenciamiento]);
  return result.rows[0] ?? null;
}

export async function getGerenciamientoByViaje(idViaje) {
  const result = await databasePool.query(`
    SELECT g.*,
      COALESCE(NULLIF(g.nombre_conductor, ''), c.nombre) AS nombre_conductor,
      COALESCE(NULLIF(g.licencia_numero, ''), c.licencia_numero, 'N/A') AS licencia_numero,
      COALESCE(NULLIF(g.licencia_tipo, ''), c.tipo_licencia, 'Chofer') AS licencia_tipo,
      COALESCE(g.licencia_vencimiento, c.licencia_vencimiento) AS licencia_vencimiento,
      COALESCE(NULLIF(g.telefono_conductor, ''), c.telefono, 'N/A') AS telefono_conductor,
      o.nombre AS origen_nombre,
      d.nombre AS destino_nombre,
      i.id_inspeccion,
      i.combustible AS inspeccion_combustible,
      i.checklist AS inspeccion_checklist,
      i.danos AS inspeccion_danos,
      i.observaciones_conductor AS inspeccion_observaciones,
      i.estado AS inspeccion_estado,
      i.es_dia_siguiente AS inspeccion_es_dia_siguiente,
      i.firma_conductor AS inspeccion_firma_conductor,
      i.fecha_operativa AS inspeccion_fecha_operativa
    FROM gerenciamiento_viajes g
    LEFT JOIN conductores c ON c.id_conductores = g.id_conductor
    LEFT JOIN lugares o ON o.id_lugares = g.id_origen
    LEFT JOIN lugares d ON d.id_lugares = g.id_destino
    LEFT JOIN inspecciones_vehiculares i ON i.id_viajes = g.id_viaje
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
      COALESCE(NULLIF(g.nombre_conductor, ''), c.nombre) AS conductor_nombre,
      COALESCE(NULLIF(g.licencia_numero, ''), c.licencia_numero, 'N/A') AS licencia_numero,
      COALESCE(NULLIF(g.licencia_tipo, ''), c.tipo_licencia, 'Chofer') AS licencia_tipo,
      COALESCE(g.licencia_vencimiento, c.licencia_vencimiento) AS licencia_vencimiento,
      COALESCE(NULLIF(g.telefono_conductor, ''), c.telefono, 'N/A') AS telefono_conductor,
      o.nombre AS origen_nombre,
      d.nombre AS destino_nombre,
      i.id_inspeccion,
      i.combustible AS inspeccion_combustible,
      i.checklist AS inspeccion_checklist,
      i.danos AS inspeccion_danos,
      i.observaciones_conductor AS inspeccion_observaciones,
      i.estado AS inspeccion_estado,
      i.es_dia_siguiente AS inspeccion_es_dia_siguiente,
      i.firma_conductor AS inspeccion_firma_conductor,
      i.fecha_operativa AS inspeccion_fecha_operativa
    FROM gerenciamiento_viajes g
    LEFT JOIN conductores c ON c.id_conductores = g.id_conductor
    LEFT JOIN lugares o ON o.id_lugares = g.id_origen
    LEFT JOIN lugares d ON d.id_lugares = g.id_destino
    LEFT JOIN inspecciones_vehiculares i ON i.id_viajes = g.id_viaje
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

    // Consultar registro para validar nivel de riesgo
    const checkRes = await client.query("SELECT id_gerenciamiento, nivel_riesgo, id_viaje, id_conductor, id_origen, id_destino, numero_unidad, placa, acompanantes, kilometraje FROM gerenciamiento_viajes WHERE id_gerenciamiento = $1", [idGerenciamiento]);
    const recordCheck = checkRes.rows[0];

    if (estado === 'APROBADO' && recordCheck && idUsuarioAdmin) {
      const userRes = await client.query("SELECT rol FROM usuarios_admin WHERE id_usuarios_admin = $1", [idUsuarioAdmin]);
      const userRol = String(userRes.rows[0]?.rol || "").toUpperCase();

      const rolesBajo = ['SUPERVISOR', 'QHSE', 'COORDINADOR', 'COORDINADOR_AREA', 'COORDINADOR_QHSE', 'GERENTE', 'GERENTE_GENERAL', 'ADMINISTRADOR', 'ADMIN', 'INSTRUCTOR'];
      const rolesMedio = ['COORDINADOR', 'COORDINADOR_AREA', 'COORDINADOR_QHSE', 'GERENTE', 'GERENTE_GENERAL', 'ADMINISTRADOR', 'ADMIN'];
      const rolesAlto = ['GERENTE', 'GERENTE_GENERAL', 'ADMINISTRADOR', 'ADMIN'];

      if (recordCheck.nivel_riesgo === 'BAJO' && !rolesBajo.includes(userRol)) {
        throw new Error("El nivel de Riesgo BAJO (0-15 pts) requiere la aprobación de Supervisor o superior.");
      }
      if (recordCheck.nivel_riesgo === 'MEDIO' && !rolesMedio.includes(userRol)) {
        throw new Error("El nivel de Riesgo MEDIO (16-22 pts) requiere la aprobación de Coordinador o superior.");
      }
      if (recordCheck.nivel_riesgo === 'ALTO' && !rolesAlto.includes(userRol)) {
        throw new Error("El nivel de Riesgo ALTO (>23 pts) requiere la aprobación de Gerente o Administrador.");
      }
    }

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

    // Al APROBAR el Gerenciamiento, habilitar el viaje en estado PENDIENTE listo para iniciar y aprobar inspección
    if (record) {
      if (estado === 'APROBADO') {
        let targetViajeId = record.id_viaje;
        if (!targetViajeId) {
          try {
            let idVehiculo = null;
            if (record.numero_unidad || record.placa) {
              const vRes = await client.query("SELECT id_vehiculos FROM vehiculos WHERE numero_economico = $1 OR placas = $2 LIMIT 1", [record.numero_unidad || "", record.placa || ""]);
              if (vRes.rows[0]) idVehiculo = vRes.rows[0].id_vehiculos;
            }
            if (!idVehiculo) {
              const vFirst = await client.query("SELECT id_vehiculos FROM vehiculos WHERE activo = TRUE LIMIT 1");
              if (vFirst.rows[0]) idVehiculo = vFirst.rows[0].id_vehiculos;
            }

            let idOrigen = record.id_origen;
            if (!idOrigen) {
              const oFirst = await client.query("SELECT id_lugares FROM lugares WHERE activo = TRUE ORDER BY id_lugares ASC LIMIT 1");
              if (oFirst.rows[0]) idOrigen = oFirst.rows[0].id_lugares;
            }

            let idDestino = record.id_destino;
            if (!idDestino) {
              const dFirst = await client.query("SELECT id_lugares FROM lugares WHERE activo = TRUE AND id_lugares != $1 ORDER BY id_lugares DESC LIMIT 1", [idOrigen || 0]);
              if (dFirst.rows[0]) idDestino = dFirst.rows[0].id_lugares;
            }

            if (idVehiculo && idOrigen && idDestino) {
              const newTrip = await createTrip({
                idConductor: record.id_conductor,
                idVehiculo,
                idOrigen,
                idDestino,
                acompanantes: record.acompanantes || [],
                kilometrajeInicial: Number(record.kilometraje || 0),
                motivo: `Gerenciamiento Fuera de Ciudad - Riesgo ${record.nivel_riesgo}`,
                esGerenciamiento: true
              });
              targetViajeId = newTrip.id_viajes || newTrip.idViaje || null;
              if (targetViajeId) {
                await client.query("UPDATE gerenciamiento_viajes SET id_viaje = $1 WHERE id_gerenciamiento = $2", [targetViajeId, record.id_gerenciamiento]);
                record.id_viaje = targetViajeId;
              }
            }
          } catch (tErr) {
            console.warn("[GerenciamientoViajes] No se pudo crear viaje al aprobar:", tErr.message);
          }
        }

        if (targetViajeId) {
          await client.query(`
            UPDATE viajes
            SET id_estado_viaje = (SELECT id_estado_viaje FROM estados_viaje WHERE nombre = 'PENDIENTE' LIMIT 1),
                actualizado_en = CURRENT_TIMESTAMP
            WHERE id_viajes = $1
          `, [targetViajeId]);

          await client.query(`
            UPDATE inspecciones_vehiculares
            SET estado = 'APROBADA',
                id_usuario_admin_aprobador = $1,
                firma_supervisor = $2,
                comentario_aprobacion = $3,
                aprobado_en = CURRENT_TIMESTAMP,
                actualizado_en = CURRENT_TIMESTAMP
            WHERE id_viajes = $4 OR (id_conductores = $5 AND fecha_operativa = CURRENT_DATE)
          `, [idUsuarioAdmin, firmaAutorizador, observaciones, targetViajeId, record.id_conductor]);
        }
      } else if (estado === 'RECHAZADO' && record.id_viaje) {
        await client.query(`
          UPDATE viajes
          SET id_estado_viaje = (SELECT id_estado_viaje FROM estados_viaje WHERE nombre = 'CANCELADO' LIMIT 1),
              actualizado_en = CURRENT_TIMESTAMP
          WHERE id_viajes = $1
        `, [record.id_viaje]);

        await client.query(`
          UPDATE inspecciones_vehiculares
          SET estado = 'RECHAZADA',
              id_usuario_admin_aprobador = $1,
              comentario_aprobacion = $2,
              actualizado_en = CURRENT_TIMESTAMP
          WHERE id_viajes = $3
        `, [idUsuarioAdmin, observaciones, record.id_viaje]);
      }
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

  return updateRes.rows[0];
}

export async function storeGerenciamientoPdf({ idGerenciamiento, nombre, document }) {
  await databasePool.query(
    `UPDATE gerenciamiento_viajes
     SET pdf_nombre=$1, pdf_documento=$2, actualizado_en=CURRENT_TIMESTAMP
     WHERE id_gerenciamiento=$3`,
    [nombre, document, idGerenciamiento]
  );
}

export async function updateGerenciamientoSharePointDetails({ idGerenciamiento, webUrl, itemId }) {
  await databasePool.query(
    `UPDATE gerenciamiento_viajes
     SET sharepoint_web_url=$1, sharepoint_item_id=$2, sharepoint_subido_en=CURRENT_TIMESTAMP, actualizado_en=CURRENT_TIMESTAMP
     WHERE id_gerenciamiento=$3`,
    [webUrl, itemId, idGerenciamiento]
  );
}

export async function getStoredGerenciamientoPdf(idGerenciamiento) {
  const result = await databasePool.query(
    "SELECT pdf_nombre, pdf_documento, sharepoint_web_url FROM gerenciamiento_viajes WHERE id_gerenciamiento=$1",
    [idGerenciamiento]
  );
  return result.rows[0] ?? null;
}
