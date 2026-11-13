const low=['SUPERVISOR','QHSE','COORDINADOR','COORDINADOR_AREA','COORDINADOR_QHSE','GERENTE','GERENTE_GENERAL','ADMINISTRADOR','ADMIN','INSTRUCTOR'];
const medium=['COORDINADOR','COORDINADOR_AREA','COORDINADOR_QHSE','GERENTE','GERENTE_GENERAL','ADMINISTRADOR','ADMIN'];
const high=['GERENTE','GERENTE_GENERAL','ADMINISTRADOR','ADMIN'];
export function canApproveRisk(role,risk){return ({BAJO:low,MEDIO:medium,ALTO:high}[String(risk).toUpperCase()]||[]).includes(String(role).toUpperCase());}
export function requiredRiskRole(risk){return ({BAJO:'Supervisor o QHSE',MEDIO:'Coordinación de área',ALTO:'Gerencia o Administración'})[risk]||'Evaluación de riesgo válida';}
