import { listTripItems, recordTripOperation, trailerInspection } from '../services/trip-operations.service.js';

export async function tripItemsController(req, res) {
  try {
    return res.json({ success: true, data: await listTripItems(Number(req.params.idViaje), req.driverUser.id_conductores) });
  } catch (e) { return res.status(e.statusCode || 400).json({ success: false, message: e.message }); }
}
export async function tripOperationController(req, res) {
  try {
    return res.status(201).json({ success: true, data: await recordTripOperation(Number(req.params.idViaje), req.driverUser.id_conductores, req.body) });
  } catch (e) { return res.status(e.code === '23505' ? 409 : e.statusCode || 400).json({ success: false, message: e.code === '23505' ? 'El remolque ya está enganchado o el evento ya está registrado.' : e.message }); }
}
export async function trailerInspectionController(req, res) {
  try {
    await listTripItems(Number(req.params.idViaje), req.driverUser.id_conductores);
    return res.json({ success: true, data: await trailerInspection(Number(req.params.trailerId), req.driverUser.id_conductores) });
  } catch (e) { return res.status(e.statusCode || 400).json({ success: false, message: e.message }); }
}
