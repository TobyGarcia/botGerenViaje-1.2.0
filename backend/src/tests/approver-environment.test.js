import test from 'node:test';import assert from 'node:assert/strict';
import {approverPushEnvironment,validateApproverServiceAccount} from '../services/approver-environment.js';
test('Firebase rechaza credenciales cruzadas antes de crear el cliente de envío',()=>{
 for(const channel of ['stable','testing']){
  const env={APPROVER_ENVIRONMENT:channel},e=approverPushEnvironment(env);
  const credentials={type:'service_account',project_id:e.projectId,client_email:`test@${e.projectId}.iam.gserviceaccount.com`,private_key:'fixture'};
  assert.equal(validateApproverServiceAccount(credentials,env).channel,channel);
  assert.throws(()=>validateApproverServiceAccount(credentials,{APPROVER_ENVIRONMENT:channel==='stable'?'testing':'stable'}));
  assert.throws(()=>validateApproverServiceAccount({...credentials,type:'android'},env));
  assert.throws(()=>validateApproverServiceAccount({...credentials,client_email:'test@otro.iam.gserviceaccount.com'},env));
 }
 assert.throws(()=>approverPushEnvironment({APPROVER_ENVIRONMENT:'bad'}));
 assert.throws(()=>approverPushEnvironment({APPROVER_ENVIRONMENT:'stable',APPROVER_FIREBASE_PROJECT_ID:'gv-mobility-pruebas'}));
});
