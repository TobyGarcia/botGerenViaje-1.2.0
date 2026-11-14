const repository = "TobyGarcia/botGerenViaje-1.2.0";
const cache = new Map();

async function discoverUpdate(channel, application = "driver") {
  const cacheKey = `${application}:${channel}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) return cached.value;
  const signal = AbortSignal.timeout(10000);
  const response = await fetch(`https://api.github.com/repos/${repository}/releases?per_page=100`, {
    signal, headers: { Accept: "application/vnd.github+json", "User-Agent": "GV-Mobility-Updates" }
  });
  if (!response.ok) throw new Error("No fue posible consultar GitHub.");
  const releases = await response.json();
  const candidates = releases.filter((release) => !release.draft &&
    (channel === "testing" ? release.prerelease : !release.prerelease) &&
    new RegExp(`^android-${application === "supervisor" ? "supervisor-" : ""}${channel}-v[0-9]+\\.[0-9]+\\.[0-9]+-[0-9]+$`).test(release.tag_name))
    .sort((a, b) => Number(b.tag_name.split("-").at(-1)) - Number(a.tag_name.split("-").at(-1)));
  let value = null;
  if (candidates.length) {
    const release = candidates[0];
    const manifest = release.assets.find((asset) => asset.name === "update.json");
    const apk = release.assets.find((asset) => asset.name === (application === "supervisor" ? "gv-supervisor.apk" : "gv-mobility.apk"));
    const expected = `https://github.com/${repository}/releases/download/${release.tag_name}/`;
    if (!manifest || !apk || manifest.browser_download_url !== `${expected}update.json` ||
        apk.browser_download_url !== `${expected}${application === "supervisor" ? "gv-supervisor.apk" : "gv-mobility.apk"}`) throw new Error("Release incompleto.");
    const result = await fetch(manifest.browser_download_url, { signal });
    if (!result.ok) throw new Error("Manifiesto no accesible.");
    value = await result.json();
    if (value.downloadUrl !== apk.browser_download_url ||
        value.versionCode !== Number(release.tag_name.split("-").at(-1))) throw new Error("Release inconsistente.");
  }
  cache.set(cacheKey, { value, expires: Date.now() + 60000 });
  return value;
}

export async function androidUpdateController(request, response) {
  response.set("Cache-Control", "no-store");
  const channel = request.query.channel || "testing";
  if (!["testing", "stable"].includes(channel)) return response.status(400).json({ message: "Canal inválido." });
  const application = request.query.application || "driver";
  if (!["driver", "supervisor"].includes(application) || (application === "supervisor" && channel !== (process.env.APPROVER_ENVIRONMENT || "testing"))) return response.status(400).json({ message: "Aplicación o canal inválido." });
  const raw = application === "supervisor" ? process.env[channel === "stable" ? "ANDROID_SUPERVISOR_UPDATE_STABLE" : "ANDROID_SUPERVISOR_UPDATE_TESTING"] : process.env[channel === "stable" ? "ANDROID_UPDATE_STABLE" : "ANDROID_UPDATE_TESTING"];
  try {
    const update = raw ? JSON.parse(raw) : process.env.ANDROID_UPDATE_DISCOVERY === channel ? await discoverUpdate(channel, application) : null;
    if (!update) return response.json({ available: false });
    const url = new URL(update.downloadUrl);
    if (!Number.isSafeInteger(update.versionCode) || update.versionCode < 1 ||
        typeof update.versionName !== "string" || !/^[a-f0-9]{64}$/.test(update.sha256) ||
        url.protocol !== "https:" || url.hostname !== "github.com" ||
        !url.pathname.startsWith("/TobyGarcia/botGerenViaje-1.2.0/releases/download/") ||
        update.channel !== channel) throw new Error("Manifiesto inválido");
    if (application === "supervisor" && (update.appId !== (channel === "stable" ? "com.aspromex.gvmobility.supervisor" : "com.aspromex.gvmobility.supervisor.testing") ||
        !new RegExp('^/TobyGarcia/botGerenViaje-1\\.2\\.0/releases/download/android-supervisor-'+channel+'-v[0-9]+\\.[0-9]+\\.[0-9]+-[0-9]+/gv-supervisor\\.apk$').test(url.pathname))) throw new Error("APK de aprobadores inválida");
    return response.json({ ...update, available: true });
  } catch {
    return response.status(503).json({ message: "La actualización todavía no está disponible." });
  }
}
