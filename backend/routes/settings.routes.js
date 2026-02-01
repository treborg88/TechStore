// routes/settings.routes.js - Site settings routes (admin)
const express = require('express');
const router = express.Router();

const { statements } = require('../database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { singleImageUpload } = require('../middleware/upload');
const { encryptSetting, decryptSetting } = require('../services/encryption.service');

// Public settings that can be exposed to the frontend (no sensitive data)
const PUBLIC_SETTINGS = [
    'siteName', 'siteIcon', 'heroTitle', 'heroDescription', 'heroPrimaryBtn', 
    'heroSecondaryBtn', 'heroImage', 'headerBgColor', 'headerTransparency',
    'primaryColor', 'secondaryColor', 'accentColor', 'backgroundColor', 'textColor',
    'productDetailHeroImage', 'categoryFiltersConfig', 'productCardConfig',
    'currencyCode', 'defaultCurrency', 'storePhone', 'storeAddress',
    // Contact page settings
    'contactTitle', 'contactSubtitle', 'contactCompany', 'contactEmail', 
    'contactPhone', 'contactWhatsapp', 'contactAddress', 'contactHours',
    'contactSupportLine', 'contactMapUrl',
    // Payment methods configuration
    'paymentMethodsConfig'
];

/**
 * GET /api/settings/public
 * Get public settings (no auth required)
 */
router.get('/public', async (req, res) => {
    try {
        const settings = await statements.getSettings();
        
        // Only return public settings (filter out sensitive data)
        const settingsObj = {};
        for (const { id, value } of settings) {
            if (PUBLIC_SETTINGS.includes(id)) {
                settingsObj[id] = value;
            }
        }
        
        res.json(settingsObj);
    } catch (error) {
        console.error('Error obteniendo ajustes públicos:', error);
        res.status(500).json({ message: 'Error al obtener los ajustes' });
    }
});

/**
 * GET /api/settings
 * Get all settings (admin only)
 */
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const settings = await statements.getSettings();
        
        // Convert to object and mask sensitive fields
        const settingsObj = {};
        for (const { id, value } of settings) {
            if (id === 'mailPassword' || id === 'stripeSecretKey') {
                // Don't send actual password/keys, just indicate if set
                settingsObj[id] = value ? '********' : '';
            } else {
                settingsObj[id] = value;
            }
        }
        
        res.json(settingsObj);
    } catch (error) {
        console.error('Error obteniendo ajustes:', error);
        res.status(500).json({ message: 'Error al obtener los ajustes' });
    }
});

/**
 * PUT /api/settings
 * Update settings (admin only)
 */
router.put('/', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const settings = req.body;
        
        // Sensitive fields that should be encrypted and filtered if empty
        const sensitiveFields = ['mailPassword', 'stripeSecretKey'];
        
        // Filter out empty sensitive field updates
        const entries = Object.entries(settings).filter(([key, value]) => {
            if (!sensitiveFields.includes(key)) return true;
            return value !== undefined && value !== null && String(value).trim() !== '' && String(value).trim() !== '********';
        });
        
        const promises = entries.map(([key, value]) => {
            // Encrypt sensitive fields
            if (sensitiveFields.includes(key)) {
                const encrypted = encryptSetting(value);
                return statements.updateSetting(key, encrypted);
            }
            return statements.updateSetting(key, value);
        });
        
        await Promise.all(promises);
        res.json({ message: 'Ajustes actualizados correctamente' });
    } catch (error) {
        console.error('❌ Error actualizando ajustes:', error);
        res.status(500).json({ 
            message: 'Error al actualizar los ajustes',
            details: error.message 
        });
    }
});

/**
 * POST /api/settings/upload
 * Upload settings image (admin only)
 */
router.post('/upload', authenticateToken, requireAdmin, singleImageUpload, async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No se subió ninguna imagen' });
        }

        const imageUrl = await statements.uploadImage(req.file);
        res.json({ url: imageUrl });
    } catch (error) {
        console.error('Error subiendo imagen de ajustes:', error);
        res.status(500).json({ message: 'Error al subir la imagen' });
    }
});

module.exports = router;
