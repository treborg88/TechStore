// middleware/tenant.js — Resolve tenant from Host header (SaaS multi-tenant)
// Sets req.tenant with tenant data when a valid subdomain is detected.
// Bypasses system subdomains (app, admin, www, staging) and localhost.

const config = require('../config');

// In-memory cache: slug → { tenant, expiresAt }
const tenantCache = new Map();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Factory: returns tenant resolution middleware.
 * Requires the pool to query public.tenants.
 * @param {import('pg').Pool} pool - PostgreSQL connection pool
 * @returns {Function} Express middleware
 */
function createTenantMiddleware(pool) {
    return async (req, res, next) => {
        // Skip if SaaS mode is off
        if (config.SAAS_MODE !== 'true') return next();

        const host = req.hostname || req.headers.host?.split(':')[0] || '';
        const parts = host.split('.');

        // Extract subdomain: {slug}.eonsclover.com → slug
        const subdomain = parts.length >= 3 ? parts[0] : null;

        // Bypass: root domain, system subdomains, localhost
        const systemSlugs = ['app', 'admin', 'staging', 'www'];
        if (!subdomain || systemSlugs.includes(subdomain) || host === 'localhost') {
            return next();
        }

        // Cache lookup
        const cached = tenantCache.get(subdomain);
        if (cached && Date.now() < cached.expiresAt) {
            req.tenant = cached.tenant;
            return next();
        }

        try {
            const result = await pool.query(
                `SELECT id, slug, name, plan_id, status, schema_name, trial_ends_at, custom_domain
                 FROM public.tenants WHERE slug = $1`,
                [subdomain]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ message: 'Tienda no encontrada' });
            }

            const tenant = result.rows[0];

            // Check tenant status
            if (tenant.status === 'suspended') {
                return res.status(403).json({ message: 'Tienda suspendida. Contacta soporte.' });
            }
            if (tenant.status === 'cancelled') {
                return res.status(410).json({ message: 'Tienda cancelada.' });
            }
            if (tenant.status === 'trial' && new Date() > new Date(tenant.trial_ends_at)) {
                return res.status(402).json({
                    message: 'Período de prueba expirado. Activa un plan.',
                    upgrade_url: 'https://app.eonsclover.com/pricing'
                });
            }

            // Cache tenant data
            tenantCache.set(subdomain, { tenant, expiresAt: Date.now() + CACHE_TTL_MS });
            req.tenant = tenant;
            next();

        } catch (err) {
            console.error('[tenantMiddleware] Error:', err.message);
            next(err);
        }
    };
}

/**
 * Invalidate cached tenant data (call on suspend/reactivate/plan change).
 * @param {string} slug - Tenant slug to invalidate
 */
function invalidateTenantCache(slug) {
    tenantCache.delete(slug);
}

/** Clear the entire tenant cache (for testing or deployments). */
function clearTenantCache() {
    tenantCache.clear();
}

module.exports = { createTenantMiddleware, invalidateTenantCache, clearTenantCache };
