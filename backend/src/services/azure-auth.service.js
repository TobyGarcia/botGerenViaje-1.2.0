import { databasePool } from "../database/pool.js";

let cachedToken = null;
let tokenExpiresAt = 0;

/**
 * Obtiene un Access Token de Azure AD (Microsoft Entra ID) mediante el flujo client_credentials.
 */
export async function getAzureAccessToken() {
  const tenantId = process.env.AZURE_TENANT_ID;
  const clientId = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error(
      "Credenciales de Azure AD incompletas. Asegúrate de configurar AZURE_TENANT_ID, AZURE_CLIENT_ID y AZURE_CLIENT_SECRET en .env"
    );
  }

  // Reutilizar token si aún es válido (con margen de 60 segundos)
  if (cachedToken && Date.now() < tokenExpiresAt - 60000) {
    return cachedToken;
  }

  const tokenUrl = `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`;

  const params = new URLSearchParams();
  params.append("grant_type", "client_credentials");
  params.append("client_id", clientId);
  params.append("client_secret", clientSecret);
  params.append("scope", "https://graph.microsoft.com/.default");

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: params.toString()
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error autenticando con Azure AD (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + (data.expires_in || 3600) * 1000;

  return cachedToken;
}

/**
 * Valida si un correo pertenece al dominio configurado del tenant (si está especificado en .env).
 */
export function validateTenantDomain(email) {
  if (!email || typeof email !== "string") {
    return { valid: false, reason: "Correo no proporcionado" };
  }

  const normalizedEmail = email.trim().toLowerCase();
  const configuredDomain = (process.env.AZURE_TENANT_DOMAIN || "").trim().toLowerCase();

  if (configuredDomain) {
    const emailDomain = normalizedEmail.split("@")[1];
    if (emailDomain !== configuredDomain) {
      return {
        valid: false,
        reason: `El correo debe pertenecer al dominio de la organización (@${configuredDomain}).`
      };
    }
  }

  return { valid: true, email: normalizedEmail };
}

/**
 * Revisa si un correo existe en la Lista Blanca (tabla usuarios_admin) y está activo.
 */
export async function findUserInWhitelist(email) {
  if (!email) return null;
  const normalizedEmail = String(email).trim().toLowerCase();

  const result = await databasePool.query(
    `SELECT id_usuarios_admin, nombre, username, correo, rol, activo, telefono, contacto_emergencia, avatar_url, id_conductores, ultimo_acceso_en
     FROM usuarios_admin
     WHERE LOWER(correo) = $1 LIMIT 1`,
    [normalizedEmail]
  );

  return result.rows[0] ?? null;
}

/**
 * Valida un correo contra el dominio del Tenant y contra la Lista Blanca de la BD.
 */
export async function validateTenantEmailAndWhitelist(email) {
  const domainCheck = validateTenantDomain(email);
  if (!domainCheck.valid) {
    return { authorized: false, reason: domainCheck.reason };
  }

  const whitelistUser = await findUserInWhitelist(domainCheck.email);
  if (!whitelistUser) {
    return {
      authorized: false,
      reason: "El correo no está registrado en la lista blanca de usuarios autorizados."
    };
  }

  if (!whitelistUser.activo) {
    return {
      authorized: false,
      reason: "La cuenta asociada a este correo está desactivada."
    };
  }

  return {
    authorized: true,
    user: whitelistUser
  };
}
