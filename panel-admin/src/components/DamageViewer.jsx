import conductorImage from "../assets/inspection-diagrams/conductor.png";
import frontalImage from "../assets/inspection-diagrams/frontal.png";
import pasajeroImage from "../assets/inspection-diagrams/pasajero.png";
import traseraImage from "../assets/inspection-diagrams/trasera.png";

const views = [["frontal", "Frontal", frontalImage], ["conductor", "Conductor", conductorImage], ["trasera", "Trasera", traseraImage], ["pasajero", "Pasajero", pasajeroImage]];

export default function DamageViewer({ damages = {}, vehicle }) {
  const count = Object.values(damages).reduce((total, points) => total + (Array.isArray(points) ? points.length : 0), 0);
  return <section className="damage-viewer"><h3>Daños marcados{vehicle ? ` · ${vehicle}` : ""}</h3><p>{count ? `${count} marca${count === 1 ? "" : "s"} registrada${count === 1 ? "" : "s"}.` : "No se registraron daños."}</p><div className="damage-viewer-grid">{views.map(([key, label, image]) => <figure key={key}><figcaption>{label} · {(damages[key] || []).length}</figcaption><div className="damage-viewer-stage"><img src={image} alt={`Vista ${label.toLowerCase()} del vehículo`} />{(damages[key] || []).map((point, index) => <span key={`${point.x}-${point.y}-${index}`} className="damage-viewer-point" style={{ left: `${point.x}%`, top: `${point.y}%` }} aria-label={`Daño ${index + 1}`}><b>{index + 1}</b></span>)}</div></figure>)}</div></section>;
}
