import test from 'node:test';
import assert from 'node:assert/strict';
import { readMonitorTargets, probeService, createServiceMonitor } from '../services/service-monitor.service.js';

const targets = [{ name: 'backend', kind: 'backend', url: 'http://127.0.0.1:3000/health' }];
test('monitor validates named targets and rejects credentials or query strings', () => {
  assert.deepEqual(readMonitorTargets(JSON.stringify(targets)), targets);
  for (const url of ['file:///etc/passwd', 'https://user:pass@test/health', 'https://test/health?token=secret']) {
    assert.throws(() => readMonitorTargets(JSON.stringify([{ ...targets[0], url }])));
  }
  assert.throws(() => readMonitorTargets(JSON.stringify([...targets, ...targets])));
});

test('health probes distinguish database failure from absent backend and reject invalid health bodies', async () => {
  const dbFailed = await probeService(targets[0], async () => ({ status:503, ok:false, json:async () => ({service:'gerenciamiento-viajes-backend',database:{connected:false}}) }));
  assert.deepEqual(dbFailed, [{name:'backend',ok:true},{name:'backend.database',ok:false}]);
  const backendFailed = await probeService(targets[0], async () => { throw new Error('timeout'); });
  assert.deepEqual(backendFailed, [{name:'backend',ok:false},{name:'backend.database',ok:null}]);
  const invalid = await probeService(targets[0], async () => ({ok:true,status:200,json:async () => ({success:true})}));
  assert.equal(invalid[0].ok,false);
  const web = await probeService({name:'pwa',kind:'http',url:'http://localhost'}, async () => ({ok:false}));
  assert.deepEqual(web,[{name:'pwa',ok:false}]);
});

test('three consecutive failures trigger one outage; two successes trigger recovery', async () => {
  let ok = true, clock = 0;
  const sent = [];
  const m = createServiceMonitor({ targets, now:()=>clock, send:async (level,text)=>sent.push({level,text}), probe:async()=>[{name:'backend',ok}] });
  await m.check(); await m.deliver(); assert.equal(sent.length,0);
  ok=false; await m.check(); await m.check(); await m.deliver(); assert.equal(sent.length,0);
  ok=true; await m.check(); // resets consecutive-failure threshold
  ok=false; for(let i=0;i<3;i++){clock+=30000;await m.check();}
  await m.deliver(); assert.equal(sent.length,1); assert.equal(sent[0].level,'CRITICAL');
  assert.ok(sent[0].text.includes('NO_DISPONIBLE'));
  await m.check(); clock+=30000; await m.deliver(); assert.equal(sent.length,1);
  ok=true; await m.check(); await m.deliver(); assert.equal(sent.length,1);
  await m.check(); await m.deliver(); assert.equal(sent.length,2); assert.ok(sent[1].text.includes('RECUPERADO'));
});

test('monitor resumes unsent alerts after restart and repeats prolonged outages every six hours', async () => {
  let clock=0, saved;
  const opts={targets,now:()=>clock,probe:async()=>[{name:'backend',ok:false}],persist:async state=>{saved=state;},output:()=>{}};
  const m=createServiceMonitor({...opts,send:async()=>{throw new Error('offline');}});
  for(let i=0;i<3;i++){clock+=30000;await m.check();}
  await m.deliver(); assert.equal(saved.pending.length,1);
  const sent=[];
  const resumed=createServiceMonitor({...opts,restored:saved,send:async(_,text)=>sent.push(text)});
  await resumed.deliver(); assert.equal(sent.length,1); assert.equal(saved.pending.length,0);
  clock+=6*3600000; await resumed.check(); await resumed.deliver();
  assert.equal(sent.length,2); assert.ok(sent[1].includes('CONTINUA_NO_DISPONIBLE'));
});

test('state disk failure prevents unrecorded sends, and failed Telegram sends remain pending', async () => {
  let sends=0;
  const m=createServiceMonitor({targets,failureThreshold:1,probe:async()=>[{name:'backend',ok:false}],
    persist:async()=>{throw new Error('disk full');},send:async()=>{sends++;},output:()=>{}});
  await m.check(); await m.deliver();
  assert.equal(sends,0); assert.equal(m.snapshot().pending.length,1);
});

test('unknown database status never fabricates a recovery and overlapping checks are ignored', async () => {
  let resolve, calls=0;
  const m=createServiceMonitor({targets,restored:{states:{'backend.database':{down:true,bad:3,good:0,downAt:1}}},
    probe:()=>{calls++;return new Promise(done=>{resolve=done;});},send:async()=>{}});
  const checking=m.check(); await m.check();
  resolve([{name:'backend',ok:false},{name:'backend.database',ok:null}]); await checking;
  assert.equal(calls,1); assert.equal(m.snapshot().states['backend.database'].down,true); assert.equal(m.snapshot().pending.length,0);
});
