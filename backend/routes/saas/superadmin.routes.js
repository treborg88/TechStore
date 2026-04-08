// routes/saas/superadmin.routes.js - Super admin panel API
// Protected by x-super-admin-secret header — only platform owner access
const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const router = express.Router();
const config = require('../../config');
const { pool, withTenantSchema } = require('../../database');

// ── Super Admin Auth Middleware ────────────────────────────────────────────────
// Validates the x-super-admin-secret header against env var
function requireSuperAdmin(req, res, next) {
    const secret = req.headers['x-super-admin-secret'];
    if (!config.SUPER_ADMIN_SECRET || secret !== config.SUPER_ADMIN_SECRET) {
        return res.status(403).json({ message: 'Acceso denegado' });
    }
    next();
}

// All routes in this router require super admin auth
router.use(requireSuperAdmin);

// ── GET /tenants — List all tenants with filters ──────────────────────────────
router.get('/tenants', async (req, res) => {
    try {
        const { status, plan, search, page = 1, limit = 20 } = req.query;
        const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);
        const params = [];
        const conditions = [];

        // Dynamic WHERE clauses
        if (status) {
            params.push(status);
            conditions.push(`t.status = $${params.length}`);
        }
        if (plan) {
            params.push(plan);
            conditions.push(`t.plan_id = $${params.length}`);
        }
        if (search) {
            params.push(`%${search.slice(0, 100)}%`);
            conditions.push(`(t.name ILIKE $${params.length} OR t.slug ILIKE $${params.length} OR t.owner_email ILIKE $${params.length})`);
        }

        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

        // Count total
        const countResult = await pool.query(
            `SELECT COUNT(*) FROM public.tenants t ${where}`, params
        );
        const total = parseInt(countResult.rows[0].count);

        // Fetch tenants with plan info
        params.push(parseInt(limit), offset);
        const result = await pool.query(`
            SELECT t.*, p.name AS plan_name, p.price_monthly,
                   s.status AS subscription_status, s.current_period_end
            FROM public.tenants t
            LEFT JOIN public.plans p ON t.plan_id = p.id
            LEFT JOIN public.subscriptions s ON s.tenant_id = t.id
            ${where}
            ORDER BY t.created_at DESC
            LIMIT $${params.length - 1} OFFSET $${params.length}
        `, params);

        res.json({
            data: result.rows,
            total,
            page: parseInt(page),
            totalPages: Math.ceil(total / parseInt(limit))
        });
    } catch (err) {
        console.error('SuperAdmin list tenants error:', err);
        res.status(500).json({ message: 'Error al listar tenants' });
    }
});

// ── GET /tenants/:id — Tenant detail with usage ──────────────────────────────
router.get('/tenants/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Tenant + plan + subscription
        const tenantResult = await pool.query(`
            SELECT t.*, p.name AS plan_name, p.price_monthly,
                   p.max_products, p.max_orders_month, p.max_storage_mb,
                   s.status AS subscription_status, s.current_period_start,
                   s.current_period_end, s.cancelled_at
            FROM public.tenants t
            LEFT JOIN public.plans p ON t.plan_id = p.id
            LEFT JOIN public.subscriptions s ON s.tenant_id = t.id
            WHERE t.id = $1
        `, [id]);

        if (!tenantResult.rows.length) {
            return res.status(404).json({ message: 'Tenant no encontrado' });
        }
        const tenant = tenantResult.rows[0];

        // Usage counts from tenant schema
        let usage = { products: 0, orders_month: 0, users: 0 };
        try {
            usage = await withTenantSchema(tenant.schema_name, async (client) => {
                const [prodRes, ordRes, usrRes] = await Promise.all([
                    client.query('SELECT COUNT(*) FROM products'),
                    client.query(`SELECT COUNT(*) FROM orders WHERE date_trunc('month', created_at) = date_trunc('month', NOW())`),
                    client.query('SELECT COUNT(*) FROM users')
                ]);
                return {
                    products: parseInt(prodRes.rows[0].count),
                    orders_month: parseInt(ordRes.rows[0].count),
                    users: parseInt(usrRes.rows[0].count)
                };
            });
        } catch { /* Schema may not exist yet */ }

        // Recent audit log entries
        const auditResult = await pool.query(
            `SELECT * FROM public.audit_log WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 20`,
            [id]
        );

        res.json({ ...tenant, usage, audit_log: auditResult.rows });
    } catch (err) {
        console.error('SuperAdmin tenant detail error:', err);
        res.status(500).json({ message: 'Error al obtener detalle del tenant' });
    }
});

// ── PUT /tenants/:id/status — Suspend / reactivate tenant ────────────────────
router.put('/tenants/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body; // 'active' | 'suspended' | 'cancelled'
        const validStatuses = ['trial', 'active', 'suspended', 'cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ message: `Estado inválido. Válidos: ${validStatuses.join(', ')}` });
        }

        const result = await pool.query(
            `UPDATE public.tenants SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING slug, status`,
            [status, id]
        );
        if (!result.rows.length) {
            return res.status(404).json({ message: 'Tenant no encontrado' });
        }

        // Invalidate tenant cache so changes take effect immediately
        const { invalidateTenantCache } = require('../../middleware');
        invalidateTenantCache(result.rows[0].slug);

        // Audit log
        await pool.query(
            `INSERT INTO public.audit_log (tenant_id, action, actor, details) VALUES ($1, $2, $3, $4)`,
            [id, 'status_change', config.SUPER_ADMIN_EMAIL || 'superadmin', JSON.stringify({ new_status: status })]
        );

        res.json({ message: `Tenant ${status === 'suspended' ? 'suspendido' : 'actualizado'}`, tenant: result.rows[0] });
    } catch (err) {
        console.error('SuperAdmin status change error:', err);
        res.status(500).json({ message: 'Error al cambiar estado del tenant' });
    }
});

// ── PUT /tenants/:id/plan — Change tenant plan ───────────────────────────────
router.put('/tenants/:id/plan', async (req, res) => {
    try {
        const { id } = req.params;
        const { plan_id } = req.body;

        // Verify plan exists
        const planCheck = await pool.query('SELECT id FROM public.plans WHERE id = $1 AND is_active = true', [plan_id]);
        if (!planCheck.rows.length) {
            return res.status(400).json({ message: 'Plan no encontrado o inactivo' });
        }

        // Update tenant + subscription in transaction
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            await client.query('UPDATE public.tenants SET plan_id = $1, updated_at = NOW() WHERE id = $2', [plan_id, id]);
            await client.query('UPDATE public.subscriptions SET plan_id = $1 WHERE tenant_id = $2', [plan_id, id]);
            await client.query(
                `INSERT INTO public.audit_log (tenant_id, action, actor, details) VALUES ($1, $2, $3, $4)`,
                [id, 'plan_change_by_superadmin', config.SUPER_ADMIN_EMAIL || 'superadmin', JSON.stringify({ new_plan: plan_id })]
            );
            await client.query('COMMIT');
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }

        res.json({ message: 'Plan actualizado' });
    } catch (err) {
        console.error('SuperAdmin plan change error:', err);
        res.status(500).json({ message: 'Error al cambiar plan del tenant' });
    }
});

// ── POST /tenants/:id/impersonate — Generate short-lived tenant admin token ──
router.post('/tenants/:id/impersonate', async (req, res) => {
    try {
        const { id } = req.params;

        // Fetch tenant
        const tenantResult = await pool.query('SELECT * FROM public.tenants WHERE id = $1', [id]);
        if (!tenantResult.rows.length) {
            return res.status(404).json({ message: 'Tenant no encontrado' });
        }
        const tenant = tenantResult.rows[0];

        // Find admin user in tenant schema
        const adminResult = await withTenantSchema(tenant.schema_name, (client) =>
            client.query(`SELECT id, email, name FROM users WHERE role = 'admin' LIMIT 1`)
        );
        if (!adminResult.rows.length) {
            return res.status(404).json({ message: 'No hay usuario admin en este tenant' });
        }
        const adminUser = adminResult.rows[0];

        // Generate short-lived impersonation token (1h)
        const token = jwt.sign(
            {
                userId: adminUser.id,
                role: 'admin',
                tenantId: tenant.id,
                tenantSlug: tenant.slug,
                impersonatedBy: config.SUPER_ADMIN_EMAIL,
                sessionId: crypto.randomUUID()
            },
            config.JWT_SECRET,
            { expiresIn: '1h' }
        );

        // Audit log
        await pool.query(
            `INSERT INTO public.audit_log (tenant_id, action, actor, details) VALUES ($1, $2, $3, $4)`,
            [id, 'impersonate', config.SUPER_ADMIN_EMAIL || 'superadmin', JSON.stringify({ admin_email: adminUser.email })]
        );

        res.json({
            token,
            redirectUrl: `https://${tenant.slug}.eonsclover.com/admin?token=${token}`,
            admin: { id: adminUser.id, email: adminUser.email, name: adminUser.name }
        });
    } catch (err) {
        console.error('SuperAdmin impersonate error:', err);
        res.status(500).json({ message: 'Error al generar token de impersonación' });
    }
});

// ── DELETE /tenants/:id — Decommission tenant ────────────────────────────────
router.delete('/tenants/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { confirm } = req.body; // Require confirmation flag

        if (confirm !== true) {
            return res.status(400).json({ message: 'Confirma la eliminación enviando { confirm: true }' });
        }

        const tenantResult = await pool.query('SELECT slug, schema_name FROM public.tenants WHERE id = $1', [id]);
        if (!tenantResult.rows.length) {
            return res.status(404).json({ message: 'Tenant no encontrado' });
        }

        const { deprovisionTenant } = require('../../services/tenant');
        await deprovisionTenant(id);

        // Invalidate cache
        const { invalidateTenantCache } = require('../../middleware');
        invalidateTenantCache(tenantResult.rows[0].slug);

        res.json({ message: 'Tenant eliminado' });
    } catch (err) {
        console.error('SuperAdmin delete tenant error:', err);
        res.status(500).json({ message: 'Error al eliminar tenant' });
    }
});

// ── GET /metrics — Global platform KPIs ──────────────────────────────────────
router.get('/metrics', async (req, res) => {
    try {
        const [tenantCounts, planCounts, mrr, trialAlerts] = await Promise.all([
            // Tenant counts by status
            pool.query(`
                SELECT status, COUNT(*) AS count
                FROM public.tenants
                GROUP BY status
            `),
            // Tenant counts by plan
            pool.query(`
                SELECT t.plan_id, p.name AS plan_name, COUNT(*) AS count
                FROM public.tenants t
                LEFT JOIN public.plans p ON t.plan_id = p.id
                GROUP BY t.plan_id, p.name
            `),
            // Monthly recurring revenue (active tenants only)
            pool.query(`
                SELECT COALESCE(SUM(p.price_monthly), 0) AS mrr
                FROM public.tenants t
                JOIN public.plans p ON t.plan_id = p.id
                WHERE t.status IN ('active', 'trial')
            `),
            // Trials expiring within 3 days
            pool.query(`
                SELECT id, slug, name, owner_email, trial_ends_at
                FROM public.tenants
                WHERE status = 'trial'
                  AND trial_ends_at <= NOW() + INTERVAL '3 days'
                  AND trial_ends_at > NOW()
                ORDER BY trial_ends_at ASC
            `)
        ]);

        // Build status map
        const statusMap = {};
        tenantCounts.rows.forEach(r => { statusMap[r.status] = parseInt(r.count); });

        res.json({
            tenants: {
                total: Object.values(statusMap).reduce((a, b) => a + b, 0),
                active: statusMap.active || 0,
                trial: statusMap.trial || 0,
                suspended: statusMap.suspended || 0,
                cancelled: statusMap.cancelled || 0
            },
            plans: planCounts.rows.map(r => ({ plan_id: r.plan_id, name: r.plan_name, count: parseInt(r.count) })),
            mrr: parseFloat(mrr.rows[0].mrr),
            trial_alerts: trialAlerts.rows
        });
    } catch (err) {
        console.error('SuperAdmin metrics error:', err);
        res.status(500).json({ message: 'Error al obtener métricas' });
    }
});

// ── GET /audit-log — Global audit log ─────────────────────────────────────────
router.get('/audit-log', async (req, res) => {
    try {
        const { tenant_id, page = 1, limit = 50 } = req.query;
        const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);
        const params = [];
        let where = '';

        if (tenant_id) {
            params.push(tenant_id);
            where = `WHERE a.tenant_id = $${params.length}`;
        }

        params.push(parseInt(limit), offset);
        const result = await pool.query(`
            SELECT a.*, t.slug AS tenant_slug, t.name AS tenant_name
            FROM public.audit_log a
            LEFT JOIN public.tenants t ON a.tenant_id = t.id
            ${where}
            ORDER BY a.created_at DESC
            LIMIT $${params.length - 1} OFFSET $${params.length}
        `, params);

        res.json({ data: result.rows });
    } catch (err) {
        console.error('SuperAdmin audit log error:', err);
        res.status(500).json({ message: 'Error al obtener audit log' });
    }
});

module.exports = router;
