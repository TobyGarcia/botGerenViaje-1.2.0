import {execFileSync} from 'node:child_process';import{existsSync,readFileSync,writeFileSync,mkdirSync}from'node:fs';import{resolve}from'node:path';import{fileURLToPath}from'node:url';
const app=resolve(fileURLToPath(new URL('..',import.meta.url)));
const npx=process.platform==='win32'?'npx.cmd':'npx';const run=args=>execFileSync(npx,args,{cwd:app,stdio:'inherit',shell:process.platform==='win32'});
if(!existsSync(resolve(app,'android')))run(['cap','add','android']);
const gradle=resolve(app,'android/app/build.gradle');let s=readFileSync(gradle,'utf8');
s=s.replace(/versionCode\s+\d+/,"versionCode Integer.parseInt(System.getenv('ANDROID_VERSION_CODE') ?: '1')").replace(/versionName\s+"[^"]+"/,"versionName System.getenv('ANDROID_VERSION_NAME') ?: '0.1.0'");
if(!s.includes('ANDROID_KEYSTORE_PATH'))s=s.replace('    buildTypes {',`    signingConfigs { release { if (System.getenv('ANDROID_KEYSTORE_PATH')) { storeFile file(System.getenv('ANDROID_KEYSTORE_PATH'));storePassword System.getenv('ANDROID_KEYSTORE_PASSWORD');keyAlias System.getenv('ANDROID_KEY_ALIAS');keyPassword System.getenv('ANDROID_KEY_PASSWORD') } } }
    buildTypes {`).replace('        release {','        release {\n            signingConfig signingConfigs.release');
writeFileSync(gradle,s);
const manifest=resolve(app,'android/app/src/main/AndroidManifest.xml');s=readFileSync(manifest,'utf8');if(!s.includes('gvsupervisor'))s=s.replace('        </activity>',`            <intent-filter><action android:name="android.intent.action.VIEW"/><category android:name="android.intent.category.DEFAULT"/><category android:name="android.intent.category.BROWSABLE"/><data android:scheme="gvsupervisor" android:host="auth"/></intent-filter>
        </activity>`);writeFileSync(manifest,s);
const foreground=resolve(app,'android/app/src/main/res/drawable/ic_launcher_foreground.xml');mkdirSync(resolve(app,'android/app/src/main/res/drawable'),{recursive:true});writeFileSync(foreground,`<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="108dp" android:height="108dp" android:viewportWidth="108" android:viewportHeight="108"><path android:fillColor="#0089BD" android:pathData="M0,0h108v108h-108z"/><path android:fillColor="#FFFFFF" android:pathData="M54,23L78,33v21c0,15 -10,25 -24,32 -14,-7 -24,-17 -24,-32V33z"/><path android:fillColor="#0089BD" android:pathData="M42,51l8,8 17,-19 5,5 -22,24 -13,-13z"/></vector>`);
for(const name of ['ic_launcher.xml','ic_launcher_round.xml']) {
 const file=resolve(app,'android/app/src/main/res/mipmap-anydpi-v26',name);
 if(existsSync(file))writeFileSync(file,readFileSync(file,'utf8').replace('@mipmap/ic_launcher_foreground','@drawable/ic_launcher_foreground'));
}

run(['cap','sync','android']);
