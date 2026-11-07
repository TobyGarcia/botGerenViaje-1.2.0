import { useEffect, useState } from 'react';
import OdometerCorrection from './OdometerCorrection.jsx';
import { odometerCorrectionPayload } from '../utils/odometer-correction.js';
import { getViajePorId, getVehiculos } from '../services/api.js';
import { getOfflineTrip } from '../services/offline-trip-storage.js';
import safeStorage from '../utils/safeStorage.js';
import { resolveStartTripVehicle } from '../utils/start-trip-vehicle.js';

export default function StartTripForm({ trip, driverId, busy, error, onConfirm }) {
  const [vehicle, setVehicle] = useState(null);
  const [reading, setReading] = useState('');
  const [report, setReport] = useState(null);
  const [validation, setValidation] = useState('');
  const [loadError, setLoadError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const tripId = trip?.idViaje ?? trip?.id_viajes;
  useEffect(() => {
    let disposed = false;
    setVehicle(null); setLoadError('');
    (async () => {
      try {
        let details, catalog;
        if (tripId < 0) {
          details = getOfflineTrip(driverId, tripId)?.trip;
          catalog = safeStorage.getJSON('cached_vehiculos', []);
        } else {
          const [result, vehicles] = await Promise.all([getViajePorId(tripId), getVehiculos()]);
          details = result.data; catalog = vehicles.data || [];
        }
        const selected = resolveStartTripVehicle(details, catalog);
        if (!selected) throw new Error('No se pudo cargar la unidad del viaje.');
        if (!disposed) { setVehicle(selected); setReading(String(selected.kilometraje_actual ?? '')); setReport(null); }
      } catch (error) { if (!disposed) setLoadError(error.message); }
    })();
    return () => { disposed = true; };
  }, [tripId, driverId, attempt]);
  function submit(event) {
    event.preventDefault(); setValidation('');
    if (busy || !vehicle) return;
    try {
      const correction = odometerCorrectionPayload(report, vehicle.id_vehiculos, reading, vehicle.kilometraje_actual);
      if (Number(reading) > 2147483647) throw new Error('La lectura excede el kilometraje permitido.');
      onConfirm({ kilometrajeInicial: Number(reading), odometerCorrection: correction });
    } catch (error) { setValidation(error.message); }
  }
  return <form onSubmit={submit} style={{ display: 'grid', gap: 12, width: '100%' }}>
    <div className="urban-field-group">
      <label className="urban-field-label" htmlFor="start-trip-odometer">Kilometraje inicial <span className="urban-req-star">*</span></label>
      <div className="urban-input-wrap">
        <input id="start-trip-odometer" className="urban-input" type="number" min="0" max="2147483647" step="1" required
          value={reading} disabled={busy || !vehicle} placeholder={vehicle ? '0' : 'Cargando lectura…'} onChange={event => { setReading(event.target.value); setValidation(''); }} />
        <span className="urban-input-suffix">KM</span>
      </div>
      <p className="urban-field-helper">Confirma el kilometraje mostrado en el tablero físico antes de iniciar.</p>
      {vehicle && <OdometerCorrection vehicleId={vehicle.id_vehiculos} reading={reading} previousReading={vehicle.kilometraje_actual} report={report} onChange={setReport} />}
    </div>
    {(validation || error || loadError) && <p role="alert">{validation || error || loadError}</p>}
    {(loadError || error) && <button type="button" className="gv-btn-secondary" disabled={busy} onClick={() => setAttempt(value => value + 1)}>Actualizar lectura</button>}
    <button type="submit" className="gv-btn-primary" disabled={busy || !vehicle}>{busy ? 'Iniciando viaje…' : 'Iniciar viaje'}</button>
  </form>;
}
