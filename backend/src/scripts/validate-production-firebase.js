// No database imports and no real notification delivery: Firebase Admin dryRun=true.
import {readFileSync} from 'node:fs';
import {initializeApp,cert,deleteApp} from 'firebase-admin/app';
import {getMessaging} from 'firebase-admin/messaging';
import {validateApproverServiceAccount} from '../services/approver-environment.js';
const credentials=JSON.parse(readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS,'utf8'));
const environment=validateApproverServiceAccount(credentials,{APPROVER_ENVIRONMENT:'stable'});
const app=initializeApp({credential:cert(credentials)},'production-validation');
try{
 await getMessaging(app).send({topic:'gv-production-configuration-validation',data:{purpose:'configuration-validation'}},true);
 console.log(JSON.stringify({project:environment.projectId,channel:environment.channel,credentials:'valid',fcmPermission:'valid',dryRun:true,notificationDelivered:false,databaseAccess:false}));
}catch(error){console.error(JSON.stringify({validation:'failed',code:error.code||'unknown',notificationDelivered:false}));process.exitCode=1;}
finally{await deleteApp(app);}
