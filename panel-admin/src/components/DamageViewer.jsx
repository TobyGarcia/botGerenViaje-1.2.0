import conductorImage from "../assets/inspection-diagrams/conductor.png";
import frontalImage from "../assets/inspection-diagrams/frontal.png";
import pasajeroImage from "../assets/inspection-diagrams/pasajero.png";
import traseraImage from "../assets/inspection-diagrams/trasera.png";
import { IconCheck, IconAlerta } from "./Icons.jsx";

const views = [
  ["frontal", "Frontal", frontalImage],
  ["conductor", "Conductor", conductorImage],
  ["trasera", "Trasera", traseraImage],
  ["pasajero", "Pasajero", pasajeroImage]
];

export default function DamageViewer({ damages = {}, vehicle }) {
  const count = Object.values(damages).reduce(
    (total, points) => total + (Array.isArray(points) ? points.length : 0),
    0
  );

  return (
    <section className="damage-viewer-enhanced">
      <div className="damage-viewer-header">
        <div>
          <h4>Daños marcados en inspección</h4>
          {vehicle && <p className="damage-vehicle-label">{vehicle}</p>}
        </div>

        {count === 0 ? (
          <div className="damage-status-badge damage-status-clean">
            <IconCheck size={16} />
            <span>Sin daños reportados · Unidad en óptimas condiciones</span>
          </div>
        ) : (
          <div className="damage-status-badge damage-status-warn">
            <IconAlerta size={16} />
            <span>{count} {count === 1 ? "daño registrado" : "daños registrados"}</span>
          </div>
        )}
      </div>

      <div className="damage-viewer-grid">
        {views.map(([key, label, image]) => {
          const viewDamages = damages[key] || [];
          const hasDamages = viewDamages.length > 0;
          return (
            <figure key={key} className={`damage-view-card ${hasDamages ? "has-damages" : ""}`}>
              <figcaption className="damage-view-caption">
                <span className="damage-view-title">{label}</span>
                <span className={`damage-count-pill ${hasDamages ? "pill-alert" : "pill-zero"}`}>
                  {viewDamages.length} {viewDamages.length === 1 ? "daño" : "daños"}
                </span>
              </figcaption>

              <div className="damage-viewer-stage">
                <img src={image} alt={`Vista ${label.toLowerCase()} del vehículo`} />
                {viewDamages.map((point, index) => (
                  <span
                    key={`${point.x}-${point.y}-${index}`}
                    className="damage-viewer-point"
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

