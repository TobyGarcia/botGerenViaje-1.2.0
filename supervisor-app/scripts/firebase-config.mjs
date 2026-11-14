export const approverPackage='com.aspromex.gvmobility.supervisor.testing';
export const approverProject='gv-mobility-pruebas';
export function validateFirebaseConfig(config,environment={projectId:approverProject,appId:approverPackage}){
 if(config?.project_info?.project_id!==environment.projectId)throw Error('El proyecto Firebase no corresponde al ambiente seleccionado.');
 const client=config.client?.find(item=>item.client_info?.android_client_info?.package_name===environment.appId);
 if(!client?.client_info?.mobilesdk_app_id||!client.api_key?.[0]?.current_key)throw Error('Falta la aplicación Android de aprobadores en google-services.json.');
 return {projectId:environment.projectId,packageName:environment.appId};
}
