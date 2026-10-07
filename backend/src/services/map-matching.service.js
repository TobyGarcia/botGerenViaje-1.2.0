import { databasePool } from "../database/pool.js";

// Instancia propia de OSRM. Se usa autohospedada y no el servidor demo publico
// por tres razones: el publico rechaza mas de 10 coordenadas por peticion
// (code TooBig), sus limites de tasa no soportan un viaje largo, y las
// coordenadas de los conductores no deben salir a un tercero.
const OSRM_URL =
  process.env.OSRM_URL || "http://osrm-routing:5000";

const OSRM_TIMEOUT_MS =
  Number(process.env.OSRM_TIMEOUT_MS) || 30000;

// Por debajo de esta confianza el ajuste no se presenta como recorrido: OSRM
// entrega una geometria plausible aunque los puntos no la sustenten, y en un
// sistema de auditoria una ruta inventada que se ve real es peor que un hueco
// visible. Medido sobre datos reales: 9 puntos dispersos produjeron una ruta
// de 32 km con confianza 0.010.
const UMBRAL_CONFIANZA =
  Number(process.env.OSRM_MIN_CONFIDENCE) || 0.5;

// El radio de busqueda por punto sale de su propia precision GPS: un fix de
// 4 m ancla con firmeza, uno de 30 m necesita mas margen.
const RADIO_MINIMO = 18;
const RADIO_MAXIMO = 35;

function radioDe(precisionMetros) {
  const precision = Number(precisionMetros);
  if (!Number.isFinite(precision)) return RADIO_MINIMO;
  return Math.max(
    RADIO_MINIMO,
    Math.min(RADIO_MAXIMO, Math.round(precision * 1.5))
  );
}

async function obtenerPuntos(idViaje) {
  const resultado = await databasePool.query(
    `
      SELECT
        latitud,
        longitud,
        precision_metros,
        fecha_gps,
        es_punto_intermedio,
        nombre_punto
      FROM ubicaciones_viaje
      WHERE id_viajes = $1
      ORDER BY fecha_gps ASC, id_ubicaciones_viaje ASC
    `,
    [idViaje]
  );

  return resultado.rows;
}

/**
 * Descarta puntos consecutivos en la misma coordenada.
 *
 * Un fix repetido no aporta informacion al modelo de Markov y sí penaliza la
 * confianza, porque OSRM lo lee como un vehiculo detenido a mitad de la traza.
 * Sobre los datos historicos esto reduce trazas de 73 puntos a 9 reales.
 */
function deduplicar(puntos) {
  const salida = [];

  for (const punto of puntos) {
    const anterior = salida[salida.length - 1];

    if (
      anterior &&
      Number(anterior.latitud) === Number(punto.latitud) &&
      Number(anterior.longitud) === Number(punto.longitud)
    ) {
      continue;
    }

    salida.push(punto);
  }

  return salida;
}

async function consultarOsrm(puntos) {
  const coordenadas = puntos
    .map((p) => `${Number(p.longitud).toFixed(6)},${Number(p.latitud).toFixed(6)}`)
    .join(";");

  const radios = puntos
    .map((p) => radioDe(p.precision_metros))
    .join(";");

  const marcas = puntos
    .map((p) => Math.floor(new Date(p.fecha_gps).getTime() / 1000))
    .join(";");

  const url =
    `${OSRM_URL}/match/v1/driving/${coordenadas}` +
    `?geometries=geojson&overview=full&radiuses=${radios}&timestamps=${marcas}`;

  const controlador = new AbortController();
  const temporizador = setTimeout(
    () => controlador.abort(),
    OSRM_TIMEOUT_MS
  );

  try {
    const respuesta = await fetch(url, { signal: controlador.signal });
    const cuerpo = await respuesta.json();

    if (!respuesta.ok || cuerpo.code !== "Ok") {
      throw new Error(
        `OSRM respondió ${cuerpo.code || respuesta.status}: ${cuerpo.message || "sin detalle"}`
      );
    }

    return cuerpo;
  } finally {
    clearTimeout(temporizador);
  }
}

/**
 * Ajusta la traza GPS de un viaje a la red vial.
 *
 * Devuelve los tramos con su confianza y una bandera `fiable`. El consumidor
 * debe dibujar solido lo fiable y punteado lo demas: nunca presentar los dos
 * de la misma forma.
 */
export async function ajustarRutaDeViaje(idViaje) {
  const crudos = await obtenerPuntos(idViaje);
  const puntos = deduplicar(crudos);

  const base = {
    idViaje,
    puntosTotales: crudos.length,
    puntosUnicos: puntos.length,
    umbralConfianza: UMBRAL_CONFIANZA
  };

  // OSRM exige al menos dos coordenadas distintas. Una traza que colapsa a un
  // solo punto significa que el vehiculo nunca se movio, o que el GPS entrego
  // siempre la misma posicion cacheada.
  if (puntos.length < 2) {
    return {
      ...base,
      disponible: false,
      motivo: "La traza no tiene suficientes coordenadas distintas para reconstruir una ruta.",
      tramos: []
    };
  }

  let respuesta;

  try {
    respuesta = await consultarOsrm(puntos);
  } catch (error) {
    return {
      ...base,
      disponible: false,
      motivo: `No fue posible ajustar la ruta: ${error.message}`,
      tramos: []
    };
  }

  const tramos = (respuesta.matchings || []).map((tramo, indice) => ({
    indice,
    confianza: Number(tramo.confidence ?? 0),
    fiable: Number(tramo.confidence ?? 0) >= UMBRAL_CONFIANZA,
    metros: Number(tramo.distance ?? 0),
    segundos: Number(tramo.duration ?? 0),
    // GeoJSON entrega [lon, lat]; el mapa del panel usa [lat, lon].
    coordenadas: (tramo.geometry?.coordinates || []).map(
      ([lon, lat]) => [lat, lon]
    )
  }));

  const metros = tramos.reduce((suma, t) => suma + t.metros, 0);

  // Ponderada por distancia, no el maximo entre tramos: una traza puede traer
  // un tramo corto con confianza alta y el grueso del recorrido en cero.
  const confianzaGlobal = metros > 0
    ? tramos.reduce((suma, t) => suma + t.confianza * t.metros, 0) / metros
    : 0;

  const metrosFiables = tramos
    .filter((t) => t.fiable)
    .reduce((suma, t) => suma + t.metros, 0);

  return {
    ...base,
    disponible: true,
    puntosAjustados: (respuesta.tracepoints || []).filter(Boolean).length,
    confianzaGlobal,
    metros,
    metrosFiables,
    tramos
  };
}
