#!/usr/bin/env bash
# Construye el grafo de OSRM para la zona de operacion, autohospedado.
#
# Por que autohospedar: el servidor demo publico de OSRM rechaza mas de 10
# coordenadas por peticion (code TooBig, verificado el 2026-09-09), lo que
# obliga a partir la traza en bloques de 8 y degrada la confianza del matching
# a valores de 0.0 a 0.4. Con instancia propia, max-matching-size es
# configurable y un viaje entero se resuelve en una sola peticion, sin
# costuras y con el contexto completo para el modelo de Markov. Ademas las
# coordenadas de los conductores no salen a un tercero.
#
# Geofabrik no publica extractos por estado para Mexico, asi que se descarga el
# pais completo y se recorta la zona con osmium antes de procesar: osrm-extract
# sobre los 615 MB nacionales no cabe en la RAM de este servidor.
#
# Uso:
#   ./scripts/osrm-build.sh            # recorte por omision (Campeche y alrededores)
#   ./scripts/osrm-build.sh W,S,E,N    # bbox propio
set -euo pipefail

DATA_DIR="/home/josuetovar/traslado_Local/osrm-data"
PBF_PAIS="mexico-latest.osm.pbf"
PBF_ZONA="zona.osm.pbf"

# Campeche con margen hacia los estados vecinos, para no cortar rutas que
# cruzan el limite estatal.
BBOX="${1:--92.6,17.7,-89.0,21.0}"

OSRM_IMG="ghcr.io/project-osrm/osrm-backend:latest"
RUN_OSRM=(docker run --rm -v "$DATA_DIR:/data" --entrypoint)

if [ ! -f "$DATA_DIR/$PBF_PAIS" ]; then
  echo "Falta $DATA_DIR/$PBF_PAIS. Descargalo con:"
  echo "  curl -L -o $DATA_DIR/$PBF_PAIS https://download.geofabrik.de/north-america/mexico-latest.osm.pbf"
  exit 1
fi

echo "== 1/4 Recortando la zona ($BBOX) =="
docker run --rm -v "$DATA_DIR:/data" --entrypoint sh debian:12-slim -c "
  apt-get update -qq >/dev/null 2>&1 &&
  apt-get install -y -qq osmium-tool >/dev/null 2>&1 &&
  osmium extract --bbox '$BBOX' --overwrite -o /data/$PBF_ZONA /data/$PBF_PAIS &&
  ls -lh /data/$PBF_ZONA"

echo "== 2/4 osrm-extract (perfil car) =="
"${RUN_OSRM[@]}" osrm-extract "$OSRM_IMG" -p /opt/car.lua "/data/$PBF_ZONA"

echo "== 3/4 osrm-partition =="
"${RUN_OSRM[@]}" osrm-partition "$OSRM_IMG" "/data/${PBF_ZONA%.osm.pbf}.osrm"

echo "== 4/4 osrm-customize =="
"${RUN_OSRM[@]}" osrm-customize "$OSRM_IMG" "/data/${PBF_ZONA%.osm.pbf}.osrm"

echo
echo "Grafo listo. Archivos generados:"
du -sh "$DATA_DIR"
echo
echo "Levanta el servicio con:"
echo "  docker compose -f compose.osrm.yml up -d"
