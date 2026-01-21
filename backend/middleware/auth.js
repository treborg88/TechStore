// middleware/auth.js - Authentication middleware and token blacklist
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config');

// --- Token Blacklist (in-memory) ---
// Map: token -> expiration timestamp (ms)
const tokenBlacklist = new Map();

// Cleanup expired tokens every hour
const TOKEN_CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour
setInterval(() => {
    const now = Date.now();
    let cleaned = 0;
    for (const [token, expiresAt] of tokenBlacklist) {
        if (expiresAt < now) {
            tokenBlacklist.delete(token);
            cleaned++;
        }
    }
    if (cleaned > 0) {
        console.log(`🧹 Token blacklist cleanup: removed ${cleaned} expired tokens`);
    }
}, TOKEN_CLEANUP_INTERVAL);

// Add token to blacklist
const blacklistToken = (token, expiresInMs = 24 * 60 * 60 * 1000) => {
    tokenBlacklist.set(token, Date.now() + expiresInMs);
};

// Check if token is blacklisted
const isTokenBlacklisted = (token) => {
    return tokenBlacklist.has(token);
};

// Authentication middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const tokenFromHeader = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    const tokenFromCookie = req.cookies?.auth_token;
    const token = tokenFromHeader || tokenFromCookie;

    if (!token) {
        return res.status(401).json({ message: 'Token de acceso requerido' });
    }

    // Check if token is blacklisted
    if (isTokenBlacklisted(token)) {
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
    tokenBlacklist
};
