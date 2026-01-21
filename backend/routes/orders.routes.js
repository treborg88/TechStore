// routes/orders.routes.js - Order management routes
const express = require('express');
const router = express.Router();

const { statements } = require('../database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { sendOrderEmail } = require('../services/email.service');
const { generateOrderNumber } = require('../utils/orderNumber');

// Valid order statuses
const VALID_STATUSES = [
    'pending_payment', 'paid', 'to_ship', 'shipped', 'delivered', 
    'return', 'refund', 'cancelled', 'pending', 'processing'
];

/**
 * Helper: Rollback reserved stock on error
 */
const rollbackReservedStock = async (reservedItems) => {
    for (const item of reservedItems) {
        try {
            await statements.incrementStock(item.product_id, item.quantity);
        } catch (rollbackError) {
            console.error('Error rollback stock:', rollbackError);
        }
    }
};

/**
 * Helper: Restore stock when order is cancelled/returned
 */
const restoreStockForOrder = async (orderId, oldStatus, newStatus) => {
    const isCancelledOrReturn = ['cancelled', 'return', 'refund'].includes(newStatus);
    const wasCancelledOrReturn = ['cancelled', 'return', 'refund'].includes(oldStatus);

    if (isCancelledOrReturn && !wasCancelledOrReturn) {
        console.log(`Restoring stock for order ${orderId} (Status: ${oldStatus} -> ${newStatus})`);
        const orderItems = await statements.getOrderItems(orderId);
        for (const item of orderItems) {
            const product = await statements.getProductById(item.product_id);
            if (product) {
                const newStock = product.stock + item.quantity;
                await statements.updateProduct(
                    product.name,
                    product.description,
                    product.price,
                    product.category,
                    newStock,
                    item.product_id
                );
            }
        }
    }
};

/**
 * GET /api/orders
 * Get all orders (admin only)
 */
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || '';
    const status = req.query.status || 'all';
    const paymentType = req.query.paymentType || 'all';
    const type = req.query.type || 'all';

    try {
        const { data: orders, total } = await statements.getOrdersPaginated(page, limit, search, status, paymentType, type);
        
        res.json({
            data: orders,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        });
    } catch (error) {
        console.error('Error obteniendo órdenes:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

/**
 * GET /api/orders/my
 * Get current user's orders
 */
router.get('/my', authenticateToken, async (req, res) => {
    try {
        const orders = await statements.getOrdersByUserId(req.user.id);
        
        const ordersWithItems = await Promise.all(orders.map(async (order) => ({
            ...order,
            items: await statements.getOrderItems(order.id)
        })));
        
        res.json(ordersWithItems);
    } catch (error) {
        console.error('Error obteniendo mis órdenes:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

/**
 * GET /api/orders/track/:id
 * Track order by ID or order number (public)
 */
router.get('/track/:id', async (req, res) => {
    const param = req.params.id;
    const orderId = parseInt(param, 10);

    try {
        let order;
        
        if (!isNaN(orderId) && orderId.toString() === param) {
            order = await statements.getOrderWithCustomerById(orderId);
        } else {
            order = await statements.getOrderByNumber(param);
        }
        
        if (!order) {
            return res.status(404).json({ message: 'Orden no encontrada' });
        }

        const orderItems = await statements.getOrderItems(order.id);
        
        res.json({
            ...order,
            items: orderItems
        });
    } catch (error) {
        console.error('Error buscando orden:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

/**
 * GET /api/orders/track/email/:email
 * Track orders by email (public)
 */
router.get('/track/email/:email', async (req, res) => {
    const email = req.params.email.trim().toLowerCase();

    try {
        const orders = await statements.getOrdersByEmail(email);
        
        if (!orders || orders.length === 0) {
            return res.status(404).json({ message: 'No se encontraron órdenes' });
        }

        const ordersWithItems = await Promise.all(orders.map(async (order) => ({
            ...order,
            items: await statements.getOrderItems(order.id)
        })));
        
        res.json(ordersWithItems);
    } catch (error) {
        console.error('Error buscando órdenes por email:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

/**
 * GET /api/orders/:id
 * Get order details with items
 */
router.get('/:id', authenticateToken, async (req, res) => {
    const orderId = parseInt(req.params.id, 10);

    try {
        const order = await statements.getOrderWithCustomerById(orderId);
        
        if (!order) {
            return res.status(404).json({ message: 'Orden no encontrada' });
        }

        // Check authorization
        if (req.user.role !== 'admin' && order.user_id !== req.user.id) {
            return res.status(403).json({ message: 'Acceso denegado' });
        }

        const orderItems = await statements.getOrderItems(orderId);
        
        res.json({
            ...order,
            items: orderItems
        });
    } catch (error) {
        console.error('Error obteniendo orden:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

/**
 * POST /api/orders
 * Create new order (authenticated user)
 */
router.post('/', authenticateToken, async (req, res) => {
    const { 
        notes, shipping_address, items, payment_method, 
        customer_name, customer_email, customer_phone, 
        shipping_street, shipping_city, shipping_postal_code, shipping_sector 
    } = req.body;

    if (!items || items.length === 0) {
        return res.status(400).json({ message: 'La orden debe tener al menos un producto' });
    }

    if (!shipping_street || !shipping_city) {
        return res.status(400).json({ message: 'Se requiere dirección completa (calle, ciudad)' });
    }

    let total = 0;
    let orderId = null;
    const reservedItems = [];
    const itemDetails = [];

    try {
        // Calculate total and reserve stock
        for (const item of items) {
            const product = await statements.getProductById(item.product_id);
            if (!product) {
                await rollbackReservedStock(reservedItems);
                return res.status(404).json({ message: `Producto ${item.product_id} no encontrado` });
            }

            const reserved = await statements.decrementStockIfAvailable(product.id, item.quantity);
            if (!reserved) {
                await rollbackReservedStock(reservedItems);
                return res.status(400).json({ message: `Stock insuficiente para ${product.name}` });
            }

            reservedItems.push({ product_id: product.id, quantity: item.quantity });
            itemDetails.push({ product_id: product.id, name: product.name, quantity: item.quantity, price: product.price });
            total += product.price * item.quantity;
        }

        const paymentMethodValue = payment_method || 'cash';
        const legacyAddress = notes || shipping_address || [shipping_street, shipping_sector, shipping_city].filter(Boolean).join(', ');
        
        const resolvedCustomerName = (customer_name && customer_name.trim()) || req.user.name;
        const resolvedCustomerEmail = (customer_email || req.user.email || '').trim().toLowerCase();
        const resolvedCustomerPhone = customer_phone ? customer_phone.trim() : '';

        const orderResult = await statements.createOrder(
            req.user.id, 
            total, 
            legacyAddress,
            paymentMethodValue,
            resolvedCustomerName,
            resolvedCustomerEmail,
            resolvedCustomerPhone,
            shipping_street,
            shipping_city,
            shipping_postal_code || '',
            shipping_sector || ''
        );
        orderId = orderResult.lastInsertRowid;

        await statements.updateOrderStatus('pending_payment', orderId);

        const orderNumber = generateOrderNumber(orderId);
        await statements.updateOrderNumber(orderNumber, orderId);

        for (const item of itemDetails) {
            await statements.addOrderItem(orderId, item.product_id, item.quantity, item.price);
        }

        await statements.clearCart(req.user.id);

        const order = await statements.getOrderById(orderId);
        
        if (req.body.skipEmail !== true) {
            const emailSent = await sendOrderEmail({
                order,
                items: itemDetails,
                customer: {
                    name: resolvedCustomerName,
                    email: resolvedCustomerEmail,
                    phone: resolvedCustomerPhone
                },
                shipping: {
                    address: [shipping_street, shipping_sector, shipping_city].filter(Boolean).join(', ')
                }
            });
            if (!emailSent) {
                console.warn('Order email not sent for order', orderId);
            }
        }
        
        console.log('Orden creada:', order);
        res.status(201).json(order);
    } catch (error) {
        console.error('Error creando orden:', error);
        await rollbackReservedStock(reservedItems);
        if (orderId) {
            try {
                await statements.updateOrderStatus('cancelled', orderId);
            } catch (statusError) {
                console.error('Error marcando orden como cancelada:', statusError);
            }
        }
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

/**
 * POST /api/orders/guest
 * Create order as guest (no authentication)
 */
router.post('/guest', async (req, res) => {
    const { 
        notes, shipping_address, items, customer_info, payment_method, 
        shipping_street, shipping_city, shipping_postal_code, shipping_sector 
    } = req.body;

    if (!items || items.length === 0) {
        return res.status(400).json({ message: 'La orden debe tener al menos un producto' });
    }

    if (!shipping_street || !shipping_city) {
        return res.status(400).json({ message: 'Se requiere dirección completa (calle, ciudad)' });
    }

    if (!customer_info || !customer_info.email) {
        return res.status(400).json({ message: 'Se requiere información del cliente (email)' });
    }

    let total = 0;
    let orderId = null;
    const reservedItems = [];
    const itemDetails = [];

    try {
        for (const item of items) {
            const product = await statements.getProductById(item.product_id);
            if (!product) {
                await rollbackReservedStock(reservedItems);
                return res.status(404).json({ message: `Producto ${item.product_id} no encontrado` });
            }

            const reserved = await statements.decrementStockIfAvailable(product.id, item.quantity);
            if (!reserved) {
                await rollbackReservedStock(reservedItems);
                return res.status(400).json({ message: `Stock insuficiente para ${product.name}` });
            }

            reservedItems.push({ product_id: product.id, quantity: item.quantity });
            itemDetails.push({ product_id: product.id, name: product.name, quantity: item.quantity, price: product.price });
            total += product.price * item.quantity;
        }

        const paymentMethodValue = payment_method || 'cash';
        const legacyAddress = notes || shipping_address || [shipping_street, shipping_sector, shipping_city].filter(Boolean).join(', ');
        const guestName = (customer_info.name && customer_info.name.trim()) || 'Cliente Invitado';
        const guestEmail = customer_info.email.trim().toLowerCase();
        const guestPhone = customer_info.phone ? customer_info.phone.trim() : '';

        const orderResult = await statements.createOrder(
            null,
            total,
            legacyAddress,
            paymentMethodValue,
            guestName,
            guestEmail,
            guestPhone,
            shipping_street,
            shipping_city,
            shipping_postal_code || '',
            shipping_sector || ''
        );
        orderId = orderResult.lastInsertRowid;

        await statements.updateOrderStatus('pending_payment', orderId);

        const orderNumber = generateOrderNumber(orderId);
        await statements.updateOrderNumber(orderNumber, orderId);

        for (const item of itemDetails) {
            await statements.addOrderItem(orderId, item.product_id, item.quantity, item.price);
        }

        const order = await statements.getOrderById(orderId);
        
        if (req.body.skipEmail !== true) {
            const emailSent = await sendOrderEmail({
                order,
                items: itemDetails,
                customer: {
                    name: guestName,
                    email: guestEmail,
                    phone: guestPhone
                },
                shipping: {
                    address: [shipping_street, shipping_sector, shipping_city].filter(Boolean).join(', ')
                }
            });
            if (!emailSent) {
                console.warn('Order email not sent for guest order', orderId);
            }
        }
        
        console.log('Orden de invitado creada:', order);
        res.status(201).json(order);
    } catch (error) {
        console.error('Error creando orden de invitado:', error);
        await rollbackReservedStock(reservedItems);
        if (orderId) {
            try {
                await statements.updateOrderStatus('cancelled', orderId);
            } catch (statusError) {
                console.error('Error marcando orden como cancelada:', statusError);
            }
        }
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

/**
 * POST /api/orders/:id/invoice-email
 * Send invoice email with PDF attachment
 */
router.post('/:id/invoice-email', async (req, res) => {
    const orderId = parseInt(req.params.id, 10);
    const { pdfBase64, email } = req.body || {};

    if (!orderId || !pdfBase64) {
        return res.status(400).json({ message: 'Falta el PDF o el ID de la orden' });
    }

    try {
        const order = await statements.getOrderById(orderId);
        if (!order) {
            return res.status(404).json({ message: 'Orden no encontrada' });
        }

        const orderEmail = (order.customer_email || '').trim().toLowerCase();
        const requestEmail = (email || orderEmail).trim().toLowerCase();
        if (orderEmail && requestEmail && orderEmail !== requestEmail) {
            return res.status(403).json({ message: 'Email no autorizado para esta orden' });
        }

        const items = await statements.getOrderItems(orderId);
        const itemDetails = items.map((item) => ({
            name: item.name,
            quantity: item.quantity,
            price: item.price
        }));

        const cleanBase64 = String(pdfBase64).replace(/^data:application\/pdf;base64,/, '');
        const attachment = {
            filename: `factura-${order.order_number || order.id}.pdf`,
            content: Buffer.from(cleanBase64, 'base64'),
            contentType: 'application/pdf'
        };

        const shippingAddress = [order.shipping_street, order.shipping_sector, order.shipping_city]
            .filter(Boolean)
            .join(', ') || order.shipping_address || '';

        let emailSent = false;
        try {
            emailSent = await sendOrderEmail({
                order,
                items: itemDetails,
                customer: {
                    name: order.customer_name || 'Cliente',
                    email: orderEmail || requestEmail,
                    phone: order.customer_phone || ''
                },
                shipping: { address: shippingAddress },
                attachment
            });
        } catch (error) {
            console.error('Error adjuntando factura, enviando sin adjunto:', error);
        }

        if (!emailSent) {
            const fallbackSent = await sendOrderEmail({
                order,
                items: itemDetails,
                customer: {
                    name: order.customer_name || 'Cliente',
                    email: orderEmail || requestEmail,
                    phone: order.customer_phone || ''
                },
                shipping: { address: shippingAddress }
            });

            if (!fallbackSent) {
                return res.status(500).json({ message: 'No se pudo enviar el correo' });
            }

            return res.json({ message: 'Correo enviado sin adjunto' });
        }

        return res.json({ message: 'Correo enviado con adjunto' });
    } catch (error) {
        console.error('Error enviando factura adjunta:', error);
        return res.status(500).json({ message: 'Error interno del servidor' });
    }
});

/**
 * PUT /api/orders/:id
 * Update order details (admin only)
 */
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
    const orderId = parseInt(req.params.id, 10);
    const updates = req.body;

    const allowedFields = ['status', 'internal_notes', 'carrier', 'tracking_number', 'shipping_address', 'shipping_street', 'shipping_city', 'shipping_sector', 'shipping_postal_code'];
    const filteredUpdates = {};
    
    Object.keys(updates).forEach(key => {
        if (allowedFields.includes(key)) {
            filteredUpdates[key] = updates[key];
        }
    });

    if (Object.keys(filteredUpdates).length === 0) {
        return res.status(400).json({ message: 'No se proporcionaron campos válidos para actualizar' });
    }

    if (filteredUpdates.status && !VALID_STATUSES.includes(filteredUpdates.status)) {
        return res.status(400).json({ 
            message: `Estado inválido. Debe ser uno de: ${VALID_STATUSES.join(', ')}` 
        });
    }

    try {
        const currentOrder = await statements.getOrderById(orderId);
        if (!currentOrder) {
             return res.status(404).json({ message: 'Orden no encontrada' });
        }

        const result = await statements.updateOrder(orderId, filteredUpdates);
        
        if (result) {
            if (filteredUpdates.status) {
                await restoreStockForOrder(orderId, currentOrder.status, filteredUpdates.status);
            }

            const order = await statements.getOrderById(orderId);
            console.log('Orden actualizada:', order);
            res.json({ message: 'Orden actualizada exitosamente', order });
        } else {
            res.status(404).json({ message: 'Orden no encontrada' });
        }
    } catch (error) {
        console.error('Error actualizando orden:', error);
        if (error.code === '42703') {
            return res.status(500).json({ message: 'Error de base de datos: Faltan columnas (internal_notes, carrier, tracking_number). Por favor ejecuta la migración.' });
        }
        res.status(500).json({ message: 'Error interno del servidor: ' + error.message });
    }
});

/**
 * PUT /api/orders/:id/status
 * Update order status (admin only)
 */
router.put('/:id/status', authenticateToken, requireAdmin, async (req, res) => {
    const orderId = parseInt(req.params.id, 10);
    const { status } = req.body;

    if (!VALID_STATUSES.includes(status)) {
        return res.status(400).json({ 
            message: `Estado inválido. Debe ser uno de: ${VALID_STATUSES.join(', ')}` 
        });
    }

    try {
        const currentOrder = await statements.getOrderById(orderId);
        if (!currentOrder) {
             return res.status(404).json({ message: 'Orden no encontrada' });
        }

        const result = await statements.updateOrderStatus(status, orderId);
        
        if (result) {
            await restoreStockForOrder(orderId, currentOrder.status, status);

            const order = await statements.getOrderById(orderId);
            console.log('Estado de orden actualizado:', order);
            res.json({ message: 'Estado actualizado exitosamente', order });
        } else {
            res.status(404).json({ message: 'Orden no encontrada' });
        }
    } catch (error) {
        console.error('Error actualizando estado:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

/**
 * DELETE /api/orders/:id
 * Delete order (admin only)
 */
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
    const orderId = parseInt(req.params.id, 10);

    try {
        const result = await statements.deleteOrder(orderId);
        
        if (result) {
            console.log('Orden eliminada:', orderId);
            res.json({ message: 'Orden eliminada exitosamente' });
        } else {
            res.status(404).json({ message: 'Orden no encontrada' });
        }
    } catch (error) {
        console.error('Error eliminando orden:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

module.exports = router;
