// middleware/planLimits.js — Enforce plan resource limits per tenant
// Usage: router.post('/', checkLimit('products'), handler)
// Skip: when not in SaaS mode or when plan limit is -1 (unlimited).

const config = require('../config');
const { withTenantSchema } = require('../database');
const { pool } = require('../database');

// Count queries per resource type (executed inside tenant schema)
const COUNT_QUERIES = {
  products: 'SELECT COUNT(*) FROM products',
  orders_month: `SELECT COUNT(*) FROM orders WHERE created_at >= date_trunc('month', NOW())`,
};

/**
 * Middleware factory that blocks requests when a tenant exceeds a plan limit.
 * @param {string} resource - 'products' | 'orders_month'
 * @returns {Function} Express middleware
 */
function checkLimit(resource) {
  return async (req, res, next) => {
    // Skip outside SaaS tenant context
    if (!req.tenant) return next();

    try {
      // Fetch tenant's active plan
      const planResult = await pool.query(
        `SELECT p.* FROM public.plans p
         JOIN public.tenants t ON t.plan_id = p.id
         WHERE t.id = $1`,
        [req.tenant.id]
      );
      const plan = planResult.rows[0];
      if (!plan) return next();

      // Determine limit key (max_products, max_orders_month)
      const limitKey = `max_${resource}`;
      const limit = plan[limitKey];

      // -1 = unlimited, skip check
      if (limit == null || limit === -1) return next();

      // Count current usage inside tenant schema
      const countQuery = COUNT_QUERIES[resource];
      if (!countQuery) return next();

      const usage = await withTenantSchema(req.tenant.schema_name, async (client) => {
        const r = await client.query(countQuery);
        return parseInt(r.rows[0].count, 10);
      });

      if (usage >= limit) {
        return res.status(403).json({
          message: `Límite de ${resource} alcanzado (${usage}/${limit} en plan ${plan.name})`,
          upgrade_url: `https://${req.tenant.slug}.${config.PLATFORM_DOMAIN}/admin/subscription`,
        });
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { checkLimit };
