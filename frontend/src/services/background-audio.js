/**
 * Servicio de Audio en Bucle Silencioso para PWA Móvil
 * Mantiene activo el proceso de JavaScript y la sesión multimedia en dispositivos móviles
 * (Android / iOS) evitando que el sistema operativo congele el rastreo GPS al bloquear la pantalla o minimizar.
 */

let audioElement = null;
let audioBlobUrl = null;
let wakeLockSentinel = null;
let isAudioActive = false;

/**
 * Detecta si el entorno actual es un navegador o PWA móvil.
 */
export function isMobileDevice() {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }
  const ua = navigator.userAgent || "";
  const isMobileUa = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const isTouchDevice =
    (navigator.maxTouchPoints > 1 || "ontouchstart" in window) &&
    window.innerWidth <= 1024;

  return Boolean(isMobileUa || isTouchDevice);
}

/**
 * Genera un Blob de audio WAV de silencio puro (PCM 8-bit mono a 8kHz, 2 segundos).
 * Se genera 100% en memoria para operar de forma offline sin descargas de red.
 */
function getOrCreateSilentAudioUrl() {
  if (audioBlobUrl) return audioBlobUrl;

  try {
    const sampleRate = 8000;
    const durationSeconds = 2;
    const numSamples = sampleRate * durationSeconds;
    const dataSize = numSamples;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    function writeString(offset, string) {
      for (let i = 0; i < string.length; i += 1) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    }

    // Encabezado RIFF WAV
    writeString(0, "RIFF");
    view.setUint32(4, 36 + dataSize, true);
    writeString(8, "WAVE");
    writeString(12, "fmt ");
    view.setUint32(16, 16, true); // Tamaño de subchunk fmt
    view.setUint16(20, 1, true);  // AudioFormat = PCM
    view.setUint16(22, 1, true);  // 1 canal mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate, true); // ByteRate = 8000
    view.setUint16(32, 1, true);  // BlockAlign
    view.setUint16(34, 8, true);  // BitsPerSample
    writeString(36, "data");
    view.setUint32(40, dataSize, true);

    // Rellenar con 128 (silencio absoluto para PCM de 8 bits sin signo)
    new Uint8Array(buffer, 44).fill(128);

    const blob = new Blob([buffer], { type: "audio/wav" });
    audioBlobUrl = URL.createObjectURL(blob);
    return audioBlobUrl;
  } catch (error) {
    console.warn("[BackgroundAudio] No fue posible crear Blob WAV de silencio:", error);
    // Fallback: Data URI de audio de 1 segundo de silencio
    return "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";
  }
}

/**
 * Solicita Wake Lock de pantalla si está disponible en el navegador.
 */
async function acquireWakeLock() {
  if (typeof navigator !== "undefined" && "wakeLock" in navigator && !wakeLockSentinel) {
    try {
      wakeLockSentinel = await navigator.wakeLock.request("screen");
      wakeLockSentinel.addEventListener("release", () => {
        wakeLockSentinel = null;
      });
    } catch {
      // Si el usuario cambia de app o se bloquea, el wake lock se libera normalmente
    }
  }
}

/**
 * Libera el Wake Lock de pantalla.
 */
function releaseWakeLock() {
  if (wakeLockSentinel) {
    try {
      wakeLockSentinel.release().catch(() => {});
    } catch {
      // Ignorar fallos de liberación
    }
    wakeLockSentinel = null;
  }
}

/**
 * Configura la sesión multimedia (MediaSession API) en navegadores móviles compatibles.
 * Esto le indica al sistema operativo que hay un proceso multimedia activo en segundo plano.
 */
function setupMediaSession() {
  if (typeof navigator !== "undefined" && "mediaSession" in navigator && window.MediaMetadata) {
    try {
      navigator.mediaSession.metadata = new window.MediaMetadata({
        title: "Viaje en Curso",
        artist: "Gerenciamiento de Viajes",
        album: "Rastreo GPS en segundo plano"
      });
      navigator.mediaSession.playbackState = "playing";

      // Manejadores para asegurar que no se detenga por toques accidentales en la barra
      navigator.mediaSession.setActionHandler("play", () => {
        if (isAudioActive && audioElement) {
          audioElement.play().catch(() => {});
          navigator.mediaSession.playbackState = "playing";
        }
      });
      navigator.mediaSession.setActionHandler("pause", () => {
        // Al pausar desde notificación, si el viaje sigue activo, reintentar reproducción
        if (isAudioActive && audioElement) {
          audioElement.play().catch(() => {});
          navigator.mediaSession.playbackState = "playing";
        }
      });
    } catch (e) {
      console.debug("[BackgroundAudio] Error configurando MediaSession:", e);
    }
  }
}

/**
 * Inicia el bucle de audio silencioso y el soporte de segundo plano.
 * Solo se ejecuta en dispositivos móviles.
 */
export async function startSilentAudioKeepAlive() {
  // Estrictamente solo para dispositivos móviles / PWA móvil
  if (!isMobileDevice()) {
    return false;
  }

  isAudioActive = true;

  try {
    if (!audioElement) {
      const src = getOrCreateSilentAudioUrl();
      audioElement = new Audio(src);
      audioElement.loop = true;
      audioElement.preload = "auto";
      // Volumen bajo pero no silenciado con muted=true (para que el motor multimedia del SO no lo descarte)
      audioElement.volume = 0.05;

      // Garantizar reanudación en bucle
      audioElement.addEventListener("ended", () => {
        if (isAudioActive) {
          audioElement.play().catch(() => {});
        }
      });
    }

    // Iniciar reproducción
    const playPromise = audioElement.play();
    if (playPromise !== undefined) {
      await playPromise;
    }

    // Configurar metadatos en la barra del sistema operativo
    setupMediaSession();

    // Intentar solicitar Wake Lock mientras la pantalla esté encendida
    await acquireWakeLock();

    return true;
  } catch (error) {
    console.warn("[BackgroundAudio] No se pudo iniciar el audio silencioso:", error.message);
    return false;
  }
}

/**
 * Detiene y limpia completamente el audio silencioso y el estado en segundo plano.
 */
export function stopSilentAudioKeepAlive() {
  isAudioActive = false;

  if (audioElement) {
    try {
      audioElement.pause();
      audioElement.currentTime = 0;
    } catch {
      // Ignorar error al pausar
    }
  }

  if (typeof navigator !== "undefined" && "mediaSession" in navigator) {
    try {
      navigator.mediaSession.playbackState = "none";
    } catch {
      // Ignorar error al resetear estado de media
    }
  }

  releaseWakeLock();
}

/**
 * Retorna true si el audio silencioso está actualmente activo.
 */
export function isSilentAudioActive() {
  return isAudioActive;
}

// Escuchar cambios de visibilidad para reanudar el audio si el SO intentó suspenderlo
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && isAudioActive) {
      if (audioElement && audioElement.paused) {
        audioElement.play().catch(() => {});
      }
      acquireWakeLock();
    }
  });
}
