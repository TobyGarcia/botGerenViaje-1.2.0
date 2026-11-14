export function approverPushEnvironment(env=process.env){
 const channel=env.APPROVER_ENVIRONMENT||'testing';
 if(!['testing','stable'].includes(channel))throw Error('Ambiente push inválido.');
 const projectId=channel==='stable'?'gvmobilityproduccion':'gv-mobility-pruebas';
 if(env.APPROVER_FIREBASE_PROJECT_ID&&env.APPROVER_FIREBASE_PROJECT_ID!==projectId)throw Error('Proyecto Firebase incompatible con el ambiente.');
 return {channel,projectId};
}
export function validateApproverServiceAccount(credentials,env=process.env){
 const environment=approverPushEnvironment(env);
 if(credentials?.type!=='service_account'||credentials.project_id!==environment.projectId||
 !credentials.client_email?.endsWith(`@${environment.projectId}.iam.gserviceaccount.com`)||!credentials.private_key)throw Error('Cuenta de servicio incompatible con el ambiente.');
 return environment;
}
