import React, { useState, useEffect, useRef } from "react";

export default function VehicleDropdown({
  vehiculos = [],
  value = "",
  onChange,
  assignedVehicle = null,
  required = false,
  disabled = false,
  placeholder = "Seleccione una unidad vehicular",
  id = "unit-selector",
  name = "idVehiculo"
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);

  // Cerrar al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, []);

  // Enfocar el input de busqueda al abrir
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
    if (!isOpen) {
      setSearch("");
    }
  }, [isOpen]);

  // Manejar teclado (Escape para cerrar)
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const selectedVehicle = vehiculos.find(
    (v) => String(v.id_vehiculos) === String(value)
  );

  const normalizedSearch = search.trim().toLowerCase();

  const filteredVehiculos = vehiculos.filter((v) => {
    if (!normalizedSearch) return true;
    const matchNombre = (v.nombre || "").toLowerCase().includes(normalizedSearch);
    const matchEco = (v.numero_economico || "").toLowerCase().includes(normalizedSearch);
    const matchPlacas = (v.placas || "").toLowerCase().includes(normalizedSearch);
    return matchNombre || matchEco || matchPlacas;
  });

  function handleSelect(vehiculo) {
    if (disabled) return;
    setIsOpen(false);
    if (onChange) {
      onChange({
        target: {
          name,
          value: String(vehiculo.id_vehiculos)
        }
      });
    }
  }

  function handleClear(e) {
    e.stopPropagation();
    if (disabled) return;
    setIsOpen(false);
    if (onChange) {
      onChange({
        target: {
          name,
          value: ""
        }
      });
    }
  }

  const isSelectedAssigned =
    selectedVehicle &&
    assignedVehicle &&
    String(selectedVehicle.id_vehiculos) === String(assignedVehicle.id_vehiculos);

  return (
    <div
      ref={dropdownRef}
      className="custom-vehicle-select-container"
      style={{ position: "relative", width: "100%" }}
    >
      {/* Input oculto para soporte nativo de formulario */}
      <input
        type="text"
        id={id}
        name={name}
        value={value || ""}
        onChange={() => {}}
        required={required}
        tabIndex={-1}
        aria-hidden="true"
        style={{
          position: "absolute",
          opacity: 0,
          pointerEvents: "none",
          height: 0,
          width: 0,
          left: "50%",
          bottom: 0
        }}
      />

      {/* Boton disparador principal */}
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (!disabled) setIsOpen(!isOpen);
          }
        }}
        className={`vehicle-select-trigger ${isOpen ? "is-open" : ""} ${disabled ? "is-disabled" : ""}`}
      >
        <div className="vehicle-trigger-left">
          <div className="vehicle-trigger-icon-box">
            <svg
              className="vehicle-trigger-svg"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                d="M8 17a2 2 0 100-4 2 2 0 000 4zm8 0a2 2 0 100-4 2 2 0 000 4m-9-4h10m-11 0l1.5-6h13l1.5 6m-16 0v4a1 1 0 001 1h1m12 0h1a1 1 0 001-1v-4"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.8"
              />
            </svg>
          </div>

          <div className="vehicle-trigger-content">
            {selectedVehicle ? (
              <div className="vehicle-trigger-selected-row">
                <span className="vehicle-trigger-name">{selectedVehicle.nombre}</span>
                <span className="vehicle-trigger-eco-badge">
                  {selectedVehicle.numero_economico}
                </span>
                {isSelectedAssigned && (
                  <span className="vehicle-trigger-assigned-tag">Asignada</span>
                )}
              </div>
            ) : (
              <span className="vehicle-trigger-placeholder">{placeholder}</span>
            )}
          </div>
        </div>

        <div className="vehicle-trigger-right">
          {selectedVehicle && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="vehicle-trigger-clear-btn"
              title="Quitar selección"
              aria-label="Quitar selección"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}

          <span className={`vehicle-trigger-chevron ${isOpen ? "chevron-up" : ""}`}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </div>
      </div>

      {/* Menu desplegable estético */}
      {isOpen && !disabled && (
        <div className="vehicle-dropdown-menu" role="listbox">
          {/* Barra de busqueda rapida */}
          <div className="vehicle-search-bar">
            <svg className="vehicle-search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="7" strokeWidth="2" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre o no. económico..."
              className="vehicle-search-input"
              onClick={(e) => e.stopPropagation()}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="vehicle-search-clear"
                aria-label="Limpiar búsqueda"
              >
                ×
              </button>
            )}
          </div>

          {/* Listado de unidades */}
          <div className="vehicle-items-list">
            {filteredVehiculos.length === 0 ? (
              <div className="vehicle-empty-state">
                <span>No se encontraron unidades para "{search}"</span>
              </div>
            ) : (
              filteredVehiculos.map((v) => {
                const isSelected = String(v.id_vehiculos) === String(value);
                const isAssigned =
                  assignedVehicle &&
                  String(v.id_vehiculos) === String(assignedVehicle.id_vehiculos);

                return (
                  <div
                    key={v.id_vehiculos}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(v)}
                    className={`vehicle-item-row ${isSelected ? "is-selected" : ""} ${isAssigned ? "is-assigned" : ""}`}
                  >
                    <div className="vehicle-item-icon-box">
                      <svg
                        className="vehicle-item-svg"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          d="M8 17a2 2 0 100-4 2 2 0 000 4zm8 0a2 2 0 100-4 2 2 0 000 4m-9-4h10m-11 0l1.5-6h13l1.5 6m-16 0v4a1 1 0 001 1h1m12 0h1a1 1 0 001-1v-4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="1.8"
                        />
                      </svg>
                    </div>

                    <div className="vehicle-item-info">
                      <div className="vehicle-item-top">
                        <span className="vehicle-item-name">{v.nombre}</span>
                        <span className="vehicle-item-eco">{v.numero_economico}</span>
                        {isAssigned && (
                          <span className="vehicle-item-badge-assigned">
                            Asignada por supervisor
                          </span>
                        )}
                      </div>

                      <div className="vehicle-item-meta">
                        {v.placas && <span>Placas: <strong>{v.placas}</strong></span>}
                        {v.kilometraje_actual != null && (
                          <span>
                            Odómetro: <strong>{Number(v.kilometraje_actual).toLocaleString("es-MX")} km</strong>
                          </span>
                        )}
                      </div>
                    </div>

                    {isSelected && (
                      <div className="vehicle-item-check">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
