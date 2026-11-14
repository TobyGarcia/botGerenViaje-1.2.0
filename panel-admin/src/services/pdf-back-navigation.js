import {Capacitor} from '@capacitor/core';
import {App} from '@capacitor/app';
export function listenForPdfBack(close,{native=Capacitor.isNativePlatform(),app=App}={}){
 if(!native)return()=>{};
 let disposed=false,listener;
 app.addListener('backButton',()=>{if(!disposed)close();}).then(handle=>{if(disposed)handle.remove();else listener=handle;});
 return()=>{disposed=true;listener?.remove();};
}
