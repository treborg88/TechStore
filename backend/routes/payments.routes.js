// routes/payments.routes.js - Stripe and PayPal payment processing
const express = require('express');
const router = express.Router();
const { 
    STRIPE_SECRET_KEY, 
    STRIPE_PUBLISHABLE_KEY, 
    STRIPE_WEBHOOK_SECRET,
    PAYPAL_CLIENT_ID,
    PAYPAL_CLIENT_SECRET,
    PAYPAL_MODE
} = require('../config');
const { statements } = require('../database');
const { authenticateToken } = require('../middleware/auth');
const { decryptSetting } = require('../services/encryption.service');

/**
 * Helper: Get Stripe instance using keys from DB or env vars
 * DB settings take priority over env vars
 */
async function getStripeInstance() {
    try {
        // Try to get keys from database (admin configured)
        const settings = await statements.getSettings();
        const settingsObj = {};
        for (const { id, value } of settings) {
            settingsObj[id] = value;
        }
        
        // Check for DB-configured secret key (encrypted)
        let secretKey = null;
        if (settingsObj.stripeSecretKey) {
            try {
                secretKey = decryptSetting(settingsObj.stripeSecretKey);
            } catch {
                // Decryption failed, key might be plain text or corrupted
                secretKey = null;
            }
        }
        
        // Fallback to env var if no DB key
        if (!secretKey) {
            secretKey = STRIPE_SECRET_KEY;
        }
        
        if (!secretKey) {
            return null;
        }
        
        return require('stripe')(secretKey);
    } catch (error) {
        console.error('Error getting Stripe instance:', error.message);
        // Fallback to env var
        if (STRIPE_SECRET_KEY) {
            return require('stripe')(STRIPE_SECRET_KEY);
        }
        return null;
    }
}

/**
 * Helper: Get Stripe publishable key from DB or env vars
 */
async function getPublishableKey() {
    try {
        const settings = await statements.getSettings();
        for (const { id, value } of settings) {
            if (id === 'stripePublishableKey' && value) {
                return value;
            }
        }
    } catch (error) {
        console.error('Error getting publishable key:', error.message);
    }
    return STRIPE_PUBLISHABLE_KEY;
}

/**
 * POST /api/payments/create-intent
 * Create a Stripe PaymentIntent for an order
 */
router.post('/create-intent', async (req, res) => {
    const stripe = await getStripeInstance();
    
    if (!stripe) {
        return res.status(503).json({ message: 'Stripe no está configurado. Configure las claves en Ajustes > Pagos.' });
    }

    const { amount, currency = 'dop', orderId, customerEmail, metadata = {} } = req.body;

    // Validate amount
    if (!amount || amount <= 0) {
        return res.status(400).json({ message: 'Monto inválido' });
    }

    try {
        // Convert amount to cents (Stripe uses smallest currency unit)
        const amountInCents = Math.round(amount * 100);

        // Create PaymentIntent
        const paymentIntent = await stripe.paymentIntents.create({
            amount: amountInCents,
            currency: currency.toLowerCase(),
            automatic_payment_methods: {
                enabled: true,
            },
            metadata: {
                orderId: orderId || '',
                ...metadata
            },
            receipt_email: customerEmail || undefined,
        });

        res.json({
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id
        });
    } catch (error) {
        console.error('Error creating PaymentIntent:', error.message);
        res.status(500).json({ 
            message: 'Error al crear el pago',
            detail: error.message 
        });
    }
});

/**
 * POST /api/payments/confirm
 * Confirm payment was successful and update order
 */
router.post('/confirm', async (req, res) => {
    const stripe = await getStripeInstance();
    
    if (!stripe) {
        return res.status(503).json({ message: 'Stripe no está configurado' });
    }

    const { paymentIntentId, orderId } = req.body;

    if (!paymentIntentId) {
        return res.status(400).json({ message: 'PaymentIntent ID requerido' });
    }

    try {
        // Verify payment with Stripe
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

        if (paymentIntent.status === 'succeeded') {
            // Update order status if orderId provided
            if (orderId) {
                // Update order status to 'paid' and payment_method to 'stripe'
                await statements.updateOrder(orderId, {
                    status: 'paid',
                    payment_method: 'stripe'
                });
                console.log('Order', orderId, 'updated to paid status');
            }

            res.json({ 
                success: true, 
                status: paymentIntent.status,
                message: 'Pago confirmado exitosamente'
            });
        } else {
            res.json({ 
                success: false, 
                status: paymentIntent.status,
                message: `Estado del pago: ${paymentIntent.status}`
            });
        }
    } catch (error) {
        console.error('Error confirming payment:', error.message);
        res.status(500).json({ 
            message: 'Error al confirmar el pago',
            detail: error.message 
        });
    }
});

/**
 * POST /api/payments/webhook
 * Handle Stripe webhook events
 * Note: This endpoint needs raw body, not JSON parsed
 */
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const stripe = await getStripeInstance();
    
    if (!stripe || !STRIPE_WEBHOOK_SECRET) {
        return res.status(503).json({ message: 'Webhook no configurado' });
    }

    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    switch (event.type) {
        case 'payment_intent.succeeded': {
            const paymentIntent = event.data.object;
            console.log('PaymentIntent succeeded:', paymentIntent.id);
            
            // Update order if orderId in metadata
            const orderId = paymentIntent.metadata?.orderId;
            if (orderId) {
                try {
                    await statements.updateOrder(parseInt(orderId), {
                        status: 'paid',
                        payment_method: 'stripe'
                    });
                    console.log('Order', orderId, 'marked as paid via webhook');
                } catch (err) {
                    console.error('Error updating order from webhook:', err.message);
                }
            }
            break;
        }

        case 'payment_intent.payment_failed': {
            const paymentIntent = event.data.object;
            console.log('Payment failed:', paymentIntent.id);
            
            const orderId = paymentIntent.metadata?.orderId;
            if (orderId) {
                try {
                    await statements.updateOrder(parseInt(orderId), {
                        status: 'cancelled'
                    });
                    console.error('Order', orderId, 'payment failed');
                } catch (err) {
                    console.error('Error updating failed payment:', err.message);
                }
            }
            break;
        }

        default:
            console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
});

/**
 * GET /api/payments/config
 * Get Stripe publishable key for frontend
 */
router.get('/config', async (req, res) => {
    const publishableKey = await getPublishableKey();
    
    if (!publishableKey) {
        return res.status(503).json({ message: 'Stripe no está configurado. Configure las claves en Ajustes > Pagos.' });
    }

    res.json({ 
        publishableKey,
        currency: 'dop'
    });
});

/**
 * GET /api/payments/saved-cards
 * Get customer's saved payment methods (cards)
 * Requires authentication
 */
router.get('/saved-cards', authenticateToken, async (req, res) => {
    const stripe = await getStripeInstance();
    
    if (!stripe) {
        return res.status(503).json({ message: 'Stripe no está configurado' });
    }

    try {
        const userId = req.user.id;
        const userEmail = req.user.email;

        // Search for existing Stripe customer by email
        const customers = await stripe.customers.list({
            email: userEmail,
            limit: 1
        });

        if (!customers.data.length) {
            return res.json({ cards: [] });
        }

        const customerId = customers.data[0].id;

        // Get payment methods for this customer
        const paymentMethods = await stripe.paymentMethods.list({
            customer: customerId,
            type: 'card'
        });

        // Map to simplified card data
        const cards = paymentMethods.data.map(pm => ({
            id: pm.id,
            brand: pm.card.brand,
            last4: pm.card.last4,
            expMonth: pm.card.exp_month,
            expYear: pm.card.exp_year,
            isDefault: pm.id === customers.data[0].invoice_settings?.default_payment_method
        }));

        res.json({ cards, customerId });
    } catch (error) {
        console.error('Error fetching saved cards:', error.message);
        res.status(500).json({ 
            message: 'Error al obtener tarjetas guardadas',
            detail: error.message 
        });
    }
});

/**
 * DELETE /api/payments/saved-cards/:cardId
 * Delete a saved payment method (card)
 * Requires authentication
 */
router.delete('/saved-cards/:cardId', authenticateToken, async (req, res) => {
    const stripe = await getStripeInstance();
    
    if (!stripe) {
        return res.status(503).json({ message: 'Stripe no está configurado' });
    }

    const { cardId } = req.params;

    if (!cardId) {
        return res.status(400).json({ message: 'ID de tarjeta requerido' });
    }

    try {
        const userEmail = req.user.email;

        // Verify the card belongs to this customer
        const paymentMethod = await stripe.paymentMethods.retrieve(cardId);
        
        if (paymentMethod.customer) {
            const customer = await stripe.customers.retrieve(paymentMethod.customer);
            if (customer.email !== userEmail) {
                return res.status(403).json({ message: 'No tienes permiso para eliminar esta tarjeta' });
            }
        }

        // Detach (delete) the payment method
        await stripe.paymentMethods.detach(cardId);

        res.json({ 
            success: true, 
            message: 'Tarjeta eliminada exitosamente' 
        });
    } catch (error) {
        console.error('Error deleting saved card:', error.message);
        res.status(500).json({ 
            message: 'Error al eliminar la tarjeta',
            detail: error.message 
        });
    }
});

// ============================================
// PayPal Payment Routes
// ============================================

/**
 * Helper: Get PayPal credentials from DB or env vars
 * DB settings take priority over env vars
 */
async function getPayPalCredentials() {
    try {
        const settings = await statements.getSettings();
        const settingsObj = {};
        for (const { id, value } of settings) {
            settingsObj[id] = value;
        }
        
        // Get clientId from DB
        let clientId = settingsObj.paypalClientId || null;
        
        // Get clientSecret from DB (encrypted)
        let clientSecret = null;
        if (settingsObj.paypalClientSecret) {
            try {
                clientSecret = decryptSetting(settingsObj.paypalClientSecret);
            } catch {
                clientSecret = null;
            }
        }
        
        // Get test mode from payment methods config
        let testMode = true;
        try {
            const paymentConfig = typeof settingsObj.paymentMethodsConfig === 'string'
                ? JSON.parse(settingsObj.paymentMethodsConfig)
                : settingsObj.paymentMethodsConfig;
            testMode = paymentConfig?.paypal?.testMode !== false;
        } catch {
            testMode = true;
        }
        
        // Fallback to env vars if no DB config
        if (!clientId) clientId = PAYPAL_CLIENT_ID;
        if (!clientSecret) clientSecret = PAYPAL_CLIENT_SECRET;
        
        // Use env PAYPAL_MODE or derive from testMode
        const mode = !testMode ? 'live' : (PAYPAL_MODE || 'sandbox');
        
        return { clientId, clientSecret, mode };
    } catch (error) {
        console.error('Error getting PayPal credentials:', error.message);
        // Fallback to env vars
        return { 
            clientId: PAYPAL_CLIENT_ID, 
            clientSecret: PAYPAL_CLIENT_SECRET, 
            mode: PAYPAL_MODE || 'sandbox' 
        };
    }
}

/**
 * Helper: Get PayPal access token
 */
async function getPayPalAccessToken() {
    const { clientId, clientSecret, mode } = await getPayPalCredentials();
    
    if (!clientId || !clientSecret) {
        return null;
    }
    
    const baseUrl = mode === 'live' 
        ? 'https://api-m.paypal.com' 
        : 'https://api-m.sandbox.paypal.com';
    
    try {
        const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
        const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: 'grant_type=client_credentials'
        });
        
        if (!response.ok) {
            console.error('PayPal auth failed:', await response.text());
            return null;
        }
        
        const data = await response.json();
        return { accessToken: data.access_token, baseUrl };
    } catch (error) {
        console.error('Error getting PayPal access token:', error.message);
        return null;
    }
}

/**
 * GET /api/payments/paypal/config
 * Get PayPal client ID for frontend
 */
router.get('/paypal/config', async (req, res) => {
    const { clientId } = await getPayPalCredentials();
    
    if (!clientId) {
        return res.status(503).json({ message: 'PayPal no está configurado. Configure las credenciales en Ajustes > Pagos.' });
    }
    
    res.json({ 
        clientId: clientId,
        currency: 'USD' // PayPal prefers USD, will convert from DOP
    });
});

/**
 * POST /api/payments/paypal/create-order
 * Create a PayPal order
 */
router.post('/paypal/create-order', async (req, res) => {
    const auth = await getPayPalAccessToken();
    
    if (!auth) {
        return res.status(503).json({ message: 'PayPal no está configurado. Configure las credenciales en Ajustes > Pagos.' });
    }
    
    const { amount, currency = 'USD', orderId, description = 'Compra en TechStore' } = req.body;
    
    if (!amount || amount <= 0) {
        return res.status(400).json({ message: 'Monto inválido' });
    }
    
    try {
        const response = await fetch(`${auth.baseUrl}/v2/checkout/orders`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${auth.accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                intent: 'CAPTURE',
                purchase_units: [{
                    amount: {
                        currency_code: currency.toUpperCase(),
                        value: amount.toFixed(2)
                    },
                    description: description,
                    custom_id: orderId ? String(orderId) : undefined
                }]
            })
        });
        
        if (!response.ok) {
            const errorData = await response.text();
            console.error('PayPal create order error:', errorData);
            return res.status(500).json({ message: 'Error al crear orden de PayPal' });
        }
        
        const order = await response.json();
        
        res.json({
            orderId: order.id,
            status: order.status
        });
    } catch (error) {
        console.error('Error creating PayPal order:', error.message);
        res.status(500).json({ 
            message: 'Error al crear el pago con PayPal',
            detail: error.message 
        });
    }
});

/**
 * POST /api/payments/paypal/capture-order
 * Capture (complete) a PayPal order after approval
 */
router.post('/paypal/capture-order', async (req, res) => {
    const auth = await getPayPalAccessToken();
    
    if (!auth) {
        return res.status(503).json({ message: 'PayPal no está configurado' });
    }
    
    const { paypalOrderId, orderId } = req.body;
    
    if (!paypalOrderId) {
        return res.status(400).json({ message: 'PayPal Order ID requerido' });
    }
    
    try {
        const response = await fetch(`${auth.baseUrl}/v2/checkout/orders/${paypalOrderId}/capture`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${auth.accessToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            const errorData = await response.text();
            console.error('PayPal capture error:', errorData);
            return res.status(500).json({ message: 'Error al capturar el pago de PayPal' });
        }
        
        const captureData = await response.json();
        
        // Check if payment was captured successfully
        if (captureData.status === 'COMPLETED') {
            // Update order status if orderId provided
            if (orderId) {
                await statements.updateOrder(orderId, {
                    status: 'paid',
                    payment_method: 'paypal'
                });
                console.log('Order', orderId, 'updated to paid status via PayPal');
            }
            
            res.json({
                success: true,
                status: captureData.status,
                captureId: captureData.purchase_units?.[0]?.payments?.captures?.[0]?.id,
                message: 'Pago completado exitosamente'
            });
        } else {
            res.json({
                success: false,
                status: captureData.status,
                message: `Estado del pago: ${captureData.status}`
            });
        }
    } catch (error) {
        console.error('Error capturing PayPal order:', error.message);
        res.status(500).json({ 
            message: 'Error al procesar el pago con PayPal',
            detail: error.message 
        });
    }
});

module.exports = router;
