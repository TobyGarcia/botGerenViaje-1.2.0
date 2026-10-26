export async function androidUpdateController(request, response) {
  response.set("Cache-Control", "no-store");
  const channel = request.query.channel || "testing";
  if (!["testing", "stable"].includes(channel)) return response.status(400).json({ message: "Canal inválido." });
  const raw = process.env[channel === "stable" ? "ANDROID_UPDATE_STABLE" : "ANDROID_UPDATE_TESTING"];
  if (!raw) return response.json({ available: false });
  try {
    const update = JSON.parse(raw);
    const url = new URL(update.downloadUrl);
    if (!Number.isSafeInteger(update.versionCode) || update.versionCode < 1 ||
        typeof update.versionName !== "string" || !/^[a-f0-9]{64}$/.test(update.sha256) ||
        url.protocol !== "https:" || url.hostname !== "github.com" ||
        !url.pathname.startsWith("/TobyGarcia/botGerenViaje-1.2.0/releases/download/") ||
        update.channel !== channel) throw new Error("Manifiesto inválido");
    return response.json({ available: true, ...update });
  } catch {
    return response.status(503).json({ message: "La actualización todavía no está disponible." });
  }
}
