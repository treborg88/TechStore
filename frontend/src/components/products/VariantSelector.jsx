// VariantSelector.jsx - Selector de variantes (colores, tallas, etc.)
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import './VariantSelector.css';
import { formatCurrency } from '../../utils/formatCurrency';

/**
 * Componente para seleccionar variantes de un producto.
 * Agrupa atributos por tipo (Color, Talla, etc.), renderiza swatches/pills,
 * y resuelve la variante seleccionada a partir de la combinación elegida.
 *
 * @param {Object} props
 * @param {Array}  props.variants       - Array de variantes del producto (con .attributes[])
 * @param {Array}  props.attributeTypes  - Catálogo global de tipos de atributo
 * @param {number} props.basePrice       - Precio base del producto
 * @param {string} props.currencyCode    - Código de moneda para formateo
 * @param {Function} props.onVariantChange - Callback(variant | null) cuando cambia la selección
 */
export default function VariantSelector({ variants, attributeTypes = [], basePrice, currencyCode, onVariantChange }) {
  // Selected values keyed by attribute type name, e.g. { Color: 'Rojo', Talla: 'M' }
  const [selected, setSelected] = useState({});

  // Build display_type map from attributeTypes catalog: { 'Color': 'color_swatch', 'Talla': 'pill' }
  const typeDisplayMap = useMemo(() => {
    const m = {};
    attributeTypes.forEach(t => { m[t.name] = t.display_type; });
    return m;
  }, [attributeTypes]);

  // Extract unique attribute groups from variants
  // Returns: [{ type: 'Color', values: ['Rojo','Azul'] }, { type: 'Talla', values: ['M','L'] }]
  const groups = useMemo(() => {
    const map = {};
    for (const v of variants) {
      for (const attr of (v.attributes || [])) {
        if (!map[attr.type]) map[attr.type] = new Set();
        map[attr.type].add(attr.value);
      }
    }
    // Sort groups by catalog order, then alphabetically
    const typeOrder = {};
    attributeTypes.forEach((t, i) => { typeOrder[t.name] = i; });
    return Object.entries(map)
      .sort(([a], [b]) => (typeOrder[a] ?? 999) - (typeOrder[b] ?? 999))
      .map(([type, valuesSet]) => ({ type, values: [...valuesSet] }));
  }, [variants, attributeTypes]);

  // Build color_hex lookup: { 'Rojo': '#FF0000', 'Azul': '#0000FF' }
  const colorHexMap = useMemo(() => {
    const m = {};
    for (const v of variants) {
      for (const attr of (v.attributes || [])) {
        if (attr.color_hex && !m[attr.value]) m[attr.value] = attr.color_hex;
      }
    }
    return m;
  }, [variants]);

  // Find variant matching current selection (exact combo match)
  const resolvedVariant = useMemo(() => {
    if (groups.length === 0) return null;
    // Only resolve when all attribute types have a selection
    const allSelected = groups.every(g => selected[g.type]);
    if (!allSelected) return null;
    return variants.find(v => {
      const attrs = v.attributes || [];
      return groups.every(g =>
        attrs.some(a => a.type === g.type && a.value === selected[g.type])
      );
    }) || null;
  }, [selected, variants, groups]);

  // Notify parent when resolved variant changes
  useEffect(() => {
    onVariantChange(resolvedVariant);
  }, [resolvedVariant, onVariantChange]);

  // Check if a value is available (there exists at least one active variant with that value
  // given current selections on OTHER attribute types)
  const isValueAvailable = useCallback((type, value) => {
    return variants.some(v => {
      if (!v.is_active) return false;
      const attrs = v.attributes || [];
      // Must have the target value
      if (!attrs.some(a => a.type === type && a.value === value)) return false;
      // Must also match selections for all other types
      for (const g of groups) {
        if (g.type === type) continue;
        const sel = selected[g.type];
        if (sel && !attrs.some(a => a.type === g.type && a.value === sel)) return false;
      }
      // Must have stock > 0
      return v.stock > 0;
    });
  }, [variants, groups, selected]);

  // Handle click on an attribute value
  const handleSelect = (type, value) => {
    setSelected(prev => {
      // Toggle off if already selected
      if (prev[type] === value) {
        const next = { ...prev };
        delete next[type];
        return next;
      }
      return { ...prev, [type]: value };
    });
  };

  // Display price override vs base price
  const priceDisplay = resolvedVariant
    ? formatCurrency(resolvedVariant.price_override ?? basePrice, currencyCode)
    : null;

  return (
    <div className="variant-selector" data-testid="variant-selector">
      {groups.map(group => (
        <div key={group.type} className="variant-attribute-group">
          <span className="variant-attribute-label">{group.type}:</span>
          <div className="variant-options-row">
            {group.values.map(value => {
              const isSelected = selected[group.type] === value;
              const available = isValueAvailable(group.type, value);
              const displayType = typeDisplayMap[group.type] || 'pill';

              return (
                <button
                  key={value}
                  type="button"
                  className={[
                    'variant-option',
                    displayType === 'color_swatch' ? 'variant-color-swatch' : 'variant-pill',
                    isSelected ? 'selected' : '',
                    !available ? 'unavailable' : ''
                  ].filter(Boolean).join(' ')}
                  disabled={!available}
                  onClick={() => handleSelect(group.type, value)}
                  title={value}
                  aria-pressed={isSelected}
                  aria-label={`${group.type}: ${value}`}
                  {...(displayType === 'color_swatch' ? { style: { '--swatch-color': colorHexMap[value] || value.toLowerCase() } } : {})}
                >
                  {/* Color swatches show a colored circle; pills show the text label */}
                  {displayType === 'color_swatch' ? '' : value}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* Variant price (only when different from base) */}
      {resolvedVariant && resolvedVariant.price_override != null && resolvedVariant.price_override !== basePrice && (
        <div className="variant-price">{priceDisplay}</div>
      )}

      {/* Error: incomplete selection */}
      {!resolvedVariant && Object.keys(selected).length > 0 && Object.keys(selected).length < groups.length && (
        <div className="variant-error">
          Selecciona {groups.filter(g => !selected[g.type]).map(g => g.type).join(' y ')}
        </div>
      )}
    </div>
  );
}
