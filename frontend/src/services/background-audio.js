/**
 * Servicio Híbrido de Mantenimiento de Segundo Plano para PWA Móvil
 * Combina un elemento de audio HTML5 (<audio loop>), un sintetizador Web Audio a 25Hz,
 * MediaSession API y WakeLock para máxima resistencia en dispositivos con capas agresivas
 * de gestión de batería (Xiaomi MIUI/HyperOS, Samsung, Huawei).
 */

let audioElement = null;
let audioBlobUrl = null;
let audioCtx = null;
let audioOscillator = null;
let audioGain = null;
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

    writeString(0, "RIFF");
    view.setUint32(4, 36 + dataSize, true);
    writeString(8, "WAVE");
    writeString(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate, true);
    view.setUint16(32, 1, true);
    view.setUint16(34, 8, true);
    writeString(36, "data");
    view.setUint32(40, dataSize, true);

    new Uint8Array(buffer, 44).fill(128);

    const blob = new Blob([buffer], { type: "audio/wav" });
    audioBlobUrl = URL.createObjectURL(blob);
    return audioBlobUrl;
  } catch (error) {
    console.warn("[BackgroundAudio] Fallback a Data URI para audio silencioso:", error);
    return "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";
  }
}

/**
 * Solicita Wake Lock de pantalla si está disponible.
 */
async function acquireWakeLock() {
  if (typeof navigator !== "undefined" && "wakeLock" in navigator && !wakeLockSentinel) {
    try {
      wakeLockSentinel = await navigator.wakeLock.request("screen");
      wakeLockSentinel.addEventListener("release", () => {
        wakeLockSentinel = null;
      });
    } catch {
      // Ignorar rechazo de wake lock
    }
  }
}

/**
 * Libera el Wake Lock.
 */
function releaseWakeLock() {
  if (wakeLockSentinel) {
    try {
      wakeLockSentinel.release().catch(() => {});
    } catch {
      // Ignorar error al liberar
    }
    wakeLockSentinel = null;
  }
}

/**
 * Configura la sesión multimedia (MediaSession API) en la barra de Android.
 */
function setupMediaSession() {
  if (typeof navigator !== "undefined" && "mediaSession" in navigator && window.MediaMetadata) {
    try {
      navigator.mediaSession.metadata = new window.MediaMetadata({
        title: "Viaje en Curso",
        artist: "Gerenciamiento de Viajes",
        album: "Rastreo GPS Activo (Segundo Plano)"
      });
      navigator.mediaSession.playbackState = "playing";

      navigator.mediaSession.setActionHandler("play", () => {
        if (isAudioActive) {
          if (audioElement && audioElement.paused) audioElement.play().catch(() => {});
          if (audioCtx && audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
          navigator.mediaSession.playbackState = "playing";
        }
      });
      navigator.mediaSession.setActionHandler("pause", () => {
        if (isAudioActive) {
          if (audioElement && audioElement.paused) audioElement.play().catch(() => {});
          if (audioCtx && audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
          navigator.mediaSession.playbackState = "playing";
        }
      });
    } catch (e) {
      console.debug("[BackgroundAudio] Error configurando MediaSession:", e);
    }
  }
}

/**
 * Inicia la reproducción híbrida: HTML5 Audio + Web Audio 25Hz.
 */
export async function startSilentAudioKeepAlive() {
  if (!isMobileDevice()) {
    return false;
  }

  isAudioActive = true;

  // 1. Iniciar HTML5 Audio Element (Requerido por Xiaomi/MIUI para notificaciones de medios)
  try {
    if (!audioElement) {
      const src = getOrCreateSilentAudioUrl();
      audioElement = new Audio(src);
      audioElement.loop = true;
      audioElement.preload = "auto";
      audioElement.volume = 0.05;

      audioElement.addEventListener("ended", () => {
        if (isAudioActive && audioElement) {
          audioElement.play().catch(() => {});
        }
      });
    }
    await audioElement.play();
  } catch (errHtml) {
    console.warn("[BackgroundAudio] HTML5 Audio warning:", errHtml);
  }

  // 2. Iniciar Web Audio API (Oscilador subsónico 25Hz)
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      if (!audioCtx || audioCtx.state === "closed") {
        audioCtx = new AudioContextClass();
      }
      if (audioCtx.state === "suspended") {
        await audioCtx.resume();
      }
      if (!audioOscillator) {
        audioOscillator = audioCtx.createOscillator();
        audioGain = audioCtx.createGain();
        audioOscillator.type = "sine";
        audioOscillator.frequency.setValueAtTime(25, audioCtx.currentTime);
        audioGain.gain.setValueAtTime(0.001, audioCtx.currentTime);
        audioOscillator.connect(audioGain);
        audioGain.connect(audioCtx.destination);
        audioOscillator.start();
      }
    }
  } catch (errWeb) {
    console.warn("[BackgroundAudio] Web Audio warning:", errWeb);
  }

  setupMediaSession();
  await acquireWakeLock();

  return true;
}

/**
 * Detiene y libera completamente todos los recursos de audio.
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

  try {
    if (audioOscillator) {
      audioOscillator.stop();
      audioOscillator.disconnect();
      audioOscillator = null;
    }
    if (audioGain) {
      audioGain.disconnect();
      audioGain = null;
    }
    if (audioCtx && audioCtx.state !== "closed") {
      audioCtx.close().catch(() => {});
      audioCtx = null;
    }
  } catch {
    // Ignorar errores de cierre
  }

  if (typeof navigator !== "undefined" && "mediaSession" in navigator) {
    try {
      navigator.mediaSession.playbackState = "none";
    } catch {
      // Ignorar error al limpiar estado
    }
  }

  releaseWakeLock();
}

/**
 * Retorna true si el mantenimiento de segundo plano está activo.
 */
export function isSilentAudioActive() {
  return isAudioActive;
}

// Escuchar cambios de visibilidad para reanudar si el SO intenta pausar
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && isAudioActive) {
      if (audioElement && audioElement.paused) {
        audioElement.play().catch(() => {});
      }
      if (audioCtx && audioCtx.state === "suspended") {
        audioCtx.resume().catch(() => {});
      }
      acquireWakeLock();
    }
  });
}
