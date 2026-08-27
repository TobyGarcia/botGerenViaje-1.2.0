import { getAzureAccessToken } from "./azure-auth.service.js";

/**
 * Parsea el destino de SharePoint a partir de una URL completa (SHAREPOINT_URL)
 * o de las variables SHAREPOINT_SITE_ID y SHAREPOINT_FOLDER_PATH.
 */
const DEFAULT_SHAREPOINT_URL =
  "https://itzamnaoilandgas.sharepoint.com/sites/TecnologasdelaInformacin/Documentos%20compartidos/Forms/AllItems.aspx?id=%2Fsites%2FTecnologasdelaInformacin%2FDocumentos%20compartidos%2FDiagramas%20y%20Planos%2Ftest%5F1%5FGV";

export function parseSharePointTarget() {
  const fullUrl = (process.env.SHAREPOINT_URL || DEFAULT_SHAREPOINT_URL).trim();

  if (fullUrl) {
    try {
      const urlObj = new URL(fullUrl);
      const hostname = urlObj.hostname;

      // El parámetro query 'id' contiene la ruta directa de la carpeta en la UI de SharePoint
      let rawPath = urlObj.searchParams.get("id") || urlObj.pathname;
      let path = decodeURIComponent(rawPath);

      const siteMatch = path.match(/^(\/sites\/[^/]+)/i);
      if (siteMatch) {
        const siteRelativePath = siteMatch[1]; // ej. /sites/TecnologasdelaInformacin
        const siteIdentifier = `${hostname}:${siteRelativePath}`;

        let rest = path.slice(siteRelativePath.length);
        // Remover el nombre de la biblioteca de documentos estándar
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

    const cleanFilename = String(filename || `inspeccion_${Date.now()}.pdf`).replace(/[/\\?%*:|"<>]/g, "-");
    
    // Construir la URL del endpoint de Microsoft Graph API para la subida directa del PDF
    const folderSegment = folderPath ? `${folderPath.split("/").map(encodeURIComponent).join("/")}/` : "";
    const uploadUrl = `https://graph.microsoft.com/v1.0/sites/${siteIdentifier}:/drive/root:/${folderSegment}${encodeURIComponent(cleanFilename)}:/content`;

    console.log(`[SharePoint] Subiendo "${cleanFilename}" a sitio "${siteIdentifier}" en carpeta "${folderPath}"...`);

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
