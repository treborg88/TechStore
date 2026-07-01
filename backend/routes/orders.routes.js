// routes/orders.routes.js - Order management routes
const express = require('express');
const router = express.Router();

const { statements, withTransaction } = require('../database');
const { authenticateToken, optionalAuth, requireAdmin } = require('../middleware/auth');
const { checkLimit } = require('../middleware/planLimits');
const { sendOrderEmail, getSettingsMap } = require('../services/email.service');
const { generateOrderNumber } = require('../utils/orderNumber');
const { normalizeProductUnitType } = require('../utils/productUnits');
const { trackLimiter } = require('../middleware/rateLimiter');

// Valid order statuses
const VALID_STATUSES = [
    'pending_payment', 'paid', 'to_ship', 'shipped', 'delivered',
    'return', 'refund', 'cancelled', 'pending', 'processing'
];

const VALID_PAYMENT_METHODS = ['cash', 'stripe', 'paypal', 'card', 'online', 'transfer'];

/**
 * Helper: Restore stock when order is cancelled/returned (supports variant stock).
 * Uses atomic RPCs — same functions as order creation, just incrementing.
 * Must be called inside a transaction alongside the status update.
 */
const restoreStockForOrder = async (orderId, oldStatus, newStatus) => {
    const isCancelledOrReturn = ['cancelled', 'return', 'refund'].includes(newStatus);
    const wasCancelledOrReturn = ['cancelled', 'return', 'refund'].includes(oldStatus);

    if (isCancelledOrReturn && !wasCancelledOrReturn) {
        console.log(`Restoring stock for order ${orderId} (${oldStatus} -> ${newStatus})`);
        const orderItems = await statements.getOrderItems(orderId);
        for (const item of orderItems) {
            if (item.variant_id) {
                await statements.incrementVariantStock(item.variant_id, item.quantity);
            } else {
                await statements.incrementStock(item.product_id, item.quantity);
            }
        }
    }
};

/**
 * GET /api/orders/counts
 * Get order counts grouped by status (admin only)
 */
router.get('/counts', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const counts = await statements.getOrderCounts();
        res.json(counts);
    } catch (error) {
        console.error('Error obteniendo conteos de órdenes:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

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
    const includeItems = req.query.includeItems === 'true';

    try {
        const { data: orders, total } = await statements.getOrdersPaginated(page, limit, search, status, paymentType, type);
        
        // Optionally attach items to each order (for analytics)
        let responseData = orders;
        if (includeItems) {
            responseData = await Promise.all(orders.map(async (order) => ({
                ...order,
                items: await statements.getOrderItems(order.id)
            })));
        }

        res.json({
            data: responseData,
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
 * Track orders by email (public) — rate limited to prevent customer email enumeration
 */
router.get('/track/email/:email', trackLimiter, async (req, res) => {
    const raw = req.params.email.trim().toLowerCase();

    // Validate email format before hitting the database
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(raw)) {
        return res.status(400).json({ message: 'Formato de email inválido' });
    }

    try {
        const orders = await statements.getOrdersByEmail(raw);
        
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

// ── Shared order-creation helpers ─────────────────────────────────────────────

/**
 * Runs all stock-reservation and DB writes for a new order inside a transaction.
 * Both the authenticated and guest routes delegate to this function.
 *
 * @param {object} opts
 * @param {number|null}  opts.userId
 * @param {array}        opts.items
 * @param {object}       opts.customer          - { name, email, phone }
 * @param {string}       opts.payment_method
 * @param {string}       opts.payment_status
 * @param {string}       opts.notes
 * @param {string}       opts.shipping_address
 * @param {string}       opts.shipping_street
 * @param {string}       opts.shipping_city
 * @param {string}       opts.shipping_postal_code
 * @param {string}       opts.shipping_sector
 * @param {number}       opts.shipping_cost
 * @param {number}       opts.shipping_distance
 * @param {object}       opts.shipping_coordinates
 * @param {boolean}      opts.clearCartAfter    - true for authenticated users
 */
async function createOrderCore({
    userId, items, customer,
    payment_method, payment_status,
    notes, shipping_address,
    shipping_street, shipping_city, shipping_postal_code, shipping_sector,
    shipping_cost, shipping_distance, shipping_coordinates,
    clearCartAfter
}) {
    let total = 0;
    const txItemDetails = [];

    for (const item of items) {
        const product = await statements.getProductById(item.product_id);
        if (!product) {
            const err = new Error(`Producto ${item.product_id} no encontrado`);
            err.httpStatus = 404;
            throw err;
        }

        let itemPrice = product.price;
        let variant = null;
        let variantSnapshot = null;

        if (item.variant_id) {
            // Variant item: decrement variant stock, resolve variant price
            variant = await statements.getVariantById(item.variant_id);
            // Coerce to Number — DB may return string IDs vs numeric IDs
            if (!variant || Number(variant.product_id) !== Number(product.id) || !variant.is_active) {
                const err = new Error(`Variante no válida para ${product.name}`);
                err.httpStatus = 400;
                throw err;
            }
            if (variant.price_override != null) itemPrice = variant.price_override;

            const reserved = await statements.decrementVariantStock(item.variant_id, item.quantity);
            if (!reserved) {
                const err = new Error(`Stock insuficiente para variante de ${product.name}`);
                err.httpStatus = 400;
                throw err;
            }
            // Build snapshot of attributes for order history
            variantSnapshot = (variant.attributes || []).map(a => ({ type: a.type, value: a.value }));
        } else {
            // Non-variant item: decrement product stock
            const reserved = await statements.decrementStockIfAvailable(product.id, item.quantity);
            if (!reserved) {
                const err = new Error(`Stock insuficiente para ${product.name}`);
                err.httpStatus = 400;
                throw err;
            }
        }

        // Snapshot the first gallery image so order history is independent of future product changes
        // Priority: variant_gallery > variant_single > product_gallery > product_legacy
        let imageUrl;
        if (item.variant_id) {
            const variantImg = await statements.getFirstVariantImage(item.variant_id);
            imageUrl = variantImg || variant?.image_url || null;
        }
        if (!imageUrl) {
            imageUrl = await statements.getFirstProductImage(product.id) || product.image || null;
        }

        txItemDetails.push({
            product_id: product.id,
            variant_id: item.variant_id || null,
            variant_attributes: variantSnapshot,
            name: product.name,
            quantity: item.quantity,
            price: itemPrice,
            unit_type: normalizeProductUnitType(product.unit_type),
            image_url: imageUrl,
            category: product.category || null
        });
        total += itemPrice * item.quantity;
    }
    total += parseFloat(shipping_cost) || 0;

    const paymentMethodValue = payment_method || 'cash';
    if (!VALID_PAYMENT_METHODS.includes(paymentMethodValue)) {
        const err = new Error('Método de pago inválido');
        err.httpStatus = 400;
        throw err;
    }

    const legacyAddress = notes || shipping_address ||
        [shipping_street, shipping_sector, shipping_city].filter(Boolean).join(', ');

    const orderResult = await statements.createOrder(
        userId, total, legacyAddress, paymentMethodValue,
        customer.name, customer.email, customer.phone,
        shipping_street, shipping_city, shipping_postal_code || '',
        shipping_sector || '', shipping_cost || 0,
        shipping_distance || null,
        shipping_coordinates ? JSON.stringify(shipping_coordinates) : null
    );
    const orderId = orderResult.lastInsertRowid;

    const onlinePaymentMethods = ['stripe', 'paypal', 'card', 'online'];
    const isPaidOnline = onlinePaymentMethods.includes(paymentMethodValue) && payment_status === 'paid';
    await statements.updateOrderStatus(isPaidOnline ? 'paid' : 'pending_payment', orderId);

    const orderNumber = generateOrderNumber(orderId);
    await statements.updateOrderNumber(orderNumber, orderId);

    for (const txItem of txItemDetails) {
        await statements.addOrderItem(
            orderId, txItem.product_id, txItem.quantity, txItem.price,
            txItem.variant_id, txItem.variant_attributes,
            txItem.name, txItem.unit_type, txItem.image_url, txItem.category
        );
    }

    if (clearCartAfter) {
        await statements.clearCart(userId);
    }

    return {
        order: await statements.getOrderById(orderId),
        itemDetails: txItemDetails,
        customer,
        shippingAddress: [shipping_street, shipping_sector, shipping_city].filter(Boolean).join(', ')
    };
}

/**
 * Sends order confirmation email if not suppressed by settings or skipEmail flag.
 * Always called outside the transaction (non-critical side-effect).
 */
async function sendOrderNotification(order, itemDetails, customer, shippingAddress, skipEmail) {
    let shouldSend = skipEmail !== true;
    if (shouldSend) {
        try {
            const emailSettings = await getSettingsMap();
            if (emailSettings.emailEnabled === 'false' || emailSettings.emailOrderConfirmation === 'false') {
                shouldSend = false;
            }
        } catch { /* default: send */ }
    }
    if (shouldSend) {
        const sent = await sendOrderEmail({ order, items: itemDetails, customer, shipping: { address: shippingAddress } });
        if (!sent) console.warn('Order email not sent for order', order.id);
    }
}

// ── Routes ────────────────────────────────────────────────────────────────────

/**
 * POST /api/orders
 * Create new order (authenticated user)
 */
router.post('/', authenticateToken, checkLimit('orders_month'), async (req, res) => {
    const {
        notes, shipping_address, items, payment_method, payment_status,
        customer_name, customer_email, customer_phone,
        shipping_street, shipping_city, shipping_postal_code, shipping_sector,
        shipping_cost, shipping_distance, shipping_coordinates
    } = req.body;

    if (!items || items.length === 0) {
        return res.status(400).json({ message: 'La orden debe tener al menos un producto' });
    }
    if (!shipping_street || !shipping_city) {
        return res.status(400).json({ message: 'Se requiere dirección completa (calle, ciudad)' });
    }

    try {
        const customer = {
            name: (customer_name && customer_name.trim()) || req.user.name,
            email: (customer_email || req.user.email || '').trim().toLowerCase(),
            phone: customer_phone ? customer_phone.trim() : ''
        };

        const { order, itemDetails, shippingAddress } = await withTransaction(() =>
            createOrderCore({
                userId: req.user.id, items, customer,
                payment_method, payment_status,
                notes, shipping_address,
                shipping_street, shipping_city, shipping_postal_code, shipping_sector,
                shipping_cost, shipping_distance, shipping_coordinates,
                clearCartAfter: true
            })
        );

        await sendOrderNotification(order, itemDetails, customer, shippingAddress, req.body.skipEmail);

        console.log('Orden creada:', order);
        res.status(201).json(order);

    } catch (error) {
        console.error('Error creando orden:', error);
        if (error.httpStatus) return res.status(error.httpStatus).json({ message: error.message });
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

/**
 * POST /api/orders/guest
 * Create order as guest (no authentication)
 */
router.post('/guest', checkLimit('orders_month'), async (req, res) => {
    const {
        notes, shipping_address, items, customer_info, payment_method, payment_status,
        shipping_street, shipping_city, shipping_postal_code, shipping_sector,
        shipping_cost, shipping_distance, shipping_coordinates
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

    try {
        const customer = {
            name: (customer_info.name && customer_info.name.trim()) || 'Cliente Invitado',
            email: customer_info.email.trim().toLowerCase(),
            phone: customer_info.phone ? customer_info.phone.trim() : ''
        };

        const { order, itemDetails, shippingAddress } = await withTransaction(() =>
            createOrderCore({
                userId: null, items, customer,
                payment_method, payment_status,
                notes, shipping_address,
                shipping_street, shipping_city, shipping_postal_code, shipping_sector,
                shipping_cost, shipping_distance, shipping_coordinates,
                clearCartAfter: false
            })
        );

        await sendOrderNotification(order, itemDetails, customer, shippingAddress, req.body.skipEmail);

        console.log('Orden de invitado creada:', order);
        res.status(201).json(order);

    } catch (error) {
        console.error('Error creando orden de invitado:', error);
        if (error.httpStatus) return res.status(error.httpStatus).json({ message: error.message });
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

/**
 * POST /api/orders/:id/invoice-email
 * Send invoice email with PDF attachment
 */
router.post('/:id/invoice-email', optionalAuth, async (req, res) => {
    const orderId = parseInt(req.params.id, 10);
    const { pdfBase64, email } = req.body || {};

    // Check master email toggle
    try {
        const emailSettings = await getSettingsMap();
        if (emailSettings.emailEnabled === 'false') {
            return res.status(400).json({ message: 'El envío de correos está deshabilitado' });
        }
    } catch { /* default: allow */ }

    // Validate required params
    if (!orderId || isNaN(orderId)) {
        return res.status(400).json({ message: 'ID de orden inválido' });
    }

    if (!pdfBase64 || typeof pdfBase64 !== 'string') {
        return res.status(400).json({ message: 'Falta el PDF o formato inválido' });
    }

    try {
        const order = await statements.getOrderById(orderId);
        if (!order) {
            return res.status(404).json({ message: 'Orden no encontrada' });
        }

        const orderEmail = (order.customer_email || '').trim().toLowerCase();
        const requestEmail = (email || '').trim().toLowerCase();

        // ── Ownership gate ──────────────────────────────────────────────────────
        // Admin: always allowed.
        // Authenticated user: must own the order.
        // Guest (no token): email param is required and must match order email.
        if (req.user) {
            if (req.user.role !== 'admin' && order.user_id !== req.user.id) {
                return res.status(403).json({ message: 'No autorizado para esta orden' });
            }
        } else {
            // Guest path — require explicit, matching email (no silent fallback)
            if (!requestEmail) {
                return res.status(401).json({ message: 'Se requiere autenticación o email de la orden' });
            }
            if (orderEmail && requestEmail !== orderEmail) {
                return res.status(403).json({ message: 'Email no autorizado para esta orden' });
            }
        }
        // ───────────────────────────────────────────────────────────────────────

        // Determine recipient: admin may override with a different address;
        // authenticated users and guests send to the order's email.
        const recipientEmail = (req.user?.role === 'admin' && requestEmail) ? requestEmail : orderEmail;

        const items = await statements.getOrderItems(orderId);
        const itemDetails = items.map((item) => ({
            name: item.name,
            quantity: item.quantity,
            price: item.price
        }));

        // Clean and validate base64 PDF
        const cleanBase64 = String(pdfBase64).replace(/^data:application\/pdf;base64,/, '');
        if (!cleanBase64 || cleanBase64.length < 100) {
            console.error('invoice-email: PDF base64 too short or invalid');
            return res.status(400).json({ message: 'PDF inválido o vacío' });
        }

        const attachment = {
            filename: `factura-${order.order_number || order.id}.pdf`,
            content: Buffer.from(cleanBase64, 'base64'),
            contentType: 'application/pdf'
        };

        const shippingAddress = [order.shipping_street, order.shipping_sector, order.shipping_city]
            .filter(Boolean)
            .join(', ') || order.shipping_address || '';

        console.log('invoice-email: Attempting to send to', recipientEmail, 'for order', order.order_number || orderId);

        // First attempt: send with PDF attachment
        let attachmentError = null;
        
        try {
            await sendOrderEmail({
                order,
                items: itemDetails,
                customer: {
                    name: order.customer_name || 'Cliente',
                    email: recipientEmail,
                    phone: order.customer_phone || ''
                },
                shipping: { address: shippingAddress },
                attachment
            });
            console.log('invoice-email: Sent successfully with attachment to', recipientEmail);
            return res.json({ message: 'Correo enviado con adjunto', email: recipientEmail });
        } catch (error) {
            attachmentError = error;
            console.error('invoice-email: Error with attachment, will try without:', error.message);
        }

        // Fallback: try without attachment
        console.log('invoice-email: Trying fallback without attachment...');
        try {
            await sendOrderEmail({
                order,
                items: itemDetails,
                customer: {
                    name: order.customer_name || 'Cliente',
                    email: recipientEmail,
                    phone: order.customer_phone || ''
                },
                shipping: { address: shippingAddress }
            });
            console.log('invoice-email: Sent without attachment to', recipientEmail);
            return res.json({ message: 'Correo enviado sin adjunto', email: recipientEmail });
        } catch (fallbackError) {
            // Both attempts failed
            console.error('invoice-email: Both attempts failed for order', orderId);
            console.error('invoice-email: Attachment error:', attachmentError?.message);
            console.error('invoice-email: Fallback error:', fallbackError?.message);
            
            // Return detailed error message
            const errorDetail = fallbackError?.message || attachmentError?.message || 'Error desconocido';
            return res.status(500).json({ 
                message: 'No se pudo enviar el correo. Verifica la configuración de email.',
                detail: errorDetail
            });
        }
    } catch (error) {
        console.error('invoice-email: Server error:', error);
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

        // Wrap update + stock restoration in one transaction so they succeed or fail together
        const order = await withTransaction(async () => {
            const result = await statements.updateOrder(orderId, filteredUpdates);
            if (!result) {
                const err = new Error('Orden no encontrada');
                err.httpStatus = 404;
                throw err;
            }
            if (filteredUpdates.status) {
                await restoreStockForOrder(orderId, currentOrder.status, filteredUpdates.status);
            }
            return statements.getOrderById(orderId);
        });

        console.log('Orden actualizada:', order);
        res.json({ message: 'Orden actualizada exitosamente', order });
    } catch (error) {
        console.error('Error actualizando orden:', error);
        if (error.httpStatus) return res.status(error.httpStatus).json({ message: error.message });
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

        // Wrap status update + stock restoration in one transaction so they succeed or fail together
        const order = await withTransaction(async () => {
            const result = await statements.updateOrderStatus(status, orderId);
            if (!result) {
                const err = new Error('Orden no encontrada');
                err.httpStatus = 404;
                throw err;
            }
            await restoreStockForOrder(orderId, currentOrder.status, status);
            return statements.getOrderById(orderId);
        });

        console.log('Estado de orden actualizado:', order);
        res.json({ message: 'Estado actualizado exitosamente', order });
    } catch (error) {
        console.error('Error actualizando estado:', error);
        if (error.httpStatus) return res.status(error.httpStatus).json({ message: error.message });
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
