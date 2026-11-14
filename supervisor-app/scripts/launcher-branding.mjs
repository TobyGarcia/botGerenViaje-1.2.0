import {mkdirSync,copyFileSync,writeFileSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';

// Keep the approved GV mark unchanged. Native drawable layers provide the white tile.
export function prepareSupervisorLauncher(app){
 const res=resolve(app,'android/app/src/main/res');
 const put=(folder,name,content)=>{mkdirSync(resolve(res,folder),{recursive:true});writeFileSync(resolve(res,folder,name),content);};
 mkdirSync(resolve(res,'drawable-nodpi'),{recursive:true});
 copyFileSync(resolve(app,'resources/launcher/gv-mark.png'),resolve(res,'drawable-nodpi/gv_supervisor_mark.png'));
 const header='<?xml version="1.0" encoding="utf-8"?>\n';
 const bitmap=size=>`<item android:width="${size}dp" android:height="${size}dp" android:gravity="center"><bitmap android:src="@drawable/gv_supervisor_mark" android:gravity="fill" android:filter="true"/></item>`;
 put('drawable-v26','gv_supervisor_foreground.xml',header+'<inset xmlns:android="http://schemas.android.com/apk/res/android" android:insetLeft="20.37037%" android:insetTop="20.37037%" android:insetRight="20.37037%" android:insetBottom="20.37037%"><bitmap android:src="@drawable/gv_supervisor_mark" android:gravity="fill" android:filter="true"/></inset>');
 for(const round of [false,true]){
  const name=round?'gv_supervisor_round.xml':'gv_supervisor.xml';
  const shape=round?'<shape android:shape="oval"><size android:width="48dp" android:height="48dp"/><solid android:color="#FFFFFF"/></shape>':'<shape android:shape="rectangle"><size android:width="48dp" android:height="48dp"/><corners android:radius="11dp"/><solid android:color="#FFFFFF"/></shape>';
  put('mipmap-anydpi',name,header+`<layer-list xmlns:android="http://schemas.android.com/apk/res/android"><item android:width="48dp" android:height="48dp" android:gravity="center">${shape}</item>${bitmap(40)}</layer-list>`);
  put('mipmap-anydpi-v26',name,header+'<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android"><background android:drawable="@android:color/white"/><foreground android:drawable="@drawable/gv_supervisor_foreground"/></adaptive-icon>');
 }
 const manifest=resolve(app,'android/app/src/main/AndroidManifest.xml');
 const xml=readFileSync(manifest,'utf8').replace(/android:icon="[^"]+"/,'android:icon="@mipmap/gv_supervisor"').replace(/android:roundIcon="[^"]+"/,'android:roundIcon="@mipmap/gv_supervisor_round"');
 writeFileSync(manifest,xml);
}
