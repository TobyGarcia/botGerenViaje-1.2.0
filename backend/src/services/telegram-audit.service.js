// Independent from the application database and operational Telegram bots.
const LEVELS = ['GENERAL', 'WARN', 'ERROR', 'CRITICAL'];
const rank = { GENERAL: 0, WARN: 1, ERROR: 2, CRITICAL: 3 };
const label = { GENERAL: '📋 Generales', WARN: '🟡 Advertencia', ERROR: '🔴 Error', CRITICAL: '🚨 Servicios / crítico' };
const safe = (value, fallback = 'NO_DISPONIBLE') => /^[a-zA-Z0-9_.:-]{1,100}$/.test(String(value || '')) ? String(value) : fallback;
const uuid = value => /^[a-f0-9-]{36}$/i.test(String(value || '')) ? value : '—';
const time = value => new Intl.DateTimeFormat('es-MX', { timeZone: 'America/Mexico_City', dateStyle: 'short', timeStyle: 'medium' }).format(new Date(value));
const httpMethod = value => /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)$/.test(String(value || '')) ? String(value) : 'INTERNO';
const safePath = value => {
  const path = String(value || '');
  return path.startsWith('/') && path.length <= 180 && /^\/[A-Za-z0-9._~:/-]*$/.test(path) ? path : '—';
};
const operationLabels = {
  ACCESO_DENEGADO: 'Acceso denegado', INICIO_SESION: 'Inicio de sesión', INICIO_SESION_FALLIDO: 'Inicio de sesión fallido',
  CIERRE_SESION: 'Cierre de sesión', ERROR_SERVIDOR: 'Error interno del servidor', REGISTRO_GPS: 'Registro de ubicaciones GPS',
  CONSULTA_INSPECCION: 'Consulta de inspección', CAMBIO_INSPECCION: 'Cambio de inspección', CONSULTA_VIAJE: 'Consulta de viaje',
  CAMBIO_VIAJE: 'Cambio de viaje', CONSULTA: 'Consulta', ELIMINACION: 'Eliminación', CAMBIO_DATOS: 'Cambio de datos',
  OPERACION: 'Operación interna', AUDIT_WRITE_FAILED: 'Persistencia de auditoría'
};
const operationLabel = event => operationLabels[event] || safe(event, 'Operación no identificada');
function httpExplanation(status, event) {
  if (event === 'INICIO_SESION_FALLIDO') return 'El servidor rechazó las credenciales o datos de acceso.';
  return ({
    400: 'La solicitud llegó incompleta o con datos inválidos.',
    401: 'No había una sesión válida; pudo expirar o faltar la autenticación.',
    403: 'La sesión existe, pero no tiene permiso para esta operación.',
    404: 'La aplicación solicitó una ruta o registro que no existe.',
    409: 'La operación entró en conflicto con el estado actual de los datos.',
    422: 'Los datos no cumplieron una regla de validación.',
    429: 'Se excedió temporalmente el límite de solicitudes.',
    499: 'El dispositivo cerró la conexión antes de recibir la respuesta.',
    500: 'El backend falló mientras procesaba la solicitud.',
    502: 'Un servicio intermedio recibió una respuesta inválida.',
    503: 'El servicio no estaba disponible temporalmente.',
    504: 'Un servicio dependiente tardó demasiado en responder.'
  })[status] || (status >= 500 ? 'El servidor no pudo completar la operación.' : status >= 400 ? 'La solicitud fue rechazada por el servidor.' : 'Revisar el detalle completo en el panel de auditoría.');
}

export function readTelegramAuditConfig(env = process.env) {
  if (env.AUDIT_TELEGRAM_ENABLED !== 'true') return { enabled: false };
  const token = env.AUDIT_TELEGRAM_BOT_TOKEN || '';
  const chatId = env.AUDIT_TELEGRAM_CHAT_ID || '';
  if (!/^\d+:[A-Za-z0-9_-]+$/.test(token) || !/^-100\d+$/.test(chatId)) throw new Error('AUDIT_TELEGRAM_CONFIG_INVALID');
  const topics = {};
  for (const level of LEVELS) {
    const raw = env['AUDIT_TELEGRAM_TOPIC_' + level];
    if (!/^\d+$/.test(raw || '') || !Number.isSafeInteger(Number(raw)) || Number(raw) < (level === 'GENERAL' ? 0 : 1)) {
      throw new Error('AUDIT_TELEGRAM_TOPICS_INVALID');
    }
    topics[level] = Number(raw);
  }
  if (new Set(Object.values(topics)).size !== LEVELS.length) throw new Error('AUDIT_TELEGRAM_TOPICS_MUST_DIFFER');
  return { enabled: true, token, chatId, topics, environment: safe(env.AUDIT_ENVIRONMENT, 'local') };
}

export function createTelegramAuditSender(config, { fetchFn = globalThis.fetch } = {}) {
  return async function send(level, text) {
    if (!config.enabled) return false;
    if (!LEVELS.includes(level) || typeof text !== 'string' || text.length > 4000) throw new Error('AUDIT_MESSAGE_INVALID');
    const response = await fetchFn(`https://api.telegram.org/bot${config.token}/sendMessage`, {
      method: 'POST', signal: AbortSignal.timeout(8000), headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: config.chatId, ...(config.topics[level] ? { message_thread_id: config.topics[level] } : {}),
        text, disable_notification: level === 'GENERAL', link_preview_options: { is_disabled: true } })
    });
    const body = await response.json().catch(() => null);
    if (!response.ok || body?.ok !== true) {
      // Never expose Telegram descriptions, fetch URLs or credentials through an exception.
      const error = new Error('AUDIT_TELEGRAM_DELIVERY_FAILED');
      const retry = Number(body?.parameters?.retry_after);
      error.retryAfterMs = Number.isFinite(retry) && retry > 0 ? Math.min(retry, 86400) * 1000 : 60000;
      throw error;
    }
    return true;
  };
}

export function formatAuditAlert(group, environment = 'local') {
  const e = group.entry;
  const status = Number.isInteger(e.status) ? e.status : null;
  const code = e.errorCode !== '—' ? e.errorCode : status ? `HTTP_${status}` : '—';
  return [`${label[group.level]} · GV · ${safe(environment, 'local')}`,
    `Operación: ${operationLabel(e.event)}`, `Paso técnico: ${safe(e.step || e.event)}`,
    `Solicitud: ${httpMethod(e.method)} ${safePath(e.path)}`, `Respuesta HTTP: ${status ?? '—'}`,
    `Resultado: ${safe(e.result)}`, `Código: ${safe(code, '—')}`, `Interpretación: ${httpExplanation(status, e.event)}`,
    `Eventos agrupados: ${group.count}`, `Desde: ${time(group.first)} CDMX`, `Hasta: ${time(group.last)} CDMX`,
    `Viaje (ID): ${Number.isSafeInteger(Number(e.tripId)) && Number(e.tripId) > 0 ? Number(e.tripId) : '—'}`,
    `Operación de muestra: ${uuid(e.requestId)}`, e.method === 'CLIENT' ? 'Origen: dispositivo (no verificado)' : 'Origen: servidor'
  ].join('\n');
}

export function createTelegramAuditDispatcher({ send, now = Date.now, environment = 'local', intervalMs = 300000,
  sendGapMs = 6500, capacity = 500, output = event => console.error(JSON.stringify(event)) } = {}) {
  const groups = new Map();
  const seen = new Map();
  let busy = false, nextSend = 0;
  const report = type => { try { output({ type }); } catch {} };
  return {
    enqueue(entry) {
      try {
        if (entry.eventId && seen.has(entry.eventId)) return;
        if (entry.eventId) {
          seen.set(entry.eventId, now());
          if (seen.size > 2000) seen.delete(seen.keys().next().value);
        }
        const level = entry.level === 'CRITICAL' ? 'CRITICAL' : entry.level === 'ERROR' ? 'ERROR' : entry.level === 'WARN' ? 'WARN' : 'GENERAL';
        // INFO remains available in the administrative audit trail, but Telegram is reserved for actionable events.
        if (level === 'GENERAL') return;
        const key = level === 'GENERAL' ? level : [level, safe(entry.event), safe(entry.step || entry.event), safePath(entry.path),
          Number.isInteger(Number(entry.status)) ? Number(entry.status) : 0, safe(entry.errorCode, '—'), safe(entry.result)].join('|');
        let group = groups.get(key);
        if (!group) {
          if (groups.size >= capacity) {
            const victim = [...groups].find(([, value]) => rank[value.level] < rank[level]);
            if (victim) groups.delete(victim[0]);
            else { report('audit_telegram_queue_full'); return; }
          }
          // Only permitted scalar metadata enters the delivery queue.
          const status = Number(entry.status);
          const compact = { step: safe(entry.step), event: safe(entry.event), result: safe(entry.result),
            errorCode: safe(entry.errorCode, '—'), tripId: Number(entry.tripId) || null, requestId: uuid(entry.requestId),
            method: entry.method === 'CLIENT' ? 'CLIENT' : httpMethod(entry.method), path: safePath(entry.path),
            status: Number.isInteger(status) && status >= 100 && status <= 599 ? status : null };
          group = { level, entry: compact, count: 0, first: now(), last: now(), due: now() };
          groups.set(key, group);
        }
        group.count++; group.last = now();
      } catch { report('audit_telegram_enqueue_failed'); }
    },
    async tick() {
      if (busy || now() < nextSend) return;
      const candidate = [...groups].filter(([, g]) => g.count && g.due <= now()).sort((a, b) => rank[b[1].level] - rank[a[1].level] || a[1].due - b[1].due)[0];
      if (!candidate) {
        for (const [key, g] of groups) if (!g.count && g.due <= now()) groups.delete(key);
        return;
      }
      busy = true;
      const [key, g] = candidate;
      const count = g.count, last = g.last;
      try {
        const text = g.level === 'GENERAL'
          ? `${label.GENERAL} · GV · ${safe(environment, 'local')}\n${count} eventos informativos.\nDesde: ${time(g.first)} CDMX\nHasta: ${time(last)} CDMX\nDetalle completo en la auditoría administrativa.`
          : formatAuditAlert({ ...g, count, last }, environment);
        await send(g.level, text);
        // Events arriving while awaiting Telegram remain in the next summary.
        if (groups.get(key) === g) { g.count -= count; g.first = last; g.due = now() + intervalMs; }
        nextSend = now() + sendGapMs;
      } catch (error) {
        nextSend = now() + Math.max(sendGapMs, Number(error?.retryAfterMs) || 60000);
        report('audit_telegram_delivery_failed');
      } finally { busy = false; }
    },
    pending() { return [...groups.values()].reduce((sum, g) => sum + g.count, 0); }
  };
}

let dispatcher = null;
let timer = null;
export function publishTelegramAudit(entry) { try { dispatcher?.enqueue(entry); } catch {} }
export function telegramAuditStatus() { return { enabled: Boolean(dispatcher) }; }
export function startTelegramAudit(env = process.env) {
  if (timer) return;
  try {
    const config = readTelegramAuditConfig(env);
    if (!config.enabled) return;
    dispatcher = createTelegramAuditDispatcher({ send: createTelegramAuditSender(config), environment: config.environment });
    timer = setInterval(() => { void dispatcher.tick(); }, 1000);
    timer.unref();
  } catch { console.error(JSON.stringify({ type: 'audit_telegram_configuration_invalid', enabled: false })); }
}
export function stopTelegramAudit() { if (timer) clearInterval(timer); timer = null; dispatcher = null; }
