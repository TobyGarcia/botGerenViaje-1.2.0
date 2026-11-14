export function startupPolicy(env=process.env){
 const flag=(key,fallback)=>{
  if(env[key]===undefined||env[key]==='')return fallback;
  if(!['true','false'].includes(env[key]))throw Error(`Configuración inválida: ${key}`);
  return env[key]==='true';
 };
 const background=flag('BACKGROUND_TASKS_ENABLED',true);
 return {autoMigrations:flag('AUTO_MIGRATIONS_ENABLED',true),background,
  auditRetention:background&&flag('AUDIT_RETENTION_ENABLED',true),
  telegramPolling:background&&flag('TELEGRAM_POLLING_ENABLED',env.NODE_ENV==='production')};
}
