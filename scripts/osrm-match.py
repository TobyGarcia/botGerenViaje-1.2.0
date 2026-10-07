#!/usr/bin/env python3
"""Ajusta la traza GPS de un viaje a la red vial usando OSRM autohospedado.

Lee los puntos de la base de prueba, los manda al endpoint /match y reporta
la confianza del ajuste. Sirve para evaluar si una traza es apta para map
matching antes de dibujarla en el panel.

Uso:
    ./scripts/osrm-match.py                     # evalua todos los viajes con >=8 puntos
    ./scripts/osrm-match.py VJ-20260909-0002    # un viaje, con detalle
    ./scripts/osrm-match.py VJ-20260909-0002 --geojson salida.json

El servicio se levanta con: docker compose -f compose.osrm.yml up -d
"""
import json
import subprocess
import sys
import urllib.error
import urllib.request

OSRM = "http://127.0.0.1:5000"
DB = ("docker", "exec", "viajes-postgres", "psql",
      "-U", "viajes_stg", "-d", "gerenciamiento_viajes_stg", "-tAF;", "-c")

# OSRM considera un match dudoso por debajo de este valor. Los tramos que no
# lo alcanzan NO deben dibujarse como ruta: hacerlo presenta una inferencia
# como si fuera un recorrido registrado.
UMBRAL_CONFIANZA = 0.5


def consulta(sql):
    salida = subprocess.run(DB + (sql,), capture_output=True, text=True, timeout=60)
    if salida.returncode != 0:
        sys.exit(f"Error consultando la base: {salida.stderr.strip()}")
    return [l.split(";") for l in salida.stdout.strip().splitlines() if l.strip()]


def puntos_de(folio):
    return consulta(f"""
        SELECT round(u.longitud,6)||','||round(u.latitud,6),
               COALESCE(round(u.precision_metros)::text,'15'),
               extract(epoch FROM u.fecha_gps)::bigint
          FROM ubicaciones_viaje u JOIN viajes v ON v.id_viajes=u.id_viajes
         WHERE v.folio='{folio}' ORDER BY u.fecha_gps, u.id_ubicaciones_viaje""")


def deduplicar(filas):
    """Quita puntos consecutivos en la misma coordenada.

    Un fix repetido no aporta informacion al modelo de Markov y sí penaliza la
    confianza, porque OSRM lo interpreta como un vehiculo detenido en medio de
    la traza.
    """
    salida = []
    for fila in filas:
        if not salida or fila[0] != salida[-1][0]:
            salida.append(fila)
    return salida


def emparejar(filas):
    coords = ";".join(f[0] for f in filas)
    radios = ";".join(str(max(18, min(35, int(float(f[1]) * 1.5)))) for f in filas)
    marcas = ";".join(f[2] for f in filas)
    url = (f"{OSRM}/match/v1/driving/{coords}"
           f"?geometries=geojson&overview=full&radiuses={radios}&timestamps={marcas}")
    try:
        with urllib.request.urlopen(url, timeout=120) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        return {"code": f"HTTP {e.code}", "detalle": e.read().decode()[:200]}
    except Exception as e:
        return {"code": type(e).__name__, "detalle": str(e)}


def evaluar(folio, verboso=False, geojson=None):
    crudos = puntos_de(folio)
    if len(crudos) < 2:
        print(f"{folio:20s} sin puntos suficientes")
        return
    limpios = deduplicar(crudos)
    resultado = emparejar(limpios)

    if resultado.get("code") != "Ok":
        print(f"{folio:20s} {resultado.get('code')} {resultado.get('detalle','')}")
        return

    matchings = resultado.get("matchings", [])
    ajustados = sum(1 for t in resultado.get("tracepoints", []) if t)
    metros = sum(m.get("distance", 0) for m in matchings)

    # Ponderada por distancia, no el maximo: una traza puede traer un tramo
    # corto con confianza alta y el grueso del recorrido en cero. Reportar el
    # maximo daria por buena una reconstruccion que en su mayoria es inventada.
    if metros > 0:
        confianza = sum(m.get("confidence", 0) * m.get("distance", 0)
                        for m in matchings) / metros
    else:
        confianza = 0.0

    # Metros que se pueden dibujar como ruta real; el resto va punteado.
    metros_fiables = sum(m.get("distance", 0) for m in matchings
                         if m.get("confidence", 0) >= UMBRAL_CONFIANZA)
    veredicto = "APTA" if confianza >= UMBRAL_CONFIANZA else "dudosa"

    print(f"{folio:20s} puntos {len(crudos):3d} -> {len(limpios):3d} unicos  "
          f"ajustados {ajustados:3d}  tramos {len(matchings):2d}  "
          f"confianza {confianza:.3f}  {metros:6.0f} m  "
          f"fiables {metros_fiables:6.0f} m  {veredicto}")

    if verboso:
        for i, m in enumerate(matchings):
            print(f"    tramo {i}: confianza {m.get('confidence',0):.3f}  "
                  f"vertices {len(m['geometry']['coordinates'])}  "
                  f"{m.get('distance',0):.0f} m  {m.get('duration',0):.0f} s")

    if geojson:
        capas = [{"type": "Feature",
                  "properties": {"folio": folio, "confianza": m.get("confidence", 0),
                                 "inferido": m.get("confidence", 0) < UMBRAL_CONFIANZA},
                  "geometry": m["geometry"]} for m in matchings]
        with open(geojson, "w") as f:
            json.dump({"type": "FeatureCollection", "features": capas}, f, indent=2)
        print(f"    geometria escrita en {geojson}")


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    geojson = None
    if "--geojson" in sys.argv:
        geojson = sys.argv[sys.argv.index("--geojson") + 1]

    try:
        urllib.request.urlopen(f"{OSRM}/nearest/v1/driving/-90.5254,19.8341", timeout=10)
    except Exception:
        sys.exit(f"OSRM no responde en {OSRM}.\n"
                 "Levantalo con: docker compose -f compose.osrm.yml up -d")

    if args:
        evaluar(args[0], verboso=True, geojson=geojson)
        return

    folios = consulta("""
        SELECT v.folio FROM viajes v
          JOIN ubicaciones_viaje u ON u.id_viajes=v.id_viajes
         GROUP BY v.folio HAVING count(*) >= 8
         ORDER BY count(*) DESC""")
    print(f"Umbral de confianza: {UMBRAL_CONFIANZA}\n")
    for (folio,) in (f[:1] for f in folios):
        evaluar(folio)


if __name__ == "__main__":
    main()
