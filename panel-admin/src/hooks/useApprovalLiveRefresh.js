import {useEffect} from 'react';
import {Capacitor} from '@capacitor/core';
import {App} from '@capacitor/app';
import {watchRemoteStatus} from '../../../frontend/src/services/update-checker.js';

// Screens own their first load. Later refreshes are read-only and never open a notification.
export function useApprovalLiveRefresh(refresh,enabled=true){
 useEffect(()=>{
  if(!enabled)return;
  let initial=true;
  const watcher=watchRemoteStatus({intervalMs:5000,minimumIntervalMs:0,
   check:signal=>{if(initial){initial=false;return;}return refresh({background:true,signal});},
   onResult:()=>{},
   subscribeResume:Capacitor.isNativePlatform()?callback=>App.addListener('appStateChange',state=>{if(state.isActive)callback();}):undefined
  });
  return()=>watcher.stop();
 },[refresh,enabled]);
}
