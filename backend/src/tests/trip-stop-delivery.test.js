import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {databasePool} from '../database/pool.js';
import {getTelegramBot} from '../bot/bot.js';
import {deliverTripOperationNotifications} from '../services/trip-operation-notifications.service.js';
const originalConnect=databasePool.connect;
after(async()=>{databasePool.connect=originalConnect;if(!databasePool.ending)await databasePool.end();});

for(const mode of ['success','failure','recent','legacy']) test(`entrega confirmada sin espera: ${mode}`,async()=>{
 process.env.TELEGRAM_BOT_TOKEN='123456:isolated-test'; process.env.TELEGRAM_GROUP_ID='isolated-group';
 const bot=getTelegramBot(); const originalSend=bot.telegram.sendMessage;
 const events=[{id:1,trip_id:1,event_type:'COMPANION_ADDED',created_at:new Date(Date.now()-(mode==='recent'?0:45000)),payload:{folio:'PRUEBA',confirmed:true,actions:[{type:'COMPANION_ADDED',name:'Persona 1'},{type:'COMPANION_ADDED',name:'Persona 2'}]}}];
 let eligible=true; const sent=[]; const updated=[];
 bot.telegram.sendMessage=async(chat,text,options)=>{sent.push({chat,text,options});if(mode==='failure')throw new Error('simulated');};
 databasePool.connect=async()=>({release(){},query:async(sql,params)=>{
  if(sql.startsWith('SELECT *'))return {rows:eligible?(sql.includes('trip_id=$1')?events:[events[0]]):[]};
  if(sql.includes('LEFT JOIN trip_telegram_start_messages')) {
    assert.deepEqual(params,[1,'isolated-group','123456']);
    return {rows:[{conductor:'Ana Conductora',vehiculo:'L200',numeroEconomico:'AUTO-006',telegramMessageId:mode==='legacy'?null:'123',telegramThreadId:'7'}]};
  }
  if(sql.startsWith('UPDATE')){updated.push({sql,ids:params[0]});eligible=false;}
  return {rows:[]};
 }});
 try{
  await deliverTripOperationNotifications();
  assert.equal(sent.length,1);assert.deepEqual(updated[0].ids,[1]);assert.match(sent[0].text,/Persona 1\n• Persona 2/);assert.equal(updated[0].sql.includes('last_error=NULL'),mode!=='failure');
  assert.match(sent[0].text,/Hora: \d{2}:\d{2}/);
  assert.match(sent[0].text,/Se recogió personal:\n• Persona 1\n• Persona 2/);
  assert.doesNotMatch(sent[0].text,/Viaje:|Conductor:|Unidad:|Número económico:|Se dejó personal:/);
  assert.deepEqual(sent[0].options,mode==='legacy'?{}:{reply_parameters:{message_id:123,allow_sending_without_reply:true},message_thread_id:7});
 }finally{bot.telegram.sendMessage=originalSend;databasePool.connect=originalConnect;delete process.env.TELEGRAM_BOT_TOKEN;delete process.env.TELEGRAM_GROUP_ID;}
});
