// cartHelpers.js - Utilidades puras para transformar datos del carrito

/**
 * Formatea la respuesta del backend de carrito al formato usado en el frontend
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
    quantity: item.quantity
  }));
};
