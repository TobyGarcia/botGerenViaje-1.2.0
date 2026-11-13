export const approverPackage='com.aspromex.gvmobility.supervisor.testing';
export const approverProject='gv-mobility-pruebas';
export function validateFirebaseConfig(config){
 if(config?.project_info?.project_id!==approverProject)throw Error('El proyecto Firebase no corresponde a pruebas.');
 const client=config.client?.find(item=>item.client_info?.android_client_info?.package_name===approverPackage);
 if(!client?.client_info?.mobilesdk_app_id||!client.api_key?.[0]?.current_key)throw Error('Falta la aplicación Android de aprobadores en google-services.json.');
 return {projectId:approverProject,packageName:approverPackage};
}
