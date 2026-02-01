// routes/payments.routes.js - Stripe payment processing
const express = require('express');
const router = express.Router();
const { STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET } = require('../config');
const { statements } = require('../database');
const { authenticateToken } = require('../middleware/auth');

// Initialize Stripe
const stripe = STRIPE_SECRET_KEY ? require('stripe')(STRIPE_SECRET_KEY) : null;

/**
 * POST /api/payments/create-intent
 * Create a Stripe PaymentIntent for an order
 */
router.post('/create-intent', async (req, res) => {
    if (!stripe) {
        return res.status(503).json({ message: 'Stripe no está configurado' });
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
router.get('/config', (req, res) => {
    const { STRIPE_PUBLISHABLE_KEY } = require('../config');
    
    if (!STRIPE_PUBLISHABLE_KEY) {
        return res.status(503).json({ message: 'Stripe no está configurado' });
    }

    res.json({ 
        publishableKey: STRIPE_PUBLISHABLE_KEY,
        currency: 'dop'
    });
});

/**
 * GET /api/payments/saved-cards
 * Get customer's saved payment methods (cards)
 * Requires authentication
 */
router.get('/saved-cards', authenticateToken, async (req, res) => {
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

module.exports = router;
