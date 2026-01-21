// middleware/index.js - Export all middleware
const { authenticateToken, requireAdmin, blacklistToken, tokenBlacklist } = require('./auth');
const { authLimiter, apiLimiter } = require('./rateLimiter');
const { csrfProtection, setAuthCookies, setCsrfCookie, getCookieOptions } = require('./csrf');
const { upload, productImagesUpload, singleImageUpload } = require('./upload');

module.exports = {
    // Auth
    authenticateToken,
    requireAdmin,
    blacklistToken,
    tokenBlacklist,
    
    // Rate limiting
    authLimiter,
    apiLimiter,
    
    // CSRF
    csrfProtection,
    setAuthCookies,
    setCsrfCookie,
    getCookieOptions,
    
    // Upload
    upload,
    productImagesUpload,
    singleImageUpload
};
