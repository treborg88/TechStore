// cartHelpers.js - Utilidades puras para transformar datos del carrito

/**
 * Formatea la respuesta del backend de carrito al formato usado en el frontend.
 * Soporta items con y sin variante.
 * @param {Array} backendCart - Array de items del carrito del backend
 * @returns {Array} Array de items formateados para el frontend
 */
export const formatBackendCart = (backendCart) => {
  return backendCart.map(item => ({
    id: item.product_id,
    name: item.name,
    price: item.price,
    image: item.image,
    stock: item.stock,
    unit_type: item.unit_type,
    quantity: item.quantity,
    // Variant fields (null for non-variant items)
    variant_id: item.variant_id || null,
    variant_attributes: item.variant_attributes || null
  }));
};

/**
 * Genera una key única para identificar items en el carrito (product + variant combo).
 * Necesario porque el mismo producto puede aparecer múltiples veces con distintas variantes.
 */
export const cartItemKey = (item) => {
  const vid = item.variant_id || item.variantId || null;
  return vid ? `${item.id}-v${vid}` : `${item.id}`;
};

/**
 * Formatea variant_attributes como etiqueta legible (e.g. "Rojo / M").
 * Soporta: array [{type,value}], objeto JSONB {"Color":"Rojo"}, o string JSON
 * @param {Array|Object|string|null} attrs
 * @returns {string} Etiqueta formateada o cadena vacía
 */
export const formatVariantLabel = (attrs) => {
  if (!attrs) return '';
  // Si viene como string JSON, parsear
  let parsed = attrs;
  if (typeof parsed === 'string') {
    try { parsed = JSON.parse(parsed); } catch { return ''; }
  }
  // Objeto JSONB {"Color":"Rojo","Talla":"M"}
  if (typeof parsed === 'object' && !Array.isArray(parsed)) {
    return Object.values(parsed).filter(v => v).join(' / ');
  }
  // Array [{type, value}] o [{attribute_type, attribute_value}]
  if (Array.isArray(parsed) && parsed.length > 0) {
    return parsed.map(a => a.value || a.attribute_value || '').filter(v => v).join(' / ');
  }
  return '';
};
