-- =============================================================================
-- TechStore SaaS — Multi-Tenant System Tables (schema 'public')
-- =============================================================================
-- Run ONCE on the main database. Does NOT modify existing tenant tables.
-- Safe to re-run: uses IF NOT EXISTS / ON CONFLICT everywhere.
-- =============================================================================


-- ── PLANES ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.plans (
    id                VARCHAR(50) PRIMARY KEY,
    name              VARCHAR(100) NOT NULL,
    price_monthly     DECIMAL(10,2) NOT NULL DEFAULT 0,
    max_products      INT DEFAULT 50,         -- -1 = unlimited
    max_orders_month  INT DEFAULT 200,        -- -1 = unlimited
    max_storage_mb    INT DEFAULT 500,        -- -1 = unlimited
    features          TEXT[] DEFAULT '{}',     -- feature flag array
    is_active         BOOLEAN DEFAULT true,
    sort_order        INT DEFAULT 0
);

INSERT INTO public.plans (id, name, price_monthly, max_products, max_orders_month, max_storage_mb, features, sort_order)
VALUES
    ('trial',   'Trial',        0,   20,   50,    200,   ARRAY['products','orders','chatbot'], 0),
    ('basic',   'Básico',      29,  100,  500,   1000,   ARRAY['products','orders','chatbot','email_invoices'], 1),
    ('pro',     'Profesional', 59,  500, 2000,   5000,   ARRAY['products','orders','chatbot','email_invoices','tracking','variants','custom_domain'], 2),
    ('premium', 'Premium',     99,   -1,   -1,  20000,   ARRAY['all'], 3)
ON CONFLICT (id) DO NOTHING;


-- ── TENANTS ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tenants (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug          VARCHAR(63) UNIQUE NOT NULL,
    -- slug = subdomain, validate: ^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$
    name          VARCHAR(255) NOT NULL,
    owner_email   VARCHAR(255) NOT NULL,
    plan_id       VARCHAR(50) DEFAULT 'trial' REFERENCES public.plans(id),
    status        VARCHAR(50) DEFAULT 'trial',
    -- statuses: trial | active | suspended | cancelled
    schema_name   VARCHAR(70) GENERATED ALWAYS AS ('tenant_' || replace(slug, '-', '_')) STORED,
    custom_domain VARCHAR(255),
    trial_ends_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '14 days',
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);


-- ── SUBSCRIPTIONS ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id             UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    plan_id               VARCHAR(50) NOT NULL REFERENCES public.plans(id),
    status                VARCHAR(50) DEFAULT 'active',
    -- statuses: active | past_due | cancelled
    current_period_start  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    current_period_end    TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 days',
    cancelled_at          TIMESTAMPTZ,
    created_at            TIMESTAMPTZ DEFAULT NOW()
);


-- ── AUDIT LOG ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.audit_log (
    id          BIGSERIAL PRIMARY KEY,
    tenant_id   UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
    action      VARCHAR(100) NOT NULL,
    actor       VARCHAR(255) NOT NULL,
    details     JSONB DEFAULT '{}',
    created_at  TIMESTAMPTZ DEFAULT NOW()
);


-- ── SCHEMA MIGRATIONS (global tracking for per-tenant migrations) ─────────────
CREATE TABLE IF NOT EXISTS public.schema_migrations (
    version        INT PRIMARY KEY,
    description    TEXT,
    applied_at     TIMESTAMPTZ DEFAULT NOW(),
    tenants_ok     INT DEFAULT 0,
    tenants_failed INT DEFAULT 0
);


-- ── INDEXES ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_tenants_slug    ON public.tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_status  ON public.tenants(status);
CREATE INDEX IF NOT EXISTS idx_tenants_domain  ON public.tenants(custom_domain)
    WHERE custom_domain IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_subs_tenant     ON public.subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subs_status     ON public.subscriptions(status);

CREATE INDEX IF NOT EXISTS idx_audit_tenant    ON public.audit_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_created   ON public.audit_log(created_at);
