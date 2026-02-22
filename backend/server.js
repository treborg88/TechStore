// server.js - Main Express server (Modular version)
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');

// Config
const { PORT, FRONTEND_URL, BASE_URL } = require('./config');
const { corsOptions, corsHeaders, addSiteDomain, getAllowedOrigins, getWildcardDomains } = require('./config/cors');

// Middleware
const { authLimiter } = require('./middleware/rateLimiter');
const { csrfProtection } = require('./middleware/csrf');

// Routes
const { 
    authRoutes, 
    productsRoutes, 
    cartRoutes, 
    ordersRoutes, 
    usersRoutes, 
    settingsRoutes, 
    verificationRoutes,
    paymentsRoutes,
    chatbotRoutes,
    setupRoutes
} = require('./routes');

// Share page utilities
const { statements, dbConfigured } = require('./database');
const { buildShareHtml, extractProductIdFromSlug } = require('./sharePage');
const pkg = require('../package.json');

const app = express();

// --- Security Middleware ---
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false,
}));

app.use(cors(corsOptions));
app.set('trust proxy', 1);
app.use(cookieParser());

// CORS headers middleware (dynamic — reads from allowedOrigins set)
app.use(corsHeaders);

// --- Rate Limiting ---
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);
app.use('/api/auth/reset-password', authLimiter);
app.use('/api/verification/send-code', authLimiter);

// --- Body Parsing ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- CSRF Protection ---
app.use(csrfProtection);

// --- Health Check (works with or without DB) ---
app.get('/api/health', (req, res) => {
    const db = dbConfigured();
    res.status(db ? 200 : 503).json({
        status: db ? 'ok' : 'setup',
        version: pkg.version || '1.0.0',
        uptime: Math.floor(process.uptime()),
        database: db ? 'connected' : 'not_configured',
        message: db ? 'All systems operational' : 'Configura SUPABASE_URL y SUPABASE_KEY para activar la app'
    });
});

// --- API Routes ---
app.use('/api/setup', setupRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/verification', verificationRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/chatbot', chatbotRoutes);

// --- Share Page (OG meta tags for social sharing) ---

// Cache for share page settings (siteName, currency) — 10 min TTL
let _shareSettingsCache = null;
let _shareSettingsCacheTime = 0;
const SHARE_SETTINGS_TTL = 10 * 60 * 1000;

/**
 * Fetch siteName and currency from DB settings with caching
 */
const getShareSettings = async () => {
    const now = Date.now();
    if (_shareSettingsCache && now - _shareSettingsCacheTime < SHARE_SETTINGS_TTL) {
        return _shareSettingsCache;
    }
    try {
        const allSettings = await statements.getSettings();
        const settingsMap = {};
        for (const s of allSettings) settingsMap[s.id] = s.value;
        _shareSettingsCache = {
            siteName: settingsMap.siteName || 'TechStore',
            currency: settingsMap.currencyCode || 'DOP'
        };
        _shareSettingsCacheTime = now;
    } catch (_err) {
        // Fallback if DB unavailable
        _shareSettingsCache = { siteName: 'TechStore', currency: 'DOP' };
    }
    return _shareSettingsCache;
};

/**
 * Convert Supabase Storage URL to proxied /storage/ path (for Cloudflare cache).
 * External crawlers use the full absolute proxied URL so images go through CDN.
 * In dev (no Nginx), returns the original Supabase URL.
 */
const resolveShareImageUrl = (imageUrl, baseUrl) => {
    if (!imageUrl) return '';
    const marker = '/storage/v1/object/public/';
    const idx = imageUrl.indexOf(marker);
    if (idx !== -1 && baseUrl) {
        // Convert to proxied URL: https://domain.com/storage/<path>
        return `${baseUrl}/storage/${imageUrl.slice(idx + marker.length)}`;
    }
    // Non-Supabase or already absolute → return as-is
    if (/^https?:\/\//i.test(imageUrl)) return imageUrl;
    // Relative path → make absolute
    return baseUrl ? `${baseUrl}${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}` : imageUrl;
};

app.get('/p/:slug', async (req, res) => {
    const slug = req.params.slug || '';
    const productId = extractProductIdFromSlug(slug);
    
    if (!productId) {
        console.log('Share page: Invalid slug, no product ID found:', slug);
        return res.status(404).send('Producto no encontrado');
    }

    try {
        const product = await statements.getProductById(productId);
        if (!product) {
            console.log('Share page: Product not found for ID:', productId);
            return res.status(404).send('Producto no encontrado');
        }

        // Get product images
        let images = await statements.getProductImages(productId);
        if (images.length === 0 && product.image) {
            images = [{ image_path: product.image }];
        }

        // Detect protocol from forwarded headers (for proxies/tunnels) or request
        const forwardedProto = req.get('x-forwarded-proto');
        const detectedProtocol = forwardedProto || req.protocol || 'http';
        const detectedHost = req.get('x-forwarded-host') || req.get('host');
        const requestOriginUrl = `${detectedProtocol}://${detectedHost}`;
        
        // Site base URL (for images and redirects)
        const siteUrl = (BASE_URL || requestOriginUrl).replace(/\/$/, '');
        // Frontend URL for product redirect (in dev, replace backend port with frontend port)
        const defaultFrontendUrl = requestOriginUrl.replace(':5001', ':5173');
        const frontendUrl = (FRONTEND_URL || defaultFrontendUrl).replace(/\/$/, '');
        
        // Build absolute image URL — proxied through Nginx/Cloudflare in production
        const primaryImage = images.length > 0 ? images[0].image_path : '';
        const imageUrl = resolveShareImageUrl(primaryImage, siteUrl);
        
        // Redirect URL points to frontend product page
        const productPageUrl = `${frontendUrl}/product/${productId}`;

        // Fetch dynamic site settings (siteName, currency) with caching
        const shareSettings = await getShareSettings();

        console.log('Share page generated:', { 
            productId, 
            imageUrl, 
            productPageUrl,
            detectedProtocol,
            detectedHost,
            envBaseUrl: BASE_URL || 'not set',
            envFrontendUrl: FRONTEND_URL || 'not set'
        });

        const html = buildShareHtml({
            title: product.name,
            description: product.description,
            imageUrl,
            url: productPageUrl,
            siteName: shareSettings.siteName,
            price: product.price,
            currency: shareSettings.currency
        });

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        // Cache for crawlers but not too long
        res.setHeader('Cache-Control', 'public, max-age=300');
        return res.send(html);
    } catch (error) {
        console.error('Error generando share page:', error);
        return res.status(500).send('Error interno del servidor');
    }
});

// --- Global Error Handler (catches DB_NOT_CONFIGURED cleanly) ---
app.use((err, req, res, _next) => {
    if (err.code === 'DB_NOT_CONFIGURED') {
        return res.status(503).json({
            message: 'Base de datos no configurada',
            code: 'DB_NOT_CONFIGURED',
            hint: 'Configura SUPABASE_URL y SUPABASE_KEY en .env y reinicia el servidor'
        });
    }
    console.error('Unhandled error:', err);
    res.status(err.statusCode || 500).json({ message: err.message || 'Error interno del servidor' });
});

// --- Start Server ---
app.listen(PORT, '0.0.0.0', async () => {
    const db = dbConfigured();
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
    console.log(`📁 Estructura modular cargada`);

    // Load siteDomain from DB to allow CORS for admin-configured domain
    if (db) {
        try {
            const settings = await statements.getSettings();
            const domainSetting = settings.find(s => s.id === 'siteDomain');
            if (domainSetting?.value) {
                addSiteDomain(domainSetting.value);
                console.log(`🌐 CORS: dominio del sitio cargado → ${domainSetting.value}`);
            }
        } catch (err) {
            console.warn('⚠️  No se pudo cargar siteDomain de la DB:', err.message);
        }
    }

    console.log(`🔒 CORS orígenes permitidos: ${getAllowedOrigins().length} exactos, ${getWildcardDomains().length} wildcard`);

    if (!db) {
        console.log(`⚠️  Modo setup: sin base de datos. Configura SUPABASE_URL + SUPABASE_KEY en .env`);
    }
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('Cerrando servidor...');
    process.exit(0);
});
