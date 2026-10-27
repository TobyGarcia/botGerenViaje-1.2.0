import React, { useState, useEffect, useRef } from "react";
import { IconTrash } from "./Icons.jsx";
import { isTrailer } from "../utils/vehicle-kind.js";

export default function VehicleDropdown({
  vehiculos: catalogoVehiculos = [],
  value = "",
  onChange,
  assignedVehicle = null,
  required = false,
  disabled = false,
  placeholder = "Buscar unidad por nombre o no. económico…",
  id = "unit-selector",
  name = "idVehiculo"
}) {
  const vehiculos = catalogoVehiculos.filter(vehicle => !isTrailer(vehicle));
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
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

  const activeVehicleId = isOpen ? filteredVehiculos[activeIndex]?.id_vehiculos : null;
  useEffect(() => {
    if (activeVehicleId != null) {
      document.getElementById(`${id}-option-${activeVehicleId}`)?.scrollIntoView({ block: "nearest" });
    }
  }, [activeVehicleId, id]);

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
        name={name}
        value={selectedVehicle ? value : ""}
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

      {/* Un solo campo para buscar y mostrar la unidad seleccionada */}
      <div
        onClick={() => { if (!disabled) searchInputRef.current?.focus(); }}
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
            <input
              ref={searchInputRef}
              id={id}
              type="text"
              role="combobox"
              aria-label="Buscar unidad vehicular"
              aria-autocomplete="list"
              aria-expanded={isOpen && !disabled}
              aria-controls={`${id}-options`}
              aria-activedescendant={isOpen && filteredVehiculos[activeIndex] ? `${id}-option-${filteredVehiculos[activeIndex].id_vehiculos}` : undefined}
              autoComplete="off"
              disabled={disabled}
              value={isOpen ? search : selectedVehicle ? [selectedVehicle.nombre, selectedVehicle.numero_economico].filter(Boolean).join(" · ") : ""}
              onFocus={() => { setIsOpen(true); setActiveIndex(-1); }}
              onClick={() => setIsOpen(true)}
              onChange={event => { setSearch(event.target.value); setActiveIndex(-1); setIsOpen(true); }}
              onKeyDown={event => {
                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                  event.preventDefault();
                  setIsOpen(true);
                  setActiveIndex(index => filteredVehiculos.length ? (event.key === "ArrowDown" ? Math.min(index + 1, filteredVehiculos.length - 1) : Math.max(index - 1, 0)) : -1);
                } else if (event.key === "Enter" && isOpen) {
                  event.preventDefault();
                  if (filteredVehiculos[activeIndex]) handleSelect(filteredVehiculos[activeIndex]);
                } else if (event.key === "Tab") {
                  setIsOpen(false);
                }
              }}
              placeholder={placeholder}
              className="vehicle-search-input"
            />
            {!isOpen && isSelectedAssigned && <span className="vehicle-trigger-assigned-tag">Asignada</span>}
          </div>
        </div>

        <div className="vehicle-trigger-right">
          {isOpen && search && (
            <button type="button" className="vehicle-search-clear" aria-label="Limpiar búsqueda"
              onClick={event => { event.stopPropagation(); setSearch(""); setActiveIndex(-1); searchInputRef.current?.focus(); }}>
              <IconTrash size={15} color="currentColor" />
            </button>
          )}
          {!isOpen && selectedVehicle && !disabled && (
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

          <button type="button" disabled={disabled} className={`vehicle-trigger-chevron ${isOpen ? "chevron-up" : ""}`}
            aria-label={isOpen ? "Cerrar lista de unidades" : "Abrir lista de unidades"}
            onClick={event => { event.stopPropagation(); if (isOpen) setIsOpen(false); else { setIsOpen(true); searchInputRef.current?.focus(); } }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* Menu desplegable estético */}
      {isOpen && !disabled && (
        <div className="vehicle-dropdown-menu" role="listbox" id={`${id}-options`} aria-label="Unidades disponibles">
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
                    id={`${id}-option-${v.id_vehiculos}`}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(v)}
                    className={`vehicle-item-row ${filteredVehiculos[activeIndex] === v ? "is-active" : ""} ${isSelected ? "is-selected" : ""} ${isAssigned ? "is-assigned" : ""}`}
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
