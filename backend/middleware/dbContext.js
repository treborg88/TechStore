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
        let releaseTimer = null;

        const cleanupClient = async (action) => {
            if (released) return;
            released = true;
            if (releaseTimer) {
                clearTimeout(releaseTimer);
                releaseTimer = null;
            }

            try {
                if (client) {
                    await client.query(action);
                }
            } catch (_) {
                /* ignore cleanup errors */
            }

            try {
                if (client) {
                    client.release();
                }
            } catch (_) {
                /* ignore release errors */
            }
        };

        try {
            client = await pool.connect();
            await client.query('BEGIN');
            await client.query(`SET LOCAL search_path TO "${schemaName}", public`);
            req.dbClient = client;

            // Intercept res.end so COMMIT runs before any bytes reach the client.
            // If COMMIT fails on a 2xx response, the status is changed to 500
            // and an error body is sent instead — preventing a silent data loss.
            const originalEnd = res.end.bind(res);
            let endIntercepted = false;

            res.end = function (chunk, encoding, callback) {
                if (endIntercepted || released) {
                    return originalEnd(chunk, encoding, callback);
                }
                endIntercepted = true;

                const shouldCommit = res.statusCode < 400;

                cleanupClient(shouldCommit ? 'COMMIT' : 'ROLLBACK')
                    .then(() => originalEnd(chunk, encoding, callback))
                    .catch((err) => {
                        console.error('Transaction commit failed:', err);
                        if (shouldCommit) {
                            // Swap success body for a 500 error before sending
                            res.statusCode = 500;
                            const errBody = JSON.stringify({ message: 'Error al guardar los datos' });
                            res.setHeader('Content-Type', 'application/json; charset=utf-8');
                            res.setHeader('Content-Length', Buffer.byteLength(errBody, 'utf8'));
                            originalEnd(errBody, 'utf8', callback);
                        } else {
                            originalEnd(chunk, encoding, callback);
                        }
                    });

                return res;
            };

            // ROLLBACK listeners for abrupt close / client abort / response error.
            // If res.end already committed, released=true makes these no-ops.
            res.once('close', () => cleanupClient('ROLLBACK'));
            res.once('error', () => cleanupClient('ROLLBACK'));
            req.once('aborted', () => cleanupClient('ROLLBACK'));

            releaseTimer = setTimeout(() => cleanupClient('ROLLBACK'), 120000);

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
