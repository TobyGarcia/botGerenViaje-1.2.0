/**
 * Servicio Híbrido de Mantenimiento de Segundo Plano para PWA y Navegadores Móviles.
 * Combina:
 * 1. Elemento HTML5 <audio loop> con ruido blanco de amplitud mínima (inaudible pero detectado por el SO como audio activo).
 * 2. Sintetizador Web Audio API con oscilador a 25Hz.
 * 3. MediaSession API (Notificación de reproducción persistente en Android).
 * 4. Screen Wake Lock API.
 * 5. Desbloqueo automático por cualquier gesto táctil/clic del usuario.
 */

let audioElement = null;
let audioBlobUrl = null;
let audioCtx = null;
let audioOscillator = null;
let audioGain = null;
let wakeLockSentinel = null;
let isAudioActive = false;
let gestureListenersAttached = false;

function setupGestureUnlock() {
  if (gestureListenersAttached || typeof window === "undefined") return;
  gestureListenersAttached = true;

  const unlockHandler = () => {
    if (isAudioActive) {
      if (audioElement && audioElement.paused) {
        audioElement.play().catch(() => {});
      }
      if (audioCtx && audioCtx.state === "suspended") {
        audioCtx.resume().catch(() => {});
      }
      acquireWakeLock();
    }
  };

  window.addEventListener("click", unlockHandler, { capture: true, passive: true });
  window.addEventListener("touchstart", unlockHandler, { capture: true, passive: true });
  window.addEventListener("pointerdown", unlockHandler, { capture: true, passive: true });
}

export function isMobileDevice() {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }
  const ua = navigator.userAgent || "";
  const isMobileUa = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const isTouchDevice =
    (navigator.maxTouchPoints > 0 || "ontouchstart" in window);

  return Boolean(isMobileUa || isTouchDevice);
}

/**
 * Genera un Blob de audio WAV con ruido blanco de amplitud mínima (inaudible).
 * PCM 8-bit mono a 8kHz, 2 segundos.
 * La variación de 1-bit evita que los controladores de audio de Android/iOS identifiquen el canal como silencio digital y apaguen el procesador de audio.
 */
function getOrCreateWhiteNoiseAudioUrl() {
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
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, 1, true); // Mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate, true);
    view.setUint16(32, 1, true);
    view.setUint16(34, 8, true);
    writeString(36, "data");
    view.setUint32(40, dataSize, true);

    const dataView8 = new Uint8Array(buffer, 44);
    for (let i = 0; i < dataSize; i++) {
      // Ruido blanco inaudible con variación leve de 1 bit (127/129)
      dataView8[i] = 128 + (Math.random() > 0.5 ? 1 : -1);
    }

    const blob = new Blob([buffer], { type: "audio/wav" });
    audioBlobUrl = URL.createObjectURL(blob);
    return audioBlobUrl;
  } catch (error) {
    console.warn("[BackgroundAudio] Fallback a Data URI para ruido blanco:", error);
    return "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";
  }
}

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

function releaseWakeLock() {
  if (wakeLockSentinel) {
    try {
      wakeLockSentinel.release().catch(() => {});
    } catch {
      // Ignorar error
    }
    wakeLockSentinel = null;
  }
}

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

export async function startSilentAudioKeepAlive() {
  isAudioActive = true;
  setupGestureUnlock();

  // 1. Iniciar HTML5 Audio Element (ruido blanco audible a bajo volumen para Xiaomi HyperOS/MIUI)
  try {
    if (!audioElement) {
      const src = getOrCreateWhiteNoiseAudioUrl();
      audioElement = new Audio(src);
      audioElement.loop = true;
      audioElement.preload = "auto";
      audioElement.volume = 0.15; // 15% de volumen para forzar al SO Xiaomi a mantener activa la sesión de audio

      audioElement.addEventListener("ended", () => {
        if (isAudioActive && audioElement) {
          audioElement.play().catch(() => {});
        }
      });
    }
    await audioElement.play();
  } catch (errHtml) {
    console.warn("[BackgroundAudio] HTML5 Audio intentará reproducirse al primer toque:", errHtml?.message);
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
        audioGain.gain.setValueAtTime(0.015, audioCtx.currentTime);
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

export function stopSilentAudioKeepAlive() {
  isAudioActive = false;

  if (audioElement) {
    try {
      audioElement.pause();
      audioElement.currentTime = 0;
    } catch {
      // Ignorar error
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
    // Ignorar
  }

  if (typeof navigator !== "undefined" && "mediaSession" in navigator) {
    try {
      navigator.mediaSession.playbackState = "none";
    } catch {
      // Ignorar
    }
  }

  releaseWakeLock();
}

export function isSilentAudioActive() {
  return isAudioActive;
}

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

