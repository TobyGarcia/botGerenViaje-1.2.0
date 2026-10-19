import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import webpush from "web-push";
import { databasePool } from "../database/pool.js";

const VAPID_FILE = resolve(process.cwd(), ".vapid-keys.json");
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:admin@aquariomobility.com";

let vapidPublicKey = process.env.VAPID_PUBLIC_KEY || "";
let vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || "";

function initVapidKeys() {
  if (vapidPublicKey && vapidPrivateKey) {
    webpush.setVapidDetails(VAPID_SUBJECT, vapidPublicKey, vapidPrivateKey);
    return;
  }

  // Intentar cargar desde archivo persistente local
  if (existsSync(VAPID_FILE)) {
    try {
      const keys = JSON.parse(readFileSync(VAPID_FILE, "utf-8"));
      if (keys.publicKey && keys.privateKey) {
        vapidPublicKey = keys.publicKey;
        vapidPrivateKey = keys.privateKey;
        webpush.setVapidDetails(VAPID_SUBJECT, vapidPublicKey, vapidPrivateKey);
        return;
      }
    } catch {
      // Si falla, se regeneran
    }
  }

  // Generar llaves automáticas para desarrollo local y persistirlas
  const generated = webpush.generateVAPIDKeys();
  vapidPublicKey = generated.publicKey;
  vapidPrivateKey = generated.privateKey;
  try {
    writeFileSync(VAPID_FILE, JSON.stringify(generated, null, 2), "utf-8");
  } catch (err) {
    console.warn("[WebPush] No se pudo escribir archivo de llaves VAPID:", err.message);
  }

  webpush.setVapidDetails(VAPID_SUBJECT, vapidPublicKey, vapidPrivateKey);
  console.log("[WebPush] Llaves VAPID generadas e inicializadas localmente.");
}

// Inicializar de inmediato
initVapidKeys();

export function getVapidPublicKey() {
  return vapidPublicKey;
}

export async function saveSubscription({
  endpoint,
  keys,
  userType = "conductor",
  userId = null,
  userName = null,
  userAgent = null
}) {
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    throw new Error("Datos de suscripción Push incompletos (endpoint, p256dh, auth son requeridos).");
  }

  const query = `
    INSERT INTO web_push_subscriptions (
      endpoint, p256dh, auth, user_type, user_id, user_name, user_agent, activo, fallos_consecutivos, actualizado_en
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, 0, CURRENT_TIMESTAMP)
    ON CONFLICT (endpoint) DO UPDATE SET
      p256dh = EXCLUDED.p256dh,
      auth = EXCLUDED.auth,
      user_type = EXCLUDED.user_type,
      user_id = EXCLUDED.user_id,
      user_name = COALESCE(EXCLUDED.user_name, web_push_subscriptions.user_name),
      user_agent = COALESCE(EXCLUDED.user_agent, web_push_subscriptions.user_agent),
      activo = TRUE,
      fallos_consecutivos = 0,
      actualizado_en = CURRENT_TIMESTAMP
    RETURNING id_subscription, endpoint, user_type, user_id, activo, creado_en;
  `;

  const values = [
    endpoint,
    keys.p256dh,
    keys.auth,
    userType,
    userId ? String(userId) : null,
    userName,
    userAgent
  ];

  const { rows } = await databasePool.query(query, values);
  return rows[0];
}

export async function removeSubscription({ endpoint }) {
  if (!endpoint) return false;
  const { rowCount } = await databasePool.query(
    "UPDATE web_push_subscriptions SET activo = FALSE, actualizado_en = CURRENT_TIMESTAMP WHERE endpoint = $1",
    [endpoint]
  );
  return rowCount > 0;
}

export async function sendPushNotification(subscription, payload) {
  const pushSubscription = {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.p256dh,
      auth: subscription.auth
    }
  };

  const formattedPayload = JSON.stringify({
    title: payload.title || "GV Control de Viajes",
    body: payload.body || "",
    icon: payload.icon || "./pwa-192x192.png",
    badge: payload.badge || "./favicon.png",
    tag: payload.tag || "gv-general",
    url: payload.url || "./",
    data: payload.data || {},
    actions: payload.actions || []
  });

  try {
    const result = await webpush.sendNotification(pushSubscription, formattedPayload, {
      TTL: 60 * 60 * 24 // 24 horas
    });

    if (subscription.id_subscription) {
      await databasePool.query(
        "UPDATE web_push_subscriptions SET ultimo_envio = CURRENT_TIMESTAMP, fallos_consecutivos = 0 WHERE id_subscription = $1",
        [subscription.id_subscription]
      ).catch(() => {});
    }

    return { success: true, statusCode: result.statusCode };
  } catch (error) {
    const statusCode = error.statusCode;

    // 404 o 410 indican que la suscripción expiró o fue eliminada en el navegador
    if (statusCode === 404 || statusCode === 410) {
      await databasePool.query(
        "UPDATE web_push_subscriptions SET activo = FALSE, fallos_consecutivos = fallos_consecutivos + 1, actualizado_en = CURRENT_TIMESTAMP WHERE endpoint = $1",
        [subscription.endpoint]
      ).catch(() => {});
    } else if (subscription.id_subscription) {
      await databasePool.query(
        "UPDATE web_push_subscriptions SET fallos_consecutivos = fallos_consecutivos + 1, actualizado_en = CURRENT_TIMESTAMP WHERE id_subscription = $1",
        [subscription.id_subscription]
      ).catch(() => {});
    }

    return { success: false, statusCode, error: error.message };
  }
}

export async function notifyUser({
  userType = "conductor",
  userId,
  title,
  body,
  url = "./",
  tag = "gv-user-alert",
  data = {},
  actions = []
}) {
  if (!userId) return { sent: 0, failed: 0 };

  const { rows } = await databasePool.query(
    `SELECT id_subscription, endpoint, p256dh, auth
     FROM web_push_subscriptions
     WHERE user_type = $1 AND user_id = $2 AND activo = TRUE`,
    [userType, String(userId)]
  );

  if (rows.length === 0) {
    return { sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;

  await Promise.allSettled(
    rows.map(async (sub) => {
      const res = await sendPushNotification(sub, { title, body, url, tag, data, actions });
      if (res.success) sent += 1;
      else failed += 1;
    })
  );

  return { sent, failed };
}

export async function notifyRole({
  userType = "supervisor",
  title,
  body,
  url = "./",
  tag = "gv-role-alert",
  data = {},
  actions = []
}) {
  const { rows } = await databasePool.query(
    `SELECT id_subscription, endpoint, p256dh, auth
     FROM web_push_subscriptions
     WHERE user_type = $1 AND activo = TRUE`,
    [userType]
  );

  if (rows.length === 0) {
    return { sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;

  await Promise.allSettled(
    rows.map(async (sub) => {
      const res = await sendPushNotification(sub, { title, body, url, tag, data, actions });
      if (res.success) sent += 1;
      else failed += 1;
    })
  );

  return { sent, failed };
}

export async function notifyTripApproval({ driverId, destino, estado, observaciones, viajeId }) {
  if (!driverId) return;

  const isApproved = estado === "APROBADO";
  const title = isApproved ? "Viaje Aprobado ✅" : "Viaje Rechazado ❌";
  const body = isApproved
    ? `Tu viaje${destino ? ` a ${destino}` : ""} fue aprobado por el supervisor. Ya puedes iniciar tu ruta.`
    : `Tu viaje fue rechazado.${observaciones ? ` Motivo: ${observaciones}` : " Revisa las observaciones con tu supervisor."}`;

  return notifyUser({
    userType: "conductor",
    userId: driverId,
    title,
    body,
    url: "./",
    tag: `trip-approval-${viajeId || driverId}`,
    data: { viajeId, estado, destino },
    actions: [{ action: "ver", title: "Abrir App" }]
  });
}

export async function notifyTripReminder({ driverId, folio, hours = 1, tipo = "1_HORA" }) {
  if (!driverId) return;

  let body = `Tu viaje (${folio || "Activo"}) lleva tiempo en ruta. Recuerda finalizarlo al llegar a destino.`;
  if (tipo === "CIERRE_OPERATIVO") {
    body = `Atención: Próximo al cierre de jornada operativa. Si finalizaste tus actividades, registra el cierre de tu viaje (${folio}).`;
  } else if (hours >= 6) {
    body = `Alerta de tiempo: Tu viaje (${folio}) lleva más de ${hours} horas activo. Recuerda reportar tu estado y cerrar el viaje.`;
  }

  return notifyUser({
    userType: "conductor",
    userId: driverId,
    title: "Recordatorio de Viaje ⏱️",
    body,
    url: "./",
    tag: `trip-reminder-${folio || driverId}`,
    data: { folio, hours, tipo },
    actions: [{ action: "ver", title: "Cerrar Viaje" }]
  });
}

export async function notifySiniestroAlert({ driverName, tipoSiniestro, folio }) {
  return notifyRole({
    userType: "supervisor",
    title: "🚨 ALERTA DE SINIESTRO REPORTADO",
    body: `El conductor ${driverName || "Operador"} reportó un siniestro: ${tipoSiniestro || "Incidente en ruta"}. Folio: ${folio || "N/A"}.`,
    url: "./supervisor",
    tag: `siniestro-${folio || Date.now()}`,
    data: { folio, driverName, tipoSiniestro }
  });
}
