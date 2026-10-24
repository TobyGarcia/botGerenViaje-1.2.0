// Runs independently of app.js, PostgreSQL and the operational Telegram polling bots.
const validName = value => /^[A-Za-z0-9_-]{1,60}$/.test(value || '');
export function readMonitorTargets(raw) {
  let targets;
  try { targets = JSON.parse(raw || '[]'); } catch { throw new Error('MONITOR_TARGETS_INVALID'); }
  if (!Array.isArray(targets) || !targets.length || targets.length > 10) throw new Error('MONITOR_TARGETS_INVALID');
  const names = new Set();
  return targets.map(target => {
    if (!validName(target.name) || names.has(target.name) || !['backend', 'http'].includes(target.kind)) throw new Error('MONITOR_TARGETS_INVALID');
    let url;
    try { url = new URL(target.url); } catch { throw new Error('MONITOR_URL_INVALID'); }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('MONITOR_URL_INVALID');
    names.add(target.name);
    return { name: target.name, kind: target.kind, url: url.href };
  });
}

export async function probeService(target, fetchFn = globalThis.fetch) {
  try {
    const response = await fetchFn(target.url, { signal: AbortSignal.timeout(8000), redirect: 'manual', cache: 'no-store' });
    if (target.kind === 'http') {
      await response.body?.cancel();
      return [{ name: target.name, ok: response.ok }];
    }
    const body = await response.json();
    const recognized = body?.service === 'gerenciamiento-viajes-backend' && typeof body.database?.connected === 'boolean';
    const available = recognized && ((response.ok && body.database.connected) || (response.status === 503 && !body.database.connected));
    return [{ name: target.name, ok: available }, { name: target.name + '.database', ok: available ? body.database.connected : null }];
  } catch {
    return [{ name: target.name, ok: false }, ...(target.kind === 'backend' ? [{ name: target.name + '.database', ok: null }] : [])];
  }
}

export function createServiceMonitor({ targets, send, persist = async () => {}, restored = {}, probe = probeService,
  now = Date.now, environment = 'local', failureThreshold = 3, recoveryThreshold = 2, reminderMs = 6 * 3600000,
  output = event => console.error(JSON.stringify(event)) } = {}) {
  const states = {};
  const allowedNames = new Set(targets.flatMap(t => [t.name, ...(t.kind === 'backend' ? [t.name + '.database'] : [])]));
  for (const name of allowedNames) states[name] = restored.states?.[name] || { down: false, bad: 0, good: 0, firstBad: null, downAt: null, lastReminder: 0 };
  let pending = Array.isArray(restored.pending) ? restored.pending.filter(item => allowedNames.has(item.name)).slice(-1000) : [];
  let checking = false, delivering = false, nextSend = 0;
  const report = type => { try { output({ type }); } catch {} };
  const snapshot = () => structuredClone({ states, pending });
  const save = async () => { try { await persist(snapshot()); return true; } catch { report('service_monitor_state_write_failed'); return false; } };
  function alert(name, result, at, downAt) {
    if (pending.length >= 1000) { pending.shift(); report('service_monitor_queue_full'); }
    pending.push({ name, result, at, downAt });
  }
  return {
    snapshot,
    async check() {
      if (checking) return;
      checking = true;
      try {
        const batches = await Promise.all(targets.map(async target => {
          try { return await probe(target); } catch { return [{ name: target.name, ok: false }]; }
        }));
        for (const result of batches.flat()) {
          const state = states[result.name];
          if (!state) continue;
          if (result.ok === null) { state.bad = 0; state.good = 0; if (!state.down) state.firstBad = null; continue; }
          if (!result.ok) {
            state.bad++; state.good = 0; state.firstBad ??= now();
            if (!state.down && state.bad >= failureThreshold) {
              state.down = true; state.downAt = state.firstBad; state.lastReminder = now();
              alert(result.name, 'NO_DISPONIBLE', now(), state.downAt);
            } else if (state.down && now() - state.lastReminder >= reminderMs) {
              state.lastReminder = now(); alert(result.name, 'CONTINUA_NO_DISPONIBLE', now(), state.downAt);
            }
          } else {
            state.good++; state.bad = 0; state.firstBad = null;
            if (state.down && state.good >= recoveryThreshold) {
              alert(result.name, 'RECUPERADO', now(), state.downAt);
              state.down = false; state.downAt = null;
            }
          }
        }
        await save();
      } finally { checking = false; }
    },
    async deliver() {
      if (delivering || !pending.length || now() < nextSend) return;
      delivering = true;
      const item = pending[0];
      try {
        // Persist first so an abrupt restart can retry the unsent transition.
        if (!await save()) { nextSend = now() + 60000; return; }
        const stamp = new Intl.DateTimeFormat('es-MX', { timeZone: 'America/Mexico_City', dateStyle: 'short', timeStyle: 'medium' }).format(new Date(item.at));
        const env = /^[A-Za-z0-9_.-]{1,60}$/.test(environment) ? environment : 'local';
        const text = `${item.result === 'RECUPERADO' ? '✅ Servicio recuperado' : '🚨 Servicio no disponible'} · GV · ${env}\nServicio: ${item.name}\nEstado: ${item.result}\nHora: ${stamp} CDMX\nTiempo desde primera falla: ${Math.max(0, Math.round((item.at - item.downAt) / 60000))} min\nComprobación HTTP desde el monitor independiente.`;
        await send('CRITICAL', text);
        pending = pending.filter(entry => entry !== item);
        nextSend = now() + 6500;
        await save();
      } catch (error) {
        nextSend = now() + Math.max(6500, Number(error?.retryAfterMs) || 60000);
        report('service_monitor_delivery_failed');
      } finally { delivering = false; }
    }
  };
}
