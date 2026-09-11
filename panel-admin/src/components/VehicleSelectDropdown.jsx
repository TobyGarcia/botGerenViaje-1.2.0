import React, { useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { IconCoche, IconChevronDown, IconBuscar, IconCheck, IconSpinner } from "./Icons";

export default function VehicleSelectDropdown({
  value,
  options = [],
  onChange,
  disabled = false,
  loading = false,
  placeholder = "-- Sin unidad --",
  className = "",
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 250, openAbove: false });

  const triggerRef = useRef(null);
  const popoverRef = useRef(null);
  const searchInputRef = useRef(null);

  // Find currently selected vehicle
  const currentVehicle = useMemo(() => {
    if (!value) return null;
    return options.find((v) => String(v.id_vehiculos) === String(value)) || null;
  }, [value, options]);

  // Update position based on trigger coordinates
  const updatePosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const dropdownWidth = Math.max(rect.width, 270);
    const estimatedHeight = 310;

    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const openAbove = spaceBelow < estimatedHeight && spaceAbove > spaceBelow;

    let left = rect.left;
    if (left + dropdownWidth > window.innerWidth - 12) {
      left = window.innerWidth - dropdownWidth - 12;
    }
    if (left < 12) left = 12;

    setCoords({
      top: openAbove ? rect.top - 6 : rect.bottom + 6,
      left,
      width: dropdownWidth,
      openAbove,
    });
  };

  const handleToggle = () => {
    if (disabled || loading) return;
    if (!isOpen) {
      updatePosition();
      setSearchTerm("");
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  // Close on outside click or Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    const handleClickOutside = (e) => {
      if (
        triggerRef.current &&
        !triggerRef.current.contains(e.target) &&
        popoverRef.current &&
        !popoverRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    };

    const handleScrollOrResize = () => {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      // If scrolled out of viewport, close
      if (rect.bottom < 0 || rect.top > window.innerHeight) {
        setIsOpen(false);
      } else {
        updatePosition();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [isOpen]);

  // Focus search input when opened
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Filter vehicles based on search term
  const filteredVehicles = useMemo(() => {
    if (!searchTerm.trim()) return options;
    const query = searchTerm.toLowerCase().trim();
    return options.filter((v) => {
      const name = (v.nombre || "").toLowerCase();
      const num = (v.numero_economico || "").toLowerCase();
      const plate = (v.placa || v.placas || "").toLowerCase();
      const model = (v.modelo || "").toLowerCase();
      const brand = (v.marca || "").toLowerCase();
      return (
        name.includes(query) ||
        num.includes(query) ||
        plate.includes(query) ||
        model.includes(query) ||
        brand.includes(query)
      );
    });
  }, [options, searchTerm]);

  const handleSelect = (vehiculoId) => {
    if (String(vehiculoId) !== String(value || "")) {
      onChange(vehiculoId);
    }
    setIsOpen(false);
  };

  // Helper to split vehicle display name into primary and secondary
  const formatVehicleLabel = (veh) => {
    if (!veh) return { primary: placeholder, secondary: "" };
    const raw = veh.nombre || veh.numero_economico || `Vehículo #${veh.id_vehiculos}`;
    const parenMatch = raw.match(/^(.*?)\s*\((.*?)\)$/);
    if (parenMatch) {
      return {
        primary: parenMatch[1].trim(),
        secondary: parenMatch[2].trim(),
      };
    }
    return {
      primary: raw,
      secondary: veh.placa || veh.placas || veh.numero_economico || "",
    };
  };

  const currentLabel = formatVehicleLabel(currentVehicle);

  return (
    <div className={`vehicle-select-container ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        className={`vehicle-select-trigger ${currentVehicle ? "has-vehicle" : "no-vehicle"} ${
          isOpen ? "is-open" : ""
        } ${disabled ? "is-disabled" : ""}`}
        onClick={handleToggle}
        disabled={disabled || loading}
        title={
          currentVehicle
            ? `Unidad asignada: ${currentVehicle.nombre || currentVehicle.numero_economico}`
            : "Seleccionar unidad vehicular"
        }
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="vehicle-trigger-left">
          <span className={`vehicle-trigger-icon ${currentVehicle ? "active" : "empty"}`}>
            {loading ? <IconSpinner size={13} /> : <IconCoche size={13} />}
          </span>
          <span className="vehicle-trigger-label" title={currentVehicle?.nombre || placeholder}>
            {currentVehicle ? (
              <>
                <strong className="vehicle-trigger-main">{currentLabel.primary}</strong>
                {currentLabel.secondary && (
                  <span className="vehicle-trigger-sub">({currentLabel.secondary})</span>
                )}
              </>
            ) : (
              <span className="vehicle-trigger-empty">{placeholder}</span>
            )}
          </span>
        </div>

        <span className={`vehicle-trigger-chevron ${isOpen ? "open" : ""}`}>
          <IconChevronDown size={14} />
        </span>
      </button>

      {isOpen &&
        createPortal(
          <div
            ref={popoverRef}
            className={`vehicle-dropdown-popover ${coords.openAbove ? "popover-above" : "popover-below"}`}
            style={{
              top: coords.openAbove ? undefined : `${coords.top}px`,
              bottom: coords.openAbove ? `${window.innerHeight - coords.top}px` : undefined,
              left: `${coords.left}px`,
              width: `${coords.width}px`,
            }}
            role="listbox"
          >
            {/* Search Header */}
            <div className="vehicle-dropdown-search-box">
              <IconBuscar size={14} className="search-icon" />
              <input
                ref={searchInputRef}
                type="text"
                className="vehicle-dropdown-input"
                placeholder="Buscar unidad, placas o modelo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
              />
              {searchTerm && (
                <button
                  type="button"
                  className="vehicle-search-clear"
                  onClick={() => setSearchTerm("")}
                  title="Limpiar búsqueda"
                >
                  &times;
                </button>
              )}
            </div>

            {/* Unassign / Sin unidad Option */}
            <div className="vehicle-dropdown-body">
              <button
                type="button"
                className={`vehicle-dropdown-item vehicle-item-unassign ${!value ? "selected" : ""}`}
                onClick={() => handleSelect("")}
              >
                <div className="vehicle-item-info">
                  <span className="vehicle-item-dot empty-dot" />
                  <span className="vehicle-item-name">-- Sin unidad (Desvincular) --</span>
                </div>
                {!value && <IconCheck size={14} className="vehicle-selected-check" />}
              </button>

              <div className="vehicle-dropdown-divider">
                <span>Unidades activas ({filteredVehicles.length})</span>
              </div>

              {/* Scrollable list of vehicles */}
              <div className="vehicle-dropdown-list">
                {filteredVehicles.length === 0 ? (
                  <div className="vehicle-dropdown-empty">
                    <span>No se encontraron unidades</span>
                  </div>
                ) : (
                  filteredVehicles.map((veh) => {
                    const isSelected = String(veh.id_vehiculos) === String(value || "");
                    const label = formatVehicleLabel(veh);

                    return (
                      <button
                        key={veh.id_vehiculos}
                        type="button"
                        className={`vehicle-dropdown-item ${isSelected ? "selected" : ""}`}
                        onClick={() => handleSelect(veh.id_vehiculos)}
                        title={veh.nombre}
                      >
                        <div className="vehicle-item-info">
                          <span className={`vehicle-item-dot ${isSelected ? "selected-dot" : ""}`} />
                          <div className="vehicle-item-text-group">
                            <span className="vehicle-item-name">{label.primary}</span>
                            {label.secondary && (
                              <span className="vehicle-item-sub">{label.secondary}</span>
                            )}
                          </div>
                        </div>
                        {isSelected && <IconCheck size={14} className="vehicle-selected-check" />}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
