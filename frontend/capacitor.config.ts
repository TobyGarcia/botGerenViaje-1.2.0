import type { CapacitorConfig } from "@capacitor/cli";

/**
 * El APK funciona como contenedor de la Mini App/PWA publicada. Al cargarla
 * desde su URL HTTPS, las rutas /api conservan el mismo origen que la web
 * (https://gv.aspromex.mx) y no se bloquean por CORS dentro del WebView.
 */
const webUrl = process.env.ANDROID_WEB_URL || "https://gvmobility.aspromex.mx/conductor/";
const bundled = process.env.ANDROID_BUNDLED === "true";
const config: CapacitorConfig = {
  appId: "com.aspromex.gerenciamientoviajes",
  appName: "GVMobility",
  webDir: "dist",
  server: {
    ...(bundled ? { hostname: new URL(webUrl).hostname, androidScheme: "https" } : { url: webUrl }),
    cleartext: false,
    allowNavigation: [new URL(webUrl).hostname]
  },
  android: {
    allowMixedContent: false,
    backgroundColor: "#f4f8fb"
  },
  plugins: { CapacitorHttp: { enabled: bundled } }
};

export default config;
