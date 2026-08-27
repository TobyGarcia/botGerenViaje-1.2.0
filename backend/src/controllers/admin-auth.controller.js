import {
  authenticateAdminUser,
  authenticateAdminByTenantEmail
} from "../services/admin-auth.service.js";

import {
  validateTenantEmailAndWhitelist,
  getAzureOAuthLoginUrl,
  exchangeCodeForUserToken,
  getVerifiedUserProfileFromMicrosoft
} from "../services/azure-auth.service.js";

import {
  createAdminSessionToken,
  getAdminCookieName,
  getAdminCookieOptions
} from "../utils/admin-session.js";

function serializeAdminUser(user) {
  return {
    idUsuarioAdmin: user.id_usuarios_admin,
    nombre: user.nombre,
    username: user.username,
    correo: user.correo,
    telefono: user.telefono,
    contactoEmergencia: user.contacto_emergencia,
    avatarUrl: user.avatar_url,
    idConductor: user.id_conductores ? Number(user.id_conductores) : null,
    rol: user.rol,
    activo: user.activo,
    ultimoAccesoEn: user.ultimo_acceso_en
  };
}

function getAzureRedirectUri(request) {
  if (process.env.AZURE_REDIRECT_URI) {
    return process.env.AZURE_REDIRECT_URI.trim();
  }
  const protocol = request.headers["x-forwarded-proto"] || (request.secure ? "https" : "http");
  const host = request.headers["x-forwarded-host"] || request.get("host");
  // Si no hay URI fija, por defecto usa la raíz del origen (ej. https://gv.aspromex.com/)
  return `${protocol}://${host}/`;
}

function getAdminPanelUrl(request) {
  if (process.env.ADMIN_PANEL_URL) {
    return process.env.ADMIN_PANEL_URL;
  }
  const corsOrigins = (process.env.CORS_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (corsOrigins.length > 0) {
    return corsOrigins[0];
  }
  const protocol = request.headers["x-forwarded-proto"] || (request.secure ? "https" : "http");
  const host = request.headers["x-forwarded-host"] || request.get("host");
  return `${protocol}://${host}`;
}

export async function loginAdminController(request, response) {
  try {
    const username = String(request.body?.username || "").trim();
    const password = String(request.body?.password || "");

    if (!username || !password) {
      return response.status(400).json({
        success: false,
        message: "Usuario y contraseña son obligatorios."
      });
    }

    const result = await authenticateAdminUser({ username, password });

    if (!result.authenticated) {
      if (result.reason === "BLOCKED") {
        return response.status(429).json({
          success: false,
          message: "La cuenta está temporalmente bloqueada por múltiples intentos fallidos."
        });
      }

      if (result.reason === "INACTIVE") {
        return response.status(403).json({
          success: false,
          message: "La cuenta administrativa está desactivada."
        });
      }

      return response.status(401).json({
        success: false,
        message: "Usuario o contraseña incorrectos."
      });
    }

    const token = createAdminSessionToken(result.user);
    response.cookie(getAdminCookieName(), token, getAdminCookieOptions());

    return response.status(200).json({
      success: true,
      data: {
        authenticated: true,
        user: serializeAdminUser(result.user)
      }
    });
  } catch (error) {
    console.error("Error iniciando sesión administrativa:", error.message);
    return response.status(500).json({
      success: false,
      message: "No fue posible iniciar sesión."
    });
  }
}

export function logoutAdminController(request, response) {
  response.clearCookie(getAdminCookieName(), {
    ...getAdminCookieOptions(),
    maxAge: undefined
  });

  return response.status(200).json({
    success: true,
    message: "Sesión cerrada correctamente."
  });
}

export function getAdminSessionController(request, response) {
  return response.status(200).json({
    success: true,
    data: {
      authenticated: true,
      user: serializeAdminUser(request.adminUser)
    }
  });
}

/**
 * Inicia el flujo OAuth 2.0 interactivo de Microsoft Entra ID.
 * Usa la Redirect URI configurada por el administrador (ej. https://gv.aspromex.com/).
 */
export function initiateAzureOAuthLoginController(request, response) {
  try {
    const redirectUri = getAzureRedirectUri(request);
    const authUrl = getAzureOAuthLoginUrl({ redirectUri });
    return response.redirect(authUrl);
  } catch (error) {
    console.error("Error al generar la URL de login de Azure:", error.message);
    const adminUrl = getAdminPanelUrl(request);
    return response.redirect(`${adminUrl}/?error=${encodeURIComponent(error.message)}`);
  }
}

/**
 * Intercambia el código devuelto por Microsoft enviado desde el frontend o callback HTTP.
 * Aplica Doble Match (Verificación Microsoft Graph + Lista Blanca BD).
 */
export async function exchangeAzureOAuthCodeController(request, response) {
  try {
    const code = String(request.body?.code || request.query?.code || "").trim();
    const redirectUri = String(request.body?.redirectUri || getAzureRedirectUri(request)).trim();

    if (!code) {
      return response.status(400).json({
        success: false,
        message: "No se recibió el código de autorización de Microsoft."
      });
    }

    // 1. Intercambiar código por Access Token de usuario
    const userTokens = await exchangeCodeForUserToken({ code, redirectUri });

    // 2. Obtener identidad verificada desde Microsoft Graph API (/v1.0/me)
    const verifiedProfile = await getVerifiedUserProfileFromMicrosoft(userTokens.access_token);
    const verifiedEmail = verifiedProfile.email;

    console.log(`[Azure OAuth] Autenticado en Microsoft: ${verifiedEmail}`);

    // 3. Doble Match: Verificar presencia activa en la Lista Blanca
    const whitelistCheck = await validateTenantEmailAndWhitelist(verifiedEmail);
    if (!whitelistCheck.authorized) {
      return response.status(403).json({
        success: false,
        message: whitelistCheck.reason || `El correo ${verifiedEmail} autenticó en Microsoft pero no está registrado en la lista blanca de administradores.`
      });
    }

    // 4. Iniciar sesión administrativa
    const result = await authenticateAdminByTenantEmail({ email: verifiedEmail });
    if (!result.authenticated) {
      return response.status(401).json({
        success: false,
        message: "No fue posible activar la sesión administrativa."
      });
    }

    const token = createAdminSessionToken(result.user);
    response.cookie(getAdminCookieName(), token, getAdminCookieOptions());

    return response.status(200).json({
      success: true,
      data: {
        authenticated: true,
        user: serializeAdminUser(result.user)
      }
    });
  } catch (error) {
    console.error("Error al intercambiar código de Microsoft:", error.message);
    return response.status(500).json({
      success: false,
      message: error.message || "Error al autenticar con Microsoft."
    });
  }
}

/**
 * Callback HTTP directo de Microsoft Azure AD.
 */
export async function azureOAuthCallbackController(request, response) {
  const adminUrl = getAdminPanelUrl(request);
  const code = request.query.code;
  const oauthError = request.query.error || request.query.error_description;

  if (oauthError) {
    console.error("Error devuelto por Microsoft Azure AD:", oauthError);
    return response.redirect(`${adminUrl}/?error=${encodeURIComponent("Cancelaste o falló el inicio de sesión en Microsoft.")}`);
  }

  if (!code) {
    return response.redirect(`${adminUrl}/?error=${encodeURIComponent("No se recibió código de autorización de Microsoft.")}`);
  }

  try {
    const redirectUri = getAzureRedirectUri(request);
    const userTokens = await exchangeCodeForUserToken({ code, redirectUri });
    const verifiedProfile = await getVerifiedUserProfileFromMicrosoft(userTokens.access_token);
    const verifiedEmail = verifiedProfile.email;

    const whitelistCheck = await validateTenantEmailAndWhitelist(verifiedEmail);
    if (!whitelistCheck.authorized) {
      return response.redirect(
        `${adminUrl}/?error=${encodeURIComponent(
          whitelistCheck.reason || `El correo ${verifiedEmail} autenticó en Microsoft pero no está registrado en la lista blanca.`
        )}`
      );
    }

    const result = await authenticateAdminByTenantEmail({ email: verifiedEmail });
    if (!result.authenticated) {
      return response.redirect(`${adminUrl}/?error=${encodeURIComponent("No fue posible activar la sesión administrativa.")}`);
    }

    const token = createAdminSessionToken(result.user);
    response.cookie(getAdminCookieName(), token, getAdminCookieOptions());

    return response.redirect(`${adminUrl}/`);
  } catch (error) {
    console.error("Excepción en callback de Azure OAuth:", error.message);
    return response.redirect(`${adminUrl}/?error=${encodeURIComponent(error.message)}`);
  }
}

export async function loginWithTenantEmailController(request, response) {
  try {
    const email = String(request.body?.email || "").trim();

    if (!email) {
      return response.status(400).json({
        success: false,
        message: "El correo electrónico es obligatorio."
      });
    }

    const whitelistValidation = await validateTenantEmailAndWhitelist(email);
    if (!whitelistValidation.authorized) {
      return response.status(403).json({
        success: false,
        message: whitelistValidation.reason || "Correo no autorizado en el tenant o lista blanca."
      });
    }

    const result = await authenticateAdminByTenantEmail({ email });
    if (!result.authenticated) {
      return response.status(401).json({
        success: false,
        message: "No fue posible autenticar con la cuenta solicitada."
      });
    }

    const token = createAdminSessionToken(result.user);
    response.cookie(getAdminCookieName(), token, getAdminCookieOptions());

    return response.status(200).json({
      success: true,
      data: {
        authenticated: true,
        user: serializeAdminUser(result.user)
      }
    });
  } catch (error) {
    console.error("Error en login por correo tenant:", error.message);
    return response.status(500).json({
      success: false,
      message: "Error al autenticar por correo del tenant."
    });
  }
}
