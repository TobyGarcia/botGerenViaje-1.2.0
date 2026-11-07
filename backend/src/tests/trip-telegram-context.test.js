import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { databasePool } from '../database/pool.js';
import { getTelegramBot, sendTripGroupAlert, sendTechnicalStopAlert } from '../bot/bot.js';
import { rememberTripStartMessage, getTripTelegramContext, tripReplyOptions } from '../services/trip-telegram-context.service.js';

const db = new PGlite();
await db.exec(`CREATE TABLE conductores(id_conductores INT PRIMARY KEY,nombre TEXT);
 CREATE TABLE vehiculos(id_vehiculos INT PRIMARY KEY,nombre TEXT,numero_economico TEXT);
 CREATE TABLE viajes(id_viajes INT PRIMARY KEY,id_conductores INT,id_vehiculos INT,folio TEXT);
 INSERT INTO conductores VALUES(1,'Ana'),(2,'Luis');
 INSERT INTO vehiculos VALUES(1,'L200','AUTO-006'),(2,'Mirage','AUTO-002');
 INSERT INTO viajes VALUES(1,1,1,'VJ-1'),(2,2,2,'VJ-2');`);
const sql = await readFile(new URL('../../../database/migrations/044_trip_telegram_start_messages.sql', import.meta.url), 'utf8');
await db.exec(sql); await db.exec(sql);
databasePool.query = async (sql, params) => db.query(sql, params);
after(async () => { await db.close(); if (!databasePool.ending) await databasePool.end(); });

test('guarda el inicio y responde a su mensaje en paradas manuales, aislando viajes, grupos y bots', async () => {
  process.env.TELEGRAM_BOT_TOKEN='123456:isolated-test';
  process.env.TELEGRAM_GROUP_ID='isolated-group';
  const bot=getTelegramBot(); const original=bot.telegram.sendMessage;
  const sent=[];
  bot.telegram.sendMessage=async(chat,text,options)=>{
    sent.push({chat,text,options}); return {message_id:101,message_thread_id:7};
  };
  try {
    const trip={id_viajes:1,folio:'VJ-1',conductor:'Ana',vehiculo:'L200',numero_economico:'AUTO-006'};
    await sendTripGroupAlert({action:'iniciado',trip});
    assert.doesNotMatch(sent[0].text,/Acompañantes:|Sin acompañantes/);
    await rememberTripStartMessage({idViaje:1},{message_id:999});
    const context=await getTripTelegramContext({idViaje:1});
    assert.deepEqual(tripReplyOptions(context),{reply_parameters:{message_id:101,allow_sending_without_reply:true},message_thread_id:7});
    assert.equal(context.numeroEconomico,'AUTO-006');
    await sendTechnicalStopAlert({trip,stop:{nombre_punto:'Patio',fecha_gps:new Date()}});
    assert.match(sent[1].text,/Folio: VJ-1\nConductor: Ana\nUnidad: L200\nNúmero económico: AUTO-006/);
    assert.deepEqual(sent[1].options,tripReplyOptions(context));
    assert.deepEqual(tripReplyOptions(await getTripTelegramContext({idViaje:2})),{});
    process.env.TELEGRAM_GROUP_ID='other-group';
    assert.deepEqual(tripReplyOptions(await getTripTelegramContext({idViaje:1})),{});
    process.env.TELEGRAM_GROUP_ID='isolated-group'; process.env.TELEGRAM_BOT_TOKEN='654321:other-bot';
    assert.deepEqual(tripReplyOptions(await getTripTelegramContext({idViaje:1})),{});
    process.env.TELEGRAM_BOT_TOKEN='123456:isolated-test';
    assert.equal(tripReplyOptions(await getTripTelegramContext({idViaje:1})).reply_parameters.message_id,101);
    await sendTripGroupAlert({action:'finalizado',trip:{...trip,idViaje:1}});
    assert.match(sent[2].text,/Viaje FINALIZADO/);
    assert.deepEqual(sent[2].options,tripReplyOptions(context));
    await sendTripGroupAlert({action:'finalizado',trip:{idViaje:2,folio:'VJ-2'}});
    assert.deepEqual(sent[3].options,{});
    assert.match(sent[3].text,/Folio: VJ-2/);
    assert.equal((await getTripTelegramContext({idViaje:1})).telegramMessageId,context.telegramMessageId);
    await sendTripGroupAlert({action:'cancelado',trip:{...trip,idViaje:1}});
    assert.match(sent[4].text,/Viaje CANCELADO/);
    assert.deepEqual(sent[4].options,tripReplyOptions(context));
    await sendTripGroupAlert({action:'cancelado',trip:{idViaje:2,folio:'VJ-2'}});
    assert.deepEqual(sent[5].options,{});
    assert.match(sent[5].text,/Folio: VJ-2/);
    assert.equal((await getTripTelegramContext({idViaje:1})).telegramMessageId,context.telegramMessageId);
    assert.equal(sent.length,6);
    await sendTripGroupAlert({action:'finalizado',trip:{...trip,idViaje:1,
      paradasTecnicas:Array.from({length:100},(_,i)=>({nombre_punto:`Parada técnica en Lugar ${i}: Se recogió personal: Ana`,fecha_gps:'2026-11-07T15:00:00Z'}))}});
    const parts=sent.slice(6);
    assert.ok(parts.length>1);
    for(const part of parts){assert.ok(part.text.length<=4000);assert.deepEqual(part.options,tripReplyOptions(context));}
    assert.match(parts.at(-1).text,/Lugar 99/);
    await sendTripGroupAlert({action:'iniciado',trip:{idViaje:2,folio:'VJ-2',acompanantes:[{nombre:'Ana'},'Luis',{nombre:' '}]}});
    assert.match(sent.at(-1).text,/Acompañantes: Ana, Luis\n/);
  } finally { bot.telegram.sendMessage=original; delete process.env.TELEGRAM_GROUP_ID; delete process.env.TELEGRAM_BOT_TOKEN; }
});
