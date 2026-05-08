// routes/saas/subscription.routes.js — Tenant subscription management
// Requires tenant middleware + auth. Returns plan info, usage, and plan changes.

const { Router } = require('express');
const path = require('path');
const fs = require('fs').promises;
const { pool, withTenantSchema, UPLOADS_DIR } = require('../../database');
const config = require('../../config');
const { authenticateToken, requireAdmin } = require('../../middleware/auth');

const router = Router();

async function calculateStorageMb(imageRows = []) {
  let totalBytes = 0;
  for (const row of imageRows) {
    const imagePath = String(row.image_path || '').trim();
    if (!imagePath || imagePath.startsWith('http')) continue;
    const normalizedPath = imagePath.replace(/^\//, '');
    const filePath = path.join(UPLOADS_DIR, normalizedPath);
    if (!filePath.startsWith(UPLOADS_DIR)) continue;
    try {
      const stats = await fs.stat(filePath);
      if (stats.isFile()) totalBytes += stats.size;
    } catch (err) {
      // Ignore missing files; storage usage is best-effort.
    }
  }
  return Math.round(totalBytes / 1024 / 1024);
}

// All subscription routes require tenant admin
router.use(authenticateToken, requireAdmin);

/**
 * GET /api/subscription
 * Current plan info + usage + dates
 */
router.get('/', async (req, res) => {
  try {
    if (!req.tenant) {
      return res.status(400).json({ message: 'No tenant context' });
    }

    // Fetch tenant + plan + subscription
    const infoResult = await pool.query(
      `SELECT t.id, t.slug, t.name, t.status, t.trial_ends_at, t.plan_id,
              p.name AS plan_name, p.price_monthly,
              p.max_products, p.max_orders_month, p.max_storage_mb, p.features,
              s.current_period_start, s.current_period_end, s.status AS sub_status
       FROM public.tenants t
       JOIN public.plans p ON p.id = t.plan_id
       LEFT JOIN public.subscriptions s ON s.tenant_id = t.id
       WHERE t.id = $1
       ORDER BY s.created_at DESC LIMIT 1`,
      [req.tenant.id]
    );
    if (infoResult.rows.length === 0) {
      return res.status(404).json({ message: 'Tenant no encontrado' });
    }

    const info = infoResult.rows[0];

    // Count usage inside tenant schema
    const usage = await withTenantSchema(req.tenant.schema_name, async (client) => {
      const [prodRes, ordRes, imagesRes] = await Promise.all([
        client.query('SELECT COUNT(*) FROM products'),
        client.query(`SELECT COUNT(*) FROM orders WHERE created_at >= date_trunc('month', NOW())`),
        client.query('SELECT image_path FROM product_images'),
      ]);
      const storage_mb = await calculateStorageMb(imagesRes.rows);
      return {
        products: parseInt(prodRes.rows[0].count, 10),
        orders_month: parseInt(ordRes.rows[0].count, 10),
        storage_mb,
      };
    });

    res.json({
      plan: {
        id: info.plan_id,
        name: info.plan_name,
        price_monthly: parseFloat(info.price_monthly),
        max_products: info.max_products,
        max_orders_month: info.max_orders_month,
        max_storage_mb: info.max_storage_mb,
        features: info.features,
      },
      usage,
      subscription: {
        status: info.sub_status || info.status,
        period_start: info.current_period_start,
        period_end: info.current_period_end,
        trial_ends_at: info.trial_ends_at,
      },
      tenant: {
        name: info.name,
        slug: info.slug,
        status: info.status,
      },
    });
  } catch (err) {
    console.error('[subscription]', err);
    res.status(500).json({ message: 'Error al obtener suscripción' });
  }
});

/**
 * GET /api/subscription/usage
 * Detailed usage breakdown
 */
router.get('/usage', async (req, res) => {
  try {
    if (!req.tenant) {
      return res.status(400).json({ message: 'No tenant context' });
    }

    const usage = await withTenantSchema(req.tenant.schema_name, async (client) => {
      const [prodRes, ordRes, imagesRes] = await Promise.all([
        client.query('SELECT COUNT(*) FROM products'),
        client.query(`SELECT COUNT(*) FROM orders WHERE created_at >= date_trunc('month', NOW())`),
        client.query('SELECT image_path FROM product_images'),
      ]);
      const storage_mb = await calculateStorageMb(imagesRes.rows);
      return {
        products: parseInt(prodRes.rows[0].count, 10),
        orders_month: parseInt(ordRes.rows[0].count, 10),
        storage_mb,
        total_images: imagesRes.rows.length,
      };
    });

    // Get plan limits for comparison
    const planResult = await pool.query(
      `SELECT p.max_products, p.max_orders_month, p.max_storage_mb
       FROM public.plans p JOIN public.tenants t ON t.plan_id = p.id
       WHERE t.id = $1`,
      [req.tenant.id]
    );
    const limits = planResult.rows[0] || {};

    res.json({ usage, limits });
  } catch (err) {
    console.error('[subscription/usage]', err);
    res.status(500).json({ message: 'Error al obtener uso' });
  }
});

/**
 * POST /api/subscription/change-plan
 * Upgrade or downgrade tenant plan
 */
router.post('/change-plan', async (req, res) => {
  try {
    if (!req.tenant) {
      return res.status(400).json({ message: 'No tenant context' });
    }

    const { planId } = req.body;
    if (!planId) {
      return res.status(400).json({ message: 'planId es requerido' });
    }

    // Verify plan exists and is active
    const planResult = await pool.query(
      'SELECT id, name FROM public.plans WHERE id = $1 AND is_active = true',
      [planId]
    );
    if (planResult.rows.length === 0) {
      return res.status(404).json({ message: 'Plan no encontrado o no disponible' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Update tenant plan
      await client.query(
        'UPDATE public.tenants SET plan_id = $1, updated_at = NOW() WHERE id = $2',
        [planId, req.tenant.id]
      );

      // Update subscription record
      await client.query(
        `UPDATE public.subscriptions SET plan_id = $1
         WHERE tenant_id = $2`,
        [planId, req.tenant.id]
      );

      // Audit log
      await client.query(
        `INSERT INTO public.audit_log (tenant_id, action, actor, details)
         VALUES ($1, 'plan.changed', $2, $3)`,
        [req.tenant.id, req.user?.email || 'admin', JSON.stringify({ newPlan: planId })]
      );

      await client.query('COMMIT');

      res.json({
        message: `Plan actualizado a ${planResult.rows[0].name}`,
        plan: planResult.rows[0],
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[subscription/change-plan]', err);
    res.status(500).json({ message: 'Error al cambiar plan' });
  }
});

/**
 * GET /api/subscription/plans
 * List available plans (for plan comparison modal)
 */
router.get('/plans', async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, price_monthly, max_products, max_orders_month, max_storage_mb, features
       FROM public.plans WHERE is_active = true ORDER BY sort_order`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[subscription/plans]', err);
    res.status(500).json({ message: 'Error al obtener planes' });
  }
});

/**
 * GET /api/subscription/custom-domain
 * Get current custom domain config for this tenant
 */
router.get('/custom-domain', async (req, res) => {
  try {
    if (!req.tenant) {
      return res.status(400).json({ message: 'No tenant context' });
    }
    const result = await pool.query(
      'SELECT custom_domain FROM public.tenants WHERE id = $1',
      [req.tenant.id]
    );
    const domain = result.rows[0]?.custom_domain || null;
    res.json({
      custom_domain: domain,
      slug: req.tenant.slug,
      // DNS instructions for the tenant admin
      dns_instructions: domain ? {
        type: 'CNAME',
        name: '@',
        value: `${req.tenant.slug}.${config.PLATFORM_DOMAIN}`,
        note: 'Agrega este registro CNAME en tu proveedor de DNS. Los cambios pueden tardar hasta 48h en propagarse.'
      } : null
    });
  } catch (err) {
    console.error('[subscription/custom-domain GET]', err);
    res.status(500).json({ message: 'Error al obtener dominio' });
  }
});

/**
 * PUT /api/subscription/custom-domain
 * Set or remove custom domain (Pro/Premium plans only)
 */
router.put('/custom-domain', async (req, res) => {
  try {
    if (!req.tenant) {
      return res.status(400).json({ message: 'No tenant context' });
    }

    // Check plan supports custom domains
    const planResult = await pool.query(
      'SELECT features FROM public.plans WHERE id = $1',
      [req.tenant.plan_id]
    );
    const features = planResult.rows[0]?.features || [];
    if (!features.includes('custom_domain') && !features.includes('all')) {
      return res.status(403).json({ message: 'Tu plan no incluye dominio personalizado. Actualiza a Pro o Premium.' });
    }

    const { domain } = req.body;

    // Allow removing domain (null)
    if (domain === null || domain === '') {
      await pool.query(
        'UPDATE public.tenants SET custom_domain = NULL, updated_at = NOW() WHERE id = $1',
        [req.tenant.id]
      );
      // Invalidate cache
      const { invalidateTenantCache } = require('../../middleware');
      invalidateTenantCache(req.tenant.slug);
      return res.json({ message: 'Dominio personalizado eliminado', custom_domain: null });
    }

    // Validate domain format
    const domainRegex = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;
    if (!domainRegex.test(domain) || domain.length > 253) {
      return res.status(400).json({ message: 'Formato de dominio inválido' });
    }

    // Ensure domain is not already used by another tenant
    const existing = await pool.query(
      'SELECT id FROM public.tenants WHERE custom_domain = $1 AND id != $2',
      [domain.toLowerCase(), req.tenant.id]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ message: 'Este dominio ya está en uso por otra tienda' });
    }

    // Save domain
    await pool.query(
      'UPDATE public.tenants SET custom_domain = $1, updated_at = NOW() WHERE id = $2',
      [domain.toLowerCase(), req.tenant.id]
    );

    // Audit log
    await pool.query(
      `INSERT INTO public.audit_log (tenant_id, action, actor, details) VALUES ($1, $2, $3, $4)`,
      [req.tenant.id, 'custom_domain.set', req.user?.email || 'admin', JSON.stringify({ domain: domain.toLowerCase() })]
    );

    // Invalidate cache so tenant middleware picks up the new domain
    const { invalidateTenantCache } = require('../../middleware');
    invalidateTenantCache(req.tenant.slug);

    res.json({
      message: 'Dominio personalizado configurado',
      custom_domain: domain.toLowerCase(),
      dns_instructions: {
        type: 'CNAME',
        name: '@',
        value: `${req.tenant.slug}.${config.PLATFORM_DOMAIN}`,
        note: 'Agrega este registro CNAME en tu proveedor de DNS. Los cambios pueden tardar hasta 48h en propagarse.'
      }
    });
  } catch (err) {
    console.error('[subscription/custom-domain PUT]', err);
    res.status(500).json({ message: 'Error al configurar dominio' });
  }
});

module.exports = router;
