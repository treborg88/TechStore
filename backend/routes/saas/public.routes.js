// routes/saas/public.routes.js — Public SaaS endpoints (no tenant middleware)
// Plans listing, slug availability, and tenant registration.
const { Router } = require('express');
const jwt = require('jsonwebtoken');
const db = require('../../database');
const { statements } = db;
const config = require('../../config');
const { provisionTenant, validateSlug } = require('../../services/tenant/provisioner');
const { getSettingsMap } = require('../../services/email.service');
const { validatePassword, PASSWORD_POLICY_MESSAGE } = require('../../utils');

const router = Router();

// GET /api/saas/plans — Active plans for pricing page
router.get('/plans', async (_req, res) => {
  try {
    const result = await db.pool.query(
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
    const result = await db.pool.query(
      'SELECT id FROM public.tenants WHERE slug = $1',
      [slug]
    );
    res.json({ available: result.rows.length === 0 });
  } catch (err) {
    console.error('[saas/check-slug]', err);
    res.status(500).json({ message: 'Error al verificar disponibilidad' });
  }
});

// GET /api/saas/check-email?email= — Check if an owner email is already registered
router.get('/check-email', async (req, res) => {
  try {
    const email = (req.query.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ message: 'Email requerido' });

    const result = await db.pool.query(
      'SELECT id FROM public.tenants WHERE LOWER(owner_email) = $1',
      [email]
    );
    res.json({ taken: result.rows.length > 0 });
  } catch (err) {
    console.error('[saas/check-email]', err);
    res.status(500).json({ message: 'Error al verificar disponibilidad' });
  }
});

// GET /api/saas/tenant-exists — Check if the current subdomain belongs to a valid tenant
router.get('/tenant-exists', async (req, res) => {
  try {
    const host = req.get('host') || '';
    const parts = host.split('.');
    const platformDomain = config.PLATFORM_DOMAIN;
    const isPlatformHost = host.endsWith(`.${platformDomain}`);
    const subdomain = isPlatformHost && parts.length >= 3 ? parts[0] : null;

    if (!subdomain) {
      return res.json({ exists: false, reason: 'not_a_subdomain' });
    }

    const result = await db.pool.query(
      'SELECT id, slug, name FROM public.tenants WHERE slug = $1',
      [subdomain]
    );
    res.json({ exists: result.rows.length > 0 });
  } catch (err) {
    console.error('[saas/tenant-exists]', err);
    res.status(500).json({ message: 'Error al verificar tenant' });
  }
});

// POST /api/saas/register — Create a new tenant (store)
// Accepts either ownerEmail+ownerPassword (form flow) or oauth_token (SSO flow).
router.post('/register', async (req, res) => {
  const { slug, businessName, planId = 'trial', trialDays = 14, themeId = 'tech-blue' } = req.body;
  let ownerEmail, ownerPassword;
  let skipVerification = false; // SSO users skip email verify; form users must verify unless toggle is off

  // ── SSO flow: extract credentials from the signed oauth_state token ─────────
  if (req.body.oauth_token) {
    let payload;
    try {
      payload = jwt.verify(req.body.oauth_token, config.JWT_SECRET);
    } catch {
      return res.status(400).json({ message: 'Token OAuth inválido o expirado' });
    }
    if (payload.type !== 'oauth_state' || !payload.email || !payload.oauthPassword) {
      return res.status(400).json({ message: 'Token OAuth con formato incorrecto' });
    }
    ownerEmail       = payload.email;
    ownerPassword    = payload.oauthPassword;
    skipVerification = true; // already authenticated via OAuth provider
  } else {
    // ── Standard form flow ───────────────────────────────────────────────────
    ownerEmail    = req.body.ownerEmail;
    ownerPassword = req.body.ownerPassword;
    const code    = req.body.code;
    if (!ownerEmail || !ownerPassword) {
      return res.status(400).json({ message: 'Todos los campos son requeridos' });
    }
    if (!validatePassword(ownerPassword)) {
      return res.status(400).json({ message: PASSWORD_POLICY_MESSAGE });
    }

    // Check if email verification is disabled via admin settings
    try {
      const settings = await getSettingsMap();
      skipVerification = settings.emailEnabled === 'false' || settings.emailVerifyRegistration === 'false';
    } catch { /* default: require verification */ }

    // Verify the emailed code (unless admin has disabled the feature)
    if (!skipVerification) {
      if (!code) {
        return res.status(400).json({ message: 'Código de verificación requerido' });
      }
      const record = await statements.getVerificationCode(ownerEmail.toLowerCase().trim(), code, 'register');
      if (!record) {
        return res.status(400).json({ message: 'Código de verificación inválido o expirado' });
      }
    }
  }

  // Required in both flows
  if (!slug || !businessName) {
    return res.status(400).json({ message: 'Nombre de tienda y subdominio son requeridos' });
  }

  try {
    const { tenantId } = await provisionTenant(db.pool, {
      slug,
      name: businessName,
      ownerEmail,
      ownerPassword,
      planId,
      trialDays: Number(trialDays),
      themeId,
    });

    // Delete the used verification code now that the tenant is created
    if (!skipVerification) {
      await statements.deleteVerificationCodes(ownerEmail.toLowerCase().trim(), 'register');
    }

    res.status(201).json({
      message: 'Tienda creada exitosamente',
      // Use request protocol so local HTTP and production HTTPS both work
      storeUrl: `${req.protocol}://${slug}.${config.PLATFORM_DOMAIN}`,
      tenantId,
    });
  } catch (err) {
    // Duplicate slug or duplicate email → 409
    if (err.message.includes('ya está en uso') || err.message.includes('correo electrónico ya está registrado')) {
      return res.status(409).json({ message: err.message });
    }
    console.error('[saas/register]', err);
    res.status(500).json({ message: 'Error al crear la tienda' });
  }
});

module.exports = router;
