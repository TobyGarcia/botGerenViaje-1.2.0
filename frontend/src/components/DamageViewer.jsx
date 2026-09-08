import conductorImage from "../assets/conductor.png";
import frontalImage from "../assets/frontal.png";
import pasajeroImage from "../assets/pasajero.png";
import traseraImage from "../assets/trasera.png";

const views = [["frontal", "Frontal", frontalImage], ["conductor", "Conductor", conductorImage], ["trasera", "Trasera", traseraImage], ["pasajero", "Pasajero", pasajeroImage]];

export default function DamageViewer({ damages = {}, vehicle }) {
  let parsedDamages = damages;
  if (typeof damages === "string") {
    try {
      parsedDamages = JSON.parse(damages);
    } catch {
      parsedDamages = {};
    }
  }
  if (!parsedDamages || typeof parsedDamages !== "object" || Array.isArray(parsedDamages)) {
    parsedDamages = {};
  }

  const count = Object.values(parsedDamages).reduce(
    (total, points) => total + (Array.isArray(points) ? points.length : 0),
    0
  );

  return (
    <section className="damage-viewer">
      <h3>Daños marcados{vehicle ? ` · ${vehicle}` : ""}</h3>
      <p>
        {count
          ? `${count} marca${count === 1 ? "" : "s"} registrada${count === 1 ? "" : "s"}.`
          : "No se registraron daños."}
      </p>
      <div className="damage-viewer-grid">
        {views.map(([key, label, image]) => {
          const points = Array.isArray(parsedDamages[key]) ? parsedDamages[key] : [];
          return (
            <figure key={key}>
              <figcaption>{label} · {points.length}</figcaption>
              <div className="damage-stage damage-viewer-stage">
                <img src={image} alt={`Vista ${label.toLowerCase()} del vehículo`} />
                {points.map((point, index) => (
                  <span
                    key={`${point.x}-${point.y}-${index}`}
                    className="damage-point damage-viewer-point"
                    style={{ left: `${point.x}%`, top: `${point.y}%` }}
                    aria-label={`Daño ${index + 1}`}
                  >
                    <b>{index + 1}</b>
                  </span>
                ))}
              </div>
            </figure>
          );
        })}
      </div>
    </section>
  );
}
