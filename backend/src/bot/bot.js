import { Telegraf } from "telegraf";

import {
  registerBotHandlers
} from "./bot.handlers.js";

let botInstance = null;
let botStarted = false;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Reintenta el arranque del bot si Telegram responde con 409 (conflicto por
// una instancia previa que aún no terminó de apagarse durante un deploy).
async function launchWithRetry(bot, { maxAttempts = 10, baseDelayMs = 3000 } = {}) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await bot.telegram.deleteWebhook({ drop_pending_updates: true });
      await bot.launch({ dropPendingUpdates: true });
      return true;
    } catch (error) {
      const isConflict =
        error?.response?.error_code === 409 ||
        /409/.test(error?.message || "");

      if (!isConflict || attempt === maxAttempts) {
        console.error(
          `No fue posible iniciar el bot de Telegram tras ${attempt} intento(s):`,
          error.message
        );
        return false;
      }

      const waitMs = Math.min(baseDelayMs * (2 ** (attempt - 1)), 30000);
      console.warn(
        `Conflicto 409 al iniciar el bot de Telegram (intento ${attempt}/${maxAttempts}). Reintentando en ${waitMs / 1000}s...`
      );
      await delay(waitMs);
    }
  }

  return false;
}

export function getTelegramBot() {
  if (botInstance) {
    return botInstance;
  }

  const token =
    process.env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    throw new Error(
      "TELEGRAM_BOT_TOKEN no está configurado."
    );
  }

  botInstance = new Telegraf(token);

  registerBotHandlers(botInstance);

  return botInstance;
}

export async function startTelegramBot() {
  const bot = getTelegramBot();

  if (botStarted) {
    return bot;
  }

  console.log(
    "Iniciando conexión con Telegram..."
  );

  await bot.telegram.setMyCommands([
    { command: "viaje", description: "Abrir el sistema de viajes" },
    { command: "registro", description: "Completar registro como conductor" },
    { command: "start", description: "Iniciar registro o abrir el sistema" },
    { command: "ayuda", description: "Mostrar ayuda" }
  ]);

  const webAppUrl = process.env.TELEGRAM_WEB_APP_URL || process.env.VITE_MINI_APP_URL;
  const groupId = process.env.TELEGRAM_GROUP_ID;

  if (webAppUrl) {
    try {
      await bot.telegram.callApi("setChatMenuButton", {
        menu_button: {
          type: "web_app",
          text: "bot de viaje",
          web_app: { url: webAppUrl }
        }
      });
      console.log("Botón de menú global 'bot de viaje' configurado.");
    } catch (err) {
      console.warn("No se pudo configurar el botón de menú global 'bot de viaje':", err.message);
    }

    if (groupId) {
      try {
        await bot.telegram.callApi("setChatMenuButton", {
          chat_id: groupId,
          menu_button: {
            type: "web_app",
            text: "bot de viaje",
            web_app: { url: webAppUrl }
          }
        });
        console.log(`Botón de menú 'bot de viaje' configurado para el grupo viajes_ITZ (${groupId}).`);
      } catch (err) {
        console.warn(`No se pudo configurar el botón de menú 'bot de viaje' en el grupo (${groupId}):`, err.message);
      }
    }
  }

  const started = await launchWithRetry(bot);

  if (started) {
    botStarted = true;
    console.log(
      "Bot de Telegram iniciado correctamente."
    );
  }

  return bot;
}

export async function stopTelegramBot(signal) {
  if (!botInstance) {
    return;
  }

  botInstance.stop(signal);
  botStarted = false;

  console.log(
    `Bot de Telegram detenido por ${signal}.`
  );
}

export async function sendTripGroupAlert({
  action,
  trip
}) {
  const groupId = process.env.TELEGRAM_GROUP_ID;

  if (!groupId) {
    console.warn(
      "No se envió la alerta del viaje: TELEGRAM_GROUP_ID no está configurado."
    );
    return;
  }

  const formatTime = (value) => value
    ? new Intl.DateTimeFormat("es-MX", {
      timeZone: "America/Mexico_City",
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(value))
    : "No registrada";

  const companions = Array.isArray(trip.acompanantes)
    ? trip.acompanantes
      .map((companion) => companion?.nombre)
      .filter(Boolean)
      .join(", ")
    : "";

  const baseDetails = [
    `Folio: ${trip.folio ?? "No disponible"}`,
    `Conductor: ${trip.conductor ?? "No disponible"}`,
    `Unidad: ${trip.vehiculo ?? "No disponible"}`,
    trip.numeroEconomico
      ? `Número económico: ${trip.numeroEconomico}`
      : null
  ];

  const messages = {
    iniciado: [
      "🚐 Viaje INICIADO",
      ...baseDetails,
      `Licencia vigente: ${trip.licenciaVigente ? "Sí" : "No"}`,
      `Kilometraje inicial: ${trip.kilometrajeInicial ?? "No registrado"} km`,
      `Origen: ${trip.origen ?? "No registrado"}`,
      `Destino: ${trip.destino ?? "No registrado"}`,
      `Acompañantes: ${companions || "Sin acompañantes"}`,
      `Motivo: ${trip.motivo ?? "No registrado"}`,
      `Hora de salida: ${formatTime(trip.horaSalida)}`
    ],
    finalizado: [
      "🚐 Viaje FINALIZADO",
      ...baseDetails,
      `Hora de finalización: ${formatTime(trip.horaLlegada)}`
    ],
    cancelado: [
      "🚐 Viaje CANCELADO",
      ...baseDetails
    ]
  };

  const message = (messages[action] ?? [
    `🚐 Viaje ${action.toUpperCase()}`,
    ...baseDetails
  ])
    .filter(Boolean)
    .join("\n");

  try {
    await getTelegramBot().telegram.sendMessage(groupId, message);
  } catch (error) {
    console.error("No fue posible enviar la alerta al grupo:", error);
  }
}

export async function sendDriverInspectionNotification({
  telegramUserId,
  approved,
  trip,
  comment
}) {
  if (!telegramUserId) return;

  const reason = String(comment || "").trim();
  const message = approved
    ? [
      "✅ Inspección vehicular aprobada",
      `Folio: ${trip?.folio ?? "No disponible"}`,
      `Unidad: ${trip?.vehiculo ?? "No disponible"}`,
      "Ya puedes abrir la Mini App e iniciar el viaje cuando estés listo."
    ]
    : [
      "❌ Inspección vehicular rechazada",
      `Folio: ${trip?.folio ?? "No disponible"}`,
      "El viaje fue cancelado automáticamente.",
      `Motivo: ${reason || "No se proporcionó un comentario administrativo."}`
    ];

  try {
    await getTelegramBot().telegram.sendMessage(
      String(telegramUserId),
      message.join("\n")
    );
  } catch (error) {
    console.error("No fue posible notificar la decisión de inspección al conductor:", error);
  }
}

export async function sendDriverManejoComentadoAuthorizationNotification({ telegramUserId, approved, trip, comment }) {
  if (!telegramUserId) return;
  const message = approved
    ? ["✅ Autorización de manejo comentado aprobada", `Folio: ${trip?.folio || "No disponible"}`, "Ya puedes iniciar el viaje."].join("\n")
    : ["❌ Autorización de manejo comentado rechazada", `Folio: ${trip?.folio || "No disponible"}`, `Motivo: ${comment || "No se proporcionó un comentario."}`].join("\n");
  try {
    await getTelegramBot().telegram.sendMessage(String(telegramUserId), message);
  } catch (error) {
    console.error("No fue posible notificar la autorización de manejo comentado:", error);
  }
}

export async function sendDriverRegistrationSupervisorAlert({ conductor, pinGenerado = null }) {
  const supervisorGroupId = process.env.TELEGRAM_GROUP_SUPRVISOR_ID || process.env.TELEGRAM_GROUP_ID;

  if (!supervisorGroupId) {
    console.warn("No se envió la alerta de nuevo conductor: TELEGRAM_GROUP_SUPRVISOR_ID no está configurado.");
    return;
  }

  const message = [
    "👤 NUEVO REGISTRO DE CONDUCTOR PENDIENTE",
    `Nombre: ${conductor.nombre}`,
    `Teléfono: ${conductor.telefono || "No registrado"}`,
    `Empresa: ${conductor.empresa || "No registrada"}`,
    `Licencia: ${conductor.licencia_numero} (${conductor.tipo_licencia || "General"})`,
    `Vencimiento Licencia: ${conductor.licencia_vencimiento || "No especificado"}`,
    `PIN Generado: ${pinGenerado ? `🔑 ${pinGenerado}` : "No disponible"}`,
    "---------------------------------",
    "⚠️ Se requiere aprobación manual desde el Panel Administrativo para habilitar la operación del conductor."
  ].join("\n");

  try {
    await getTelegramBot().telegram.sendMessage(supervisorGroupId, message);
  } catch (error) {
    console.error("No fue posible enviar la alerta de registro de conductor al grupo de supervisores:", error);
  }
}

export async function sendDriverApprovalNotification({ telegramUserId, approved }) {
  if (!telegramUserId) return;

  const message = approved
    ? "🎉 ¡Tu registro de conductor ha sido APROBADO por la administración! Ya puedes abrir la Mini App e iniciar viajes."
    : "❌ Tu registro de conductor ha sido rechazado o inhabilitado por la administración. Contacta a tu supervisor.";

  try {
    await getTelegramBot().telegram.sendMessage(String(telegramUserId), message);
  } catch (error) {
    console.error("No fue posible enviar la notificación de aprobación al conductor:", error);
  }
}

export async function sendDriverPinNotification({
  telegramUserId,
  pin,
  conductorNombre,
  motivo = "ASIGNADO"
}) {
  if (!telegramUserId || !pin) return;

  const greeting = conductorNombre ? `Hola *${conductorNombre}*,` : "Hola,";

  let header = "🔑 *Tu PIN de acceso ha sido asignado*";
  let context = "Se ha asignado tu PIN de 4 dígitos para acceder al sistema de viajes:";
  if (motivo === "APROBACION") {
    header = "🎉 *¡Cuenta Aprobada! Tu PIN de acceso*";
    context = "Tu cuenta ha sido aprobada por la administración. Tu PIN de 4 dígitos para ingresar a la aplicación es:";
  } else if (motivo === "REGISTRO") {
    header = "📋 *Registro recibido - Tu PIN de acceso*";
    context = "Hemos recibido tu solicitud de registro. Tu PIN de 4 dígitos asignado es:";
  } else if (motivo === "ACTUALIZACION") {
    header = "🔑 *PIN de acceso actualizado*";
    context = "La administración ha actualizado tu PIN de acceso para el sistema de viajes:";
  }

  const message = [
    header,
    "",
    greeting,
    context,
    "",
    `👉  \`${pin}\`  👈`,
    "",
    "⚠️ *Importante:*",
    "• Puedes tocar el número para copiar tu PIN.",
    "• Guarda este PIN en un lugar seguro y no lo compartas con nadie.",
    "• Puedes ingresar a la aplicación introduciendo este PIN de 4 dígitos."
  ].join("\n");

  try {
    await getTelegramBot().telegram.sendMessage(String(telegramUserId), message, {
      parse_mode: "Markdown"
    });
  } catch (error) {
    console.error("No fue posible enviar el PIN al conductor por Telegram:", error.message);
  }
}

export async function sendDriverDeactivationNotification({ telegramUserId, conductorNombre, activo }) {
  if (!telegramUserId) return;

  const greeting = conductorNombre ? `Hola *${conductorNombre}*,` : "Hola,";
  const message = activo
    ? [
        "✅ *Cuenta Reactivada*",
        "",
        greeting,
        "Tu cuenta de conductor ha sido reactivada por la administración. Ya puedes ingresar al sistema de viajes con tu PIN habitual."
      ].join("\n")
    : [
        "⛔ *Acceso Restringido*",
        "",
        greeting,
        "Tu acceso al sistema de viajes ha sido temporalmente deshabilitado o restringido por la administración.",
        "",
        "Si consideras que se trata de un error o necesitas información, contacta a tu supervisor."
      ].join("\n");

  try {
    await getTelegramBot().telegram.sendMessage(String(telegramUserId), message, {
      parse_mode: "Markdown"
    });
  } catch (error) {
    console.error("No fue posible enviar la notificación de estado al conductor por Telegram:", error.message);
  }
}

export async function sendSiniestroGroupAlert({ siniestro, pdfBuffer }) {
  const groupId = process.env.TELEGRAM_GROUP_ID;
  if (!groupId) {
    console.warn("No se envió la alerta de siniestro: TELEGRAM_GROUP_ID no está configurado.");
    return;
  }

  const message = [
    `🚨 *ALERTA URGENTE: REPORTADO DE SINIESTRO* 🚨`,
    `----------------------------------------`,
    `*Folio:* ${siniestro.folio || "N/A"}`,
    `*Tipo de Siniestro:* ${siniestro.tipo_siniestro || "GENERAL"}`,
    `*Conductor:* ${siniestro.conductor_nombre || "No especificado"}`,
    `*Teléfono:* ${siniestro.conductor_telefono || "N/A"}`,
    `*Empresa / Cargo:* ${siniestro.empresa || "ITZAMNA"} - ${siniestro.puesto || "N/A"}`,
    `*Vehículo:* ${siniestro.vehiculo_nombre || "N/A"} (Eco: ${siniestro.numero_economico || "N/A"})`,
    `*Placas:* ${siniestro.placas || "N/A"}`,
    `----------------------------------------`,
    `📍 *Ubicación GPS:* Lat ${siniestro.latitud ?? "N/A"}, Lon ${siniestro.longitud ?? "N/A"}`,
    siniestro.altitud ? `⛰️ *Altitud:* ${siniestro.altitud} m.s.n.m.` : null,
    siniestro.latitud && siniestro.longitud ? `🗺️ [Abrir en Google Maps](https://www.google.com/maps?q=${siniestro.latitud},${siniestro.longitud})` : null,
    `----------------------------------------`,
    `📝 *Descripción:* ${siniestro.descripcion || "Sin descripción"}`
  ].filter(Boolean).join("\n");

  try {
    const bot = getTelegramBot();
    await bot.telegram.sendMessage(groupId, message, { parse_mode: "Markdown", disable_web_page_preview: false });

    // Enviar parrilla de fotos del siniestro si existen
    if (Array.isArray(siniestro.fotos) && siniestro.fotos.length > 0) {
      const mediaGroup = siniestro.fotos.slice(0, 6).map((photo, index) => {
        const base64Str = typeof photo === "string" ? photo : photo?.base64;
        if (base64Str && base64Str.includes(";base64,")) {
          const buf = Buffer.from(base64Str.split(",")[1], "base64");
          return {
            type: "photo",
            media: { source: buf },
            caption: index === 0 ? `🚨 Fotos Evidencia Siniestro Folio ${siniestro.folio}` : undefined
          };
        }
        return null;
      }).filter(Boolean);

      if (mediaGroup.length > 0) {
        await bot.telegram.sendMediaGroup(groupId, mediaGroup);
      }
    }

    // Enviar PDF si está disponible
    if (pdfBuffer && Buffer.isBuffer(pdfBuffer)) {
      await bot.telegram.sendDocument(groupId, {
        source: pdfBuffer,
        filename: `REPORTE_SINIESTRO_${siniestro.folio}.pdf`
      }, {
        caption: `📄 Reporte Oficial de Siniestro Folio ${siniestro.folio}`
      });
    }
  } catch (error) {
    console.error("Error al enviar alerta de siniestro al grupo principal por Telegram:", error.message);
  }
}


