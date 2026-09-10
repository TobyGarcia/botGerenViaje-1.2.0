function normalizeLocation(location) {
  const latitud = Number(location.latitude);
  const longitud = Number(location.longitude);

  if (
    !Number.isFinite(latitud) ||
    !Number.isFinite(longitud) ||
    (latitud === 0 && longitud === 0)
  ) {
    throw new Error("La ubicación recibida no contiene coordenadas válidas.");
  }

  return {
    latitud,
    longitud,
    precisionMetros: location.accuracy ?? null,
    velocidad: location.speed ?? null,
    direccion: location.heading ?? null,
    fechaGps: new Date(location.timestamp ?? Date.now()).toISOString()
  };
}

function getBrowserLocation() {
  if (!navigator.geolocation) return Promise.reject(new Error("Este dispositivo no admite geolocalización."));
  return new Promise((resolve, reject) => {
    // Intento 1: Alta precisión con timeout de 12 segundos
    navigator.geolocation.getCurrentPosition(
      (position) => resolve(normalizeLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        speed: position.coords.speed,
        heading: position.coords.heading,
        timestamp: position.timestamp
      })),
      (error) => {
        // Fallback para Xiaomi/MIUI y ahorro de energía: Intentar con precisión estándar (red/celular)
        navigator.geolocation.getCurrentPosition(
          (posFallback) => resolve(normalizeLocation({
            latitude: posFallback.coords.latitude,
            longitude: posFallback.coords.longitude,
            accuracy: posFallback.coords.accuracy,
            speed: posFallback.coords.speed,
            heading: posFallback.coords.heading,
            timestamp: posFallback.timestamp
          })),
          (errFallback) => reject(new Error(({
            1: "El permiso de ubicación fue rechazado.",
            2: "Ubicación no disponible (revisar configuración de ahorro de batería en Xiaomi).",
            3: "Se agotó el tiempo para obtener la señal GPS."
          })[errFallback.code || error.code] || "No fue posible obtener la ubicación.")),
          { enableHighAccuracy: false, timeout: 15000, maximumAge: 30000 }
        );
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 10000 }
    );
  });
}

async function getTelegramLocation() {
  const manager = window.Telegram?.WebApp?.LocationManager;
  if (!manager) throw new Error("Telegram LocationManager no está disponible.");
  if (!manager.isInited && typeof manager.init === "function") {
    await new Promise((resolve, reject) => {
      const timeoutId = window.setTimeout(
        () => reject(new Error("Telegram LocationManager no respondió.")),
        5000
      );
      manager.init(() => {
        window.clearTimeout(timeoutId);
        resolve();
      });
    });
  }
  if (manager.isLocationAvailable === false) throw new Error("Telegram LocationManager no está disponible.");
  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(
      () => reject(new Error("Telegram no respondió con una ubicación.")),
      10000
    );
    manager.getLocation((location) => {
      window.clearTimeout(timeoutId);
      if (location) {
        resolve(normalizeLocation({ latitude: location.latitude, longitude: location.longitude, accuracy: location.horizontal_accuracy, timestamp: Date.now() }));
      } else {
        reject(new Error("Telegram no proporcionó una ubicación."));
      }
    });
  });
}

export async function getCurrentLocation() {
  const isTelegramMiniApp = Boolean(window.Telegram?.WebApp?.initData);
  if (!isTelegramMiniApp) return getBrowserLocation();
  try { return await getTelegramLocation(); }
  catch { return getBrowserLocation(); }
}
