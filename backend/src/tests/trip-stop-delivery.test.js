import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {databasePool} from '../database/pool.js';
import {getTelegramBot} from '../bot/bot.js';
import {deliverTripOperationNotifications} from '../services/trip-operation-notifications.service.js';
const originalConnect=databasePool.connect;
after(async()=>{databasePool.connect=originalConnect;if(!databasePool.ending)await databasePool.end();});

for(const mode of ['success','failure','waiting']) test(`entrega agrupada: ${mode}`,async()=>{
 process.env.TELEGRAM_BOT_TOKEN='123456:isolated-test'; process.env.TELEGRAM_GROUP_ID='isolated-group';
 const bot=getTelegramBot(); const originalSend=bot.telegram.sendMessage;
 const events=[1,2].map(id=>({id,trip_id:1,event_type:'COMPANION_ADDED',created_at:new Date(Date.now()-(mode==='waiting'?5000:45000)+id*1000),payload:{folio:'PRUEBA',name:`Persona ${id}`,latitude:19.4,longitude:-99.1}}));
 let eligible=true; const sent=[]; const updated=[];
 bot.telegram.sendMessage=async(chat,text)=>{sent.push({chat,text});if(mode==='failure')throw new Error('simulated');};
 databasePool.connect=async()=>({release(){},query:async(sql,params)=>{
  if(sql.startsWith('SELECT *'))return {rows:eligible?(sql.includes('trip_id=$1')?events:[events[0]]):[]};
  if(sql.startsWith('UPDATE')){updated.push({sql,ids:params[0]});eligible=false;}
  return {rows:[]};
 }});
 try{
  await deliverTripOperationNotifications();
  if(mode==='waiting'){assert.equal(sent.length,0);assert.equal(updated.length,0);}
  else {assert.equal(sent.length,1);assert.deepEqual(updated[0].ids,[1,2]);assert.match(sent[0].text,/Persona 1\n• Persona 2/);assert.equal(updated[0].sql.includes('last_error=NULL'),mode==='success');}
 }finally{bot.telegram.sendMessage=originalSend;databasePool.connect=originalConnect;delete process.env.TELEGRAM_BOT_TOKEN;delete process.env.TELEGRAM_GROUP_ID;}
});
