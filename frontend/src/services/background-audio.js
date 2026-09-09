/**
 * Servicio de Audio Sintetizado en Hardware para PWA Móvil (25Hz Subsónico)
 * Genera una onda senoidal de 25Hz mediante Web Audio API con amplitud infinitesimal (0.001)
 * sin archivos de audio ni etiquetas externas.
 * Mantiene activo el hilo de JavaScript y la sesión multimedia en dispositivos móviles
 * para evitar que Android Doze Mode / iOS WebKit Process Suspension duerman el GPS.
 */

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
      // Ignorar rechazo de wake lock
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
      // Ignorar error al liberar
    }
    wakeLockSentinel = null;
  }
}

/**
 * Configura la sesión multimedia (MediaSession API) en navegadores móviles compatibles.
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
        if (isAudioActive && audioCtx && audioCtx.state === "suspended") {
          audioCtx.resume().catch(() => {});
          navigator.mediaSession.playbackState = "playing";
        }
      });
      navigator.mediaSession.setActionHandler("pause", () => {
        // Al pausar desde notificación, si el viaje sigue activo, reactivar
        if (isAudioActive && audioCtx && audioCtx.state === "suspended") {
          audioCtx.resume().catch(() => {});
          navigator.mediaSession.playbackState = "playing";
        }
      });
    } catch (e) {
      console.debug("[BackgroundAudio] Error configurando MediaSession:", e);
    }
  }
}

/**
 * Inicia el sintetizador de hardware de 25Hz y el soporte de segundo plano.
 * Solo se ejecuta en dispositivos móviles.
 */
export async function startSilentAudioKeepAlive() {
  // Estrictamente solo para dispositivos móviles / PWA móvil
  if (!isMobileDevice()) {
    return false;
  }

  isAudioActive = true;

  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return false;

    if (!audioCtx || audioCtx.state === "closed") {
      audioCtx = new AudioContextClass();
    }

    if (audioCtx.state === "suspended") {
      await audioCtx.resume();
    }

    if (!audioOscillator) {
      audioOscillator = audioCtx.createOscillator();
      audioGain = audioCtx.createGain();

      // Onda senoidal a 25Hz (frecuencia subsónica inaudible para el oído humano)
      audioOscillator.type = "sine";
      audioOscillator.frequency.setValueAtTime(25, audioCtx.currentTime);

      // Ganancia prácticamente nula (amplitud infinitesimal 0.001) para 0 consumo de batería
      audioGain.gain.setValueAtTime(0.001, audioCtx.currentTime);

      // Conectar oscilador -> ganancia -> salida de audio de hardware
      audioOscillator.connect(audioGain);
      audioGain.connect(audioCtx.destination);
      audioOscillator.start();
    }

    setupMediaSession();
    await acquireWakeLock();

    return true;
  } catch (error) {
    console.warn("[BackgroundAudio] No se pudo iniciar el sintetizador Web Audio 25Hz:", error);
    return false;
  }
}

/**
 * Detiene y libera completamente el sintetizador Web Audio y el estado de segundo plano.
 */
export function stopSilentAudioKeepAlive() {
  isAudioActive = false;

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
  } catch (e) {
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
 * Retorna true si el sintetizador de fondo está actualmente activo.
 */
export function isSilentAudioActive() {
  return isAudioActive && audioCtx !== null && audioCtx.state === "running";
}

// Escuchar cambios de visibilidad para reanudar el audio si el SO intentó suspenderlo
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && isAudioActive) {
      if (audioCtx && audioCtx.state === "suspended") {
        audioCtx.resume().catch(() => {});
      }
      acquireWakeLock();
    }
  });
}
