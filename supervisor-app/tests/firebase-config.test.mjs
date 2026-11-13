import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync}from'node:fs';
import {validateFirebaseConfig,approverPackage,approverProject}from'../scripts/firebase-config.mjs';
const config=JSON.parse(readFileSync(new URL('../google-services.json',import.meta.url),'utf8'));
test('configuración Firebase corresponde al proyecto y paquete de pruebas',()=>{
 assert.deepEqual(validateFirebaseConfig(config),{projectId:approverProject,packageName:approverPackage});
 assert.throws(()=>validateFirebaseConfig({...config,client:[]}));
 assert.throws(()=>validateFirebaseConfig({...config,project_info:{project_id:'produccion'}}));
 const missing=structuredClone(config);missing.client[0].api_key=[];assert.throws(()=>validateFirebaseConfig(missing));
});
