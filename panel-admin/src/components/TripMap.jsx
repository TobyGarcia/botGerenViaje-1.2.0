import {
  useEffect
} from "react";

import {
  CircleMarker,
  MapContainer,
  Polyline,
  Popup,
  TileLayer,
  Tooltip,
  useMap
} from "react-leaflet";

function MapBoundsController({
  positions
}) {
  const map =
    useMap();

  useEffect(() => {
    if (!positions.length) {
      return;
    }

    if (positions.length === 1) {
      map.setView(
        positions[0],
        16
      );

      return;
    }

    map.fitBounds(
      positions,
      {
        padding: [35, 35]
      }
    );
  }, [map, positions]);

  return null;
}

function formatDateTime(value) {
  if (!value) {
    return "Sin fecha";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "Fecha no válida";
  }

  return date.toLocaleString(
    "es-MX",
    {
      dateStyle: "medium",
      timeStyle: "medium"
    }
  );
}

function TripMap({
  locations = []
}) {
  const validLocations =
    locations.filter(
      (location) =>
        Number.isFinite(
          Number(location.latitud)
        ) &&
        Number.isFinite(
          Number(location.longitud)
        )
    );

  const positions =
    validLocations.map(
      (location) => [
        Number(location.latitud),
        Number(location.longitud)
      ]
    );

  if (!positions.length) {
    return (
      <div className="map-empty-state">
        Este viaje no tiene coordenadas GPS válidas.
      </div>
    );
  }

  const firstLocation =
    validLocations[0];

  const lastLocation =
    validLocations[
      validLocations.length - 1
    ];

  const center =
    positions[0];

  return (
    <MapContainer
      center={center}
      zoom={15}
      scrollWheelZoom
      className="trip-map"
    >
      <TileLayer
        attribution={
          '&copy; OpenStreetMap contributors'
        }
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <MapBoundsController
        positions={positions}
      />

      {positions.length > 1 && (
        <Polyline
          positions={positions}
          pathOptions={{
            weight: 5,
            opacity: 0.8
          }}
        />
      )}

      {validLocations.map(
        (location, index) => {
          const isFirst =
            index === 0;

          const isLast =
            index ===
            validLocations.length - 1;

          const isIntermediate = Boolean(
            location.esPuntoIntermedio ||
            location.es_punto_intermedio
          );

          return (
            <CircleMarker
              key={
                location.idUbicacion ??
                `${location.latitud}-${location.longitud}-${index}`
              }
              center={[
                Number(
                  location.latitud
                ),
                Number(
                  location.longitud
                )
              ]}
              radius={
                isFirst || isLast
                  ? 9
                  : isIntermediate
                    ? 8
                    : 5
              }
              pathOptions={
                isIntermediate
                  ? {
                      color: "#dc2626",
                      fillColor: "#dc2626",
                      weight: 3,
                      fillOpacity: 0.95
                    }
                  : {
                      weight: 3,
                      fillOpacity:
                        isFirst || isLast
                          ? 1
                          : 0.65
                    }
              }
            >
              {isIntermediate && (
                <Tooltip permanent direction="top" offset={[0, -8]}>
                  <span style={{ fontWeight: "bold", color: "#991b1b", fontSize: "0.78rem" }}>
                    🔴 {location.nombrePunto || location.nombre_punto || "Punto Intermedio"}
                  </span>
                </Tooltip>
              )}
              <Popup>
                <div className="map-popup">
                  <strong style={{ color: isIntermediate ? "#dc2626" : "inherit" }}>
                    {isIntermediate
                      ? `🔴 Punto Intermedio${location.nombrePunto || location.nombre_punto ? `: ${location.nombrePunto || location.nombre_punto}` : ""}`
                      : isFirst
                        ? "Inicio del recorrido"
                        : isLast
                          ? "Última ubicación"
                          : `Punto ${index + 1}`}
                  </strong>

                  <span>
                    {Number(
                      location.latitud
                    ).toFixed(6)}
                    {", "}
                    {Number(
                      location.longitud
                    ).toFixed(6)}
                  </span>

                  <span>
                    Fecha:{" "}
                    {formatDateTime(
                      location.fechaGps
                    )}
                  </span>

                  {location.precisionMetros !==
                    null &&
                    location.precisionMetros !==
                      undefined && (
                      <span>
                        Precisión:{" "}
                        {
                          location.precisionMetros
                        }{" "}
                        m
                      </span>
                    )}

                  {location.velocidad !==
                    null &&
                    location.velocidad !==
                      undefined && (
                      <span>
                        Velocidad:{" "}
                        {
                          location.velocidad
                        }
                      </span>
                    )}

                  <a
                    href={`https://www.google.com/maps?q=${location.latitud},${location.longitud}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Abrir en Google Maps
                  </a>
                </div>
              </Popup>
            </CircleMarker>
          );
        }
      )}

      <CircleMarker
        center={[
          Number(
            firstLocation.latitud
          ),
          Number(
            firstLocation.longitud
          )
        ]}
        radius={11}
        pathOptions={{
          weight: 2,
          fillOpacity: 0
        }}
      />

      {validLocations.length > 1 && (
        <CircleMarker
          center={[
            Number(
              lastLocation.latitud
            ),
            Number(
              lastLocation.longitud
            )
          ]}
          radius={11}
          pathOptions={{
            weight: 2,
            fillOpacity: 0
          }}
        />
      )}
    </MapContainer>
  );
}

export default TripMap;