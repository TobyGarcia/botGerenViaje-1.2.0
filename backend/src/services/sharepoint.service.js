import { getAzureAccessToken } from "./azure-auth.service.js";

const DEFAULT_SHAREPOINT_URL =
  "https://itzamnaoilandgas.sharepoint.com/sites/TecnologasdelaInformacin/Documentos%20compartidos/Forms/AllItems.aspx?id=%2Fsites%2FTecnologasdelaInformacin%2FDocumentos%20compartidos%2FDiagramas%20y%20Planos%2Ftest%5F1%5FGV";

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
        const siteRelativePath = siteMatch[1]; // ej. /sites/TecnologasdelaInformacin
        const siteIdentifier = `${hostname}:${siteRelativePath}`;

        let rest = path.slice(siteRelativePath.length);
        rest = rest.replace(/^\/(Documentos%20compartidos|Documentos compartidos|Shared Documents)\/?/i, "");
        rest = rest.replace(/^\/+|\/+$/g, "");

        return {
          siteIdentifier,
          folderPath: rest || "Inspecciones"
        };
      }
    } catch (error) {
      console.warn("[SharePoint] No se pudo analizar SHAREPOINT_URL, se usarán los valores por defecto:", error.message);
    }
  }

  const siteId = (process.env.SHAREPOINT_SITE_ID || "root").trim();
  const folderPath = (process.env.SHAREPOINT_FOLDER_PATH || "Inspecciones").replace(/^\/+|\/+$/g, "");

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
    const searchUrl = `https://graph.microsoft.com/v1.0/sites?search=Tecnolog`;
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
 * Sube un archivo PDF a la carpeta de SharePoint mediante Microsoft Graph API.
 * Utiliza autenticación de aplicación (client_credentials) con Azure AD.
 */
export async function uploadInspectionPdfToSharePoint({ filename, pdfBuffer }) {
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
    const { siteIdentifier, folderPath } = parseSharePointTarget();

    // Resolver el Site ID único mediante Microsoft Graph API
    const targetSiteId = await resolveSharePointSiteId(siteIdentifier, accessToken);

    const cleanFilename = String(filename || `inspeccion_${Date.now()}.pdf`).replace(/[/\\?%*:|"<>]/g, "-");
    const encodedFilename = encodeURIComponent(cleanFilename);

    let uploadUrl = "";
    if (targetSiteId.includes(":")) {
      // Si se usa sintaxis de identificador compuesto
      const folderSegment = folderPath ? `${folderPath.split("/").map(encodeURIComponent).join("/")}/` : "";
      uploadUrl = `https://graph.microsoft.com/v1.0/sites/${targetSiteId}:/drive/root:/${folderSegment}${encodedFilename}:/content`;
    } else {
      // Si se usa el GUID o ID directo de sitio en Graph API
      if (folderPath) {
        const folderSegment = folderPath.split("/").map(encodeURIComponent).join("/");
        uploadUrl = `https://graph.microsoft.com/v1.0/sites/${targetSiteId}/drive/root:/${folderSegment}/${encodedFilename}:/content`;
      } else {
        uploadUrl = `https://graph.microsoft.com/v1.0/sites/${targetSiteId}/drive/root:/${encodedFilename}:/content`;
      }
    }

    console.log(`[SharePoint] Subiendo "${cleanFilename}" al sitio "${targetSiteId}" en carpeta "${folderPath}"...`);

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
