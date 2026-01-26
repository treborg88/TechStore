// server.js - Main Express server (Modular version)
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');

// Config
const { PORT, FRONTEND_URL, BASE_URL } = require('./config');
const { corsOptions } = require('./config/cors');

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
    verificationRoutes 
} = require('./routes');

// Share page utilities
const { statements } = require('./database');
const { buildShareHtml, extractProductIdFromSlug, ensureAbsoluteUrl } = require('./sharePage');

const app = express();

// --- Security Middleware ---
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false,
}));

app.use(cors(corsOptions));
app.set('trust proxy', 1);
app.use(cookieParser());

// CORS headers middleware
app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (corsOptions.origin.includes(origin)) {
        res.header('Access-Control-Allow-Origin', origin);
    }
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,PATCH,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-CSRF-Token');
    
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

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

// --- API Routes ---
app.use('/api/auth', authRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/verification', verificationRoutes);

// --- Share Page (OG meta tags for social sharing) ---
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
        
        // Backend URL for image assets - use BASE_URL if set, otherwise detect from request
        const backendUrl = (BASE_URL || requestOriginUrl).replace(/\/$/, '');
        // Frontend URL for product redirect - use FRONTEND_URL if set, otherwise derive from backend
        // Note: Replace port 5001 with 5173 for frontend if using default ports
        const defaultFrontendUrl = requestOriginUrl.replace(':5001', ':5173');
        const frontendUrl = (FRONTEND_URL || defaultFrontendUrl).replace(/\/$/, '');
        
        // Build absolute image URL
        const primaryImage = images.length > 0 ? images[0].image_path : '';
        const imageUrl = ensureAbsoluteUrl(primaryImage, backendUrl);
        
        // Redirect URL points to frontend product page
        const productPageUrl = `${frontendUrl}/product/${productId}`;

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
            siteName: 'TechStore',
            price: product.price,
            currency: 'DOP'
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

// --- Start Server ---
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
    console.log(`📁 Estructura modular cargada`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('Cerrando servidor...');
    process.exit(0);
});
