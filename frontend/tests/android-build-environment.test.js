import test from 'node:test';import assert from 'node:assert/strict';
import {driverBuildEnvironment} from '../android-build-environment.mjs';
test('el candidato estable exige API y origen productivos y mantiene el modo empaquetado',()=>{
 const env={ANDROID_UPDATE_CHANNEL:'stable',ANDROID_WEB_URL:'https://gv.aspromex.mx/conductor/',ANDROID_BUNDLED:'true',VITE_API_BASE_URL:'https://gv.aspromex.mx'};
 assert.deepEqual(driverBuildEnvironment(env),{channel:'stable',webUrl:env.ANDROID_WEB_URL,bundled:true,apiOrigin:'https://gv.aspromex.mx'});
 for(const bad of [{ANDROID_UPDATE_CHANNEL:'testing'},{ANDROID_WEB_URL:'https://gvmobility.aspromex.mx/conductor/'},{ANDROID_WEB_URL:'https://gv.aspromex.mx/otra/'},{ANDROID_WEB_URL:'https://user@gv.aspromex.mx/conductor/'},{VITE_API_BASE_URL:'https://gvmobility.aspromex.mx'},{ANDROID_UPDATE_CHANNEL:'bad'}])assert.throws(()=>driverBuildEnvironment({...env,...bad}));
 assert.equal(driverBuildEnvironment({}).apiOrigin,'https://gvmobility.aspromex.mx');
 assert.throws(()=>driverBuildEnvironment({ANDROID_UPDATE_CHANNEL:'stable'}));
});
