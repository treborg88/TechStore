// routes/settings.routes.js - Site settings routes (admin)
const express = require('express');
const router = express.Router();

const { statements } = require('../database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { singleImageUpload } = require('../middleware/upload');
const { encryptSetting, decryptSetting } = require('../services/encryption.service');

// Public settings that can be exposed to the frontend (no sensitive data)
const PUBLIC_SETTINGS = [
    'siteName', 'siteIcon', 'siteLogo', 'siteLogoSize', 'siteNameImage', 'siteNameImageSize',
    'heroTitle', 'heroDescription', 'heroPrimaryBtn', 
    'heroSecondaryBtn', 'heroImage', 'heroTitleSize', 'heroDescriptionSize',
    'heroPositionX', 'heroPositionY', 'heroImageWidth', 'heroOverlayOpacity', 'heroHeight',
    'heroTextColor', 'headerTextColor', 'headerButtonColor', 'headerButtonTextColor',
    'heroBannerImage', 'heroBannerSize', 'heroBannerPositionX', 'heroBannerPositionY', 'heroBannerOpacity',
    'headerBgColor', 'headerTransparency',
    'primaryColor', 'secondaryColor', 'accentColor', 'backgroundColor', 'textColor',
    'productDetailHeroImage', 'productDetailUseHomeHero', 'productDetailHeroHeight', 'productDetailHeroOverlayOpacity',
    'productDetailHeroBannerImage', 'productDetailHeroBannerSize', 'productDetailHeroBannerPositionX', 
    'productDetailHeroBannerPositionY', 'productDetailHeroBannerOpacity',
    'categoryFiltersConfig', 'productCardConfig',
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
            if (id === 'mailPassword' || id === 'stripeSecretKey' || id === 'paypalClientSecret') {
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
        const sensitiveFields = ['mailPassword', 'stripeSecretKey', 'paypalClientSecret'];
        
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
 * GET /api/settings/db-status
 * Get database connection info (admin only, sensitive data masked)
 */
router.get('/db-status', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const supabaseUrl = process.env.SUPABASE_URL || '';
        const supabaseKey = process.env.SUPABASE_KEY || '';

        // Extract project ref from URL (e.g. https://abc123.supabase.co -> abc123)
        let projectRef = '';
        try {
            const urlObj = new URL(supabaseUrl);
            projectRef = urlObj.hostname.split('.')[0] || '';
        } catch { /* invalid URL */ }

        // Mask the API key: show first 8 and last 4 chars
        const maskedKey = supabaseKey.length > 12
            ? `${supabaseKey.slice(0, 8)}...${supabaseKey.slice(-4)}`
            : supabaseKey ? '••••••••' : '';

        // Test actual connection with a lightweight query
        let connected = false;
        let tableCount = 0;
        try {
            const { data, error } = await require('../database').supabase
                .from('settings')
                .select('id', { count: 'exact', head: true });
            connected = !error;
            // Try to count main tables
            const tables = ['users', 'products', 'orders', 'order_items', 'cart', 'settings'];
            let count = 0;
            for (const t of tables) {
                const { error: tErr } = await require('../database').supabase
                    .from(t)
                    .select('id', { count: 'exact', head: true });
                if (!tErr) count++;
            }
            tableCount = count;
        } catch { /* connection failed */ }

        res.json({
            provider: 'Supabase (PostgreSQL)',
            url: supabaseUrl || 'No configurada',
            projectRef,
            apiKeySet: !!supabaseKey,
            maskedKey,
            connected,
            tableCount,
            dashboardUrl: projectRef ? `https://supabase.com/dashboard/project/${projectRef}` : ''
        });
    } catch (error) {
        console.error('Error getting DB status:', error);
        res.status(500).json({ message: 'Error al obtener estado de la base de datos' });
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
