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
  if (customSiteId) {
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
    const searchUrl = `https://graph.microsoft.com/v1.0/sites?search=Gerenciamiento`;
    const searchRes = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (searchRes.ok) {
      const searchData = await searchRes.json();
      if (Array.isArray(searchData.value) && searchData.value.length > 0) {
        const found = searchData.value[0];
        console.log(`[SharePoint] Sitio encontrado por búsqueda Graph: ${found.id} (${found.webUrl})`);
        return found.id;
      }
    }
  } catch (err) {
    // Ignorar excepción de búsqueda
  }

  return siteIdentifier;
}

/**
 * Sube un archivo PDF a la carpeta de SharePoint mediante Microsoft Graph API,
 * organizándolo en subcarpetas por Año / Mes / Semana.
 * Utiliza autenticación de aplicación (client_credentials) con Azure AD.
 */
export async function uploadInspectionPdfToSharePoint({ filename, pdfBuffer, folio, date }) {
  const tenantId = process.env.AZURE_TENANT_ID;
  const clientId = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;

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
    const accessToken = await getAzureAccessToken();
    const { siteIdentifier, folderPath: baseFolderPath } = parseSharePointTarget();

    // Generar ruta de subcarpetas (inspecciones/Año/MM-Mes/Semana-WW)
    const fullFolderPath = getSharePointFolderPath({ baseFolder: baseFolderPath, date });

    // Resolver el Site ID único mediante Microsoft Graph API
    const targetSiteId = await resolveSharePointSiteId(siteIdentifier, accessToken);

    // Nombre del archivo: priorizar folio.pdf si se proporciona
    let rawFilename = filename;
    if (folio) {
      const cleanFolio = String(folio).trim();
      rawFilename = cleanFolio.toLowerCase().endsWith(".pdf") ? cleanFolio : `${cleanFolio}.pdf`;
    }
    const cleanFilename = String(rawFilename || `inspeccion_${Date.now()}.pdf`).replace(/[/\\?%*:|"<>]/g, "-");
    const encodedFilename = encodeURIComponent(cleanFilename);

    let uploadUrl = "";
    if (targetSiteId.includes(":")) {
      // Si se usa sintaxis de identificador compuesto
      const folderSegment = fullFolderPath ? `${fullFolderPath.split("/").map(encodeURIComponent).join("/")}/` : "";
      uploadUrl = `https://graph.microsoft.com/v1.0/sites/${targetSiteId}:/drive/root:/${folderSegment}${encodedFilename}:/content`;
    } else {
      // Si se usa el GUID o ID directo de sitio en Graph API
      if (fullFolderPath) {
        const folderSegment = fullFolderPath.split("/").map(encodeURIComponent).join("/");
        uploadUrl = `https://graph.microsoft.com/v1.0/sites/${targetSiteId}/drive/root:/${folderSegment}/${encodedFilename}:/content`;
      } else {
        uploadUrl = `https://graph.microsoft.com/v1.0/sites/${targetSiteId}/drive/root:/${encodedFilename}:/content`;
      }
    }

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

