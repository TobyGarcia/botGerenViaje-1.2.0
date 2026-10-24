import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readTelegramAuditConfig, createTelegramAuditSender, createTelegramAuditDispatcher, formatAuditAlert } from '../services/telegram-audit.service.js';

const env = { AUDIT_TELEGRAM_ENABLED: 'true', AUDIT_TELEGRAM_BOT_TOKEN: '123:FAKE_TEST_TOKEN', AUDIT_TELEGRAM_CHAT_ID: '-100123',
  AUDIT_TELEGRAM_TOPIC_GENERAL: '0', AUDIT_TELEGRAM_TOPIC_WARN: '2', AUDIT_TELEGRAM_TOPIC_ERROR: '3', AUDIT_TELEGRAM_TOPIC_CRITICAL: '4' };
const event = (level, step = 'viajes.startTrip') => ({ level, step, eventId: randomUUID(), requestId: randomUUID(), result: 'ERROR',
  errorCode: '23514', event: 'CAMBIO_VIAJE', method: 'POST', path: '/api/viajes', status: 500 });

test('alerts require explicit enablement and dedicated complete configuration', async () => {
  assert.deepEqual(readTelegramAuditConfig({ TELEGRAM_BOT_TOKEN: 'real_operational_token' }), { enabled: false });
  let calls = 0;
  await createTelegramAuditSender({ enabled: false }, { fetchFn: async () => { calls++; } })('ERROR', 'test');
  assert.equal(calls, 0);
  assert.throws(() => readTelegramAuditConfig({ ...env, AUDIT_TELEGRAM_TOPIC_ERROR: '' }));
  assert.throws(() => readTelegramAuditConfig({ ...env, AUDIT_TELEGRAM_TOPIC_ERROR: '2' }));
  assert.throws(() => readTelegramAuditConfig({ ...env, AUDIT_TELEGRAM_CHAT_ID: '123' }));
});

test('sender uses correct supergroup topics, native General and silent informational delivery', async () => {
  const calls = [];
  const send = createTelegramAuditSender(readTelegramAuditConfig(env), { fetchFn: async (url, options) => {
    calls.push({ url, ...JSON.parse(options.body) }); return { ok: true, json: async () => ({ ok: true }) };
  } });
  for (const level of ['GENERAL','WARN','ERROR','CRITICAL']) await send(level, 'TEST');
  assert.equal(calls[0].message_thread_id, undefined);
  assert.equal(calls[0].disable_notification, true);
  assert.deepEqual(calls.slice(1).map(c => c.message_thread_id), [2,3,4]);
  assert.ok(calls.every(c => c.chat_id === '-100123' && !c.parse_mode));
});

test('Telegram 429 preserves retry_after without leaking response descriptions', async () => {
  const send = createTelegramAuditSender(readTelegramAuditConfig(env), { fetchFn: async () => ({ ok: false, json: async () => ({
    ok: false, description: 'SECRET', parameters: { retry_after: 120 }
  }) }) });
  await assert.rejects(() => send('ERROR', 'test'), error => error.retryAfterMs === 120000 && !error.message.includes('SECRET'));
});

test('messages include only safe fields, never personal data, payloads, secrets or coordinates', () => {
  const text = formatAuditAlert({ level: 'ERROR', count: 3, first: Date.now(), last: Date.now(), entry: {
    ...event('ERROR'), step: 'bad\nSECRET', actorName: 'SECRET', tripId: 7, details: { token: 'SECRET', latitud: 20 }, message: 'SECRET'
  } });
  assert.ok(!text.includes('SECRET'));
  assert.ok(!text.includes('latitud'));
  assert.ok(text.includes('Viaje (ID): 7'));
});

test('HTTP alerts explain operation, endpoint, status and likely meaning', () => {
  const text = formatAuditAlert({ level: 'WARN', count: 12, first: Date.now(), last: Date.now(), entry: {
    ...event('WARN', 'http'), event: 'ACCESO_DENEGADO', method: 'GET', path: '/api/admin/auth/session',
    status: 401, result: 'ERROR_HTTP', errorCode: '—'
  } });
  assert.match(text, /Operación: Acceso denegado/);
  assert.match(text, /Solicitud: GET \/api\/admin\/auth\/session/);
  assert.match(text, /Respuesta HTTP: 401/);
  assert.match(text, /Código: HTTP_401/);
  assert.match(text, /sesión válida/);
});

test('HTTP alerts reject unsafe paths and do not combine different routes or statuses', async () => {
  const unsafe = formatAuditAlert({ level: 'ERROR', count: 1, first: Date.now(), last: Date.now(), entry: {
    ...event('ERROR'), path: '/api/test?token=SECRET', actorName: 'SECRET'
  } });
  assert.ok(!unsafe.includes('SECRET'));
  let clock = 0;
  const sent = [];
  const d = createTelegramAuditDispatcher({ now: () => clock, sendGapMs: 0, send: async (_, text) => sent.push(text) });
  d.enqueue({ ...event('WARN', 'http'), status: 401, path: '/api/admin/auth/session' });
  d.enqueue({ ...event('WARN', 'http'), status: 403, path: '/api/admin/auditoria' });
  await d.tick(); await d.tick();
  assert.equal(sent.length, 2);
  assert.ok(sent.some(text => text.includes('HTTP: 401')));
  assert.ok(sent.some(text => text.includes('HTTP: 403')));
});

test('informational logs stay out of Telegram and critical faults take priority', async () => {
  let clock = 0;
  const sent = [];
  const d = createTelegramAuditDispatcher({ now: () => clock, send: async (level,text) => { sent.push({level,text}); } });
  for (let i = 0; i < 50; i++) d.enqueue(event('INFO'));
  await d.tick(); assert.equal(sent.length, 0); assert.equal(d.pending(), 0);
  d.enqueue(event('WARN')); d.enqueue(event('ERROR')); d.enqueue(event('CRITICAL'));
  await d.tick(); assert.equal(sent[0].level, 'CRITICAL');
  clock += 6500; await d.tick(); assert.equal(sent[1].level, 'ERROR');
  clock += 6500; await d.tick(); assert.equal(sent[2].level, 'WARN');
  clock = 300000; await d.tick(); assert.equal(sent.length, 3);
});

test('repeated errors group while identical event IDs do not count twice', async () => {
  let clock = 0;
  const sent = [];
  const d = createTelegramAuditDispatcher({ now: () => clock, send: async (_,text) => sent.push(text) });
  const e = event('ERROR');
  d.enqueue(e); d.enqueue(e); await d.tick();
  for (let i = 0; i < 4; i++) d.enqueue(event('ERROR'));
  clock = 10000; await d.tick(); assert.equal(sent.length, 1);
  clock = 300000; await d.tick(); assert.equal(sent.length, 2);
  assert.ok(sent[1].includes('Eventos agrupados: 4'));
});

test('delivery failures retain queue, back off and never recurse through audit logging', async () => {
  let clock = 0, attempts = 0;
  const output = [];
  const d = createTelegramAuditDispatcher({ now: () => clock, output: e => output.push(e), send: async () => {
    attempts++; if (attempts === 1) throw Object.assign(new Error('SECRET'), { retryAfterMs: 120000 });
  } });
  d.enqueue(event('ERROR')); await d.tick(); await d.tick();
  assert.equal(attempts, 1); assert.equal(d.pending(), 1);
  clock = 120000; await d.tick();
  assert.equal(d.pending(), 0); assert.ok(!JSON.stringify(output).includes('SECRET'));
});

test('bounded queue reserves space for severe events and preserves arrivals during send', async () => {
  let done;
  const sent = [];
  const d = createTelegramAuditDispatcher({ capacity: 1, output: () => {}, send: (level) => {
    sent.push(level); return new Promise(resolve => { done = resolve; });
  } });
  d.enqueue(event('INFO')); d.enqueue(event('CRITICAL'));
  const work = d.tick(); await d.tick();
  d.enqueue(event('CRITICAL'));
  done(); await work;
  assert.deepEqual(sent, ['CRITICAL']); assert.equal(d.pending(), 1);
});
