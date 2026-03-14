// routes/settings.routes.js - Site settings routes (admin)
const express = require('express');
const router = express.Router();

const { statements } = require('../database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { singleImageUpload } = require('../middleware/upload');
const { encryptSetting } = require('../services/encryption.service');
const { addSiteDomain } = require('../config/cors');

// Public settings that can be exposed to the frontend (no sensitive data)
const PUBLIC_SETTINGS = [
    'siteName', 'siteIcon', 'siteLogo', 'siteLogoSize', 'siteNameImage', 'siteNameImageSize',
    'heroTitle', 'heroDescription', 'heroImage', 'heroTitleSize', 'heroDescriptionSize',
    'heroPositionX', 'heroPositionY', 'heroImageWidth', 'heroOverlayOpacity', 'heroHeight',
    'heroTextColor', 'headerTextColor', 'headerButtonColor', 'headerButtonTextColor',
    'heroBannerImage', 'heroBannerSize', 'heroBannerPositionX', 'heroBannerPositionY', 'heroBannerOpacity',
    'headerBgColor', 'headerTransparency',
    'primaryColor', 'secondaryColor', 'accentColor', 'backgroundColor', 'textColor',
    'productDetailHeroImage', 'productDetailUseHomeHero', 'productDetailHeroHeight', 'productDetailHeroOverlayOpacity',
    'productDetailHeroBannerImage', 'productDetailHeroBannerSize', 'productDetailHeroBannerPositionX', 
    'productDetailHeroBannerPositionY', 'productDetailHeroBannerOpacity',
    'categoryFiltersConfig', 'productCardConfig',
    'storePhone', 'storeAddress',
    // Contact page settings
    'contactTitle', 'contactSubtitle', 'contactCompany', 'contactEmail', 
    'contactPhone', 'contactWhatsapp', 'contactAddress', 'contactHours',
    'contactSupportLine',
    // Map & shipping config (store location + shipping zones)
    'mapConfig',
    // Payment methods configuration
    'paymentMethodsConfig',
    // Site domain (for CORS / display)
    'siteDomain',
    // Chatbot public settings
    'chatbotEnabled', 'chatbotGreeting', 'chatbotMaxMessages',
    'chatbotPlaceholder', 'chatbotColor',
    // Landing page configuration
    'landingPageConfig',
    // Header navigation visibility controls
    'navigationConfig',
    // Store module control
    'storeModuleConfig'
];

/**
 * GET /api/settings/public
 * Get public settings (no auth required)
 */
router.get('/public', async (req, res) => {
    try {
        // Evita caché de navegador/proxy para que cambios de diseño (landing/templates)
        // se reflejen inmediatamente tras guardar.
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
        res.set('Surrogate-Control', 'no-store');

        const settings = await statements.getSettings();
        
        // Only return public settings (filter out sensitive data)
        const settingsObj = {};
        for (const { id, value } of settings) {
            if (PUBLIC_SETTINGS.includes(id)) {
                settingsObj[id] = value;
            }
        }

        // Compatibilidad con backups antiguos: asegurar que configs clave existan
        // para que el frontend siempre tenga una base válida al recargar.
        if (settingsObj.landingPageConfig === undefined) {
            settingsObj.landingPageConfig = '{"enabled":false}';
            try {
                await statements.updateSetting('landingPageConfig', settingsObj.landingPageConfig);
            } catch (healError) {
                console.warn('⚠️ No se pudo auto-crear landingPageConfig:', healError.message);
            }
        }

        if (settingsObj.storeModuleConfig === undefined) {
            settingsObj.storeModuleConfig = '{"enabled":true}';
            try {
                await statements.updateSetting('storeModuleConfig', settingsObj.storeModuleConfig);
            } catch (healError) {
                console.warn('⚠️ No se pudo auto-crear storeModuleConfig:', healError.message);
            }
        }

        if (settingsObj.navigationConfig === undefined) {
            settingsObj.navigationConfig = '{"showHomeLink":true,"showStoreLink":true}';
            try {
                await statements.updateSetting('navigationConfig', settingsObj.navigationConfig);
            } catch (healError) {
                console.warn('⚠️ No se pudo auto-crear navigationConfig:', healError.message);
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
            if (id === 'mailPassword' || id === 'stripeSecretKey' || id === 'paypalClientSecret' || id === 'dbSupabaseKey') {
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
        const settings = { ...(req.body || {}) };

        // Compatibilidad defensiva: aceptar typo legado del frontend y mapearlo.
        if (settings.cdlandingPageConfig !== undefined && settings.landingPageConfig === undefined) {
            settings.landingPageConfig = settings.cdlandingPageConfig;
        }
        delete settings.cdlandingPageConfig;
        
        // Sensitive fields that should be encrypted and filtered if empty
        const sensitiveFields = ['mailPassword', 'stripeSecretKey', 'paypalClientSecret', 'dbSupabaseKey'];
        
        // Filter out empty sensitive field updates
        const entries = Object.entries(settings).filter(([key, value]) => {
            if (!sensitiveFields.includes(key)) return true;
            return value !== undefined && value !== null && String(value).trim() !== '' && String(value).trim() !== '********';
        });
        
        const promises = entries.map(([key, value]) => {
            // Evita guardar "[object Object]" cuando llega JSON como objeto.
            const normalizedValue = (value && typeof value === 'object')
                ? JSON.stringify(value)
                : value;

            // Encrypt sensitive fields
            if (sensitiveFields.includes(key)) {
                const encrypted = encryptSetting(normalizedValue);
                return statements.updateSetting(key, encrypted);
            }
            return statements.updateSetting(key, normalizedValue);
        });
        
        await Promise.all(promises);

        // If siteDomain changed, refresh CORS allowed origins immediately (no restart needed)
        if (settings.siteDomain !== undefined && String(settings.siteDomain).trim()) {
            addSiteDomain(String(settings.siteDomain));
            console.log(`🌐 CORS: dominio actualizado desde Admin Panel → ${settings.siteDomain}`);
        }

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
 * Provider-agnostic: returns info for whichever adapter is active.
 */
router.get('/db-status', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const db = require('../database');
        const currentProvider = db.provider;

        // Common: test actual connection
        let connected = false;
        let tableCount = 0;

        if (currentProvider === 'postgres') {
            // ── PostgreSQL (native) ────────────────────────────
            const dbUrl = process.env.DATABASE_URL || '';
            // Mask credentials in connection string for display
            const maskedUrl = dbUrl.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:****@');

            try {
                const result = await db.testConnection();
                connected = result.success;
                if (connected && db.pool) {
                    const { rows } = await db.pool.query(
                        `SELECT COUNT(*) AS c FROM information_schema.tables
                         WHERE table_schema = 'public'
                           AND table_name = ANY($1)`,
                        [['users', 'products', 'orders', 'order_items', 'cart', 'app_settings']]
                    );
                    tableCount = parseInt(rows[0].c, 10);
                }
            } catch { /* connection failed */ }

            return res.json({
                provider: 'PostgreSQL (native)',
                url: maskedUrl,
                connected,
                tableCount,
                dashboardUrl: ''
            });
        }

        // ── Supabase (default) ──────────────────────────────
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

        // Test connection via Supabase client
        const dbClient = db.supabase;
        if (dbClient) {
            try {
                const { error } = await dbClient
                    .from('app_settings')
                    .select('id', { count: 'exact', head: true });
                connected = !error;
                // Count main tables
                const tables = ['users', 'products', 'orders', 'order_items', 'cart', 'app_settings'];
                let count = 0;
                for (const t of tables) {
                    const { error: tErr } = await dbClient
                        .from(t)
                        .select('id', { count: 'exact', head: true });
                    if (!tErr) count++;
                }
                tableCount = count;
            } catch { /* connection failed */ }
        }

        res.json({
            provider: 'Supabase (PostgreSQL)',
            url: supabaseUrl || '',
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
 * POST /api/settings/db-disconnect
 * Disconnect database — puts app back into setup mode for migration.
 * Deletes .env.local credentials so setup wizard can reconfigure.
 */
router.post('/db-disconnect', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const db = require('../database');
        const fs = require('fs');
        const path = require('path');

        const currentProvider = db.provider;

        // Remove .env.local (setup wizard credentials file)
        const envLocalPath = path.join(__dirname, '..', '.env.local');
        if (fs.existsSync(envLocalPath)) {
            fs.unlinkSync(envLocalPath);
        }

        // Disconnect the in-memory client
        db.disconnectDb();

        console.log(`✅ DB desconectada (${currentProvider}) por admin: ${req.user.email}`);
        res.json({ message: 'Base de datos desconectada. La app está en modo setup.' });
    } catch (error) {
        console.error('Error desconectando DB:', error);
        res.status(500).json({ message: 'Error al desconectar la base de datos' });
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

/**
 * GET /api/settings/credentials-status
 * Returns which service credentials are configured (admin only)
 */
router.get('/credentials-status', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const config = require('../config');
        const { decryptSetting } = require('../services/encryption.service');

        // Leer settings de DB para verificar credenciales guardadas allí
        let dbSettings = {};
        try {
            const rows = await statements.getSettings();
            for (const { id, value } of rows) dbSettings[id] = value;
        } catch { /* DB may not be available */ }

        // Helper: verifica si un valor encriptado en DB es válido
        const hasDbKey = (key) => {
            if (!dbSettings[key]) return false;
            try {
                const decrypted = decryptSetting(dbSettings[key]);
                return !!decrypted && decrypted.length > 0;
            } catch {
                return !!dbSettings[key]; // fallback: existe aunque no se pueda desencriptar
            }
        };

        // Email: DB (mailUser+mailPassword) o ENV (EMAIL_USER+EMAIL_PASS)
        const emailDb = !!(dbSettings.mailUser && hasDbKey('mailPassword'));
        const emailEnv = !!(config.EMAIL_USER && config.EMAIL_PASS);

        // Stripe: DB (stripeSecretKey) o ENV
        const stripeDb = hasDbKey('stripeSecretKey');
        const stripeEnv = !!config.STRIPE_SECRET_KEY;

        // PayPal: DB o ENV
        const paypalDb = !!(dbSettings.paypalClientId && hasDbKey('paypalClientSecret'));
        const paypalEnv = !!(config.PAYPAL_CLIENT_ID && config.PAYPAL_CLIENT_SECRET);

        // Chatbot: DB (chatbotLlmApiKey) o ENV
        const chatbotDb = hasDbKey('chatbotLlmApiKey');
        const chatbotEnv = !!process.env.CHATBOT_LLM_API_KEY;

        // Base de datos: verificar conexión activa
        const db = require('../database');
        const dbConnected = db.dbConfigured();

        const credentials = [
            { id: 'database', label: 'Base de Datos', configured: dbConnected },
            { id: 'email', label: 'Correo SMTP', configured: emailDb || emailEnv },
            { id: 'stripe', label: 'Stripe (Pagos con tarjeta)', configured: stripeDb || stripeEnv },
            { id: 'paypal', label: 'PayPal', configured: paypalDb || paypalEnv },
            { id: 'chatbot', label: 'Chatbot (LLM API Key)', configured: chatbotDb || chatbotEnv },
        ];

        const missing = credentials.filter(c => !c.configured);
        res.json({ credentials, missing, allConfigured: missing.length === 0 });
    } catch (error) {
        console.error('Error checking credentials status:', error);
        res.status(500).json({ message: 'Error al verificar credenciales' });
    }
});

module.exports = router;
