// middleware/csrf.js - CSRF protection
const crypto = require('crypto');
const { NODE_ENV } = require('../config');

const createCsrfToken = () => crypto.randomBytes(32).toString('hex');

const getCookieOptions = (req) => {
    const origin = req?.headers?.origin || '';
    const host = req?.headers?.host || '';
    const forwardedProto = req?.headers?.['x-forwarded-proto'] || '';
    
    const isLocal = origin.includes('localhost') || origin.includes('127.0.0.1') || 
                    host.includes('localhost') || host.includes('127.0.0.1');
    
    // Check if connection is secure (HTTPS)
    const isSecureProtocol = req.protocol === 'https' || forwardedProto === 'https';
    const isSecureOrigin = origin.startsWith('https://');
    const isProduction = NODE_ENV === 'production';
    
    // For mobile/external access over HTTP, we need to be more permissive
    const isExternalHttp = !isLocal && !isSecureProtocol && !isSecureOrigin;
    
    // Secure cookies only work over HTTPS
    const secure = isSecureProtocol || isSecureOrigin;
    
    // sameSite: 'none' requires secure: true, otherwise use 'lax'
    // For external HTTP access, use 'lax' to allow cookies
    const sameSite = secure ? 'none' : 'lax';

    return { secure, sameSite, isExternalHttp };
};

// Set CSRF cookie — reuses existing token if present to avoid multi-tab conflicts
const setCsrfCookie = (req, res, { forceNew = false } = {}) => {
    const { secure, sameSite } = getCookieOptions(req);
    // Reuse existing cookie token unless forced (login/register always force new)
    const existing = !forceNew ? req.cookies?.['XSRF-TOKEN'] : null;
    const csrfToken = existing || createCsrfToken();

    res.cookie('XSRF-TOKEN', csrfToken, {
        httpOnly: false, // JS must read this
        secure,
        sameSite,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours (matches token expiry)
        path: '/'
    });

    return csrfToken;
};

// Set auth + CSRF cookies — forces new CSRF token on login/register (new session)
const setAuthCookies = (req, res, token) => {
    const { secure, sameSite } = getCookieOptions(req);

    res.cookie('auth_token', token, {
        httpOnly: true, // JS cannot read this
        secure,
        sameSite,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        path: '/'
    });

    // Force new CSRF token on authentication (new session = new CSRF)
    return setCsrfCookie(req, res, { forceNew: true });
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

    // Skip auth endpoints that don't need CSRF protection
    // Logout is exempt: only blacklists the JWT, no sensitive data modification
    const csrfExemptPaths = [
        '/api/auth/login',
        '/api/auth/register',
        '/api/auth/forgot-password',
        '/api/auth/reset-password',
        '/api/auth/logout'
    ];
    if (csrfExemptPaths.some(path => req.path.startsWith(path))) {
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

    // Log for debugging mobile issues
    if (!csrfCookie || !csrfHeader) {
        console.log('CSRF Debug:', {
            method,
            path: req.path,
            hasAuthCookie,
            hasCsrfCookie: !!csrfCookie,
            hasCsrfHeader: !!csrfHeader,
            origin: req.headers.origin,
            userAgent: req.headers['user-agent']?.substring(0, 50)
        });
    }

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
