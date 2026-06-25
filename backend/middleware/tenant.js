// middleware/tenant.js â€” Resolve tenant from Host header (SaaS multi-tenant)
// Sets req.tenant with tenant data when a valid subdomain is detected.
// Bypasses system subdomains (app, admin, www, staging) and localhost.

const config = require('../config');

// In-memory cache: slug â†’ { tenant, expiresAt }
const tenantCache = new Map();
// Custom domain â†’ slug reverse map for cache lookups
const domainToSlugCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Factory: returns tenant resolution middleware.
 * Requires the pool to query public.tenants.
 * @param {import('pg').Pool|Function} poolOrGetter - PostgreSQL pool or lazy getter returning the current pool
 * @returns {Function} Express middleware
 */
function createTenantMiddleware(poolOrGetter) {
    return async (req, res, next) => {
        const resolvedPool = typeof poolOrGetter === 'function' ? poolOrGetter() : poolOrGetter;

        // Skip if SaaS mode is off
        if (config.SAAS_MODE !== 'true') return next();

        const host = req.hostname || req.headers.host?.split(':')[0] || '';
        const parts = host.split('.');

        // Determine if this is a known platform domain (*.eonsclover.local or localhost)
        const platformDomain = config.PLATFORM_DOMAIN;
        const isPlatformHost = host.endsWith(`.${platformDomain}`) || host === platformDomain || host === 'localhost'
            || host.endsWith(`.${platformDomain}.local`) || host === `${platformDomain}.local`
            || host.endsWith('.local');

        // Extract subdomain for platform hosts: {slug}.eonsclover.com â†’ slug
        const subdomain = isPlatformHost && parts.length >= 3 ? parts[0] : null;

        // Bypass: system subdomains and root/localhost on platform domain
        const systemSlugs = ['app', 'admin', 'staging', 'www', 'database'];
        if (isPlatformHost && (!subdomain || systemSlugs.includes(subdomain))) {
            return next();
        }

        // --- Resolve tenant: by subdomain (slug) or custom domain ---
        let cacheKey = null;
        let tenant = null;

        if (isPlatformHost && subdomain) {
            // Standard flow: subdomain lookup
            cacheKey = subdomain;
        } else if (!isPlatformHost) {
            // Custom domain flow: check reverse cache or query by custom_domain
            cacheKey = domainToSlugCache.get(host) || null;
        } else {
            return next();
        }

        // Cache lookup
        if (cacheKey) {
            const cached = tenantCache.get(cacheKey);
            if (cached && Date.now() < cached.expiresAt) {
                req.tenant = cached.tenant;
                return next();
            }
        }

        if (!resolvedPool) {
            const err = new Error('Base de datos no configurada');
            err.code = 'DB_NOT_CONFIGURED';
            err.statusCode = 503;
            return next(err);
        }

        try {
            let result;
            if (isPlatformHost && subdomain) {
                // Lookup by slug
                result = await resolvedPool.query(
                    `SELECT id, slug, name, plan_id, status, schema_name, trial_ends_at, custom_domain
                     FROM public.tenants WHERE slug = $1`,
                    [subdomain]
                );
            } else {
                // Lookup by custom domain
                result = await resolvedPool.query(
                    `SELECT id, slug, name, plan_id, status, schema_name, trial_ends_at, custom_domain
                     FROM public.tenants WHERE custom_domain = $1`,
                    [host]
                );
            }

            if (result.rows.length === 0) {
                return res.status(404).json({ message: 'Tienda no encontrada' });
            }

            tenant = result.rows[0];

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
                    upgrade_url: `https://app.${config.PLATFORM_DOMAIN}/pricing`
                });
            }

            // Cache tenant data (by slug, and maintain reverse domain map)
            tenantCache.set(tenant.slug, { tenant, expiresAt: Date.now() + CACHE_TTL_MS });
            if (tenant.custom_domain) {
                domainToSlugCache.set(tenant.custom_domain, tenant.slug);
            }
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
    // Also remove from domain reverse map
    const cached = tenantCache.get(slug);
    if (cached?.tenant?.custom_domain) {
        domainToSlugCache.delete(cached.tenant.custom_domain);
    }
    tenantCache.delete(slug);
}

/** Clear the entire tenant cache (for testing or deployments). */
function clearTenantCache() {
    tenantCache.clear();
    domainToSlugCache.clear();
}

module.exports = { createTenantMiddleware, invalidateTenantCache, clearTenantCache };
