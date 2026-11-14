import test from 'node:test';
import assert from 'node:assert/strict';
import {validateSupervisorUpdate} from '../src/services/supervisor-update.js';
const update={available:true,appId:'com.aspromex.gvmobility.supervisor.testing',channel:'testing',versionName:'0.1.4',versionCode:5,sha256:'a'.repeat(64),downloadUrl:'https://github.com/TobyGarcia/botGerenViaje-1.2.0/releases/download/android-supervisor-testing-v0.1.4-5/gv-supervisor.apk'};
test('aprobadores solo ofrece una versión posterior de su propio paquete',()=>{
 assert.equal(validateSupervisorUpdate(update,{versionCode:4}),update);
 assert.equal(validateSupervisorUpdate(update,{versionCode:5}),null);
 assert.equal(validateSupervisorUpdate({available:false},{versionCode:4}),null);
 for(const bad of [{appId:'driver'},{channel:'stable'},{sha256:'bad'},{versionCode:NaN},{downloadUrl:update.downloadUrl.replace('github.com','example.com')},{downloadUrl:update.downloadUrl.replace('gv-supervisor.apk','gv-mobility.apk')}])assert.throws(()=>validateSupervisorUpdate({...update,...bad},{versionCode:4}));
});

test('canal estable acepta solo el paquete y enlace productivo de aprobadores',()=>{
 const stable={...update,appId:'com.aspromex.gvmobility.supervisor',channel:'stable',downloadUrl:update.downloadUrl.replace('supervisor-testing-','supervisor-stable-')};
 assert.equal(validateSupervisorUpdate(stable,{versionCode:4},'stable'),stable);
 assert.throws(()=>validateSupervisorUpdate(update,{versionCode:4},'stable'));
 assert.throws(()=>validateSupervisorUpdate(stable,{versionCode:4},'testing'));
 assert.throws(()=>validateSupervisorUpdate({...stable,downloadUrl:update.downloadUrl},{versionCode:4},'stable'));
});
