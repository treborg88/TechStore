// invoiceUtils.js - Funciones auxiliares para facturación
import { pdf } from '@react-pdf/renderer';
import React from 'react';
import { InvoicePDF } from '../components/common/InvoicePDF';
import { formatQuantityWithUnit, getUnitShortLabel } from './productUnits';

export const STATUS_CONFIG = {
    pending_payment: { label: 'Pendiente de Pago', icon: '⏳', color: '#f59e0b' },
    paid: { label: 'Pagado', icon: '💰', color: '#10b981' },
    to_ship: { label: 'Para Enviar', icon: '📦', color: '#3b82f6' },
    shipped: { label: 'Enviado', icon: '🚚', color: '#8b5cf6' },
    delivered: { label: 'Entregado', icon: '✅', color: '#10b981' },
    return: { label: 'Devolución', icon: '↩️', color: '#ef4444' },
    refund: { label: 'Reembolso', icon: '💸', color: '#6366f1' },
    cancelled: { label: 'Cancelado', icon: '❌', color: '#6b7280' }
};

/**
 * Determina el estado de pago basado en el status de la orden y método de pago
 * @param {string} orderStatus - Estado actual de la orden
 * @param {string} paymentMethod - Método de pago (cash, transfer, online, card)
 * @returns {string} - Etiqueta del estado de pago
 */
export const getPaymentStatusLabel = (orderStatus, paymentMethod) => {
    // Si el estado es pagado o entregado, siempre es "Pagado"
    if (['paid', 'delivered'].includes(orderStatus)) {
        return 'Pagado';
    }
    
    // Para COD (contra entrega): si está en camino o entregado, el pago está pendiente hasta entrega
    if (paymentMethod === 'cash') {
        if (['to_ship', 'shipped'].includes(orderStatus)) {
            return 'Pago al Entregar';
        }
        // Estado inicial COD: pendiente de envío
        if (orderStatus === 'pending_payment') {
            return 'Pago al Entregar';
        }
    }
    
    // Para otros métodos, si no está pagado es "Pendiente"
    return 'Pendiente';
};

export const PAYMENT_METHODS = {
    cash: { 
        label: 'Pago Contra Entrega', 
        icon: '💵', 
        detail: 'Efectivo al Recibir',
        instructions: {
            fields: [
                { label: 'Tipo de Pago', value: 'Efectivo al Recibir' },
                { label: 'Estado del Pedido', getValue: (order) => getPaymentStatusLabel(order.status, 'cash') },
                { label: 'Referencia', getValue: (order) => order.order_number || order.id }
            ],
            amountLabel: 'Total a Pagar',
            note: {
                icon: '💡',
                text: 'Por favor, prepara el monto exacto para facilitar el proceso de entrega.',
                highlight: 'Tip:'
            }
        }
    },
    transfer: { 
        label: 'Transferencia Bancaria', 
        icon: '🏦', 
        detail: 'Transferencia Bancaria',
        instructions: {
            fields: [
                { label: 'Banco', key: 'bankName', value: 'Banco Ejemplo' },
                { label: 'Titular', key: 'bankHolder', value: 'Mi Tienda Online' },
                { label: 'Cuenta / CLABE', key: 'bankAccount', value: '1234-5678-9012-3456' }
            ],
            amountLabel: 'Monto a Pagar',
            note: {
                icon: '⚠️',
                key: 'transferNote',
                text: (order) => `Envía tu comprobante de pago por correo a pagos@mitienda.com o por WhatsApp para validar tu orden. Indica el número de orden #${order.id} en el mensaje.`,
                highlight: 'Importante:'
            }
        }
    },
    online: { label: 'Pago en Línea', icon: '💳', detail: 'Pago en Línea' },
    card: { label: 'Tarjeta de Crédito/Débito', icon: '💳', detail: 'Tarjeta' },
    // Métodos de pago online específicos
    stripe: { label: 'Tarjeta de Crédito/Débito', icon: '💳', detail: 'Stripe' },
    paypal: { label: 'PayPal', icon: '🅿️', detail: 'PayPal' }
};

/**
 * Builds a resolved PAYMENT_METHODS config using dynamic transfer settings
 * @param {Object} transferConfig - Transfer config from paymentMethodsConfig.transfer
 * @returns {Object} - Merged PAYMENT_METHODS with dynamic values
 */
export const getResolvedPaymentMethods = (transferConfig) => {
    if (!transferConfig) return PAYMENT_METHODS;

    // Deep-clone transfer instructions and override with config values
    const resolvedTransfer = { ...PAYMENT_METHODS.transfer };
    const fields = PAYMENT_METHODS.transfer.instructions.fields.map(field => {
        // If field has a key and config provides a non-empty value, use it
        if (field.key && transferConfig[field.key]) {
            return { ...field, value: transferConfig[field.key] };
        }
        return field;
    });

    const note = { ...PAYMENT_METHODS.transfer.instructions.note };
    // Override note text if transferNote is configured
    if (transferConfig.transferNote) {
        note.text = transferConfig.transferNote;
    }

    resolvedTransfer.instructions = {
        ...PAYMENT_METHODS.transfer.instructions,
        fields,
        note
    };

    return { ...PAYMENT_METHODS, transfer: resolvedTransfer };
};

export const buildInvoiceData = ({
  order,
  customerInfo,
  items,
  siteName = 'Mi Tienda Online',
  siteIcon = '🛒',
  currencyCode
}) => {
  const orderDate = order?.created_at ? new Date(order.created_at) : new Date();
  const currentDate = orderDate.toLocaleDateString('es-DO', { year: 'numeric', month: '2-digit', day: '2-digit' });
  const currentTime = orderDate.toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit', hour12: true });

  // Normalize items to handle different data structures
  const normalizedItems = (items || []).map(item => {
    // Get the item name (support different field names)
    const itemName = item.name || item.product_name || 'Producto';
    // Get the item price (support different field names)
    const itemPrice = Number(item.price) || Number(item.unit_price) || 0;
    // Get quantity
    const itemQuantity = Number(item.quantity) || 1;
        const itemUnitType = item.unit_type || item.unitType;
    
    return {
      description: itemName,
      quantity: itemQuantity,
            quantityLabel: formatQuantityWithUnit(itemQuantity, itemUnitType),
            unitShortLabel: getUnitShortLabel(itemUnitType),
      unitPrice: itemPrice,
      taxPercent: '',
      taxes: '',
      amount: itemPrice * itemQuantity
    };
  });

  // Calculate subtotal from normalized items
  const subtotal = normalizedItems.reduce((sum, item) => sum + item.amount, 0);
  const shippingCost = Number(order?.shipping_cost) || Number(customerInfo?.shippingCost) || 0;

  return {
    companyName: siteName,
    companyIcon: siteIcon,
    companyAddress: 'Calle Principal #123, Santo Domingo',
    companyPhone: '829-334-6358',
    companyRNC: '123456789',
    companyLocation: 'República Dominicana',
    invoiceNumber: order?.order_number || `COT/${order?.id?.toString().padStart(6, '0')}`,
    date: currentDate,
    time: currentTime,
    customerName: `${customerInfo?.firstName || ''} ${customerInfo?.lastName || ''}`.trim(),
    customerEmail: customerInfo?.email || '',
    customerPhone: customerInfo?.phone || 'N/A',
    customerAddress: `${customerInfo?.address || ''}, ${customerInfo?.sector || ''}, ${customerInfo?.city || ''}`.replace(/^,\s*|,\s*,/g, '').trim(),
    customerID: customerInfo?.identification || 'N/A',
    seller: 'Sistema Online',
    paymentType: PAYMENT_METHODS[customerInfo?.paymentMethod]?.label || 'Pendiente',
    // Estado de pago considerando el método: COD se paga al entregar
    paymentStatus: getPaymentStatusLabel(order?.status, customerInfo?.paymentMethod),
    deliveryTime: '3-5 días hábiles',
    currency: currencyCode || 'USD',
    source: order?.order_number || order?.id?.toString(),
    items: normalizedItems,
    subtotal,
    shippingCost,
    shippingDistance: order?.shipping_distance || customerInfo?.shippingDistance || null,
    shippingCoordinates: order?.shipping_coordinates || customerInfo?.shippingCoordinates || null,
    total: subtotal + shippingCost
  };
};

export const generateInvoicePdfBlob = async (invoiceData) => {
  // Usamos React.createElement para evitar sintaxis JSX en archivo .js
  const blob = await pdf(React.createElement(InvoicePDF, { invoiceData })).toBlob();
  return blob;
};
