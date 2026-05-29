// services/tenant/provisioner.js — Create/delete tenant schemas in PostgreSQL
// Called by SaaS registration flow. Each tenant gets its own schema
// with the full set of tables from schema.sql + seed data from seed.sql.

const fs = require('fs').promises;
const path = require('path');
const bcrypt = require('bcrypt');
const { applyTheme, DEFAULT_THEME } = require('../../database/themes');

// Slug validation: lowercase alphanumeric + hyphens, 3-63 chars
const SLUG_REGEX = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;

// Reserved slugs that cannot be used as tenant subdomains
const RESERVED_SLUGS = new Set([
    'www', 'api', 'admin', 'app', 'mail', 'smtp', 'ftp',
    'status', 'docs', 'help', 'support', 'billing',
    'static', 'assets', 'cdn', 'media',
]);

// Map theme IDs to their demo seed files — unmapped themes use the default tech seed
const DEMO_SEED_MAP = {
    'rose':    'seed-demo-rosa.sql',
    'emerald': 'seed-demo-emerald.sql',
    'amber':   'seed-demo-amber.sql',
    'carbon':  'seed-demo-carbon.sql',
};

// Bundled seed images directory (included in Docker image via COPY backend/)
const SEED_IMAGES_DIR = path.join(__dirname, '..', '..', 'database', 'seed-images');
const UPLOADS_PRODUCTS_DIR = process.env.UPLOADS_DIR
    ? path.join(process.env.UPLOADS_DIR, 'products')
    : path.join(__dirname, '..', '..', 'uploads', 'products');

/**
 * Copy seed images to the uploads/products directory (idempotent — skips existing files).
 * Non-fatal: logs a warning if the seed-images directory is missing.
 */
async function copySeedImages() {
    try {
        const files = await fs.readdir(SEED_IMAGES_DIR);
        await fs.mkdir(UPLOADS_PRODUCTS_DIR, { recursive: true });
        await Promise.all(files.map(async (file) => {
            const dest = path.join(UPLOADS_PRODUCTS_DIR, file);
            try { await fs.access(dest); } catch { // file doesn't exist yet
                await fs.copyFile(path.join(SEED_IMAGES_DIR, file), dest);
            }
        }));
    } catch (err) {
        console.warn('[provisioner] copySeedImages skipped:', err.message);
    }
}

/**
 * Validate slug format and availability.
 * @param {string} slug - Subdomain to validate
 * @returns {{ valid: boolean, error?: string }}
 */
function validateSlug(slug) {
    if (!slug || typeof slug !== 'string') {
        return { valid: false, error: 'El subdominio es requerido' };
    }
    if (!SLUG_REGEX.test(slug)) {
        return { valid: false, error: 'El subdominio solo permite letras minúsculas, números y guiones (3-63 caracteres)' };
    }
    if (RESERVED_SLUGS.has(slug)) {
        return { valid: false, error: `El subdominio "${slug}" está reservado` };
    }
    return { valid: true };
}

/**
 * Provision a new tenant:
 * 1. Validates slug format and availability
 * 2. Creates PostgreSQL schema
 * 3. Executes schema.sql + seed.sql inside the schema
 * 4. Creates tenant admin user (overwrites seed default)
 * 5. Registers in public.tenants + public.subscriptions + audit_log
 * 6. Creates upload directory
 *
 * @param {import('pg').Pool} pool - PostgreSQL pool
 * @param {Object} opts - Tenant options
 * @param {string} opts.slug - Subdomain (validated)
 * @param {string} opts.name - Business/store name
 * @param {string} opts.ownerEmail - Owner's email
 * @param {string} opts.ownerPassword - Owner's password (plain text, hashed here)
 * @param {string} [opts.planId='trial'] - Plan ID
 * @param {number} [opts.trialDays=14] - Trial duration in days
 * @returns {Promise<{ tenantId: string, schemaName: string }>}
 */
async function provisionTenant(pool, { slug, name, ownerEmail, ownerPassword, planId = 'trial', trialDays = 14, themeId = DEFAULT_THEME }) {
    // Normalize email and validate slug format
    const normalizedEmail = (ownerEmail || '').trim().toLowerCase();
    const slugCheck = validateSlug(slug);
    if (!slugCheck.valid) {
        throw new Error(slugCheck.error);
    }

    // Schema name derived from slug (hyphens → underscores)
    const schemaName = 'tenant_' + slug.replace(/-/g, '_');

    // Hash password BEFORE acquiring a DB client — bcrypt is CPU-intensive
    // and should not hold a connection during computation
    const hashedPassword = await bcrypt.hash(ownerPassword, 10);

    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        // Ensure UTF-8 encoding for the session so emojis in seed.sql are stored correctly
        await client.query("SET LOCAL client_encoding = 'UTF8'");

        // 1. Check slug availability
        const existingSlug = await client.query(
            'SELECT id FROM public.tenants WHERE slug = $1',
            [slug]
        );
        if (existingSlug.rows.length > 0) {
            throw new Error(`El subdominio "${slug}" ya está en uso`);
        }

        // 2. Check owner email uniqueness across tenants
        const existingEmail = await client.query(
            'SELECT id FROM public.tenants WHERE LOWER(owner_email) = LOWER($1)',
            [normalizedEmail]
        );
        if (existingEmail.rows.length > 0) {
            throw new Error('El correo electrónico ya está registrado en otra tienda');
        }

        // 2. Create schema (name is validated by SLUG_REGEX → safe for identifier)
        await client.query(`CREATE SCHEMA "${schemaName}"`);

        // 3. Execute schema.sql + seed.sql inside the new schema
        await client.query(`SET LOCAL search_path TO "${schemaName}"`);

        const schemaSQL = (await fs.readFile(
            path.join(__dirname, '..', '..', 'database', 'schema.sql'),
            'utf8'
        )).replace(/^\uFEFF/, ''); // strip UTF-8 BOM if present
        await client.query(schemaSQL);

        const seedSQL = (await fs.readFile(
            path.join(__dirname, '..', '..', 'database', 'seed.sql'),
            'utf8'
        )).replace(/^\uFEFF/, ''); // strip UTF-8 BOM if present
        await client.query(seedSQL);

        // 3b. Copy bundled seed images to the uploads directory (non-fatal)
        await copySeedImages();

        // 3c. Run the theme-specific demo seed (products + enriched settings)
        const demoSeedFile = DEMO_SEED_MAP[themeId] || 'seed-demo.sql';
        const demoSeedSQL = (await fs.readFile(
            path.join(__dirname, '..', '..', 'database', demoSeedFile),
            'utf8'
        )).replace(/^\uFEFF/, '');
        await client.query(demoSeedSQL);

        // 3c. Apply the chosen color theme on top of the seed settings
        await applyTheme(client, themeId);

        // 4. Create tenant admin (overwrite the generic admin from seed.sql)
        await client.query(
            `INSERT INTO users (name, email, password, role, is_active)
             VALUES ($1, $2, $3, 'admin', true)
             ON CONFLICT (email) DO UPDATE SET
               password = EXCLUDED.password, name = EXCLUDED.name`,
            [name, normalizedEmail, hashedPassword]
        );

        // 5. Register in SaaS system tables (public schema)
        await client.query('SET LOCAL search_path TO public');

        const tenantResult = await client.query(
            `INSERT INTO public.tenants (slug, name, owner_email, plan_id, trial_ends_at)
             VALUES ($1, $2, $3, $4, NOW() + $5 * INTERVAL '1 day')
             RETURNING id`,
            [slug, name, normalizedEmail, planId, trialDays]
        );
        const tenantId = tenantResult.rows[0].id;

        await client.query(
            `INSERT INTO public.subscriptions (tenant_id, plan_id)
             VALUES ($1, $2)`,
            [tenantId, planId]
        );

        await client.query(
            `INSERT INTO public.audit_log (tenant_id, action, actor, details)
             VALUES ($1, 'tenant.created', $2, $3)`,
            [tenantId, normalizedEmail, JSON.stringify({ slug, plan: planId })]
        );

        await client.query('COMMIT');

        // 6. Create upload directory (outside transaction — non-critical)
        const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'tenants', slug, 'products');
        await fs.mkdir(uploadDir, { recursive: true });

        return { tenantId, schemaName };

    } catch (err) {
        await client.query('ROLLBACK');
        // Clean up partially created schema
        try {
            await client.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
        } catch (_) { /* ignore cleanup errors */ }
        throw err;
    } finally {
        client.release();
    }
}

/**
 * Completely delete a tenant and all its data.
 * Requires explicit confirmation string: "DELETE_{SLUG_UPPER}"
 *
 * @param {import('pg').Pool} pool - PostgreSQL pool
 * @param {Object} opts
 * @param {string} opts.slug - Tenant slug to delete
 * @param {string} opts.confirm - Confirmation string (must be "DELETE_{SLUG_UPPER}")
 */
async function deprovisionTenant(pool, { slug, confirm }) {
    const expected = `DELETE_${slug.toUpperCase()}`;
    if (confirm !== expected) {
        throw new Error(`Confirmación incorrecta. Enviar: ${expected}`);
    }

    const schemaName = 'tenant_' + slug.replace(/-/g, '_');
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Drop the entire schema (all tables, functions, data)
        await client.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);

        // Remove from SaaS system tables
        const result = await client.query(
            'DELETE FROM public.tenants WHERE slug = $1 RETURNING id',
            [slug]
        );

        // Audit log (tenant_id = null since tenant was deleted)
        if (result.rows.length > 0) {
            await client.query(
                `INSERT INTO public.audit_log (tenant_id, action, actor, details)
                 VALUES (NULL, 'tenant.deleted', 'super_admin', $1)`,
                [JSON.stringify({ slug, schema: schemaName })]
            );
        }

        await client.query('COMMIT');

        // Clean up upload directory (non-critical)
        const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'tenants', slug);
        await fs.rm(uploadDir, { recursive: true, force: true }).catch(() => {});

    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

module.exports = {
    validateSlug,
    provisionTenant,
    deprovisionTenant,
    RESERVED_SLUGS,
    SLUG_REGEX,
};
