import crypto from "node:crypto";

const DEFAULT_MAX_AGE_SECONDS = 60 * 60;

function safeCompareHex(expectedHex, receivedHex) {
  try {
    const expected = Buffer.from(
      expectedHex,
      "hex"
    );

    const received = Buffer.from(
      receivedHex,
      "hex"
    );

    if (expected.length !== received.length) {
      return false;
    }

    return crypto.timingSafeEqual(
      expected,
      received
    );
  } catch {
    return false;
  }
}

export function validateTelegramInitData(
  initData,
  {
    botToken,
    maxAgeSeconds =
      DEFAULT_MAX_AGE_SECONDS
  } = {}
) {
  if (
    typeof initData !== "string" ||
    !initData.trim()
  ) {
    throw new Error(
      "Telegram initData no fue enviado."
    );
  }

  if (!botToken) {
    throw new Error(
      "TELEGRAM_BOT_TOKEN no está configurado."
    );
  }

  const params =
    new URLSearchParams(initData);

  const receivedHash =
    params.get("hash");

  if (!receivedHash) {
    throw new Error(
      "Telegram initData no contiene hash."
    );
  }

  params.delete("hash");

  /*
   * En la validación HMAC con token de bot se
   * excluye únicamente hash. signature se excluye
   * solo en la validación Ed25519 de terceros.
   */

  const dataCheckString =
    [...params.entries()]
      .sort(([keyA], [keyB]) =>
        keyA.localeCompare(keyB)
      )
      .map(
        ([key, value]) =>
          `${key}=${value}`
      )
      .join("\n");

  const secretKey =
    crypto
      .createHmac(
        "sha256",
        "WebAppData"
      )
      .update(botToken)
      .digest();

  const calculatedHash =
    crypto
      .createHmac(
        "sha256",
        secretKey
      )
      .update(dataCheckString)
      .digest("hex");

  if (
    !safeCompareHex(
      calculatedHash,
      receivedHash
    )
  ) {
    throw new Error(
      "La firma de Telegram no es válida."
    );
  }

  const authDateValue =
    params.get("auth_date");

  const authDate =
    Number(authDateValue);

  if (
    !Number.isInteger(authDate) ||
    authDate <= 0
  ) {
    throw new Error(
      "Telegram auth_date no es válido."
    );
  }

  const currentUnixTime =
    Math.floor(Date.now() / 1000);

  const ageSeconds =
    currentUnixTime - authDate;

  // Permitir hasta 10 minutos (600s) de tolerancia por desfase de reloj (clock skew)
  if (ageSeconds < -600) {
    throw new Error(
      "Telegram auth_date pertenece al futuro."
    );
  }

  if (
    maxAgeSeconds > 0 &&
    ageSeconds > maxAgeSeconds
  ) {
    throw new Error(
      "La sesión de Telegram ha expirado."
    );
  }

  const userJson =
    params.get("user");

  if (!userJson) {
    throw new Error(
      "Telegram initData no contiene usuario."
    );
  }

  let user;

  try {
    user = JSON.parse(userJson);
  } catch {
    throw new Error(
      "Los datos del usuario de Telegram no son válidos."
    );
  }

  if (
    user.id === null ||
    user.id === undefined
  ) {
    throw new Error(
      "El usuario de Telegram no contiene ID."
    );
  }

  return {
    authDate,
    queryId:
      params.get("query_id") || null,

    chatType:
      params.get("chat_type") || null,

    chatInstance:
      params.get("chat_instance") || null,

    user: {
      id: String(user.id),

      username:
        user.username || null,

      firstName:
        user.first_name || null,

      lastName:
        user.last_name || null,

      languageCode:
        user.language_code || null,

      isPremium:
        Boolean(user.is_premium),

      photoUrl:
        user.photo_url || null
    }
  };
}
