import React, { useState, useEffect } from "react";
import { getConductores, loginConductorConPin } from "../services/api";

export default function PinLoginForm({ onSuccess, onCancel }) {
  const [conductores, setConductores] = useState([]);
  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingConductores, setLoadingConductores] = useState(true);

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
    if (pin.length < 4) {
      setPin(prev => prev + digit);
      setError("");
    }
  };

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
    setError("");
  };

  const handleLogin = async () => {
    if (!selectedDriverId) {
      setError("Selecciona tu nombre de conductor.");
      return;
    }

    if (pin.length !== 4) {
      setError("Ingresa los 4 dígitos de tu PIN de acceso.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      const result = await loginConductorConPin(Number(selectedDriverId), pin);

      if (result.success && result.data?.token) {
        localStorage.setItem("driver_token", result.data.token);
        if (onSuccess) {
          onSuccess(result.data.conductor);
        }
      } else {
        setError(result.message || "Credenciales incorrectas.");
      }
    } catch (err) {
      setError(err.message || "Error al iniciar sesión.");
      setPin("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      maxWidth: "400px",
      margin: "0 auto",
      padding: "24px 16px",
      fontFamily: "system-ui, -apple-system, sans-serif"
    }}>
      <div style={{ textAlign: "center", marginBottom: "20px" }}>
        <h2 style={{ fontSize: "1.25rem", color: "#1e293b", marginBottom: "6px" }}>
          Ingreso por PIN de Conductor
        </h2>
        <p style={{ fontSize: "0.875rem", color: "#64748b" }}>
          Selecciona tu nombre e ingresa tu PIN de 4 dígitos para acceder al sistema
        </p>
      </div>

      {error && (
        <div style={{
          backgroundColor: "#fef2f2",
          color: "#991b1b",
          border: "1px solid #fecaca",
          padding: "10px 14px",
          borderRadius: "8px",
          marginBottom: "16px",
          fontSize: "0.875rem",
          textAlign: "center"
        }}>
          {error}
        </div>
      )}

      {/* Selector de Conductor */}
      <div style={{ marginBottom: "20px" }}>
        <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
          Conductor:
        </label>
        {loadingConductores ? (
          <div style={{ padding: "10px", textAlign: "center", color: "#94a3b8" }}>Cargando conductores...</div>
        ) : (
          <select
            value={selectedDriverId}
            onChange={(e) => setSelectedDriverId(e.target.value)}
            style={{
              width: "100%",
              padding: "12px",
              fontSize: "1rem",
              borderRadius: "8px",
              border: "1px solid #cbd5e1",
              backgroundColor: "#ffffff",
              color: "#0f172a"
            }}
          >
            {conductores.map(c => (
              <option key={c.id_conductores} value={c.id_conductores}>
                {c.nombre} {c.empresa ? `(${c.empresa})` : ""}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Indicador visual de los 4 dígitos */}
      <div style={{
        display: "flex",
        justifyContent: "center",
        gap: "16px",
        marginBottom: "24px"
      }}>
        {[0, 1, 2, 3].map(index => (
          <div
            key={index}
            style={{
              width: "18px",
              height: "18px",
              borderRadius: "50%",
              border: "2px solid #0284c7",
              backgroundColor: pin.length > index ? "#0284c7" : "transparent",
              transition: "all 0.15s ease"
            }}
          />
        ))}
      </div>

      {/* Teclado numérico táctil */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: "12px",
        marginBottom: "20px"
      }}>
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map(num => (
          <button
            key={num}
            type="button"
            onClick={() => handleKeyPress(num)}
            style={{
              padding: "16px",
              fontSize: "1.25rem",
              fontWeight: 600,
              borderRadius: "12px",
              border: "1px solid #e2e8f0",
              backgroundColor: "#f8fafc",
              color: "#0f172a",
              cursor: "pointer"
            }}
          >
            {num}
          </button>
        ))}
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: "16px",
              fontSize: "0.875rem",
              fontWeight: 600,
              borderRadius: "12px",
              border: "none",
              backgroundColor: "#cbd5e1",
              color: "#334155",
              cursor: "pointer"
            }}
          >
            Cancelar
          </button>
        ) : (
          <button
            type="button"
            onClick={() => { setPin(""); setError(""); }}
            style={{
              padding: "16px",
              fontSize: "0.875rem",
              fontWeight: 600,
              borderRadius: "12px",
              border: "1px solid #e2e8f0",
              backgroundColor: "#f8fafc",
              color: "#64748b",
              cursor: "pointer"
            }}
            title="Borrar PIN"
          >
            Limpiar
          </button>
        )}

        <button
          type="button"
          onClick={() => handleKeyPress("0")}
          style={{
            padding: "16px",
            fontSize: "1.25rem",
            fontWeight: 600,
            borderRadius: "12px",
            border: "1px solid #e2e8f0",
            backgroundColor: "#f8fafc",
            color: "#0f172a",
            cursor: "pointer"
          }}
        >
          0
        </button>

        <button
          type="button"
          onClick={handleDelete}
          style={{
            padding: "16px",
            fontSize: "1rem",
            fontWeight: 600,
            borderRadius: "12px",
            border: "none",
            backgroundColor: "#fee2e2",
            color: "#991b1b",
            cursor: "pointer"
          }}
        >
          ⌫
        </button>
      </div>

      <button
        type="button"
        disabled={pin.length !== 4 || loading}
        onClick={handleLogin}
        style={{
          width: "100%",
          padding: "14px",
          fontSize: "1rem",
          fontWeight: 600,
          borderRadius: "8px",
          border: "none",
          backgroundColor: pin.length === 4 ? "#0284c7" : "#94a3b8",
          color: "#ffffff",
          cursor: pin.length === 4 ? "pointer" : "not-allowed",
          transition: "background-color 0.2s ease"
        }}
      >
        {loading ? "Verificando..." : "Ingresar"}
      </button>
    </div>
  );
}
