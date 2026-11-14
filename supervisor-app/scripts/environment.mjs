export function approverEnvironment(channel=process.env.ANDROID_UPDATE_CHANNEL||'testing'){
 if(!['testing','stable'].includes(channel))throw Error('Canal de aprobadores inválido.');
 const stable=channel==='stable';
 return {channel,appId:`com.aspromex.gvmobility.supervisor${stable?'':'.testing'}`,
  projectId:stable?'gvmobilityproduccion':'gv-mobility-pruebas',
  apiBase:stable?'https://gv.aspromex.mx':'https://gvmobility.aspromex.mx',
  scheme:stable?'gvsupervisorprod':'gvsupervisor'};
}
