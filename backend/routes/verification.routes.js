// routes/verification.routes.js - Email verification routes
const express = require('express');
const router = express.Router();

const { statements } = require('../database');
const { sendMailWithSettings } = require('../services/email.service');
const { EMAIL_USER } = require('../config');

/**
 * POST /api/verification/send-code
 * Send verification code to email
 */
router.post('/send-code', async (req, res) => {
    const { email, purpose } = req.body;

    if (!email) {
        return res.status(400).json({ message: 'Email es requerido' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Expires in 10 minutes
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    try {
        // Delete previous codes for this email and purpose
        await statements.deleteVerificationCodes(normalizedEmail, purpose || 'general');

        // Save new code
        await statements.createVerificationCode(normalizedEmail, code, purpose || 'general', expiresAt);

        // Send email
        const mailOptions = {
            from: EMAIL_USER || 'noreply@techstore.com',
            to: normalizedEmail,
            subject: 'Tu código de verificación - TechStore',
            text: `Tu código de verificación es: ${code}. Este código expira en 10 minutos.`,
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                    <h2 style="color: #007bff;">Código de Verificación</h2>
                    <p>Hola,</p>
                    <p>Tu código de verificación para TechStore es:</p>
                    <h1 style="letter-spacing: 5px; background: #f4f4f4; padding: 10px; display: inline-block; border-radius: 5px;">${code}</h1>
                    <p>Este código expira en 10 minutos.</p>
                    <p>Si no solicitaste este código, puedes ignorar este correo.</p>
                </div>
            `
        };

        try {
            await sendMailWithSettings(mailOptions);
        } catch (emailError) {
            console.error('Error enviando email:', emailError);
            return res.status(500).json({ message: 'Error al enviar el correo de verificación' });
        }

        res.json({ success: true, message: 'Código enviado correctamente' });

    } catch (error) {
        console.error('Error generando código:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

/**
 * POST /api/verification/verify-code
 * Verify a code
 */
router.post('/verify-code', async (req, res) => {
    const { email, code, purpose } = req.body;

    if (!email || !code) {
        return res.status(400).json({ message: 'Email y código son requeridos' });
    }

    try {
        const normalizedEmail = email.toLowerCase().trim();
        const record = await statements.getVerificationCode(normalizedEmail, code, purpose || 'general');

        if (record) {
            // Don't delete if for registration or password reset
            // Those routes need to verify the code a second time
            if (purpose !== 'register' && purpose !== 'password_reset') {
                await statements.deleteVerificationCodes(normalizedEmail, purpose || 'general');
            }
            res.json({ success: true, message: 'Código verificado correctamente' });
        } else {
            res.status(400).json({ message: 'Código inválido o expirado' });
        }
    } catch (error) {
        console.error('Error verificando código:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

module.exports = router;
