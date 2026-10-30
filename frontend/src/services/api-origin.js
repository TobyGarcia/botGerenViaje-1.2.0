export function resolveApiOrigin({ configuredUrl = "", native = false, location } = {}) {
  // Un WebView remoto conserva el ambiente que está mostrando, incluso si
  // quedó una variable de compilación perteneciente a otro servidor.
  if (native && location?.protocol === "https:") return location.origin;
  const configured = String(configuredUrl).trim().replace(/\/+$/, "").replace(/\/api$/, "");
  if (configured) return configured;
  if (native || location?.protocol === "capacitor:" || location?.protocol === "file:") {
    throw new Error("La aplicación Android no tiene configurado su servidor de API.");
  }
  return "";
}
