import React, { useState, useEffect, useRef } from "react";
import { IconStar } from "./Icons.jsx";

export default function DestinationAutocomplete({
  lugares = [],
  value,
  onChange,
  placeholder = "Buscar o escribir lugar...",
  disabled = false,
  excludeId = null,
  onAddNew = null,
  allowCustom = false,
  customText = "",
  onCustomTextChange = null,
  required = false,
  id = undefined
}) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isCustomMode, setIsCustomMode] = useState(false);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // Sincronizar el texto del input cuando cambia la seleccion externa
  useEffect(() => {
    if (value === "CUSTOM") {
      setIsCustomMode(true);
      return;
    }

    if (value) {
      setIsCustomMode(false);
      const selected = lugares.find((l) => String(l.id_lugares) === String(value));
      if (selected) {
        setQuery(selected.nombre);
        return;
      }
    }

    if (!value && !isCustomMode) {
      setQuery("");
    }
  }, [value, lugares]);

  // Cerrar el menu desplegable al hacer clic fuera del componente
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
        // Si hay un valor seleccionado, restaurar su nombre exacto
        if (value && value !== "CUSTOM") {
          const selected = lugares.find((l) => String(l.id_lugares) === String(value));
          if (selected) {
            setQuery(selected.nombre);
          }
        } else if (!value && !isCustomMode) {
          setQuery("");
        }
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [value, lugares, isCustomMode]);

  // Filtrado reactivo en tiempo real por nombre o direccion, priorizando favoritos
  const normalizedQuery = query.trim().toLowerCase();
  const eligibleLugares = lugares.filter((lugar) => {
    if (excludeId && String(lugar.id_lugares) === String(excludeId)) {
      return false;
    }
    if (!normalizedQuery) {
      return true;
    }
    const matchNombre = (lugar.nombre || "").toLowerCase().includes(normalizedQuery);
    const matchDireccion = (lugar.direccion || "").toLowerCase().includes(normalizedQuery);
    return matchNombre || matchDireccion;
  });

  // Ordenar para garantizar que los favoritos SIEMPRE estén al principio
  const sortedLugares = [...eligibleLugares].sort((a, b) => {
    const favA = Boolean(a.es_favorito);
    const favB = Boolean(b.es_favorito);
    if (favA && !favB) return -1;
    if (!favA && favB) return 1;
    return (a.nombre || "").localeCompare(b.nombre || "");
  });

  const filteredLugares = sortedLugares.slice(0, 30);

  function handleSelect(lugar) {
    setIsCustomMode(false);
    setQuery(lugar.nombre);
    setIsOpen(false);
    onChange(String(lugar.id_lugares), lugar);
    inputRef.current?.blur();
  }

  function handleClear() {
    setIsCustomMode(false);
    setQuery("");
    setIsOpen(false);
    onChange("", null);
    if (onCustomTextChange) onCustomTextChange("");
    inputRef.current?.focus();
  }

  function handleChooseCustom() {
    setIsCustomMode(true);
    setIsOpen(false);
    onChange("CUSTOM", null);
  }

  return (
    <div
      ref={containerRef}
      className="destination-autocomplete-container"
      style={{ position: "relative", width: "100%" }}
    >
      <div style={{ position: "relative", display: "flex", alignItems: "center", width: "100%" }}>
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={query}
          disabled={disabled}
          placeholder={placeholder}
          required={required && !value && !isCustomMode}
          autoComplete="off"
          className="destination-autocomplete-input"
          onFocus={() => {
            if (!disabled) setIsOpen(true);
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
            if (value && value !== "CUSTOM") {
              // Si el usuario empieza a borrar o cambiar texto, reiniciar seleccion previa
              onChange("", null);
            }
          }}
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "12px 36px 12px 14px",
            borderRadius: "12px",
            border: "1px solid #cbd5e1",
            background: "#ffffff",
            backgroundColor: "#ffffff",
            backgroundImage: "none",
            color: "#1e293b",
            fontSize: "0.88rem",
            fontWeight: "500",
            outline: "none",
            boxShadow: "none",
            WebkitBoxShadow: "none",
            WebkitAppearance: "none",
            appearance: "none",
            backdropFilter: "none",
            WebkitBackdropFilter: "none"
          }}
        />

        {query && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Limpiar seleccion"
            style={{
              position: "absolute",
              right: "10px",
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#94a3b8",
              fontSize: "1.2rem",
              lineHeight: 1,
              padding: "4px"
            }}
          >
            ×
          </button>
        )}
      </div>

      {/* Campo adicional si se eligio texto personalizado */}
      {isCustomMode && allowCustom && (
        <div style={{ marginTop: "8px" }}>
          <input
            type="text"
            value={customText}
            onChange={(e) => onCustomTextChange && onCustomTextChange(e.target.value)}
            placeholder="Escribe la direccion o ubicacion exacta..."
            required={required}
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "10px 14px",
              borderRadius: "8px",
              border: "1px solid #1ba8ce",
              background: "#ffffff",
              color: "#173c4d",
              fontSize: "0.92rem"
            }}
          />
        </div>
      )}

      {/* Menu desplegable de sugerencias */}
      {isOpen && !disabled && (
        <ul
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            zIndex: 9999,
            maxHeight: "280px",
            overflowY: "auto",
            background: "#ffffff",
            border: "1px solid #cadde6",
            borderRadius: "10px",
            boxShadow: "0 10px 25px -5px rgba(15, 23, 42, 0.15)",
            margin: 0,
            padding: "4px 0",
            listStyle: "none"
          }}
        >
          {filteredLugares.length === 0 ? (
            <li
              style={{
                padding: "12px 14px",
                color: "#64748b",
                fontSize: "0.88rem",
                textAlign: "center"
              }}
            >
              No se encontraron lugares con "{query}"
            </li>
          ) : (
            filteredLugares.map((lugar, index) => {
              const isSelected = String(lugar.id_lugares) === String(value);
              const isFav = Boolean(lugar.es_favorito);
              const prevLugar = index > 0 ? filteredLugares[index - 1] : null;
              const isFirstFav = isFav && index === 0;
              const isFirstNonFav = !isFav && prevLugar && Boolean(prevLugar.es_favorito);

              return (
                <React.Fragment key={lugar.id_lugares}>
                  {isFirstFav && (
                    <li
                      style={{
                        padding: "6px 14px 4px",
                        fontSize: "0.72rem",
                        fontWeight: "700",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        color: "#854d0e",
                        background: "#fefce8",
                        borderBottom: "1px solid #fef08a",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px"
                      }}
                    >
                      <IconStar size={13} color="#ca8a04" filled />
                      <span>Destinos Sugeridos / Favoritos</span>
                    </li>
                  )}
                  {isFirstNonFav && (
                    <li
                      style={{
                        padding: "6px 14px 4px",
                        fontSize: "0.72rem",
                        fontWeight: "700",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        color: "#64748b",
                        background: "#f8fafc",
                        borderTop: "1px solid #e2e8f0",
                        borderBottom: "1px solid #e2e8f0"
                      }}
                    >
                      Todos los destinos
                    </li>
                  )}
                  <li
                    onClick={() => handleSelect(lugar)}
                    style={{
                      padding: "10px 14px",
                      cursor: "pointer",
                      borderBottom: "1px solid #f1f5f9",
                      background: isSelected
                        ? "#eff6ff"
                        : isFav
                        ? "#fffdf5"
                        : "#ffffff",
                      transition: "background 0.15s ease",
                      borderLeft: isFav ? "3px solid #eab308" : "3px solid transparent"
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.background = isFav ? "#fef9c3" : "#f8fafc";
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.background = isFav ? "#fffdf5" : "#ffffff";
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "6px"
                      }}
                    >
                      <div
                        style={{
                          fontWeight: isSelected ? "700" : isFav ? "600" : "500",
                          color: isSelected ? "#1d4ed8" : isFav ? "#713f12" : "#0f172a",
                          fontSize: "0.92rem",
                          display: "flex",
                          alignItems: "center",
                          gap: "6px"
                        }}
                      >
                        {isFav && <IconStar size={14} color="#ca8a04" filled />}
                        <span>{lugar.nombre}</span>
                      </div>
                      {isFav && (
                        <span
                          style={{
                            fontSize: "0.68rem",
                            fontWeight: "700",
                            color: "#854d0e",
                            background: "#fef08a",
                            padding: "1px 6px",
                            borderRadius: "4px",
                            whiteSpace: "nowrap"
                          }}
                        >
                          Sugerido
                        </span>
                      )}
                    </div>
                    {lugar.direccion && (
                      <div
                        style={{
                          color: "#64748b",
                          fontSize: "0.78rem",
                          marginTop: "2px",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          paddingLeft: isFav ? "20px" : "0px"
                        }}
                      >
                        {lugar.direccion}
                      </div>
                    )}
                  </li>
                </React.Fragment>
              );
            })
          )}

          {/* Opciones especiales al final de la lista */}
          {allowCustom && (
            <li
              onClick={handleChooseCustom}
              style={{
                padding: "10px 14px",
                cursor: "pointer",
                borderTop: "1px dashed #cbd5e1",
                background: isCustomMode ? "#eff6ff" : "#fafafa",
                color: "#2563eb",
                fontWeight: "600",
                fontSize: "0.88rem"
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5f9")}
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = isCustomMode ? "#eff6ff" : "#fafafa")
              }
            >
              + Especificar otra direccion o ubicacion...
            </li>
          )}

          {onAddNew && (
            <li
              onClick={() => {
                setIsOpen(false);
                onAddNew();
              }}
              style={{
                padding: "10px 14px",
                cursor: "pointer",
                borderTop: "1px dashed #cbd5e1",
                background: "#fafafa",
                color: "#0891b2",
                fontWeight: "600",
                fontSize: "0.88rem"
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5f9")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#fafafa")}
            >
              + Registrar nuevo destino en el catalogo...
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
