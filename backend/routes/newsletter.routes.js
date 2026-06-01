// routes/newsletter.routes.js - Newsletter subscription routes
const express = require('express');
const router = express.Router();

const { statements } = require('../database');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST /api/newsletter/subscribe
 * Save a valid email in newsletter_subscribers
 */
router.post('/subscribe', async (req, res) => {
    const email = String(req.body?.email || '').toLowerCase().trim();

    if (!email) {
        return res.status(400).json({ message: 'Email es requerido' });
    }

    if (!EMAIL_REGEX.test(email)) {
        return res.status(400).json({ message: 'Formato de email inválido' });
    }

    try {
        await statements.addNewsletterSubscriber(email, 'home');
        return res.json({ success: true, message: 'Gracias por unirte a nuestra newsletter.' });
    } catch (error) {
        console.error('Error guardando suscripción a newsletter:', error);
        return res.status(500).json({ message: 'No se pudo registrar la suscripción' });
    }
});

module.exports = router;
