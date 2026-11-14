// Compose rendering only. No Docker containers are started and no database is opened.
import {execFileSync} from 'node:child_process';
import {mkdtempSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const root=resolve(import.meta.dirname,'../..');
const temporary=mkdtempSync(resolve(tmpdir(),'gv-compose-review-'));
const emptyEnv=resolve(temporary,'empty.env');writeFileSync(emptyEnv,'');
function render(overlay){
 const args=['compose','--env-file',emptyEnv,'-f','compose.prod.yml'];
 if(overlay)args.push('-f','deploy/compose.approver-production-candidate.yml');
 args.push('config','--no-env-resolution','--no-interpolate','--format','json');
 return JSON.parse(execFileSync('docker',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}));
}
function envMap(value){return Array.isArray(value)?Object.fromEntries(value.map(line=>{const i=line.indexOf('=');return i<0?[line,null]:[line.slice(0,i),line.slice(i+1)];})):Object.fromEntries(Object.entries(value).map(([k,v])=>[k,v==null?null:String(v)]));}
const before=render(false),after=render(true);
const oldEnv=envMap(before.services.backend.environment),newEnv=envMap(after.services.backend.environment);
for(const key of Object.keys(oldEnv))if(key!=='ANDROID_UPDATE_DISCOVERY')assert.equal(newEnv[key],oldEnv[key],`Existing setting changed: ${key}`);
assert.deepEqual(after.services.postgres,before.services.postgres);
assert.deepEqual(after.volumes,before.volumes);
for(const oldMount of before.services.backend.volumes)assert.deepEqual(after.services.backend.volumes.find(v=>v.target===oldMount.target),oldMount);
assert.equal(after.services.backend.volumes.find(v=>v.target==='/run/secrets/approver-production-firebase.json').read_only,true);
assert.equal(newEnv.APPROVER_ENVIRONMENT,'stable');
assert.equal(newEnv.APPROVER_FIREBASE_PROJECT_ID,'gvmobilityproduccion');
console.log('PASS: Compose valid; PostgreSQL, existing environment and data volumes preserved; Firebase mount read-only. No services started.');
