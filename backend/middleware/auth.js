// middleware/auth.js - Authentication middleware and token blacklist
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { JWT_SECRET } = require('../config');
const { statements, dbConfigured } = require('../database');

// --- Token Blacklist (hybrid: in-memory cache + Supabase persistence) ---
// In-memory cache for fast lookups (Map: tokenHash -> expiration timestamp)
const blacklistCache = new Map();

// Hash token for secure storage (don't store raw tokens)
const hashToken = (token) => {
    return crypto.createHash('sha256').update(token).digest('hex');
};

// Cleanup expired tokens from cache every hour
const TOKEN_CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour
setInterval(async () => {
    const now = Date.now();
    let cleaned = 0;
    
    // Clean local cache
    for (const [tokenHash, expiresAt] of blacklistCache) {
        if (expiresAt < now) {
            blacklistCache.delete(tokenHash);
            cleaned++;
        }
    }
    
    // Clean Supabase (async, don't block — skip if DB not configured)
    try {
        if (dbConfigured()) {
            await statements.cleanupExpiredBlacklistTokens();
        }
    } catch (err) {
        console.error('Error cleaning Supabase blacklist:', err.message);
    }
    
    if (cleaned > 0) {
        console.log(`🧹 Token blacklist cleanup: removed ${cleaned} expired tokens from cache`);
    }
}, TOKEN_CLEANUP_INTERVAL);

// Add token to blacklist (both cache and Supabase)
const blacklistToken = async (token, userId = null, sessionId = null, expiresInMs = 24 * 60 * 60 * 1000, reason = 'logout') => {
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + expiresInMs);
    
    // Add to local cache for immediate effect
    blacklistCache.set(tokenHash, expiresAt.getTime());
    
    // Persist to Supabase (async, don't block)
    try {
        await statements.addToBlacklist(tokenHash, sessionId, userId, expiresAt.toISOString(), reason);
    } catch (err) {
        console.error('Error persisting to blacklist:', err.message);
        // Continue - local cache still works
    }
};

// Check if token is blacklisted (check cache first, then Supabase)
const isTokenBlacklisted = async (token) => {
    const tokenHash = hashToken(token);
    
    // Check local cache first (fast)
    if (blacklistCache.has(tokenHash)) {
        const expiresAt = blacklistCache.get(tokenHash);
        if (expiresAt > Date.now()) {
            return true;
        }
        // Expired in cache, remove it
        blacklistCache.delete(tokenHash);
    }
    
    // Check Supabase (for tokens blacklisted on other server instances)
    try {
        const isBlacklisted = await statements.isTokenBlacklisted(tokenHash);
        if (isBlacklisted) {
            // Add to cache for future fast lookups
            blacklistCache.set(tokenHash, Date.now() + 24 * 60 * 60 * 1000);
        }
        return isBlacklisted;
    } catch (err) {
        console.error('Error checking blacklist in Supabase:', err.message);
        // On error, rely only on local cache
        return false;
    }
};

// Authentication middleware
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const tokenFromHeader = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    const tokenFromCookie = req.cookies?.auth_token;
    const token = tokenFromHeader || tokenFromCookie;

    if (!token) {
        return res.status(401).json({ message: 'Token de acceso requerido' });
    }

    // Check if token is blacklisted
    const blacklisted = await isTokenBlacklisted(token);
    if (blacklisted) {
        return res.status(401).json({ message: 'Token revocado. Por favor inicia sesión nuevamente.' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ message: 'Token inválido o expirado' });
        }
        req.user = user;
        req.token = token; // Store token for logout
        next();
    });
};

// Admin-only middleware (use after authenticateToken)
const requireAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Acceso denegado' });
    }
    next();
};

module.exports = {
    authenticateToken,
    requireAdmin,
    blacklistToken,
    isTokenBlacklisted,
    hashToken
};
