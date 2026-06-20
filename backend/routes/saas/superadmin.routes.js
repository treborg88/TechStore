// routes/saas/superadmin.routes.js - Super admin panel API
// Protected by x-super-admin-secret header — only platform owner access
const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const router = express.Router();
const config = require('../../config');
const db = require('../../database');
const { withTenantSchema } = db;
const backupService = require('../../services/backup.service');
const nodemailer = require('nodemailer');

// Direct env-var transporter for OTP — bypasses DB settings query (pre-auth context)
const _sendOtpEmail = async (to, code) => {
    const transporter = nodemailer.createTransport({
        service: config.EMAIL_SERVICE || 'gmail',
        host: config.EMAIL_HOST || undefined,
        port: config.EMAIL_PORT ? Number(config.EMAIL_PORT) : undefined,
        auth: { user: config.EMAIL_USER, pass: config.EMAIL_PASS }
    });
    await transporter.sendMail({
        from: `${config.BRAND} Admin <${config.EMAIL_USER}>`,
        to,
        subject: `\uD83D\uDD10 C\u00f3digo de acceso \u2014 ${config.BRAND} Super Admin`,
        html: `
            <div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto;padding:32px;">
                <h2 style="color:#0f172a;margin-bottom:8px;">C\u00f3digo de autenticaci\u00f3n</h2>
                <p style="color:#475569;margin-bottom:24px;">Usa este c\u00f3digo para acceder al panel de Super Admin. Expira en <strong>5 minutos</strong>.</p>
                <div style="background:#f1f5f9;border-radius:12px;padding:24px;text-align:center;letter-spacing:0.3em;font-size:2rem;font-weight:700;color:#0f172a;">${code}</div>
                <p style="color:#94a3b8;font-size:0.75rem;margin-top:24px;">Si no solicitaste este c\u00f3digo, ignora este mensaje.</p>
            </div>
        `
    });
};

// ── Super Admin Auth Middleware ────────────────────────────────────────────────
// Validates the x-super-admin-secret header against env var
function requireSuperAdmin(req, res, next) {
    const secret = req.headers['x-super-admin-secret'];
    if (!config.SUPER_ADMIN_SECRET || !secret) {
        return res.status(403).json({ message: 'Acceso denegado' });
    }
    // Use timing-safe comparison to prevent secret enumeration via timing attacks
    const expected = Buffer.from(config.SUPER_ADMIN_SECRET);
    const provided = Buffer.from(secret);
    if (expected.length !== provided.length ||
        !crypto.timingSafeEqual(expected, provided)) {
        return res.status(403).json({ message: 'Acceso denegado' });
    }
    next();
}

// ── In-memory OTP + device token stores ──────────────────────────────────────
// NOTE: Single-process safe; for multi-process deployments use Redis/DB
const _otpStore     = new Map(); // email  -> { code, expires }
const _deviceTokens = new Map(); // token  -> { email, expires }

// Purge expired entries every hour
setInterval(() => {
    const now = Date.now();
    for (const [k, v] of _otpStore)     if (now > v.expires)     _otpStore.delete(k);
    for (const [k, v] of _deviceTokens) if (now > v.expires) _deviceTokens.delete(k);
}, 60 * 60 * 1000);

// ── POST /send-otp — validate credentials, send 6-digit OTP to admin email ────
router.post('/send-otp', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password || !config.SUPER_ADMIN_EMAIL || !config.SUPER_ADMIN_SECRET) {
        return res.status(401).json({ message: 'Credenciales inválidas.' });
    }
    const emailOk = email.trim().toLowerCase() === config.SUPER_ADMIN_EMAIL.toLowerCase();
    let secretOk = false;
    try {
        const expected = Buffer.from(config.SUPER_ADMIN_SECRET);
        const provided = Buffer.from(password);
        secretOk = expected.length === provided.length && crypto.timingSafeEqual(expected, provided);
    } catch { secretOk = false; }

    if (!emailOk || !secretOk) {
        return res.status(401).json({ message: 'Credenciales inválidas.' });
    }

    // Generate and store 6-digit OTP (5-min expiry)
    const code = String(Math.floor(100000 + Math.random() * 900000));
    _otpStore.set(email.trim().toLowerCase(), { code, expires: Date.now() + 5 * 60 * 1000 });

    try {
        await _sendOtpEmail(email.trim(), code);
        res.json({ success: true });
    } catch (err) {
        console.error('Error sending OTP email:', err.message);
        res.status(500).json({ message: 'Error enviando el código por email.' });
    }
});

// ── POST /verify-otp — validate OTP, issue device token if requested ──────────
router.post('/verify-otp', (req, res) => {
    const { email, code, rememberDevice } = req.body;
    if (!email || !code) return res.status(400).json({ message: 'Faltan parámetros.' });

    const key    = email.trim().toLowerCase();
    const stored = _otpStore.get(key);
    if (!stored || String(code).trim() !== stored.code || Date.now() > stored.expires) {
        return res.status(401).json({ message: 'Código inválido o expirado.' });
    }
    _otpStore.delete(key); // Single-use

    let deviceToken = null;
    if (rememberDevice) {
        deviceToken = crypto.randomBytes(32).toString('hex');
        _deviceTokens.set(deviceToken, { email: key, expires: Date.now() + 30 * 24 * 60 * 60 * 1000 });
    }
    res.json({ success: true, deviceToken });
});

// ── POST /verify-device — check if remembered device token is still valid ─────
router.post('/verify-device', (req, res) => {
    const { deviceToken, email, password } = req.body;
    if (!deviceToken || !email || !password) return res.json({ valid: false });

    // Still validate credentials before trusting device token
    const emailOk = email.trim().toLowerCase() === (config.SUPER_ADMIN_EMAIL || '').toLowerCase();
    let secretOk = false;
    try {
        const expected = Buffer.from(config.SUPER_ADMIN_SECRET);
        const provided = Buffer.from(password);
        secretOk = expected.length === provided.length && crypto.timingSafeEqual(expected, provided);
    } catch { secretOk = false; }

    if (!emailOk || !secretOk) return res.json({ valid: false });

    const stored = _deviceTokens.get(deviceToken);
    if (!stored || Date.now() > stored.expires || stored.email !== email.trim().toLowerCase()) {
        _deviceTokens.delete(deviceToken);
        return res.json({ valid: false });
    }
    res.json({ valid: true });
});

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
        const countResult = await db.pool.query(
            `SELECT COUNT(*) FROM public.tenants t ${where}`, params
        );
        const total = parseInt(countResult.rows[0].count);

        // Fetch tenants with plan info
        params.push(parseInt(limit), offset);
        const result = await db.pool.query(`
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

router.post('/database/backup/all-tenants', async (req, res) => {
    try {
        const { name, version, includePublicSchema = true } = req.body || {};
        const result = await backupService.createBusinessWideBackup({
            name,
            version,
            includePublicSchema
        });
        res.json(result);
    } catch (err) {
        console.error('SuperAdmin all-tenants backup error:', err);
        res.status(500).json({ message: 'Error al crear backup de todos los tenants' });
    }
});

router.post('/database/restore/all-tenants', async (req, res) => {
    try {
        const { filename, confirmText, includePublicSchema = true } = req.body || {};
        if (!filename) {
            return res.status(400).json({ message: 'filename es requerido' });
        }

        const result = await backupService.restoreBusinessWideBackup({
            filename,
            confirmText,
            includePublicSchema
        });

        res.json(result);
    } catch (err) {
        console.error('SuperAdmin all-tenants restore error:', err);
        res.status(500).json({ message: err.message || 'Error al restaurar backup de todos los tenants' });
    }
});

// ── GET /tenants/:id — Tenant detail with usage ──────────────────────────────
router.get('/tenants/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Tenant + plan + subscription
        const tenantResult = await db.pool.query(`
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
        const auditResult = await db.pool.query(
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

        const result = await db.pool.query(
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
        await db.pool.query(
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
        const planCheck = await db.pool.query('SELECT id FROM public.plans WHERE id = $1 AND is_active = true', [plan_id]);
        if (!planCheck.rows.length) {
            return res.status(400).json({ message: 'Plan no encontrado o inactivo' });
        }

        // Update tenant + subscription in transaction
        const client = await db.pool.connect();
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
        const tenantResult = await db.pool.query('SELECT * FROM public.tenants WHERE id = $1', [id]);
        if (!tenantResult.rows.length) {
            return res.status(404).json({ message: 'Tenant no encontrado' });
        }
        const tenant = tenantResult.rows[0];

        // Find admin user in tenant schema; create one if none exists
        let adminUser;
        const adminResult = await withTenantSchema(tenant.schema_name, (client) =>
            client.query(`SELECT id, email, name FROM users WHERE role = 'admin' LIMIT 1`)
        );
        if (!adminResult.rows.length) {
            // Create a temporary admin user for impersonation
            await withTenantSchema(tenant.schema_name, (client) =>
                client.query(
                    `INSERT INTO users (name, email, password, role, is_active, created_at)
                     VALUES ($1, $2, $3, 'admin', true, NOW())
                     ON CONFLICT (email) DO NOTHING`,
                    ['Impersonated Admin', `impersonated@${tenant.slug}.local`, crypto.randomUUID()]
                )
            );
            const newAdmin = await withTenantSchema(tenant.schema_name, (client) =>
                client.query(`SELECT id, email, name FROM users WHERE role = 'admin' LIMIT 1`)
            );
            if (!newAdmin.rows.length) {
                return res.status(500).json({ message: 'No se pudo crear usuario admin para este tenant' });
            }
            adminUser = newAdmin.rows[0];
        } else {
            adminUser = adminResult.rows[0];
        }

        // Generate short-lived impersonation token (1h)
        const token = jwt.sign(
            {
                id: adminUser.id,
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
        await db.pool.query(
            `INSERT INTO public.audit_log (tenant_id, action, actor, details) VALUES ($1, $2, $3, $4)`,
            [id, 'impersonate', config.SUPER_ADMIN_EMAIL || 'superadmin', JSON.stringify({ admin_email: adminUser.email })]
        );

        res.json({
            token,
            redirectUrl: `https://${tenant.slug}.${config.PLATFORM_DOMAIN}/admin?token=${token}`,
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

        const tenantResult = await db.pool.query('SELECT slug, schema_name FROM public.tenants WHERE id = $1', [id]);
        if (!tenantResult.rows.length) {
            return res.status(404).json({ message: 'Tenant no encontrado' });
        }

        const { deprovisionTenant } = require('../../services/tenant');
        await deprovisionTenant(db.pool, { 
            slug: tenantResult.rows[0].slug, 
            confirm: `DELETE_${tenantResult.rows[0].slug.toUpperCase()}` 
        });

        // Invalidate cache
        const { invalidateTenantCache } = require('../../middleware');
        invalidateTenantCache(tenantResult.rows[0].slug);

        res.json({ message: 'Tenant eliminado' });
    } catch (err) {
        console.error('SuperAdmin delete tenant error:', err);
        res.status(500).json({ 
            message: 'Error al eliminar tenant',
            error: err.message,
            stack: err.stack
        });
    }
});

// ── GET /database/backups — List business-wide backups ────────────────────────
router.get('/database/backups', async (req, res) => {
    try {
        const archives = await backupService.storage.listArchives();
        const businessBackups = archives.filter(a =>
            a.filename.startsWith('saas-business-backup')
        );
        res.json({ backups: businessBackups });
    } catch (err) {
        console.error('List business backups error:', err);
        res.status(500).json({ message: err.message || 'Error al listar backups' });
    }
});

// ── GET /database/backups/:filename/download — Download business backup ───────
router.get('/database/backups/:filename/download', async (req, res) => {
    try {
        const filename = backupService.sanitizeFilename(req.params.filename);
        if (!filename) return res.status(400).json({ message: 'Nombre de archivo inválido' });

        const filePath = await backupService.storage.getArchivePath(filename);
        res.setHeader('Content-Type', 'application/gzip');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.download(filePath, filename, (err) => {
            if (err) {
                backupService.storage.cleanupDownloadedArchive(filePath).catch(() => {});
            }
        });
    } catch (err) {
        console.error('Download business backup error:', err);
        res.status(404).json({ message: err.message || 'Backup no encontrado' });
    }
});

// ── DELETE /database/backups/:filename — Delete business backup ───────────────
router.delete('/database/backups/:filename', async (req, res) => {
    try {
        const filename = backupService.sanitizeFilename(req.params.filename);
        if (!filename) return res.status(400).json({ message: 'Nombre de archivo inválido' });

        await backupService.storage.deleteArchive(filename);
        res.json({ success: true, message: `Backup ${filename} eliminado` });
    } catch (err) {
        console.error('Delete business backup error:', err);
        res.status(500).json({ message: err.message || 'Error al eliminar backup' });
    }
});

// ── GET /metrics — Global platform KPIs ──────────────────────────────────────
router.get('/metrics', async (req, res) => {
    try {
        const [tenantCounts, planCounts, mrr, trialAlerts] = await Promise.all([
            // Tenant counts by status
            db.pool.query(`
                SELECT status, COUNT(*) AS count
                FROM public.tenants
                GROUP BY status
            `),
            // Tenant counts by plan
            db.pool.query(`
                SELECT t.plan_id, p.name AS plan_name, COUNT(*) AS count
                FROM public.tenants t
                LEFT JOIN public.plans p ON t.plan_id = p.id
                GROUP BY t.plan_id, p.name
            `),
            // Monthly recurring revenue (active tenants only)
            db.pool.query(`
                SELECT COALESCE(SUM(p.price_monthly), 0) AS mrr
                FROM public.tenants t
                JOIN public.plans p ON t.plan_id = p.id
                WHERE t.status IN ('active', 'trial')
            `),
            // Trials expiring within 3 days
            db.pool.query(`
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

// ── GET /database/schemas — List all schemas + their tables (read-only) ───────
router.get('/database/schemas', async (req, res) => {
    try {
        // Fetch only public + tenant_* schemas
        const schemasResult = await db.pool.query(`
            SELECT schema_name FROM information_schema.schemata
            WHERE schema_name = 'public' OR schema_name LIKE 'tenant_%'
            ORDER BY schema_name
        `);

        const result = {};
        for (const { schema_name } of schemasResult.rows) {
            const tablesResult = await db.pool.query(`
                SELECT table_name FROM information_schema.tables
                WHERE table_schema = $1 AND table_type = 'BASE TABLE'
                ORDER BY table_name
            `, [schema_name]);
            result[schema_name] = tablesResult.rows.map(r => r.table_name);
        }

        res.json(result);
    } catch (err) {
        console.error('SuperAdmin database schemas error:', err);
        res.status(500).json({ message: 'Error al obtener esquemas' });
    }
});

// ── GET /database/:schema/table/:table — Paginated rows (read-only) ───────────
router.get('/database/:schema/table/:table', async (req, res) => {
    try {
        const { schema, table } = req.params;
        const page  = Math.max(1, parseInt(req.query.page)  || 1);
        const limit = Math.min(100, parseInt(req.query.limit) || 50);
        const offset = (page - 1) * limit;

        // Strict allowlist validation — prevents SQL injection via identifier
        if (!/^(public|tenant_[a-z0-9_]+)$/.test(schema)) {
            return res.status(400).json({ message: 'Schema inválido' });
        }
        if (!/^[a-z_][a-z0-9_]*$/.test(table)) {
            return res.status(400).json({ message: 'Tabla inválida' });
        }

        // Verify the table actually exists in the schema before querying
        const exists = await db.pool.query(
            `SELECT 1 FROM information_schema.tables
             WHERE table_schema = $1 AND table_name = $2 AND table_type = 'BASE TABLE'`,
            [schema, table]
        );
        if (!exists.rows.length) {
            return res.status(404).json({ message: 'Tabla no encontrada' });
        }

        const countResult = await db.pool.query(`SELECT COUNT(*) FROM "${schema}"."${table}"`);
        const total = parseInt(countResult.rows[0].count);

        const dataResult = await db.pool.query(
            `SELECT * FROM "${schema}"."${table}" LIMIT $1 OFFSET $2`,
            [limit, offset]
        );

        res.json({
            columns: dataResult.fields.map(f => f.name),
            rows: dataResult.rows,
            total,
            page,
            totalPages: Math.ceil(total / limit)
        });
    } catch (err) {
        console.error('SuperAdmin table data error:', err);
        res.status(500).json({ message: 'Error al obtener datos de la tabla' });
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
        const result = await db.pool.query(`
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
