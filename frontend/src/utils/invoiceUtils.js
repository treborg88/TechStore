// invoiceUtils.js - Funciones auxiliares para facturación
import { pdf } from '@react-pdf/renderer';
import React from 'react';
import { InvoicePDF } from '../components/common/InvoicePDF';

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

export const PAYMENT_METHODS = {
    cash: { 
        label: 'Pago Contra Entrega', 
        icon: '💵', 
        detail: 'Efectivo al Recibir',
        instructions: {
            fields: [
                { label: 'Tipo de Pago', value: 'Efectivo al Recibir' },
                { label: 'Estado del Pedido', getValue: (order) => ['paid', 'delivered'].includes(order.status) ? 'Pagado' : 'Pendiente de Pago' },
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
                { label: 'Banco', value: 'Banco Ejemplo' },
                { label: 'Titular', value: 'Mi Tienda Online' },
                { label: 'Cuenta / CLABE', value: '1234-5678-9012-3456' }
            ],
            amountLabel: 'Monto a Pagar',
            note: {
                icon: '⚠️',
                text: (order) => `Envía tu comprobante de pago por correo a pagos@mitienda.com o por WhatsApp para validar tu orden. Indica el número de orden #${order.id} en el mensaje.`,
                highlight: 'Importante:'
            }
        }
    },
    online: { label: 'Pago en Línea', icon: '💳', detail: 'Pago en Línea' },
    card: { label: 'Tarjeta de Crédito/Débito', icon: '💳', detail: 'Tarjeta' }
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
    paymentStatus: ['paid', 'delivered'].includes(order?.status) ? 'Pagado' : 'Pendiente',
    deliveryTime: '3-5 días hábiles',
    currency: currencyCode || 'USD',
    source: order?.order_number || order?.id?.toString(),
    items: (items || []).map(item => ({
      description: item.name,
      quantity: item.quantity,
      unitPrice: item.price,
      taxPercent: '',
      taxes: '',
      amount: item.price * item.quantity
    })),
    total: order?.total || 0
  };
};

export const generateInvoicePdfBlob = async (invoiceData) => {
  // Usamos React.createElement para evitar sintaxis JSX en archivo .js
  const blob = await pdf(React.createElement(InvoicePDF, { invoiceData })).toBlob();
  return blob;
};
