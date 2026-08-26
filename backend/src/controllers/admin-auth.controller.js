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
    return process.env.AZURE_REDIRECT_URI;
  }
  const protocol = request.headers["x-forwarded-proto"] || request.protocol || "http";
  const host = request.headers["x-forwarded-host"] || request.get("host");
  return `${protocol}://${host}/api/admin/auth/azure/callback`;
}

function getAdminPanelUrl(request) {
  if (process.env.ADMIN_PANEL_URL) {
    return process.env.ADMIN_PANEL_URL;
  }
  const corsOrigins = (process.env.CORS_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (corsOrigins.length > 0) {
    return corsOrigins[0];
  }
  return "http://localhost:5173";
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
 * Redirige la ventana del usuario directamente a login.microsoftonline.com
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
 * Callback de Microsoft Azure AD después del login interactivo.
 * Intercambia el código, obtiene el correo verificado en Microsoft y comprueba la Lista Blanca.
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

    // 1. Intercambiar código por tokens de usuario
    const userTokens = await exchangeCodeForUserToken({ code, redirectUri });

    // 2. Obtener identidad autenticada y verificada directamente desde Microsoft Graph API
    const verifiedProfile = await getVerifiedUserProfileFromMicrosoft(userTokens.access_token);
    const verifiedEmail = verifiedProfile.email;

    console.log(`[Azure OAuth] Usuario autenticado exitosamente en Microsoft: ${verifiedEmail}`);

    // 3. Verificar Doble Match: Comprobar dominio de Tenant y presencia activa en la Lista Blanca
    const whitelistCheck = await validateTenantEmailAndWhitelist(verifiedEmail);
    if (!whitelistCheck.authorized) {
      console.warn(`[Azure OAuth] Acceso denegado: ${verifiedEmail} autenticó en Microsoft pero no está en la Lista Blanca BD.`);
      return response.redirect(
        `${adminUrl}/?error=${encodeURIComponent(
          whitelistCheck.reason || `El correo ${verifiedEmail} autenticó en Microsoft pero no está registrado en la lista blanca de administradores.`
        )}`
      );
    }

    // 4. Iniciar sesión administrativa en el sistema
    const result = await authenticateAdminByTenantEmail({ email: verifiedEmail });
    if (!result.authenticated) {
      return response.redirect(`${adminUrl}/?error=${encodeURIComponent("No fue posible activar la sesión administrativa.")}`);
    }

    const token = createAdminSessionToken(result.user);
    response.cookie(getAdminCookieName(), token, getAdminCookieOptions());

    // 5. Redirigir de regreso al panel administrativo con sesión activa
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
