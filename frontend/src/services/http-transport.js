import { Capacitor, CapacitorHttp } from "@capacitor/core";

// Capacitor omite su parche fetch para el mismo hostname que sirve los assets.
// Invocar el plugin directamente evita que /api termine en el servidor local.
export async function apiFetch(url, options = {}, transport = {}) {
  const native = transport.native ?? Capacitor.isNativePlatform();
  if (!native) return (transport.fetch ?? globalThis.fetch)(url, options);
  const target = new URL(url);
  if (target.protocol !== "https:") throw new Error("La API requiere HTTPS.");
  options.signal?.throwIfAborted();
  let data = options.body;
  const headers = Object.fromEntries(new Headers(options.headers || {}).entries());
  if (typeof data === "string" && headers["content-type"]?.includes("application/json")) data = JSON.parse(data);
  const http = transport.http ?? CapacitorHttp;
  let response;
  try {
    response = await http.request({ url: target.href, method: options.method || "GET", headers,
      ...(data === undefined ? {} : { data }), responseType: "json", connectTimeout: 15000, readTimeout: options.timeout || 25000 });
  } catch (cause) {
    const timeout = /timeout|timed out/i.test(cause?.message || "");
    const error = new Error(timeout ? "Tiempo de espera agotado al conectar con el servidor." : "No fue posible conectar con el servidor.");
    error.code = timeout ? "NETWORK_TIMEOUT" : "NETWORK_ERROR";
    throw error;
  }
  options.signal?.throwIfAborted();
  const body = response.status === 204 ? null : typeof response.data === "string" ? response.data : JSON.stringify(response.data ?? null);
  return new Response(body, { status: response.status, headers: response.headers });
}

export async function readApiJson(response) {
  const text = await response.text();
  try {
    const data = JSON.parse(text);
    if (data === null || typeof data !== "object") throw new Error();
    return data;
  } catch {
    const error = new Error("El servidor no devolvió una respuesta válida. Vuelve a intentar el acceso.");
    error.code = "INVALID_API_RESPONSE"; error.status = response.status;
    throw error;
  }
}
