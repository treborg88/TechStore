// routes/verification.routes.js - Email verification routes
const express = require('express');
const router = express.Router();

const { statements } = require('../database');
const { sendMailWithSettings, getSettingsMap } = require('../services/email.service');
const config = require('../config');
const { EMAIL_USER, TEST_BYPASS_EMAIL } = config;

// Returns true when the email matches a TEST_BYPASS_EMAIL entry.
// Entries can be exact addresses (test@example.com) or domain suffixes (@example.com).
const isTestBypassEmail = (email) => {
    if (!TEST_BYPASS_EMAIL) return false;
    const lower = email.toLowerCase();
    return TEST_BYPASS_EMAIL.split(',').map(e => e.trim().toLowerCase()).some(
        entry => entry.startsWith('@') ? lower.endsWith(entry) : lower === entry
    );
};

/**
 * POST /api/verification/send-code
 * Send verification code to email
 * Respects per-purpose email toggles (registration, guest checkout)
 */
router.post('/send-code', async (req, res) => {
    const { email, purpose } = req.body;

    if (!email) {
        return res.status(400).json({ message: 'Email es requerido' });
    }

    // Check email feature toggles — skip verification if disabled globally or per purpose
    try {
        const settings = await getSettingsMap();
        // Master toggle: all email functions disabled
        if (settings.emailEnabled === 'false') {
            if (purpose === 'password_reset') {
                return res.status(400).json({ message: 'El envío de correos está deshabilitado' });
            }
            return res.json({ success: true, skipped: true, message: 'Envío de correos deshabilitado' });
        }
        if (purpose === 'register' && settings.emailVerifyRegistration === 'false') {
            return res.json({ success: true, skipped: true, message: 'Verificación de registro deshabilitada' });
        }
        if (purpose === 'guest_checkout' && settings.emailVerifyGuestCheckout === 'false') {
            return res.json({ success: true, skipped: true, message: 'Verificación de checkout deshabilitada' });
        }
        if (purpose === 'password_reset' && settings.emailPasswordReset === 'false') {
            return res.status(400).json({ message: 'La recuperación de contraseña por email está deshabilitada' });
        }
    } catch (settingsError) {
        console.warn('Could not check email toggles, proceeding with send:', settingsError.message);
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Test bypass: skip real email and store fixed code 000000
    if (isTestBypassEmail(normalizedEmail)) {
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
        await statements.deleteVerificationCodes(normalizedEmail, purpose || 'general');
        await statements.createVerificationCode(normalizedEmail, '000000', purpose || 'general', expiresAt);
        return res.json({ success: true, message: 'Código enviado correctamente' });
    }

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
            from: EMAIL_USER || `noreply@${config.BRAND}.com`,
            to: normalizedEmail,
            subject: `Tu código de verificación - ${config.BRAND}`,
            text: `Tu código de verificación es: ${code}. Este código expira en 10 minutos.`,
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                    <h2 style="color: #007bff;">Código de Verificación</h2>
                    <p>Hola,</p>
                    <p>Tu código de verificación para ${config.BRAND} es:</p>
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
