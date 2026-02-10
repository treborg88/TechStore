// settingsHelpers.js - Utilidades puras para clonar/merge de configuraciones de settings
import { DEFAULT_CATEGORY_FILTERS_CONFIG, DEFAULT_PRODUCT_CARD_CONFIG } from '../config';

/**
 * Clona y merge la configuración de filtros de categoría con los defaults
 * @param {Object|null} value - Configuración parcial a merge
 * @returns {Object} Configuración completa con defaults aplicados
 */
export const cloneCategoryConfig = (value) => {
  const base = JSON.parse(JSON.stringify(DEFAULT_CATEGORY_FILTERS_CONFIG));
  if (!value || typeof value !== 'object') return base;
  return {
    ...base,
    ...value,
    categories: Array.isArray(value.categories) && value.categories.length > 0
      ? value.categories
      : base.categories,
    styles: {
      ...base.styles,
      ...(value.styles || {})
    }
  };
};

/**
 * Clona y merge la configuración de tarjetas de producto con los defaults
 * @param {Object|null} value - Configuración parcial a merge
 * @returns {Object} Configuración completa con defaults aplicados
 */
export const cloneProductCardConfig = (value) => {
  const base = JSON.parse(JSON.stringify(DEFAULT_PRODUCT_CARD_CONFIG));
  if (!value || typeof value !== 'object') return base;

  const merged = {
    ...base,
    ...value,
    layout: {
      ...base.layout,
      ...(value.layout || {})
    },
    styles: {
      ...base.styles,
      ...(value.styles || {})
    }
  };

  merged.useDefault = value.useDefault === true || value.useDefault === 'true';

  // Convertir columnas a número si vienen como string
  if (merged.layout) {
    const toNumber = (val) => {
      if (val === '' || val === null || val === undefined) return val;
      const num = Number(val);
      return Number.isNaN(num) ? val : num;
    };
    merged.layout = {
      ...merged.layout,
      columnsMobile: toNumber(merged.layout.columnsMobile),
      columnsTablet: toNumber(merged.layout.columnsTablet),
      columnsDesktop: toNumber(merged.layout.columnsDesktop),
      columnsWide: toNumber(merged.layout.columnsWide)
    };
  }

  return merged;
};
