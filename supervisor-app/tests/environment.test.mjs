import test from 'node:test';import assert from 'node:assert/strict';
import {approverEnvironment} from '../scripts/environment.mjs';
import {validateFirebaseConfig} from '../scripts/firebase-config.mjs';
const config=e=>({project_info:{project_id:e.projectId},client:[{client_info:{android_client_info:{package_name:e.appId},mobilesdk_app_id:'fixture'},api_key:[{current_key:'fixture'}]}]});
test('producción y pruebas mantienen paquete, proyecto, servidor y enlace distintos',()=>{
 const stable=approverEnvironment('stable'),testing=approverEnvironment('testing');
 assert.equal(stable.apiBase,'https://gv.aspromex.mx');assert.equal(stable.appId,'com.aspromex.gvmobility.supervisor');
 for(const key of ['apiBase','appId','projectId','scheme'])assert.notEqual(stable[key],testing[key]);
 assert.throws(()=>approverEnvironment('production'));
 for(const e of [stable,testing])assert.equal(validateFirebaseConfig(config(e),e).packageName,e.appId);
 assert.throws(()=>validateFirebaseConfig(config(testing),stable));assert.throws(()=>validateFirebaseConfig(config(stable),testing));
});
