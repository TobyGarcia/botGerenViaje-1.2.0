import { useState } from "react";
import CameraModal from "./CameraModal.jsx";
import { compressImageToMaxKb } from "../utils/imageCompressor.js";
import "./OdometerCorrection.css";

export default function OdometerCorrection({ vehicleId, reading, previousReading, report, onChange }) {
  const [camera, setCamera] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  if (reading === "" || !Number.isFinite(Number(previousReading)) || !Number.isFinite(Number(reading)) || Number(reading) < 0 || Number(reading) >= Number(previousReading)) return null;
  const current = report && String(report.vehicleId) === String(vehicleId) && Number(report.reading) === Number(reading) && Number(report.previousReading) === Number(previousReading)
    ? report : { vehicleId, reading: Number(reading), previousReading: Number(previousReading), reason: "", photoBase64: "", confirmed: false };
  const change = update => onChange({ ...current, ...update });
  return <div className="odometer-report">
    <strong>La lectura es menor al último registro</strong>
    <p>Registrado: {Number(previousReading).toLocaleString("es-MX")} km · Tablero: {Number(reading).toLocaleString("es-MX")} km</p>
    <label className="odometer-report-confirm"><input type="checkbox" checked={current.confirmed} onChange={event => change({ confirmed: event.target.checked })} /> Reportar diferencia de odómetro y continuar con esta lectura</label>
    {current.confirmed && <>
      <label className="odometer-report-reason">Motivo de la corrección
        <textarea value={current.reason} minLength={5} maxLength={300} required rows={3}
          placeholder="Ej. Lectura registrada incorrectamente o cambio de tablero" onChange={event => change({ reason: event.target.value })} />
      </label>
      {current.photoBase64 && <img src={current.photoBase64} alt="Foto del odómetro reportado" />}
      <button type="button" disabled={processing} onClick={() => { setError(""); setCamera(true); }}>{processing ? "Procesando foto…" : current.photoBase64 ? "Volver a tomar foto" : "Tomar foto del odómetro"}</button>
      <p>La corrección se aplica al iniciar este viaje. La foto y el aviso se enviarán a Telegram, sin esperar autorización.</p>
    </>}
    {error && <p role="alert">{error}</p>}
    {camera && <CameraModal onClose={() => setCamera(false)} onCapture={async file => {
      setCamera(false); setProcessing(true);
      try { const image = await compressImageToMaxKb(file, 250); change({ photoBase64: image.base64 }); }
      catch { setError("No se pudo guardar la foto. Vuelve a tomarla."); }
      finally { setProcessing(false); }
    }} />}
  </div>;
}
