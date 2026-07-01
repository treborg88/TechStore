// routes/saas/subscription.routes.js — Tenant subscription management
// Requires tenant middleware + auth. Returns plan info, usage, and plan changes.

const { Router } = require('express');
const path = require('path');
const fs = require('fs').promises;
const { pool, withTenantSchema, UPLOADS_DIR } = require('../../database');
const config = require('../../config');
const { authenticateToken, requireAdmin } = require('../../middleware/auth');
const { sendMailWithSettings } = require('../../services/email.service');

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
 * GET /api/subscription/change-preview
 * Preview plan change info (new plan details + billing date) before confirming
 */
router.get('/change-preview', async (req, res) => {
  try {
    if (!req.tenant) {
      return res.status(400).json({ message: 'No tenant context' });
    }

    const planId = req.query.planId;
    if (!planId) {
      return res.status(400).json({ message: 'planId es requerido' });
    }

    // Fetch the target plan
    const planResult = await pool.query(
      `SELECT id, name, price_monthly, max_products, max_orders_month, max_storage_mb, features
       FROM public.plans WHERE id = $1 AND is_active = true`,
      [planId]
    );
    if (planResult.rows.length === 0) {
      return res.status(404).json({ message: 'Plan no encontrado' });
    }

    // Fetch current billing period end
    const subResult = await pool.query(
      `SELECT s.current_period_end, s.current_period_start
       FROM public.subscriptions s
       WHERE s.tenant_id = $1
       ORDER BY s.created_at DESC LIMIT 1`,
      [req.tenant.id]
    );

    // Fetch current plan for comparison
    const currentPlan = await pool.query(
      `SELECT p.id, p.name, p.price_monthly, p.max_products, p.max_orders_month, p.max_storage_mb, p.features FROM public.plans p
       JOIN public.tenants t ON t.plan_id = p.id
       WHERE t.id = $1`,
      [req.tenant.id]
    );

    res.json({
      newPlan: planResult.rows[0],
      currentPlan: currentPlan.rows[0] || null,
      billing: subResult.rows[0]
        ? {
            period_start: subResult.rows[0].current_period_start,
            period_end: subResult.rows[0].current_period_end,
          }
        : null,
    });
  } catch (err) {
    console.error('[subscription/change-preview]', err);
    res.status(500).json({ message: 'Error al obtener vista previa del cambio' });
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

    // Verify plan exists and get full details
    const planResult = await pool.query(
      `SELECT id, name, price_monthly, max_products, max_orders_month, max_storage_mb, features
       FROM public.plans WHERE id = $1 AND is_active = true`,
      [planId]
    );
    if (planResult.rows.length === 0) {
      return res.status(404).json({ message: 'Plan no encontrado o no disponible' });
    }

    const newPlan = planResult.rows[0];

    // Fetch current plan + tenant info (for email)
    const currentInfo = await pool.query(
      `SELECT t.id, t.name AS tenant_name, t.owner_email,
              p.name AS current_plan_name,
              s.current_period_end
       FROM public.tenants t
       LEFT JOIN public.plans p ON p.id = t.plan_id
       LEFT JOIN public.subscriptions s ON s.tenant_id = t.id AND s.id = (
         SELECT id FROM public.subscriptions WHERE tenant_id = t.id ORDER BY created_at DESC LIMIT 1
       )
       WHERE t.id = $1`,
      [req.tenant.id]
    );
    const tenantInfo = currentInfo.rows[0] || {};

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

      // ── Send plan change notification email ──
      const recipientEmail = tenantInfo.owner_email || req.user?.email;
      if (recipientEmail) {
        try {
          const { getSettingsMap, formatCurrency } = require('../../services/email.service');
          const settings = await getSettingsMap();
          const siteName = settings.siteName || tenantInfo.tenant_name || config.BRAND;

          const currency = (value) => {
            const n = Number(value) || 0;
            return n.toLocaleString('es-DO', { style: 'currency', currency: 'USD' });
          };

          const featureList = Array.isArray(newPlan.features) && newPlan.features.length
            ? newPlan.features.map((f) => `<li style="margin-bottom:4px;">✅ ${f.replace(/_/g, ' ')}</li>`).join('')
            : '<li style="color:#888;">Sin características adicionales</li>';

          const billingDate = tenantInfo.current_period_end
            ? new Date(tenantInfo.current_period_end).toLocaleDateString('es-DO', {
                year: 'numeric', month: 'long', day: 'numeric',
              })
            : 'N/A';

          const html = `
            <div style="font-family:Arial,sans-serif;color:#111827;line-height:1.6;max-width:560px;">
              <div style="background:#111827;color:#fff;padding:16px 20px;border-radius:10px 10px 0 0;">
                <h2 style="margin:0;">${siteName}</h2>
                <p style="margin:4px 0 0;">Cambio de plan completado</p>
              </div>
              <div style="border:1px solid #e5e7eb;border-top:none;padding:20px;border-radius:0 0 10px 10px;">
                <p>Hola,</p>
                <p>El plan de tu tienda ha sido cambiado exitosamente.</p>

                <table style="width:100%;border-collapse:collapse;margin:16px 0;">
                  <tr>
                    <td style="padding:8px 6px;border-bottom:1px solid #e5e7eb;color:#6b7280;">Plan anterior</td>
                    <td style="padding:8px 6px;border-bottom:1px solid #e5e7eb;font-weight:600;">${tenantInfo.current_plan_name || 'N/A'}</td>
                  </tr>
                  <tr>
                    <td style="padding:8px 6px;border-bottom:1px solid #e5e7eb;color:#6b7280;">Plan nuevo</td>
                    <td style="padding:8px 6px;border-bottom:1px solid #e5e7eb;font-weight:600;color:#4f46e5;">${newPlan.name}</td>
                  </tr>
                  <tr>
                    <td style="padding:8px 6px;border-bottom:1px solid #e5e7eb;color:#6b7280;">Precio</td>
                    <td style="padding:8px 6px;border-bottom:1px solid #e5e7eb;">${newPlan.price_monthly > 0 ? currency(newPlan.price_monthly) + '/mes' : 'Gratis'}</td>
                  </tr>
                  <tr>
                    <td style="padding:8px 6px;border-bottom:1px solid #e5e7eb;color:#6b7280;">Productos</td>
                    <td style="padding:8px 6px;border-bottom:1px solid #e5e7eb;">${newPlan.max_products === -1 ? 'Ilimitados' : newPlan.max_products}</td>
                  </tr>
                  <tr>
                    <td style="padding:8px 6px;border-bottom:1px solid #e5e7eb;color:#6b7280;">Órdenes/mes</td>
                    <td style="padding:8px 6px;border-bottom:1px solid #e5e7eb;">${newPlan.max_orders_month === -1 ? 'Ilimitadas' : newPlan.max_orders_month}</td>
                  </tr>
                  <tr>
                    <td style="padding:8px 6px;border-bottom:1px solid #e5e7eb;color:#6b7280;">Almacenamiento</td>
                    <td style="padding:8px 6px;border-bottom:1px solid #e5e7eb;">${newPlan.max_storage_mb === -1 ? 'Ilimitado' : newPlan.max_storage_mb + ' MB'}</td>
                  </tr>
                  <tr>
                    <td style="padding:8px 6px;border-bottom:1px solid #e5e7eb;color:#6b7280;">Próxima fecha de facturación</td>
                    <td style="padding:8px 6px;border-bottom:1px solid #e5e7eb;font-weight:600;">${billingDate}</td>
                  </tr>
                </table>

                <h4 style="margin:16px 0 8px;">Características incluidas</h4>
                <ul style="padding-left:20px;">${featureList}</ul>

                <p style="margin-top:16px;">Gracias por confiar en nosotros.</p>
              </div>
            </div>
          `;

          await sendMailWithSettings({
            to: recipientEmail,
            subject: `✅ Plan actualizado a ${newPlan.name} — ${siteName}`,
            html,
          });
          console.log(`[subscription] Plan change email sent to ${recipientEmail}`);
        } catch (emailErr) {
          // Email is non-critical — log but don't fail the request
          console.error('[subscription] Failed to send plan change email:', emailErr.message);
        }
      }

      res.json({
        message: `Plan actualizado a ${newPlan.name}`,
        plan: { id: newPlan.id, name: newPlan.name },
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
