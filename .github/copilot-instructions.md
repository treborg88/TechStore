# Eonsclover — AI Project Context

## Local / Remote Development Workflow
- Working in Visual Studio Code using a Copilot-powered LLM to interact with the code.
- The primary instance is the local PC. Always work on this instance first.
- The secondary instance is a remote host used only for production-like testing after local verification.
- Keep code compatible with both environments: local and remote.
- Local base URL: `http://eonsclover.local`
- Remote base URL: `https://eonsclover.com`
- Both environments should handle both host contexts.
- For local testing, ensure your machine resolves `eonsclover.local` and related local subdomains to `127.0.0.1`.
- Add these lines to your Windows `hosts` file when testing locally:
  ```
  127.0.0.1 eonsclover.local
  127.0.0.1 app.eonsclover.local
  127.0.0.1 admin.eonsclover.local
  127.0.0.1 database.eonsclover.local
  ```

### Local instance checklist
1. Verify Docker Desktop is open.
2. Confirm Docker containers are running.
3. Confirm `docker compose up` is active.

### Deployment workflow
1. update code / add feature / fix bugs
2. fully test the app locally
3. update local git
4. manual test locally
5. git push branch
6. remote host git pull
7. remote host testing

## 1. Identity
Eonsclover is a SaaS platform for creating online stores. Users register, get a subdomain (`{slug}.eonsclover.com`), and can immediately sell products. Stack: Express + React + PostgreSQL. Containerized with Docker Compose. Deployed on Oracle Cloud ARM64. **Active branch**: `feat/saas-multitenant`.

## 2. Architecture
```
User → Nginx (:80) → React SPA (frontend container)
                   → Express API (backend :5001) → PostgreSQL (:5432)
                   → Adminer :8080 (database.eonsclover.com)
```
- Frontend: Vite + React SPA, served by Nginx inside Docker. Routing via `src/config.js` subdomain logic.
- Backend: Express API. Multi-tenant: each store gets a `tenant_{slug}` PostgreSQL schema. SaaS data in `public` schema.
- Proxy: Nginx container (`docker/nginx-proxy.conf`). Domain-based routing with `default_server` for main app.
- Auth: JWT (`Authorization: Bearer`). bcrypt passwords.

## 3. Business Domain
| Entity | Notes |
|--------|-------|
| **Tenant** | A store with its own PostgreSQL schema, slug, admin user. Plans: trial/basic/pro. |
| **Product** | Tenant-scoped. Has name, price, images, category. |
| **Order** | Checkout: cart → address → payment → order confirmation + email. |
| **Settings** | `app_settings` key-value per tenant. Controls colors, fonts, layout, landing page, payment methods. |

## 4. Technical Conventions
- **API** — `apiFetch(apiUrl('/path'))` (auto-attaches auth + base URL). Backend: raw SQL via `pg`, parameterized (`$1, $2`).
- **React** — `useState`/`useEffect`. Settings loaded via `SettingsManager` from `/api/settings`.
- **CSS** — No framework. CSS Modules via Vite. PascalCase in JSX, followed by CSS file import.
- **Code style** — Avoid comments that describe the literal code. Minimal dependencies. ES modules (`import`/`export`). No `.ts` files (JavaScript only).

## 5. Repository Map
```
backend/                  Express API
  routes/                 REST endpoints (products, orders, cart, settings, auth, saas/*)
  middleware/             Auth, tenant resolution, CSRF, plan limits, rate limiter, upload
  services/               Business logic (provisioner, email, backup, encryption, llm/*, tenant/*)
  database/               schema.sql, seed.sql, seed-demo-*.sql, themes/, _rebuild_seeds.mjs
frontend/                 React SPA
  src/components/admin/   SettingsManager, SiteCustomizer, LandingPageAdmin, DatabaseSection, etc.
  src/components/store/   Header, Home, Products, Cart, Checkout, OrderTracker, Footer
  src/components/saas/    OnboardingWizard, SaasLanding, SuperAdmin panel
  src/config.js           SaaS detection: IS_TENANT, IS_SUPER_ADMIN, SYSTEM_SLUGS
  src/utils/              formatCurrency, landingPageDefaults, colorPalettes, cacheStorage
docker/                   Dockerfile.backend, Dockerfile.frontend, nginx-proxy.conf
```

## 6. Current State
- **Working**: Full store flow (products, cart, checkout, orders). Super admin panel. SaaS onboarding (register → verify → create store). Settings panel with live preview. Multi-tenant provisioning with per-theme demo seeds. Adminer at `database.eonsclover.com`.
- **In progress**: Landing page editor improvements. SaaS subscription plans integration. Landing SEO and chatbot AI enhancements.
- **Recently fixed**: Double scrollbar in LandingPageAdmin preview. `siteName` override during provisioning. Landing route SEO title tags. `default_server` in nginx-proxy.conf to fix admin routing.

## 7. Key Architectural Decisions
| Decision | Why |
|----------|-----|
| Per-tenant PostgreSQL schemas | Full data isolation, simple backup/restore per tenant |
| `app_settings` key-value | Flexible — new settings don't require schema migration |
| `SYSTEM_SLUGS = ['app', 'admin', 'www', 'staging', 'database']` | Bypass tenant resolution for platform subdomains |
| Docker Compose | Consistent dev/staging/prod, single command deployment |
| CSS variables for colors | Dynamic theming, live preview in settings panel |

## 8. Specialized Knowledge

**Tenant resolution** (`frontend/src/config.js`):
- `hostParts[0]` determines route: tenant store, system page (admin/app), or landing (bare domain / www).
- `SYSTEM_SLUGS` subdomains bypass `IS_TENANT` detection.
- Backend `middleware/tenant.js` mirrors this — `systemSlugs` bypasses schema lookup.

**LandingPageAdmin vs SiteCustomizer**:
- Both follow the same pattern: horizontal nav → sidebar (controls) + preview (live). CSS classes use `lp-` and `sc-` prefixes.
- `LandingPageAdmin` edits `landingPageConfig` (JSON sections). `SiteCustomizer` edits flat settings (`primaryColor`, `siteName`, etc.).
- Both render as direct children of `.settings-content` in `SettingsManager.jsx`.

**Provisioning flow**:
1. User enters store name + slug in onboarding step 3
2. Backend `provisionTenant()`: creates schema → runs seed.sql → runs theme demo seed → applies theme → **overrides `siteName` with user's entered name** → creates admin user
3. Seed data: products, demo images, color settings per theme

## 9. Recurring Procedures
- **Add a setting**: 1) Add default in `SettingsManager` state, 2) Add `else if` in `buildTypedData`, 3) Add field in the relevant component, 4) Include in `handleSave` payload.
- **Add a landing page section**: 1) Add default in `landingPageDefaults.js`, 2) Create editor sub-component, 3) Register in `SECTION_EDITORS` + `SECTION_LABELS` + `SECTION_ICONS`.
- **Deploy locally**: `docker compose up -d --build` (rebuilds all containers).
- **Deploy to staging**: `git push` → SSH into server → `git pull` → `docker compose up -d --build`.

## 10. Recent Activity (2026-06-18)
- Fixed `siteName` override in provisioner: after `seed.sql` hardcodes `siteName = 'Eonsclover'`, the user's entered store name now properly overwrites it via `UPDATE app_settings`.
- Added `default_server` to the main nginx server block to prevent Adminer block from becoming the Nginx default server.
- Removed nested overflow constraints from LandingPageAdmin CSS (`lp-app`, `lp-body`, `lp-preview-scroll`) to eliminate double scrollbar.
- Both frontend and backend `systemSlugs` now include `'database'` for consistency.
