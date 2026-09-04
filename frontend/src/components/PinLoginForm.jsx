import React, { useState } from "react";
import { loginConductorConPin } from "../services/api";
import aquarioBlanco from "../assets/AQUARIO_BLANCO.png";
import PwaInstallPrompt from "./PwaInstallPrompt";

export default function PinLoginForm({ onSuccess, onCancel, onRegisterClick }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
        // Almacenar token de sesión de la app
        localStorage.setItem("driver_token", result.data.token);
        if (onSuccess) {
          onSuccess(result.data.conductor);
        }
      } else {
        setError(result.message || "PIN incorrecto. Verifica e intenta nuevamente.");
        setPin("");
      }
    } catch (err) {
      const isNetworkError = !navigator.onLine || err.message?.includes("Failed to fetch") || err.message?.includes("fetch");
      if (isNetworkError) {
        const cachedDriverRaw = localStorage.getItem("cached_driver");
        if (cachedDriverRaw) {
          try {
            const cachedDriver = JSON.parse(cachedDriverRaw);
            if (onSuccess) {
              onSuccess(cachedDriver);
              return;
            }
          } catch {
            // Ignorar error de JSON parse
          }
        }
        setError("Sin conexión a internet. Para entrar sin red, debes haber iniciado sesión al menos una vez con internet en este celular.");
      } else {
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
        {/* Header con Logo Blanco y Título */}
        <div className="pin-header">
          <img src={aquarioBlanco} alt="AQUARIO" className="pin-aquario-logo" />
          <h2 className="pin-title">Ingreso por PIN</h2>
          <p className="pin-subtitle">
            Ingresa tu PIN de 4 dígitos para acceder al sistema
          </p>
        </div>

        {/* Mensaje de Error compacto */}
        {error && (
          <div className="pin-error-banner" role="alert">
            <span>⚠️ {error}</span>
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
            <span className="key-delete-icon">⌫</span>
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
            style={{
              marginTop: "16px",
              background: "none",
              border: "none",
              color: "#0284c7",
              fontSize: "0.85rem",
              fontWeight: 600,
              cursor: "pointer",
              textDecoration: "underline",
              display: "block",
              width: "100%",
              textAlign: "center"
            }}
          >
            📝 ¿Eres un conductor nuevo? Regístrate aquí
          </button>
        )}
      </div>
      <PwaInstallPrompt />
    </div>
  );
}

