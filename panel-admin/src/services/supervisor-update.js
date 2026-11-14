import {supervisorChannel} from './supervisor-environment.js';
export function validateSupervisorUpdate(update,installed,channel=supervisorChannel){
 if(!['testing','stable'].includes(channel))throw Error('Canal inválido');
 const appId=channel==='stable'?'com.aspromex.gvmobility.supervisor':'com.aspromex.gvmobility.supervisor.testing';
 if(!update.available)return null;
 const url=new URL(update.downloadUrl);
 if(update.appId!==appId||update.channel!==channel||
 !Number.isSafeInteger(update.versionCode)||!/^\d+\.\d+\.\d+$/.test(update.versionName)||! /^[a-f0-9]{64}$/.test(update.sha256)||
 url.origin!=='https://github.com'||url.search||url.hash||url.username||url.password||
 !new RegExp('^/TobyGarcia/botGerenViaje-1\\.2\\.0/releases/download/android-supervisor-'+channel+'-v[0-9]+\\.[0-9]+\\.[0-9]+-[0-9]+/gv-supervisor\\.apk$').test(url.pathname))throw Error('La actualización no corresponde a esta aplicación.');
 return update.versionCode>installed.versionCode?update:null;
}
