import {inspectionMatchesTripSql} from './approval-eligibility.js';
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
    ${inspectionMatchesTripSql('i','mt')}
    AND ${managementTripSql("mt")})`;
}
