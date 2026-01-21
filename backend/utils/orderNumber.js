// utils/orderNumber.js - Order number generation
/**
 * Generate a formatted order number
 * Format: W-YYMMDD-XXXXX (e.g., W-240115-00001)
 * @param {number} id - Order ID
 * @returns {string} - Formatted order number
 */
const generateOrderNumber = (id) => {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const dateStr = `${year}${month}${day}`;
    const idPadded = id.toString().padStart(5, '0');
    return `W-${dateStr}-${idPadded}`;
};

module.exports = {
    generateOrderNumber
};
