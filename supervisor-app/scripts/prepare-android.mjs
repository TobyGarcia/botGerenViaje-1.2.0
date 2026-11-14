import {prepareSupervisorLauncher} from './launcher-branding.mjs';
import {validateFirebaseConfig} from './firebase-config.mjs';
import {execFileSync} from 'node:child_process';import{existsSync,readFileSync,writeFileSync,mkdirSync}from'node:fs';import{resolve}from'node:path';import{fileURLToPath}from'node:url';
const app=resolve(fileURLToPath(new URL('..',import.meta.url)));
const npx=process.platform==='win32'?'npx.cmd':'npx';const run=args=>execFileSync(npx,args,{cwd:app,stdio:'inherit',shell:process.platform==='win32'});
if(!existsSync(resolve(app,'android')))run(['cap','add','android']);
const firebaseConfig=readFileSync(resolve(app,'google-services.json'),'utf8');
validateFirebaseConfig(JSON.parse(firebaseConfig));
writeFileSync(resolve(app,'android/app/google-services.json'),firebaseConfig);
const rootGradle=resolve(app,'android/build.gradle');
writeFileSync(rootGradle,readFileSync(rootGradle,'utf8').replace(/com.google.gms:google-services:[^']+/, 'com.google.gms:google-services:4.5.0'));
const gradle=resolve(app,'android/app/build.gradle');let s=readFileSync(gradle,'utf8');
if(!s.includes('firebase-messaging'))s=s.replace('dependencies {', `dependencies {
    implementation platform('com.google.firebase:firebase-bom:35.1.0')
    implementation 'com.google.firebase:firebase-messaging'
`);
s=s.replace(/versionCode\s+\d+/,"versionCode Integer.parseInt(System.getenv('ANDROID_VERSION_CODE') ?: '1')").replace(/versionName\s+"[^"]+"/,"versionName System.getenv('ANDROID_VERSION_NAME') ?: '0.1.0'");
if(!s.includes('ANDROID_KEYSTORE_PATH'))s=s.replace('    buildTypes {',`    signingConfigs { release { if (System.getenv('ANDROID_KEYSTORE_PATH')) { storeFile file(System.getenv('ANDROID_KEYSTORE_PATH'));storePassword System.getenv('ANDROID_KEYSTORE_PASSWORD');keyAlias System.getenv('ANDROID_KEY_ALIAS');keyPassword System.getenv('ANDROID_KEY_PASSWORD') } } }
    buildTypes {`).replace('        release {','        release {\n            signingConfig signingConfigs.release');
writeFileSync(gradle,s);
const manifest=resolve(app,'android/app/src/main/AndroidManifest.xml');s=readFileSync(manifest,'utf8');if(!s.includes('gvsupervisor'))s=s.replace('        </activity>',`            <intent-filter><action android:name="android.intent.action.VIEW"/><category android:name="android.intent.category.DEFAULT"/><category android:name="android.intent.category.BROWSABLE"/><data android:scheme="gvsupervisor" android:host="auth"/></intent-filter>
        </activity>`);if(!s.includes('android.permission.POST_NOTIFICATIONS'))s=s.replace('</manifest>','<uses-permission android:name="android.permission.POST_NOTIFICATIONS" /></manifest>');if(!s.includes('android.permission.REQUEST_INSTALL_PACKAGES'))s=s.replace('</manifest>','<uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES" /></manifest>');if(!s.includes('android.permission.VIBRATE'))s=s.replace('</manifest>','<uses-permission android:name="android.permission.VIBRATE" /></manifest>');writeFileSync(manifest,s);
prepareSupervisorLauncher(app);

// Reuse the conductor updater: same download, SHA256, package and signer checks.
const sharedNative=resolve(app,'../frontend/android/app/src/main/java/com/aspromex/gerenciamientoviajes');
const nativeDir=resolve(app,'android/app/src/main/java/com/aspromex/gvmobility/supervisor/testing');mkdirSync(nativeDir,{recursive:true});
for(const name of ['AndroidVersionPlugin','NativeApkUpdater','ApkUpdateSecurity','BridgeNumbers']) {
 writeFileSync(resolve(nativeDir,name+'.java'),readFileSync(resolve(sharedNative,name+'.java'),'utf8').replaceAll('package com.aspromex.gerenciamientoviajes;','package com.aspromex.gvmobility.supervisor.testing;').replaceAll('/gv-mobility.apk','/gv-supervisor.apk'));
}
const nativeTestDir=resolve(app,'android/app/src/test/java/com/aspromex/gvmobility/supervisor/testing');mkdirSync(nativeTestDir,{recursive:true});
writeFileSync(resolve(nativeTestDir,'ApkUpdateSecurityTest.java'),readFileSync(resolve(app,'../frontend/android/app/src/test/java/com/aspromex/gerenciamientoviajes/ApkUpdateSecurityTest.java'),'utf8').replaceAll('package com.aspromex.gerenciamientoviajes;','package com.aspromex.gvmobility.supervisor.testing;').replaceAll('/gv-mobility.apk','/gv-supervisor.apk'));
writeFileSync(resolve(nativeDir,'MainActivity.java'),`package com.aspromex.gvmobility.supervisor.testing;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
public class MainActivity extends BridgeActivity {
 @Override public void onCreate(Bundle savedInstanceState) {registerPlugin(AndroidVersionPlugin.class);registerPlugin(ApproverNotificationsPlugin.class);super.onCreate(savedInstanceState);}
 @Override protected void onNewIntent(android.content.Intent intent){super.onNewIntent(intent);setIntent(intent);}
}`);
for(const name of ['ApproverNotifications','ApproverFirebaseService','ApproverNotificationsPlugin','PriorityAlertPolicy','NotificationSoundPolicy'])writeFileSync(resolve(nativeDir,name+'.java'),readFileSync(resolve(app,'native',name+'.java'),'utf8'));
mkdirSync(resolve(app,'android/app/src/main/res/raw'),{recursive:true});
for(const name of ['priority_trip.wav','gv_management.mp3'])writeFileSync(resolve(app,'android/app/src/main/res/raw',name),readFileSync(resolve(app,'resources/raw',name)));
writeFileSync(resolve(nativeTestDir,'NotificationSoundPolicyTest.java'),readFileSync(resolve(app,'native-tests/NotificationSoundPolicyTest.java'),'utf8'));
writeFileSync(resolve(nativeTestDir,'PriorityAlertPolicyTest.java'),readFileSync(resolve(app,'native-tests/PriorityAlertPolicyTest.java'),'utf8'));
writeFileSync(resolve(nativeDir,'ApproverSecrets.java'),readFileSync(resolve(sharedNative,'GpsSecrets.java'),'utf8').replaceAll('com.aspromex.gerenciamientoviajes','com.aspromex.gvmobility.supervisor.testing').replaceAll('GpsSecrets','ApproverSecrets').replaceAll('gv-gps-token','gv-approver-token'));
let notificationManifest=readFileSync(manifest,'utf8');
if(!notificationManifest.includes('ApproverFirebaseService'))notificationManifest=notificationManifest.replace('</application>',`<service android:name=".ApproverFirebaseService" android:exported="false"><intent-filter><action android:name="com.google.firebase.MESSAGING_EVENT" /></intent-filter></service><meta-data android:name="firebase_messaging_auto_init_enabled" android:value="false" /></application>`);
writeFileSync(manifest,notificationManifest);
writeFileSync(resolve(app,'android/app/src/main/res/drawable/ic_stat_approver.xml'),'<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="24dp" android:height="24dp" android:viewportWidth="24" android:viewportHeight="24"><path android:fillColor="#FFFFFF" android:pathData="M5,3h4V1h6v2h4v19H5zM8,12l3,3 6,-7 -2,-2 -4,5 -1,-1z"/></vector>');
writeFileSync(resolve(app,'android/app/src/main/res/values/update_channel.xml'),'<resources><string name="android_update_channel">testing</string></resources>');

run(['cap','sync','android']);
