// config/cors.js - Dynamic CORS configuration
// Origins are built from: env var CORS_ORIGIN + admin-panel siteDomain + localhost defaults
const cors = require('cors');

// --- Localhost origins (always allowed in development) ---
const LOCALHOST_ORIGINS = [
    'http://localhost:5173',
    'http://localhost:5001',
    'http://localhost:3000'
];

// --- Wildcard subdomain allow-list (e.g. *.example.com) ---
const wildcardDomains = new Set();

// --- Build the dynamic allowed-origins set ---
const allowedOrigins = new Set(LOCALHOST_ORIGINS);

/**
 * Parse CORS_ORIGIN env var (comma-separated domains or URLs).
 * Accepts: "https://example.com, https://www.example.com"
 *      or: "example.com" (auto-expands to http + https + www variants)
 */
const parseEnvOrigins = () => {
    const raw = process.env.CORS_ORIGIN || '';
    if (!raw.trim()) return;

    raw.split(',').forEach(entry => {
        const trimmed = entry.trim();
        if (!trimmed) return;

        // Wildcard domain pattern support:
        //   *.example.com
        //   https://*.example.com
        //   http://*.example.com
        if (trimmed.includes('*')) {
            addWildcardDomain(trimmed);
            return;
        }

        if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
            // Full URL provided — add as-is
            allowedOrigins.add(trimmed.replace(/\/$/, ''));
        } else {
            // Bare domain — expand to http/https + www variants
            expandDomain(trimmed);
        }
    });
};

/**
 * Expand a bare domain into its http/https/www variants and add to allowed set.
 * e.g. "example.com" → http://example.com, https://example.com, 
 *                        http://www.example.com, https://www.example.com
 */
const expandDomain = (domain) => {
    const clean = domain.replace(/^(https?:\/\/)/, '').replace(/\/$/, '');
    if (!clean) return;

    allowedOrigins.add(`http://${clean}`);
    allowedOrigins.add(`https://${clean}`);

    // Add www variant only if domain doesn't already start with www
    if (!clean.startsWith('www.')) {
        allowedOrigins.add(`http://www.${clean}`);
        allowedOrigins.add(`https://www.${clean}`);
    }
};

/**
 * Store wildcard domain suffix for dynamic origin matching.
 * Examples accepted:
 *   *.example.com
 *   https://*.example.com
 *   http://*.example.com
 */
const addWildcardDomain = (pattern) => {
    const clean = pattern
        .replace(/^https?:\/\//, '')
        .replace(/^\*\./, '')
        .replace(/\/$/, '')
        .toLowerCase();

    if (!clean) return;
    wildcardDomains.add(clean);
};

/**
 * Validate if request origin is allowed by wildcard suffix.
 */
const isWildcardOriginAllowed = (requestOrigin) => {
    try {
        const parsed = new URL(requestOrigin);
        const hostname = (parsed.hostname || '').toLowerCase();
        if (!hostname) return false;

        for (const domain of wildcardDomains) {
            // Require real subdomain: foo.example.com matches, example.com does not
            if (hostname.endsWith(`.${domain}`)) {
                return true;
            }
        }

        return false;
    } catch {
        return false;
    }
};

/**
 * Add domain(s) from admin panel (siteDomain setting).
 * Supports comma-separated values with full URLs or bare domains.
 * Called at boot (from DB) and when admin updates the setting.
 */
const addSiteDomain = (domainStr) => {
    if (!domainStr || typeof domainStr !== 'string') return;

    // Split by comma to support multiple domains in one field
    domainStr.split(',').forEach(entry => {
        const trimmed = entry.trim();
        if (!trimmed) return;

        if (trimmed.includes('*')) {
            addWildcardDomain(trimmed);
            return;
        }

        if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
            // Full URL — add as-is (strip trailing slash)
            allowedOrigins.add(trimmed.replace(/\/$/, ''));
        } else {
            // Bare domain — expand to http/https/www variants
            expandDomain(trimmed);
        }
    });
};

/**
 * Get a snapshot of currently allowed origins (for debugging / health checks).
 */
const getAllowedOrigins = () => [...allowedOrigins];

/**
 * Get wildcard domain patterns currently allowed.
 */
const getWildcardDomains = () => [...wildcardDomains];

// Initialize from env var on module load
parseEnvOrigins();

// Also add FRONTEND_URL if set (ensures share-page origin is allowed)
if (process.env.FRONTEND_URL) {
    allowedOrigins.add(process.env.FRONTEND_URL.replace(/\/$/, ''));
}

// --- CORS options with dynamic origin function ---
const corsOptions = {
    origin: (requestOrigin, callback) => {
        // Allow requests with no origin (server-to-server, curl, mobile apps)
        if (!requestOrigin) return callback(null, true);
        if (allowedOrigins.has(requestOrigin)) return callback(null, true);
        if (isWildcardOriginAllowed(requestOrigin)) return callback(null, true);
        // Reject unknown origins
        callback(null, false);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    credentials: true,
    optionsSuccessStatus: 200
};

// --- Manual CORS headers middleware (backup for edge-case proxies) ---
const corsHeaders = (req, res, next) => {
    const origin = req.headers.origin;
    if (origin && (allowedOrigins.has(origin) || isWildcardOriginAllowed(origin))) {
        res.header('Access-Control-Allow-Origin', origin);
    }
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,PATCH,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-CSRF-Token');

    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
};

module.exports = {
    corsMiddleware: cors(corsOptions),
    corsHeaders,
    corsOptions,
    addSiteDomain,
    getAllowedOrigins,
    getWildcardDomains
};
