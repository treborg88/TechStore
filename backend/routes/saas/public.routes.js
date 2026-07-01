// routes/saas/public.routes.js — Public SaaS endpoints (no tenant middleware)
// Plans listing, slug availability, and tenant registration.
const { Router } = require('express');
const jwt = require('jsonwebtoken');
const db = require('../../database');
const { statements } = db;
const config = require('../../config');
const { provisionTenant, validateSlug } = require('../../services/tenant/provisioner');
const { getSettingsMap } = require('../../services/email.service');
const { sendMailWithSettings } = require('../../services/email.service');
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
    const isPlatformHost = host.endsWith(`.${platformDomain}`) || host === platformDomain
      || host.endsWith(`.${platformDomain}.local`) || host === `${platformDomain}.local`
      || host === 'localhost' || host.endsWith('.local');
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

    const storeUrl = `${req.protocol}://${slug}.${config.PLATFORM_DOMAIN}`;

    // ── Send welcome email (non-critical) ──
    try {
      const settings = await getSettingsMap();
      const platformName = settings.siteName || config.BRAND || 'EonsClover';

      // Fetch plan + trial info for the billing summary
      const billingInfo = await db.pool.query(
        `SELECT p.name AS plan_name, p.price_monthly,
                t.trial_ends_at, t.created_at,
                s.current_period_end
         FROM public.tenants t
         JOIN public.plans p ON p.id = t.plan_id
         LEFT JOIN public.subscriptions s ON s.tenant_id = t.id
         WHERE t.id = $1
         ORDER BY s.created_at DESC LIMIT 1`,
        [tenantId]
      );
      const bill = billingInfo.rows[0] || {};
      const planName = bill.plan_name || planId || 'Trial';
      const trialEnds = bill.trial_ends_at
        ? new Date(bill.trial_ends_at).toLocaleDateString('es-DO', { year: 'numeric', month: 'long', day: 'numeric' })
        : 'N/A';
      const createdDate = bill.created_at
        ? new Date(bill.created_at).toLocaleDateString('es-DO', { year: 'numeric', month: 'long', day: 'numeric' })
        : new Date().toLocaleDateString('es-DO', { year: 'numeric', month: 'long', day: 'numeric' });

      // Fetch the cheapest paid plan for the post-trial cost display
      const cheapestPlan = await db.pool.query(
        `SELECT name, price_monthly FROM public.plans
         WHERE is_active = true AND price_monthly > 0
         ORDER BY price_monthly ASC LIMIT 1`
      );
      const postTrialPrice = cheapestPlan.rows[0]
        ? `$${parseFloat(cheapestPlan.rows[0].price_monthly).toFixed(2)} USD/mes`
        : 'Por definir';
      const postTrialPlanName = cheapestPlan.rows[0]?.name || '';

      // Theme info
      const THEMES = {
        'tech-blue': { name: 'Tech Azul', desc: 'Tecnología · Electrónica', tip: 'Perfecto para tiendas de tecnología, electrónica y gadgets.' },
        'emerald':   { name: 'Esmeralda', desc: 'Salud · Orgánicos', tip: 'Ideal para productos naturales, salud y bienestar.' },
        'rose':      { name: 'Rosa',      desc: 'Belleza · Flores', tip: 'Recomendado para belleza, cosmética y florerías.' },
        'amber':     { name: 'Ámbar',     desc: 'Café · Artesanal', tip: 'Diseñado para cafeterías, productos artesanales y gourmet.' },
        'carbon':    { name: 'Carbón',    desc: 'Automotriz · Tools', tip: 'Pensado para repuestos, herramientas y productos industriales.' },
        'blank':     { name: 'Base Vacía', desc: 'Sin demo', tip: 'Comienza desde cero sin productos de demostración. Tú decides el camino.' },
      };
      const themeInfo = THEMES[themeId] || THEMES['tech-blue'];

      const html = `
        <div style="font-family:'Segoe UI',Arial,sans-serif;color:#1e293b;line-height:1.6;max-width:600px;margin:0 auto;">
          <!-- Header -->
          <div style="background:linear-gradient(135deg,#1e293b,#0f172a);color:#fff;padding:36px 40px 28px;text-align:center;border-radius:0;">
            <div style="font-size:48px;margin-bottom:8px;">🎉</div>
            <h1 style="margin:0;font-size:26px;font-weight:700;letter-spacing:-0.3px;">¡Bienvenido a ${platformName}!</h1>
            <p style="margin:8px 0 0;color:#94a3b8;font-size:15px;">${businessName} ya está lista</p>
          </div>

          <!-- Body -->
          <div style="background:#fff;border:1px solid #e2e8f0;border-top:none;padding:36px 40px 32px;">
            <p style="margin:0 0 16px;">Hola,</p>
            <p style="margin:0 0 20px;">
              Tu tienda <strong style="color:#0f172a;">${businessName}</strong> ha sido creada exitosamente.
              Ya puedes acceder al panel de administración y comenzar a gestionar tu negocio.
            </p>

            <!-- Access card -->
            <table style="width:100%;border-collapse:collapse;margin:0 0 24px;">
              <tr>
                <td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px 24px;">
                  <h3 style="margin:0 0 14px;font-size:15px;color:#475569;text-transform:uppercase;letter-spacing:0.5px;">🔑 Acceso a tu tienda</h3>
                  <table style="width:100%;border-collapse:collapse;font-size:14px;">
                    <tr>
                      <td style="padding:6px 0;color:#64748b;width:100px;">URL:</td>
                      <td style="padding:6px 0;font-weight:600;"><a href="${storeUrl}" style="color:#2563eb;text-decoration:none;">${storeUrl}</a></td>
                    </tr>
                    <tr>
                      <td style="padding:6px 0;color:#64748b;">Email:</td>
                      <td style="padding:6px 0;font-weight:600;">${ownerEmail}</td>
                    </tr>
                    <tr>
                      <td style="padding:6px 0;color:#64748b;">Contraseña:</td>
                      <td style="padding:6px 0;font-weight:600;">La que registraste</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- Billing summary -->
            <table style="width:100%;border-collapse:collapse;margin:0 0 24px;">
              <tr>
                <td style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:12px;padding:20px 24px;">
                  <h3 style="margin:0 0 14px;font-size:15px;color:#0369a1;text-transform:uppercase;letter-spacing:0.5px;">📄 Resumen de tu plan</h3>
                  <table style="width:100%;border-collapse:collapse;font-size:14px;">
                    <tr>
                      <td style="padding:5px 0;color:#475569;">Plan actual:</td>
                      <td style="padding:5px 0;font-weight:700;text-align:right;color:#0f172a;">${planName}</td>
                    </tr>
                    <tr>
                      <td style="padding:5px 0;color:#475569;">Fecha de inicio:</td>
                      <td style="padding:5px 0;font-weight:600;text-align:right;">${createdDate}</td>
                    </tr>
                    <tr>
                      <td style="padding:5px 0;color:#475569;">Fin del periodo de prueba:</td>
                      <td style="padding:5px 0;font-weight:600;text-align:right;color:#ea580c;">${trialEnds}</td>
                    </tr>
                    <tr>
                      <td style="padding:8px 0 0;color:#475569;border-top:1px solid #bae6fd;">Costo posterior:</td>
                      <td style="padding:8px 0 0;font-weight:700;text-align:right;border-top:1px solid #bae6fd;color:#0f172a;font-size:16px;">
                        ${postTrialPrice}
                        ${postTrialPlanName ? `<br><span style="font-size:12px;font-weight:400;color:#64748b;">plan ${postTrialPlanName}</span>` : ''}
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- Theme card -->
            <table style="width:100%;border-collapse:collapse;margin:0 0 24px;">
              <tr>
                <td style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:12px;padding:18px 24px;">
                  <h3 style="margin:0 0 8px;font-size:15px;color:#065f46;text-transform:uppercase;letter-spacing:0.5px;">🎨 Tema seleccionado: ${themeInfo.name}</h3>
                  <p style="margin:0 0 4px;font-size:14px;color:#374151;"><strong>Estilo:</strong> ${themeInfo.desc}</p>
                  <p style="margin:0;font-size:14px;color:#475569;">${themeInfo.tip}</p>
                </td>
              </tr>
            </table>

            <!-- Next steps -->
            <table style="width:100%;border-collapse:collapse;">
              <tr>
                <td style="background:#faf5ff;border:1px solid #e9d5ff;border-radius:12px;padding:18px 24px;">
                  <h3 style="margin:0 0 10px;font-size:15px;color:#6b21a8;text-transform:uppercase;letter-spacing:0.5px;">📋 Primeros pasos</h3>
                  <table style="width:100%;border-collapse:collapse;font-size:14px;">
                    <tr><td style="padding:4px 0;color:#475569;">1. Ingresa a tu tienda con el enlace de arriba</td></tr>
                    <tr><td style="padding:4px 0;color:#475569;">2. Personaliza nombre, logo y colores en <strong>Configuración</strong></td></tr>
                    <tr><td style="padding:4px 0;color:#475569;">3. Agrega tus productos desde el panel de administración</td></tr>
                    <tr><td style="padding:4px 0;color:#475569;">4. Configura métodos de pago y envío</td></tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- Footer -->
            <div style="margin-top:28px;padding-top:16px;border-top:1px solid #e2e8f0;">
              <p style="margin:0;color:#94a3b8;font-size:13px;text-align:center;">
                Si tienes alguna duda, responde a este correo.<br>
                — El equipo de ${platformName}
              </p>
            </div>
          </div>

          <!-- Bottom bar -->
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-top:none;padding:16px 40px;text-align:center;border-radius:0 0 12px 12px;">
            <p style="margin:0;font-size:11px;color:#94a3b8;">
              ${platformName} &mdash; Plataforma de tiendas en línea
            </p>
          </div>
        </div>
      `;

      await sendMailWithSettings({
        to: ownerEmail,
        subject: `🎉 ¡Bienvenido a ${platformName}, ${businessName} ya está lista!`,
        html,
      });
      console.log(`[saas/register] Welcome email sent to ${ownerEmail}`);
    } catch (emailErr) {
      // Email is non-critical — log but don't fail the request
      console.error('[saas/register] Failed to send welcome email:', emailErr.message);
    }

    res.status(201).json({
      message: 'Tienda creada exitosamente',
      storeUrl,
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
