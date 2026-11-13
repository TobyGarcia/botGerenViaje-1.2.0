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
        </activity>`);if(!s.includes('android.permission.POST_NOTIFICATIONS'))s=s.replace('</manifest>','<uses-permission android:name="android.permission.POST_NOTIFICATIONS" /></manifest>');if(!s.includes('android.permission.REQUEST_INSTALL_PACKAGES'))s=s.replace('</manifest>','<uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES" /></manifest>');writeFileSync(manifest,s);
const foreground=resolve(app,'android/app/src/main/res/drawable/ic_launcher_foreground.xml');mkdirSync(resolve(app,'android/app/src/main/res/drawable'),{recursive:true});writeFileSync(foreground,`<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="108dp" android:height="108dp" android:viewportWidth="108" android:viewportHeight="108"><path android:fillColor="#0089BD" android:pathData="M0,0h108v108h-108z"/><path android:fillColor="#FFFFFF" android:pathData="M54,23L78,33v21c0,15 -10,25 -24,32 -14,-7 -24,-17 -24,-32V33z"/><path android:fillColor="#0089BD" android:pathData="M42,51l8,8 17,-19 5,5 -22,24 -13,-13z"/></vector>`);
for(const name of ['ic_launcher.xml','ic_launcher_round.xml']) {
 const file=resolve(app,'android/app/src/main/res/mipmap-anydpi-v26',name);
 if(existsSync(file))writeFileSync(file,readFileSync(file,'utf8').replace('@mipmap/ic_launcher_foreground','@drawable/ic_launcher_foreground'));
}

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
 @Override public void onCreate(Bundle savedInstanceState) {registerPlugin(AndroidVersionPlugin.class);super.onCreate(savedInstanceState);}
}`);
writeFileSync(resolve(app,'android/app/src/main/res/values/update_channel.xml'),'<resources><string name="android_update_channel">testing</string></resources>');

run(['cap','sync','android']);
