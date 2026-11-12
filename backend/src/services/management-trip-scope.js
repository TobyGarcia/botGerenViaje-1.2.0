// Trip timestamps are Mexico City wall time (timestamp without time zone).
export function isManagementRole(role) {
  return ["GERENTE", "GERENTE_GENERAL"].includes(String(role || "").toUpperCase());
}
export function managementTripSql(alias = "v") {
  return `(EXISTS (SELECT 1 FROM gerenciamiento_viajes mg WHERE mg.id_viaje=${alias}.id_viajes)
    OR COALESCE(${alias}.hora_salida, ${alias}.creado_en)::time < TIME '06:00'
    OR COALESCE(${alias}.hora_salida, ${alias}.creado_en)::time >= TIME '18:00')`;
}
export function managementInspectionSql() {
  return `EXISTS (SELECT 1 FROM viajes mt WHERE
    (mt.id_viajes=i.id_viajes OR EXISTS (SELECT 1 FROM viaje_inspeccion_uso mu
      WHERE mu.id_inspeccion=i.id_inspeccion AND mu.id_viajes=mt.id_viajes))
    AND ${managementTripSql("mt")})`;
}
