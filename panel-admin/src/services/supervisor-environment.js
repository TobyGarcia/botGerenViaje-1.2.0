export const supervisorChannel=import.meta.env?.VITE_APPROVER_CHANNEL||(globalThis.location?.hostname==='gv.aspromex.mx'?'stable':'testing');
if(!['testing','stable'].includes(supervisorChannel))throw Error('Ambiente de aprobadores inválido.');
export const supervisorPackage=`com.aspromex.gvmobility.supervisor${supervisorChannel==='stable'?'':'.testing'}`;
export const supervisorScheme=supervisorChannel==='stable'?'gvsupervisorprod':'gvsupervisor';
