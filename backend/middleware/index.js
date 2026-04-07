// middleware/index.js - Export all middleware
const { authenticateToken, requireAdmin, blacklistToken, isTokenBlacklisted, hashToken } = require('./auth');
const { authLimiter, apiLimiter } = require('./rateLimiter');
const { csrfProtection, setAuthCookies, setCsrfCookie, getCookieOptions } = require('./csrf');
const { upload, productImagesUpload, singleImageUpload } = require('./upload');
const { createTenantMiddleware, invalidateTenantCache, clearTenantCache } = require('./tenant');
const { createDbContext } = require('./dbContext');
const { checkLimit } = require('./planLimits');

module.exports = {
    // Auth
    authenticateToken,
    requireAdmin,
    blacklistToken,
    isTokenBlacklisted,
    hashToken,
    
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
    singleImageUpload,

    // Multi-tenant (SaaS)
    createTenantMiddleware,
    invalidateTenantCache,
    clearTenantCache,
    createDbContext,

    // Plan limits (SaaS)
    checkLimit
};
