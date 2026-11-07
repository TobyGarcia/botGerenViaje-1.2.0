// El detalle de la API agrupa la unidad; el viaje offline guarda idVehiculo.
export function resolveStartTripVehicle(details, catalog) {
  const id = details?.vehiculo?.idVehiculo ?? details?.idVehiculo ?? details?.id_vehiculos;
  if (id == null) return null;
  return catalog.find(item => String(item.id_vehiculos) === String(id)) || null;
}
