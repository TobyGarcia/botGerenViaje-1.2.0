export async function installedGuideVersion({ native, platform, getNativeInfo, webVersion }) {
 if (native && platform === 'android') {
  const info = await getNativeInfo();
  if (!Number.isSafeInteger(Number(info.versionCode)) || Number(info.versionCode) <= 0) throw new Error('Versión instalada no disponible.');
  return `android:${info.channel || 'testing'}:${info.versionCode}`;
 }
 if (!webVersion) throw new Error('Versión web no disponible.');
 return `web:${webVersion}`;
}
