export function validateSupervisorUpdate(update,installed){
 if(!update.available)return null;
 const url=new URL(update.downloadUrl);
 if(update.appId!=='com.aspromex.gvmobility.supervisor.testing'||update.channel!=='testing'||
 !Number.isSafeInteger(update.versionCode)||!/^\d+\.\d+\.\d+$/.test(update.versionName)||! /^[a-f0-9]{64}$/.test(update.sha256)||
 url.origin!=='https://github.com'||url.search||url.hash||url.username||url.password||
 !/^\/TobyGarcia\/botGerenViaje-1\.2\.0\/releases\/download\/android-supervisor-testing-v[0-9]+\.[0-9]+\.[0-9]+-[0-9]+\/gv-supervisor\.apk$/.test(url.pathname))throw Error('La actualización no corresponde a esta aplicación.');
 return update.versionCode>installed.versionCode?update:null;
}
