import type { CapacitorConfig } from "@capacitor/cli";

/**
 * El APK funciona como contenedor de la Mini App/PWA publicada. Al cargarla
 * desde su URL HTTPS, las rutas /api conservan el mismo origen que la web
 * (https://gv.aspromex.mx) y no se bloquean por CORS dentro del WebView.
 */
const config: CapacitorConfig = {
  appId: "com.aspromex.gerenciamientoviajes",
  appName: "Gerenciamiento de Viajes",
  webDir: "dist",
  server: {
    url: "https://gv.aspromex.mx/conductor/",
    cleartext: false,
    allowNavigation: ["gv.aspromex.mx"]
  },
  android: {
    allowMixedContent: false,
    backgroundColor: "#f4f8fb"
  }
};

export default config;
