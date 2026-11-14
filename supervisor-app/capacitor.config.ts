import {approverEnvironment} from './scripts/environment.mjs';
const environment=approverEnvironment();
const config = {
 appId:environment.appId,appName:'GV Aprobadores',webDir:'dist',
 server:{hostname:new URL(environment.apiBase).hostname,androidScheme:'https',cleartext:false},
 android:{allowMixedContent:false,backgroundColor:'#102430'},
 plugins:{CapacitorHttp:{enabled:true},SystemBars:{insetsHandling:'native'}}
};
export default config;
