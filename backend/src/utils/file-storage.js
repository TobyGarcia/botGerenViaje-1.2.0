import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import crypto from "node:crypto";

/**
 * Guarda un archivo enviado en base64 en la carpeta uploads/licencias
 * @param {string} base64Data Data URL en formato base64 o contenido base64 puro
 * @param {string} originalName Nombre original del archivo (opcional)
 * @returns {string} URL relativa accesible desde express (/uploads/licencias/...)
 */
export function saveLicenseFileBase64(base64Data, originalName = "", prefix = "licencia") {
  if (!base64Data || typeof base64Data !== "string") {
    return null;
  }

  let extension = "png";
  let base64Body = base64Data;

  const mimeMatch = base64Data.match(/^data:([^;]+);base64,/);
  if (mimeMatch) {
    const mimeType = mimeMatch[1].toLowerCase();
    if (mimeType.includes("jpeg") || mimeType.includes("jpg")) {
      extension = "jpg";
    } else if (mimeType.includes("png")) {
      extension = "png";
    } else if (mimeType.includes("webp")) {
      extension = "webp";
    } else if (mimeType.includes("pdf")) {
      extension = "pdf";
    }
    base64Body = base64Data.replace(/^data:[^;]+;base64,/, "");
  } else if (originalName && originalName.includes(".")) {
    const ext = originalName.split(".").pop().toLowerCase();
    if (["jpg", "jpeg", "png", "webp", "pdf"].includes(ext)) {
      extension = ext === "jpeg" ? "jpg" : ext;
    }
  }

  const buffer = Buffer.from(base64Body, "base64");
  if (buffer.length === 0) {
    return null;
  }

  const uploadDir = resolve(process.cwd(), "uploads", "licencias");
  mkdirSync(uploadDir, { recursive: true });

  const randomHash = crypto.randomBytes(6).toString("hex");
  const fileName = `${prefix}_${Date.now()}_${randomHash}.${extension}`;
  const filePath = join(uploadDir, fileName);

  writeFileSync(filePath, buffer);

  return `/uploads/licencias/${fileName}`;
}

