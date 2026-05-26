// utils/productUnits.js - Shared product unit type helpers

const VALID_PRODUCT_UNIT_TYPES = [
    'unidad', 'paquete', 'caja', 'docena',
    'lb', 'kg', 'g', 'l', 'ml', 'm'
];

// Normalizes a unit type value to a valid enum member, defaulting to 'unidad'
const normalizeProductUnitType = (value) => {
    const normalized = String(value || '').trim().toLowerCase();
    return VALID_PRODUCT_UNIT_TYPES.includes(normalized) ? normalized : 'unidad';
};

module.exports = { VALID_PRODUCT_UNIT_TYPES, normalizeProductUnitType };
