import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
const root=resolve(import.meta.dirname,'../..');
const ref=process.argv[2];
if(!/^[a-f0-9]{40}$/.test(ref||''))throw Error('Pass the full reviewed application commit SHA.');
const output=resolve(root,'output/releases',ref);
mkdirSync(output,{recursive:true});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const files=['042_trip_operations','043_trip_stop_description','044_trip_telegram_start_messages','045_viaje_inspeccion_uso','046_approver_notifications','047_cancelled_approval_withdrawals','048_manejo_approval_notifications'];
const migrations=files.map(name=>{
 const path=`database/migrations/${name}.sql`;
 const bytes=execFileSync('git',['show',`${ref}:${path}`],{cwd:root});
 if(/\b(?:TRUNCATE|DELETE\s+FROM|DROP\s+(?:TABLE|DATABASE|COLUMN))\b/i.test(bytes.toString()))throw Error(`Destructive SQL requires a separate review: ${path}`);
 return {path,sha256:hash(bytes)};
});
const archive=resolve(output,'source.tar.gz');
execFileSync('git',['archive','--format=tar.gz',`--output=${archive}`,ref],{cwd:root});
const manifest={applicationCommit:ref,authorization:'NOT_AUTHORIZED_FOR_PRODUCTION',source:{file:'source.tar.gz',sha256:hash(readFileSync(archive))},migrations,
 production:{database:'gerenciamiento_viajes_prod',composeProject:'botgerenviaje-120',databaseVolume:'viajes_postgres_data_prod',uploadsVolume:'viajes_backend_uploads_prod'},
 rollbackImages:{backend:'gv-production-backend:160eb38',frontend:'gv-production-frontend:bfdf6e6',panel:'gv-production-panel-admin:8b09c3f'},
 blockedBy:['explicit_user_launch_instruction','fresh_cutover_backup_and_verified_external_copy','production_device_and_Microsoft_canary_after_authorized_deployment','approved_maintenance_window_and_inflight_trip_policy']};
writeFileSync(resolve(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(`Prepared only; no publication, database migration or deployment.\n${output}`);
