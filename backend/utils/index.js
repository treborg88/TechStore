// utils/index.js - Export all utilities
const { generateOrderNumber } = require('./orderNumber');
const { VALID_PRODUCT_UNIT_TYPES, normalizeProductUnitType } = require('./productUnits');

// Password must be ≥8 chars with at least one lowercase, one uppercase, and one digit.
// Single source of truth — used by auth.routes.js and saas/public.routes.js.
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
const PASSWORD_POLICY_MESSAGE = 'La contraseña debe tener al menos 8 caracteres, una mayúscula y un número';

const validatePassword = (password) => PASSWORD_REGEX.test(password);

module.exports = {
    generateOrderNumber,
    VALID_PRODUCT_UNIT_TYPES,
    normalizeProductUnitType,
    validatePassword,
    PASSWORD_POLICY_MESSAGE
};
