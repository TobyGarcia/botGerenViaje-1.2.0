// Utilidad de almacenamiento resiliente para WebViews móviles y Telegram MiniApp.
// Evita excepciones de tipo SecurityError / DOMException cuando el navegador
// tiene deshabilitado el acceso a almacenamiento local de terceros o navegación privada estricta.

const memoryStorage = new Map();

function isStorageAvailable() {
  try {
    const testKey = "__storage_test__";
    window.localStorage.setItem(testKey, testKey);
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

const canUseLocalStorage = typeof window !== "undefined" && isStorageAvailable();

export const safeStorage = {
  getItem(key) {
    try {
      if (canUseLocalStorage) {
        return window.localStorage.getItem(key);
      }
    } catch {
      // Fallback a memoria
    }
    return memoryStorage.get(key) ?? null;
  },

  setItem(key, value) {
    const stringValue = String(value);
    try {
      if (canUseLocalStorage) {
        window.localStorage.setItem(key, stringValue);
        return;
      }
    } catch {
      // Fallback a memoria
    }
    memoryStorage.set(key, stringValue);
  },

  removeItem(key) {
    try {
      if (canUseLocalStorage) {
        window.localStorage.removeItem(key);
      }
    } catch {
      // Fallback a memoria
    }
    memoryStorage.delete(key);
  },

  clear() {
    try {
      if (canUseLocalStorage) {
        window.localStorage.clear();
      }
    } catch {
      // Ignorar fallo
    }
    memoryStorage.clear();
  },

  getJSON(key, fallback = null) {
    try {
      const raw = this.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  },

  setJSON(key, value) {
    try {
      this.setItem(key, JSON.stringify(value));
    } catch (err) {
      console.warn(`Error al guardar JSON en safeStorage para la clave ${key}:`, err);
    }
  }
};

export default safeStorage;
