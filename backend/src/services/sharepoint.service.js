import { getAzureAccessToken } from "./azure-auth.service.js";

const DEFAULT_SHAREPOINT_URL =
  "https://itzamnaoilandgas.sharepoint.com/sites/GerenciamientoViajes/Documentos%20compartidos/Forms/AllItems.aspx";

/**
 * Calcula el número de semana ISO para una fecha.
 */
export function getIsoWeekNumber(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
}

/**
 * Genera la estructura de subcarpetas Año/Mes/Semana a partir de una fecha.
 * Ej: inspecciones/2026/08-Agosto/Semana-35
 */
export function getSharePointFolderPath({ baseFolder = "inspecciones", date = new Date() } = {}) {
  const targetDate = date ? new Date(date) : new Date();
  const validDate = isNaN(targetDate.getTime()) ? new Date() : targetDate;

  const year = validDate.getFullYear();
  const monthNames = [
    "01-Enero", "02-Febrero", "03-Marzo", "04-Abril",
    "05-Mayo", "06-Junio", "07-Julio", "08-Agosto",
    "09-Septiembre", "10-Octubre", "11-Noviembre", "12-Diciembre"
  ];
  const monthFolder = monthNames[validDate.getMonth()];
  const weekNum = getIsoWeekNumber(validDate);
  const weekFolder = `Semana-${String(weekNum).padStart(2, "0")}`;

  const cleanBase = (baseFolder || "inspecciones").replace(/^\/+|\/+$/g, "");
  return `${cleanBase}/${year}/${monthFolder}/${weekFolder}`;
}

/**
 * Parsea el destino de SharePoint a partir de una URL completa (SHAREPOINT_URL)
 * o de las variables SHAREPOINT_SITE_ID y SHAREPOINT_FOLDER_PATH.
 */
export function parseSharePointTarget() {
  const fullUrl = (process.env.SHAREPOINT_URL || DEFAULT_SHAREPOINT_URL).trim();

  if (fullUrl) {
    try {
      const urlObj = new URL(fullUrl);
      const hostname = urlObj.hostname;

      let rawPath = urlObj.searchParams.get("id") || urlObj.pathname;
      let path = decodeURIComponent(rawPath);

      const siteMatch = path.match(/^(\/sites\/[^/]+)/i);
      if (siteMatch) {
        const siteRelativePath = siteMatch[1]; // ej. /sites/GerenciamientoViajes
        const siteIdentifier = `${hostname}:${siteRelativePath}`;

        let rest = path.slice(siteRelativePath.length);
        rest = rest.replace(/^\/(Documentos%20compartidos|Documentos compartidos|Shared Documents)\/?/i, "");
        rest = rest.replace(/^Forms(\/.*)?$/i, "").replace(/\/Forms(\/.*)?$/i, "");
        rest = rest.replace(/^\/+|\/+$/g, "");

        if (rest.toLowerCase().includes(".aspx") || rest.toLowerCase().startsWith("sitepages")) {
          rest = "";
        }

        const configuredFolder = (process.env.SHAREPOINT_FOLDER_PATH || "").replace(/^\/+|\/+$/g, "");

        return {
          siteIdentifier,
          folderPath: rest || configuredFolder || "inspecciones"
        };
      }
    } catch (error) {
      console.warn("[SharePoint] No se pudo analizar SHAREPOINT_URL, se usarán los valores por defecto:", error.message);
    }
  }

  const siteId = (process.env.SHAREPOINT_SITE_ID || "root").trim();
  const folderPath = (process.env.SHAREPOINT_FOLDER_PATH || "inspecciones").replace(/^\/+|\/+$/g, "");

  return { siteIdentifier: siteId, folderPath };
}

/**
 * Resuelve el Site ID único de Microsoft Graph API para un sitio de SharePoint.
 */
async function resolveSharePointSiteId(siteIdentifier, accessToken) {
  const customSiteId = (process.env.SHAREPOINT_SITE_ID || "").trim();
  if (customSiteId && customSiteId !== "root") {
    return customSiteId;
  }

  if (!siteIdentifier || siteIdentifier === "root") {
    return "root";
  }

  // 1. Intentar resolver el sitio por ruta codificada
  try {
    const parts = siteIdentifier.split(":");
    const hostname = parts[0];
    const sitePath = parts[1] || "";
    const encodedSitePath = sitePath.split("/").map(encodeURIComponent).join("/");
    const siteUrl = `https://graph.microsoft.com/v1.0/sites/${hostname}:${encodedSitePath}`;

    console.log(`[SharePoint] Consultando Site ID en Graph API: ${siteUrl}`);
    const res = await fetch(siteUrl, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (res.ok) {
      const siteData = await res.json();
      if (siteData?.id) {
        console.log(`[SharePoint] Site ID obtenido de Microsoft Graph: ${siteData.id}`);
        return siteData.id;
      }
    } else {
      const errText = await res.text();
      console.warn(`[SharePoint] No se resolvió sitio por ruta (HTTP ${res.status}): ${errText}`);
    }
  } catch (err) {
    console.warn("[SharePoint] Excepción consultando sitio por ruta:", err.message);
  }

  // 2. Búsqueda de respaldo en Microsoft Graph API
  try {
    const sitePath = siteIdentifier.includes(":") ? siteIdentifier.split(":")[1] : siteIdentifier;
    const siteName = sitePath.split("/").filter(Boolean).pop() || "GerenciamientoViajes";
    const searchUrl = `https://graph.microsoft.com/v1.0/sites?search=${encodeURIComponent(siteName)}`;
    const searchRes = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (searchRes.ok) {
      const searchData = await searchRes.json();
      if (Array.isArray(searchData.value) && searchData.value.length > 0) {
        const found = searchData.value.find(s => s.webUrl?.toLowerCase().includes(siteName.toLowerCase())) || searchData.value[0];
        console.log(`[SharePoint] Sitio encontrado por búsqueda Graph: ${found.id} (${found.webUrl})`);
        return found.id;
      }
    }
  } catch (err) {
    // Ignorar excepción de búsqueda
  }

  // Si no se pudo resolver a un GUID site ID, asegurar formato hostname:/sites/path: con dos puntos al final
  if (siteIdentifier.includes(":") && !siteIdentifier.endsWith(":")) {
    return `${siteIdentifier}:`;
  }

  return siteIdentifier;
}

/**
 * Sube un archivo PDF a cualquier carpeta base de SharePoint mediante Microsoft Graph API,
 * organizándolo en subcarpetas por Año / Mes / Semana.
 */
export async function uploadPdfToSharePoint({ filename, pdfBuffer, folio, date, baseFolder = "Inspecciones" }) {
  const tenantId = process.env.AZURE_TENANT_ID;
  const clientId = process.env.AZURE_CLIENT_ID_S || process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET_S || process.env.AZURE_CLIENT_SECRET;

  if (!tenantId || !clientId || !clientSecret) {
    console.warn(
      "[SharePoint] Omitiendo subida a SharePoint: Credenciales de Azure AD no configuradas en .env."
    );
    return {
      success: false,
      reason: "NOT_CONFIGURED",
      message: "Credenciales de Azure AD no configuradas."
    };
  }

  try {
    const accessToken = await getAzureAccessToken({ clientId, clientSecret });
    const { siteIdentifier } = parseSharePointTarget();

    // Generar ruta de subcarpetas (baseFolder/Año/MM-Mes/Semana-WW)
    const fullFolderPath = getSharePointFolderPath({ baseFolder, date });

    // Resolver el Site ID único mediante Microsoft Graph API
    const targetSiteId = await resolveSharePointSiteId(siteIdentifier, accessToken);

    // Nombre del archivo: priorizar folio.pdf si se proporciona
    let rawFilename = filename;
    if (folio) {
      const cleanFolio = String(folio).trim();
      rawFilename = cleanFolio.toLowerCase().endsWith(".pdf") ? cleanFolio : `${cleanFolio}.pdf`;
    }
    const cleanFilename = String(rawFilename || `documento_${Date.now()}.pdf`).replace(/[/\\?%*:|"<>]/g, "-");
    const encodedFilename = encodeURIComponent(cleanFilename);

    const folderSegment = fullFolderPath ? `${fullFolderPath.split("/").map(encodeURIComponent).join("/")}/` : "";
    const uploadUrl = `https://graph.microsoft.com/v1.0/sites/${targetSiteId}/drive/root:/${folderSegment}${encodedFilename}:/content`;

    console.log(`[SharePoint] Subiendo "${cleanFilename}" al sitio "${targetSiteId}" en carpeta "${fullFolderPath}"...`);

    const response = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/pdf"
      },
      body: pdfBuffer
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[SharePoint] Error al subir archivo (${response.status}):`, errorText);
      return {
        success: false,
        statusCode: response.status,
        message: `Error al subir a SharePoint (${response.status}): ${errorText}`
      };
    }

    const data = await response.json();
    console.log(`[SharePoint] Archivo subido con éxito: ${data.webUrl}`);

    return {
      success: true,
      webUrl: data.webUrl || null,
      itemId: data.id || null,
      name: data.name || cleanFilename
    };
  } catch (error) {
    console.error("[SharePoint] Excepción durante la subida a SharePoint:", error.message);
    return {
      success: false,
      message: error.message
    };
  }
}

/**
 * Sube un PDF de Inspección Vehicular a la carpeta "Inspecciones".
 */
export async function uploadInspectionPdfToSharePoint({ filename, pdfBuffer, folio, date }) {
  const baseFolder = process.env.SHAREPOINT_FOLDER_INSPECCIONES || process.env.SHAREPOINT_FOLDER_PATH || "Inspecciones";
  return uploadPdfToSharePoint({ filename, pdfBuffer, folio, date, baseFolder });
}

/**
 * Sube un PDF de Gerenciamiento de Viaje a la carpeta "Gerenciamientos".
 */
export async function uploadGerenciamientoPdfToSharePoint({ filename, pdfBuffer, folio, date }) {
  const baseFolder = process.env.SHAREPOINT_FOLDER_GERENCIAMIENTOS || "Gerenciamientos";
  return uploadPdfToSharePoint({ filename, pdfBuffer, folio, date, baseFolder });
}

/**
 * Sube una imagen de evidencia a SharePoint en la carpeta "Evidencias".
 */
export async function uploadEvidenceImageToSharePoint({ filename, buffer, imageBuffer, mimeType = "image/png", date, baseFolder = "Evidencias" } = {}) {
  const targetBuffer = buffer || imageBuffer;
  if (!targetBuffer) {
    return { success: false, message: "No se proporcionó buffer de imagen." };
  }
  const tenantId = process.env.AZURE_TENANT_ID;
  const clientId = process.env.AZURE_CLIENT_ID_S || process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET_S || process.env.AZURE_CLIENT_SECRET;

  if (!tenantId || !clientId || !clientSecret) {
    return { success: false, reason: "NOT_CONFIGURED" };
  }

  try {
    const accessToken = await getAzureAccessToken({ clientId, clientSecret });
    const { siteIdentifier } = parseSharePointTarget();

    const fullFolderPath = getSharePointFolderPath({ baseFolder, date });
    const targetSiteId = await resolveSharePointSiteId(siteIdentifier, accessToken);

    const cleanFilename = String(filename || `evidencia_${Date.now()}.png`).replace(/[/\\?%*:|"<>]/g, "-");
    const encodedFilename = encodeURIComponent(cleanFilename);

    const folderSegment = fullFolderPath ? `${fullFolderPath.split("/").map(encodeURIComponent).join("/")}/` : "";
    const uploadUrl = `https://graph.microsoft.com/v1.0/sites/${targetSiteId}/drive/root:/${folderSegment}${encodedFilename}:/content`;

    const response = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": mimeType
      },
      body: targetBuffer
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, statusCode: response.status, message: errorText };
    }

    const data = await response.json();
    return {
      success: true,
      webUrl: data.webUrl || null,
      itemId: data.id || null,
      name: data.name || cleanFilename
    };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

/**
 * Sube una fotografía o documento de licencia de conducir a SharePoint en la carpeta "Licencias"
 * con el nombre del conductor.
 */
export async function uploadDriverLicenseToSharePoint({ driverName, fileBuffer, mimeType = "image/jpeg", side = "frente", extension = "jpg" }) {
  if (!fileBuffer) {
    return { success: false, message: "No se proporcionó el buffer del archivo de la licencia." };
  }
  const tenantId = process.env.AZURE_TENANT_ID;
  const clientId = process.env.AZURE_CLIENT_ID_S || process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET_S || process.env.AZURE_CLIENT_SECRET;

  if (!tenantId || !clientId || !clientSecret) {
    return { success: false, reason: "NOT_CONFIGURED", message: "Credenciales de Azure AD no configuradas." };
  }

  try {
    const accessToken = await getAzureAccessToken({ clientId, clientSecret });
    const { siteIdentifier } = parseSharePointTarget();
    const targetSiteId = await resolveSharePointSiteId(siteIdentifier, accessToken);

    const baseFolder = (process.env.SHAREPOINT_FOLDER_LICENCIAS || "Licencias").replace(/^\/+|\/+$/g, "");
    const safeDriverName = String(driverName || "conductor")
      .trim()
      .replace(/[\s]+/g, "_")
      .replace(/[/\\?%*:|"<>]/g, "");

    const cleanFilename = `${safeDriverName}_licencia_${side}.${extension}`.replace(/[/\\?%*:|"<>]/g, "-");
    const encodedFilename = encodeURIComponent(cleanFilename);

    const uploadUrl = `https://graph.microsoft.com/v1.0/sites/${targetSiteId}/drive/root:/${encodeURIComponent(baseFolder)}/${encodedFilename}:/content`;

    console.log(`[SharePoint] Subiendo licencia de "${driverName}" (${side}) a carpeta "${baseFolder}": ${cleanFilename}...`);

    const response = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": mimeType
      },
      body: fileBuffer
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`[SharePoint] Fallo al subir licencia (${response.status}):`, errorText);
      return { success: false, statusCode: response.status, message: errorText };
    }

    const data = await response.json();
    console.log(`[SharePoint] Licencia subida con éxito: ${data.webUrl}`);
    return {
      success: true,
      webUrl: data.webUrl || null,
      itemId: data.id || null,
      name: data.name || cleanFilename
    };
  } catch (error) {
    console.error("[SharePoint] Error al subir licencia:", error.message);
    return { success: false, message: error.message };
  }
}

