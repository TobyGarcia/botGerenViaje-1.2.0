import React, { useState, useEffect, useRef } from "react";
import { getConductores, loginConductorConPin } from "../services/api";
import aquarioBlanco from "../assets/AQUARIO_BLANCO.png";

export default function PinLoginForm({ onSuccess, onCancel }) {
  const [conductores, setConductores] = useState([]);
  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingConductores, setLoadingConductores] = useState(true);

  // Cargar lista de conductores
  useEffect(() => {
    async function loadConductores() {
      try {
        setLoadingConductores(true);
        const data = await getConductores();
        const activeDrivers = (data?.data || []).filter(c => c.activo !== false);
        setConductores(activeDrivers);
        if (activeDrivers.length > 0) {
          setSelectedDriverId(String(activeDrivers[0].id_conductores));
        }
      } catch (err) {
        setError("No fue posible cargar la lista de conductores.");
      } finally {
        setLoadingConductores(false);
      }
    }
    loadConductores();
  }, []);

  const handleKeyPress = (digit) => {
    if (loading) return;
    if (pin.length < 4) {
      const nextPin = pin + digit;
      setPin(nextPin);
      setError("");
      if (nextPin.length === 4) {
        executeLogin(selectedDriverId, nextPin);
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

  const executeLogin = async (driverId, pinToVerify) => {
    if (!driverId) {
      setError("Selecciona tu nombre de conductor.");
      return;
    }

    if (pinToVerify.length !== 4) {
      setError("Ingresa los 4 dígitos de tu PIN de acceso.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      const result = await loginConductorConPin(Number(driverId), pinToVerify);

      if (result.success && result.data?.token) {
        localStorage.setItem("driver_token", result.data.token);
        if (onSuccess) {
          onSuccess(result.data.conductor);
        }
      } else {
        setError(result.message || "Credenciales incorrectas.");
        setPin("");
      }
    } catch (err) {
      setError(err.message || "Error al iniciar sesión.");
      setPin("");
    } finally {
      setLoading(false);
    }
  };

  const handleDriverChange = (e) => {
    setSelectedDriverId(e.target.value);
    setPin("");
    setError("");
  };

  return (
    <div className="pin-login-wrapper">
      <div className="pin-login-card glass-panel">
        {/* Header con Logo Blanco y Título */}
        <div className="pin-header">
          <img src={aquarioBlanco} alt="AQUARIO" className="pin-aquario-logo" />
          <h2 className="pin-title">Ingreso por PIN</h2>
          <p className="pin-subtitle">
            Selecciona tu nombre e ingresa tu PIN de 4 dígitos
          </p>
        </div>

        {/* Mensaje de Error compacto */}
        {error && (
          <div className="pin-error-banner" role="alert">
            <span>⚠️ {error}</span>
          </div>
        )}

        {/* Selector de Conductor con estilo frosted glass */}
        <div className="pin-selector-group">
          <label htmlFor="conductor-select" className="pin-selector-label">
            Conductor:
          </label>
          {loadingConductores ? (
            <div className="pin-loading-conductores">Cargando catálogo...</div>
          ) : (
            <div className="pin-select-container">
              <select
                id="conductor-select"
                value={selectedDriverId}
                onChange={handleDriverChange}
                className="pin-select-control"
                disabled={loading}
              >
                {conductores.map(c => (
                  <option key={c.id_conductores} value={c.id_conductores}>
                    {c.nombre} {c.empresa ? `(${c.empresa})` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

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
          onClick={() => executeLogin(selectedDriverId, pin)}
          className={`pin-submit-btn ${pin.length === 4 ? "ready" : ""} ${loading ? "loading" : ""}`}
        >
          {loading ? "Verificando acceso..." : "Ingresar"}
        </button>
      </div>
    </div>
  );
}

