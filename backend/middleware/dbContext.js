// middleware/dbContext.js — Inject tenant-scoped DB client into req.dbClient
// When SAAS_MODE=true and req.tenant exists, acquires a client from pool,
// sets search_path to the tenant schema, and auto-releases on response end.
// When SAAS_MODE=false, req.dbClient is not set (routes use pool directly).
// Uses AsyncLocalStorage so pool.query() automatically routes to the tenant client.

const config = require('../config');

/**
 * Factory: returns dbContext middleware.
 * @param {import('pg').Pool} pool - PostgreSQL connection pool
 * @returns {Function} Express middleware
 */
function createDbContext(pool) {
    // Import tenantContext from the database module (AsyncLocalStorage instance)
    const { tenantContext } = require('../database');

    return async (req, res, next) => {
        // Only wire tenant schema in SaaS mode with a resolved tenant
        if (config.SAAS_MODE !== 'true' || !req.tenant) {
            return next();
        }

        // Validate schema name (prevent injection — only allows tenant_<slug> format)
        const schemaName = req.tenant.schema_name;
        if (!/^tenant_[a-z0-9_]+$/.test(schemaName)) {
            return res.status(500).json({ message: 'Schema de tenant inválido' });
        }

        let client;
        let released = false;

        // Safe release helper (prevents double-release)
        const releaseClient = async (action) => {
            if (released) return;
            released = true;
            try {
                await client.query(action);
            } catch (_) { /* ignore */ }
            client.release();
        };

        try {
            client = await pool.connect();
            await client.query('BEGIN');
            await client.query(`SET LOCAL search_path TO "${schemaName}", public`);
            req.dbClient = client;

            // Auto-cleanup: COMMIT on success, ROLLBACK on premature close
            res.on('finish', () => releaseClient('COMMIT'));
            res.on('close', () => releaseClient('ROLLBACK'));

            // Run downstream middleware/routes inside AsyncLocalStorage context
            // so pool.query() calls are auto-routed to this tenant-scoped client
            tenantContext.run({ client }, () => next());
        } catch (err) {
            if (client && !released) {
                released = true;
                try { await client.query('ROLLBACK'); } catch (_) { /* ignore */ }
                client.release();
            }
            next(err);
        }
    };
}

module.exports = { createDbContext };
