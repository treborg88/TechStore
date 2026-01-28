// middleware/csrf.js - CSRF protection
const crypto = require('crypto');
const { NODE_ENV } = require('../config');

const createCsrfToken = () => crypto.randomBytes(32).toString('hex');

const getCookieOptions = (req) => {
    const origin = req?.headers?.origin || '';
    const isLocal = origin.includes('localhost') || origin.includes('127.0.0.1');
    
    // Improved secure detection for proxies/tunnels (like devtunnels) where Origin might be missing on GET
    // TRUST_PROXY must be enabled in express app for req.protocol to be reliable behind proxy
    const isSecureProtocol = req.protocol === 'https';
    const isSecureOrigin = origin.startsWith('https://');
    const isSecure = NODE_ENV === 'production' || isSecureOrigin || isSecureProtocol;

    const secure = isSecure;
    // sameSite: 'none' requires secure: true
    const sameSite = isLocal ? 'lax' : 'none';

    return { secure, sameSite };
};

const setCsrfCookie = (req, res) => {
    const { secure, sameSite } = getCookieOptions(req);
    const csrfToken = createCsrfToken();

    res.cookie('XSRF-TOKEN', csrfToken, {
        httpOnly: false, // JS must read this
        secure,
        sameSite,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours (matches token expiry)
        path: '/'
    });

    return csrfToken;
};

const setAuthCookies = (req, res, token) => {
    const { secure, sameSite } = getCookieOptions(req);

    res.cookie('auth_token', token, {
        httpOnly: true, // JS cannot read this
        secure,
        sameSite,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        path: '/'
    });

    return setCsrfCookie(req, res);
};

// Clear auth cookies (for logout or session reset)
const clearAuthCookies = (req, res) => {
    const { secure, sameSite } = getCookieOptions(req);
    
    res.cookie('auth_token', '', {
        httpOnly: true,
        secure,
        sameSite,
        maxAge: 0,
        path: '/'
    });
    
    res.cookie('XSRF-TOKEN', '', {
        httpOnly: false,
        secure,
        sameSite,
        maxAge: 0,
        path: '/'
    });
};

const csrfProtection = (req, res, next) => {
    const method = req.method.toUpperCase();
    
    // Skip safe methods
    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
        return next();
    }

    // Skip if no auth cookie (public endpoints)
    const hasAuthCookie = !!req.cookies?.auth_token;
    if (!hasAuthCookie) {
        return next();
    }

    // Validate CSRF token
    const csrfCookie = req.cookies['XSRF-TOKEN'];
    const csrfHeader = req.headers['x-csrf-token'];

    if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
        return res.status(403).json({ message: 'Token CSRF inválido o ausente' });
    }

    next();
};

module.exports = {
    createCsrfToken,
    getCookieOptions,
    setCsrfCookie,
    setAuthCookies,
    clearAuthCookies,
    csrfProtection
};
