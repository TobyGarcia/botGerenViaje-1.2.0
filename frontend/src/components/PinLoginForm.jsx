import React, { useState } from "react";
import { loginConductorConPin } from "../services/api";
import PwaInstallPrompt from "./PwaInstallPrompt";
import safeStorage from "../utils/safeStorage";
import { IconAlert, IconFileText, IconBackspace } from "./Icons.jsx";

export default function PinLoginForm({ onSuccess, onCancel, onRegisterClick }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function digestPin(value) {
    try {
      if (window.crypto?.subtle) {
        const bytes = new TextEncoder().encode(`gerenciamiento-viajes:${value}`);
        const digest = await window.crypto.subtle.digest("SHA-256", bytes);
        return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
      }
    } catch {
      // Continuar a fallback
    }
    let hash = 0;
    const str = `geren_pin_${value}`;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return `fb_${Math.abs(hash)}`;
  }

  const handleKeyPress = (digit) => {
    if (loading) return;
    if (pin.length < 4) {
      const nextPin = pin + digit;
      setPin(nextPin);
      setError("");
      if (nextPin.length === 4) {
        executeLogin(nextPin);
      }
    }
  };

  const handleDelete = () => {
    if (loading) return;
    setPin(prev => prev.slice(0, -1));
    setError("");
  };

  const handleClear = () => {
    if (loading) return;
    setPin("");
    setError("");
  };

  const executeLogin = async (pinToVerify) => {
    if (!pinToVerify || pinToVerify.length !== 4) {
      setError("Ingresa los 4 dígitos de tu PIN de acceso.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      const result = await loginConductorConPin(pinToVerify);

      if (result.success && result.data?.token) {
        // Almacenar token y perfil de conductor
        safeStorage.setItem("driver_token", result.data.token);
        if (result.data.conductor) {
          safeStorage.setJSON("cached_driver", result.data.conductor);
        }
        const pinDigest = await digestPin(pinToVerify);
        if (pinDigest) safeStorage.setItem("offline_driver_pin_digest", pinDigest);
        if (onSuccess) {
          onSuccess(result.data.conductor);
        }
      } else {
        setError(result.message || "PIN incorrecto. Verifica e intenta nuevamente.");
        setPin("");
      }
    } catch (err) {
      const isNetworkError = !navigator.onLine ||
        err.code === "NETWORK_ERROR" ||
        err.code === "NETWORK_TIMEOUT" ||
        err.message?.includes("Failed to fetch") ||
        err.message?.includes("fetch");
      if (isNetworkError) {
        const cachedDriver = safeStorage.getJSON("cached_driver", null);
        const savedPinDigest = safeStorage.getItem("offline_driver_pin_digest");
        const enteredPinDigest = await digestPin(pinToVerify);
        if (cachedDriver && savedPinDigest && enteredPinDigest === savedPinDigest) {
          if (cachedDriver.activo === false) {
            setError("Tu acceso ha sido restringido o deshabilitado por la administración. Contacta a tu supervisor.");
            setPin("");
            return;
          }
          if (onSuccess) {
            onSuccess(cachedDriver);
            return;
          }
        }
        setError("Sin conexión a internet. Para entrar sin red, debes haber iniciado sesión al menos una vez con internet en este celular.");
      } else {
        if (err.code === "CONDUCTOR_INACTIVE") {
          safeStorage.removeItem("cached_driver");
          safeStorage.removeItem("driver_token");
        }
        setError(err.message || "Error al iniciar sesión.");
      }
      setPin("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pin-login-wrapper">
      <div className="pin-login-card glass-panel">
        {/* Header con Titulo de Acceso por PIN */}
        <div className="pin-header">
          <h2 className="pin-title">Ingreso por PIN</h2>
          <p className="pin-subtitle">
            Ingresa tu PIN de 4 dígitos para acceder al sistema
          </p>
        </div>

        {/* Mensaje de Error compacto */}
        {error && (
          <div className="pin-error-banner" role="alert">
            <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}><IconAlert size={16} color="#ef4444" /> {error}</span>
          </div>
        )}

        {/* Indicadores de los 4 dígitos (Glow Circles) */}
        <div className="pin-indicators">
          {[0, 1, 2, 3].map(index => {
            const isFilled = pin.length > index;
            return (
              <div
                key={index}
                className={`pin-dot ${isFilled ? "filled" : ""} ${loading ? "verifying" : ""}`}
              />
            );
          })}
        </div>

        {/* Teclado Numérico Glassmorphism */}
        <div className="pin-keypad-grid">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map(num => (
            <button
              key={num}
              type="button"
              onClick={() => handleKeyPress(num)}
              className="glass-key"
              disabled={loading || pin.length >= 4}
            >
              <span className="key-number">{num}</span>
            </button>
          ))}

          {/* Botón Acción Izquierda (Limpiar o Cancelar) */}
          {onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              className="glass-key glass-key-aux"
              disabled={loading}
            >
              <span className="key-aux-text">Cancelar</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleClear}
              className="glass-key glass-key-aux"
              disabled={loading || pin.length === 0}
              title="Borrar PIN"
            >
              <span className="key-aux-text">Limpiar</span>
            </button>
          )}

          {/* Tecla Cero */}
          <button
            type="button"
            onClick={() => handleKeyPress("0")}
            className="glass-key"
            disabled={loading || pin.length >= 4}
          >
            <span className="key-number">0</span>
          </button>

          {/* Tecla Borrar Dígito */}
          <button
            type="button"
            onClick={handleDelete}
            className="glass-key glass-key-delete"
            disabled={loading || pin.length === 0}
            title="Borrar último dígito"
          >
            <span className="key-delete-icon">
              <IconBackspace size={20} color="#dc2626" />
            </span>
          </button>
        </div>

        {/* Botón de Ingreso o Estado de Verificación */}
        <button
          type="button"
          disabled={pin.length !== 4 || loading}
          onClick={() => executeLogin(pin)}
          className={`pin-submit-btn ${pin.length === 4 ? "ready" : ""} ${loading ? "loading" : ""}`}
        >
          {loading ? "Verificando PIN..." : "Ingresar"}
        </button>

        {onRegisterClick && (
          <button
            type="button"
            onClick={onRegisterClick}
            className="pin-register-card-btn"
          >
            <IconFileText size={18} color="#0284c7" />
            <span>¿Eres un conductor nuevo? Regístrate aquí</span>
          </button>
        )}
      </div>
      <PwaInstallPrompt />
    </div>
  );
}
