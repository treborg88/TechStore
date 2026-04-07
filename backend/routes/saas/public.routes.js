// routes/saas/public.routes.js — Public SaaS endpoints (no tenant middleware)
// Plans listing, slug availability, and tenant registration.
const { Router } = require('express');
const { pool } = require('../../database');
const { provisionTenant, validateSlug } = require('../../services/tenant/provisioner');

const router = Router();

// GET /api/saas/plans — Active plans for pricing page
router.get('/plans', async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, price_monthly, max_products, max_orders_month, max_storage_mb, features
       FROM public.plans WHERE is_active = true ORDER BY sort_order`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[saas/plans]', err);
    res.status(500).json({ message: 'Error al obtener planes' });
  }
});

// GET /api/saas/check-slug/:slug — Subdomain availability check
router.get('/check-slug/:slug', async (req, res) => {
  try {
    const { slug } = req.params;

    // Validate format + reserved words via provisioner
    const check = validateSlug(slug);
    if (!check.valid) {
      return res.json({ available: false, reason: check.error });
    }

    // Check DB uniqueness
    const result = await pool.query(
      'SELECT id FROM public.tenants WHERE slug = $1',
      [slug]
    );
    res.json({ available: result.rows.length === 0 });
  } catch (err) {
    console.error('[saas/check-slug]', err);
    res.status(500).json({ message: 'Error al verificar disponibilidad' });
  }
});

// POST /api/saas/register — Create a new tenant (store)
router.post('/register', async (req, res) => {
  const { slug, businessName, ownerEmail, ownerPassword, planId = 'trial' } = req.body;

  // Required fields
  if (!slug || !businessName || !ownerEmail || !ownerPassword) {
    return res.status(400).json({ message: 'Todos los campos son requeridos' });
  }

  // Password strength
  if (ownerPassword.length < 8) {
    return res.status(400).json({ message: 'Contraseña mínimo 8 caracteres' });
  }

  try {
    const { tenantId } = await provisionTenant(pool, {
      slug,
      name: businessName,
      ownerEmail,
      ownerPassword,
      planId,
    });

    res.status(201).json({
      message: 'Tienda creada exitosamente',
      storeUrl: `https://${slug}.eonsclover.com`,
      tenantId,
    });
  } catch (err) {
    // Duplicate slug → 409
    if (err.message.includes('ya está en uso')) {
      return res.status(409).json({ message: err.message });
    }
    console.error('[saas/register]', err);
    res.status(500).json({ message: 'Error al crear la tienda' });
  }
});

module.exports = router;
