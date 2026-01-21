// middleware/rateLimiter.js - Rate limiting configuration
const rateLimit = require('express-rate-limit');

// Rate limiter for auth routes
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Limit each IP to 10 requests per window
    message: { message: 'Demasiados intentos desde esta IP, por favor intenta de nuevo en 15 minutos' },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.method === 'OPTIONS' // Don't count preflights
});

// General API limiter (optional, for future use)
const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100, // 100 requests per minute
    message: { message: 'Demasiadas peticiones, por favor intenta de nuevo en un momento' },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.method === 'OPTIONS'
});

module.exports = {
    authLimiter,
    apiLimiter
};
