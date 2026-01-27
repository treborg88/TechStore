// middleware/rateLimiter.js - Rate limiting configuration
const rateLimit = require('express-rate-limit');

// Check if we should skip rate limiting (for testing)
const shouldSkipRateLimit = (req) => {
    // Always skip OPTIONS (preflight)
    if (req.method === 'OPTIONS') return true;
    
    // Skip in test/development when special header is present
    // SECURITY: Only works when NODE_ENV is NOT production
    if (process.env.NODE_ENV !== 'production') {
        if (req.headers['x-test-bypass'] === 'e2e-testing') {
            return true;
        }
    }
    
    return false;
};

// Rate limiter for auth routes
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Limit each IP to 10 requests per window
    message: { message: 'Demasiados intentos desde esta IP, por favor intenta de nuevo en 15 minutos' },
    standardHeaders: true,
    legacyHeaders: false,
    skip: shouldSkipRateLimit
});

// General API limiter (optional, for future use)
const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100, // 100 requests per minute
    message: { message: 'Demasiadas peticiones, por favor intenta de nuevo en un momento' },
    standardHeaders: true,
    legacyHeaders: false,
    skip: shouldSkipRateLimit
});

module.exports = {
    authLimiter,
    apiLimiter
};
