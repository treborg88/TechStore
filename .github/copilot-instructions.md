# Eonsclover — Project Context for AI Agents

> **Principle**: Minimal but relevant. Each section below is a focused layer of knowledge.

## 🧭 Workflow

| Step | Detail |
|------|--------|
| **Local dev** | \http://eonsclover.local\ — requires \hosts\ entries |
| **Remote** | \https://eonsclover.com\ — production-like testing |
| **Branch** | \eat/saas-multitenant\ (active), \main\ (stable) |
| **Deploy** | \git push\ → SSH → \git pull\ → \docker compose up -d --build\ |

Requires \hosts\: \127.0.0.1 eonsclover.local app.eonsclover.local admin.eonsclover.local database.eonsclover.local\

## 1. Identity
**Eonsclover** is a SaaS that lets anyone create a branded online store in minutes. Each store is a PostgreSQL tenant with its own schema. Stack: Express + React + PostgreSQL + Docker Compose. Deployed on Oracle Cloud ARM64 and staging at \150.136.214.228\.

## 2. Architecture
\\\
Nginx (:80) → React SPA (frontend container)
            → Express API (backend :5001) → PostgreSQL (:5432)
            → Adminer :8080 (database.eonsclover.com)
\\\
- **Multi-tenant**: Each store = \	enant_{slug}\ PostgreSQL schema. Platform data in \public\ schema.
- **Auth**: JWT Bearer token. bcrypt passwords. CSRF cookie.
- **Proxy**: \docker/nginx-proxy.conf\ — routes by Host header. \default_server\ for main app.

## 3. Business Domain
| Entity | Key attributes |
|--------|----------------|
| **Tenant** | slug, name, plan (trial/basic/pro), schema_name, status |
| **Product** | name, price, category, images (array), stock, is_hidden |
| **Order** | items, address, payment_method, status, total |
| **Settings** | \pp_settings\ key-value per tenant — colors, fonts, layout, landing page, payments |

## 4. Technical Conventions
- **API**: \piFetch(apiUrl('/path'))\ auto-attaches auth + base URL. Backend uses raw SQL with \pg\ parameterized queries (\\, \\).
- **React**: Hooks (\useState\/\useEffect\). No Redux. Settings via \useSiteSettings\ hook with localStorage cache.
- **CSS**: No framework. CSS Modules via Vite. PascalCase JSX, import \.css\.
- **Style**: Avoid obvious comments. ES modules. JavaScript only (no TypeScript).

## 5. Repository Map
\\\
backend/
  routes/           REST endpoints by domain (products, orders, settings, saas/, etc.)
  middleware/       auth, tenant.js, dbContext, upload, csrf, planLimits, rateLimiter
  services/         provisioner, email, backup.service, encryption, llm/
  database/         schema.sql, seed.sql, seed-demo-*.sql, themes/
frontend/src/
  components/admin/ SettingsManager, SiteCustomizer, LandingPageAdmin, DatabaseSection
  components/store/ Header, Home, Products, Cart, Checkout, OrderTracker, Footer
  components/saas/  OnboardingWizard, SaasLanding, SuperAdmin panel
  hooks/            useProducts, useSiteSettings, useCart, useAuth, useSeo
  config.js         IS_TENANT, IS_SUPER_ADMIN, SYSTEM_SLUGS, DEFAULT_CATEGORY_FILTERS_CONFIG
docker/             Dockerfiles, nginx-proxy.conf
\\\

## 6. Current State (2026-06-26)
| Area | Status |
|------|--------|
| Store flow (products → cart → checkout → orders) | ✅ Working |
| Super admin panel | ✅ Working |
| SaaS onboarding (register → verify → create store) | ✅ Working |
| Multi-tenant with per-theme demo seeds | ✅ Working |
| Settings editor with live preview | ✅ Working |
| Product category filter system | ✅ Working |
| SiteCustomizer → auto-slug on category name edit | ✅ Fixed |
| Nginx proxy \default_server\ for proper subdomain routing | ✅ Fixed |
| Admin product list independent from Home filters | ✅ Fixed |
| Backup UI (list/download/restore) | ✅ Implemented |
| Provisioner \siteName\ override | ✅ Fixed |

## 7. Key Architectural Decisions
| Decision | Rationale |
|----------|-----------|
| Per-tenant schemas | Full isolation, simple backup/restore per tenant |
| \pp_settings\ key-value | Add settings without schema migration |
| \SYSTEM_SLUGS\ (app, admin, www, staging, database) | Bypass tenant resolution for platform subdomains |
| Docker Compose | Consistent across local/staging/prod |
| CSS variables for colors | Dynamic theming + live preview |
| Shared global \products\ state (useProducts) | Simple; Admin forces refresh to 'todos' on tab switch to avoid Home filter contamination |

## 8. Specialized Knowledge

**Tenant resolution** → \config.js\:
\\\
hostParts[0] → IS_TENANT if not in SYSTEM_SLUGS, else IS_SUPER_ADMIN if 'admin', etc.
\\\
Backend \middleware/tenant.js\ mirrors this — \systemSlugs\ bypass schema lookup.

**LandingPageAdmin vs SiteCustomizer**:
Both follow: horizontal nav → sidebar controls + live preview. Prefix \lp-\ (landing) vs \sc-\ (site). Landing edits \landingPageConfig\ JSON; Site edits flat \pp_settings\.

**Provisioning flow**:
1. User enters store name + slug (onboarding step 3)
2. \provisionTenant()\ → create schema → \schema.sql\ → \seed.sql\ → demo seed → apply theme → **override \siteName\** → create admin user
3. \seed.sql\ hardcodes \siteName = 'Eonsclover'\ — step 3e overwrites with user's name

**Product category→slug pipeline**:
- SiteCustomizer calls \setCatItem(idx, 'name', val)\ which also runs \slugify(val)\ to update slug
- Backend stores \categoryFiltersConfig\ as JSON string in \pp_settings\
- \ProductList\ reads \categoryFilterSettings\ prop → \categoryOptions\ derived from settings slugs + existing product categories
- Admin ProductList shares global \products\ state; AdminDashboard calls \onForceRefresh\ when entering products tab

## 9. Recurring Procedures
| Task | Steps |
|------|-------|
| **Add a setting** | 1) Default in SettingsManager state, 2) \else if\ in \uildTypedData\, 3) Field component, 4) Include in \handleSave\ payload |
| **Add landing section** | 1) Default in \landingPageDefaults.js\, 2) Editor sub-component, 3) Register in \SECTION_EDITORS\ + \SECTION_LABELS\ + \SECTION_ICONS\ |
| **Add Super Admin feature** | 1) Component in \pages/superadmin/\, 2) Add to \NAV_SYSTEM\ array, 3) Render on \ctiveNav === 'id'\, 4) Wire QuickActions |
| **Remove endpoint cleanly** | 1) Remove route, 2) Check \
outes/index.js\, 3) Search frontend for callers, 4) Remove imports/components, 5) Remove nav entries |
| **Deploy** | \docker compose up -d --build\ (local), \git push\ → SSH → \git pull\ → \docker compose up -d --build\ (remote) |

## 10. Recent Activity (2026-06-26)
- **Auto-slug on category name edit**: When user changes a category name in SiteCustomizer, \slugify()\ now runs automatically to update the slug. New categories get \slugify(name)\ instead of \cat-{timestamp}\.
- **Removed redundant "Nueva categoría" field** from admin product form — categories are managed exclusively through the Filters panel.
- **Independent admin product list**: AdminDashboard now calls \onForceRefresh()\ when switching to the products tab, preventing Home category/search filters from contaminating the admin view.
- **\siteName\ in provisioner**: After seed.sql sets \siteName = 'Eonsclover'\, provisioner step 3e overwrites it with the user's entered store name.
- **\default_server\** added to main nginx block — prevents Adminer block from catching \dmin.eonsclover.com\.
- **\database\ added to SYSTEM_SLUGS** in both frontend (\config.js\) and backend (\	enant.js\) for consistency.
