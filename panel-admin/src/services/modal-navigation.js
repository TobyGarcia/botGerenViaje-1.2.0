import {Capacitor} from '@capacitor/core';
import {App} from '@capacitor/app';
const channels=new WeakMap();
export function dispatchModalBack(app=App,modalOnly=false){
 const entries=channels.get(app)?.entries||[];
 const top=entries.filter(entry=>!modalOnly||entry.priority>=0).sort((a,b)=>b.priority-a.priority||b.order-a.order)[0];
 if(!top)return false;top.close();return true;
}
export function listenForModalBack(close,{native=Capacitor.isNativePlatform(),app=App,priority=30}={}){
 let channel=channels.get(app);if(!channel){channel={entries:[],order:0};channels.set(app,channel);}
 const entry={close,priority,order:++channel.order};channel.entries.push(entry);
 if(native&&!channel.pending&&!channel.listener){
  channel.pending=true;
  app.addListener('backButton',()=>dispatchModalBack(app)).then(handle=>{channel.pending=false;if(!channel.entries.length)handle.remove();else channel.listener=handle;}).catch(()=>{channel.pending=false;});
 }
 return()=>{channel.entries=channel.entries.filter(value=>value!==entry);if(!channel.entries.length&&channel.listener){channel.listener.remove();channel.listener=null;}};
}
export function listenForPdfBack(close,options={}){return listenForModalBack(close,{priority:80,...options});}
