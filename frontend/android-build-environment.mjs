export function driverBuildEnvironment(env=process.env){
 const channel=env.ANDROID_UPDATE_CHANNEL||'testing';
 if(!['testing','stable'].includes(channel))throw Error('Canal Android inválido.');
 const origin=channel==='stable'?'https://gv.aspromex.mx':'https://gvmobility.aspromex.mx';
 const webUrl=env.ANDROID_WEB_URL||'https://gvmobility.aspromex.mx/conductor/';
 const url=new URL(webUrl);
 if(url.origin!==origin||url.username||url.password||url.search||url.hash||url.pathname!=='/conductor/')throw Error('Servidor Android incompatible con el canal seleccionado.');
 if(env.VITE_API_BASE_URL&&env.VITE_API_BASE_URL.replace(/\/+$/,'').replace(/\/api$/,'')!==origin)throw Error('La API no corresponde al ambiente Android.');
 return {channel,webUrl,bundled:env.ANDROID_BUNDLED==='true',apiOrigin:origin};
}
