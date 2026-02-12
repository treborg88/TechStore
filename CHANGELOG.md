# Changelog

All notable changes to this project are documented in this file.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-02-12

First stable release after full infrastructure audit and hardening.

### Added
- **Docker containerization** — Dockerfiles (backend + frontend), docker-compose.yml with Nginx reverse proxy (P12)
- **Database schema** — `backend/database/schema.sql` with 9 tables, 2 RPC functions, indexes (P9)
- **Seed data** — `backend/database/seed.sql` with admin user and ~90 default settings (P9)
- **Server install script** — `scripts/install.sh` interactive 7-step setup for fresh Ubuntu servers (P10)
- **Nginx config template** — `nginx/tienda.conf.template` for Cloudflare Full Strict SSL (P6)

### Fixed
- **Portable frontend config** — `config.js` uses `/api` (relative) + `window.location.origin` instead of hardcoded domains (P2)
- **Mixed Content errors** — Removed VITE_ env vars from CI build steps; config.js defaults handle routing (P1)
- **Duplicate React runtime** — Removed unused `yet-another-react-lightbox` from root `package.json` that pulled a second React copy causing "Invalid hook call" (P2)
- **CI/CD consistency** — Unified `deploy.yml` and `rollback.yml` to use secrets consistently (P8)
- **Backend lockfile sync** — Regenerated `backend/package-lock.json` after moving `nodemailer` to correct package (P8)
- **CORS multi-URL** — `addSiteDomain()` now supports comma-separated URLs with protocol awareness

### Changed
- **SSL upgraded** — Cloudflare Flexible → Full (Strict) with Origin Certificate on Nginx :443 (P6)
- **DuckDNS deactivated** — Legacy `demotechstore.duckdns.org` removed from DNS and docs (P7)
- **Dependency cleanup** — Moved `nodemailer` to `backend/package.json`, emptied root `dependencies`
- **DEPLOYMENT.md** — Complete rewrite reflecting actual infrastructure (P5)
- **Vite config** — `allowedHosts: true` for flexible hostname support

### Removed
- Unused root dependencies: `yet-another-react-lightbox`, `dotenv`, `express`, `cors`

---

## [0.9.0] - 2026-02-11

### Added
- Health check endpoint (`GET /api/products` used by monitoring)
- `.env.example` for backend with all required variables documented

---

## [0.8.0] - 2026-02-10

### Changed
- **App.jsx refactored** — Extracted logic into custom hooks (`useAuth`, `useCart`, `useProducts`, `useSiteSettings`)
- Chatbot improvements: better context building, checkout integration

### Fixed
- Stock update errors on product refresh
- Suggested questions removed from chatbot UI

---

## [0.7.0] - 2026-02-08

### Added
- **LLM-powered chatbot** — Multi-provider support (Groq, OpenAI, Google, OpenRouter) configurable from admin panel
- **Order count badges** — Status stepper shows order counts per stage
- **New order sound alert** — Audio notification for admin on new orders

### Fixed
- Lint errors in ChatBotAdmin, AdminDashboard, AdminOrderDetail
- Chatbot toggle uses boolean with string fallback for compatibility

---

## [0.6.0] - 2026-02-07

### Added
- **Email invoice totals** with shipping cost breakdown
- Editable bank transfer settings from admin panel
- Database status panel in admin dashboard
- **Order timeline** — Visual tracker for order status history

### Fixed
- CSRF multi-tab conflicts resolved
- ProductDetail theme sync with site settings
- OrderTracker improvements for guest tracking

---

## [0.5.0] - 2026-02-05 – 2026-02-06

### Added
- **Hero banner overlay image** — Configurable from admin with color sync
- Product detail hero settings
- Mobile menu color sync with site theme
- Session management improvements for checkout UX

### Fixed
- Nginx `/p/` route for OG share pages
- Production API URL set to HTTPS domain
- CORS and Vite settings for production environment

---

## [0.4.0] - 2026-02-01 – 2026-02-02

### Added
- **Stripe payments** — Full checkout flow with configurable keys from admin panel
- **PayPal integration** — Create/capture payment flow with admin settings
- 24-hour session expiry with email logging

### Fixed
- Invoice payment method and status display for Stripe/PayPal
- Duplicate `borderTop` lint error in DeliveryMap
- Settings reorganized with collapsible compact sections

---

## [0.3.0] - 2026-01-23 – 2026-01-31

### Added
- **CI/CD with GitHub Actions** — `ci.yml` (lint + build), `deploy.yml` (auto on push to main)
- Search bar on home page
- Share button (copy link / WhatsApp)
- Password visibility security toggle
- Hero caching for performance

### Fixed
- Email verification bug
- Rate limiter exceptions for preflight
- ESLint errors resolved across codebase
- Frontend and backend `package-lock.json` tracked and synced

---

## [0.2.0] - 2026-01-06 – 2026-01-21

### Added
- **Security hardening** — JWT 24h expiry, token blacklist, CSRF Double Submit Cookie, rate limiting, AES-256-GCM encryption for settings, bcrypt hashing
- **Contact page** — Editable from admin panel
- **Image viewer** — Fullscreen, zoom, pan, swipe, pinch-to-zoom
- Admin settings tab with full site configuration
- Product detail page with gallery view
- PDF invoice generation (printable)
- Robust order ID format (`ORD-XXXXXXXX`)

### Fixed
- Cookie-based auth + CSRF protection
- Atomic stock decrement with rollback on orders
- Cart and checkout spinner improvements
- Header menu and admin panel adjustments

---

## [0.1.0] - 2025-11-28 – 2025-12-31

### Added
- **Initial e-commerce platform** — React 19 (Vite) + Express + Supabase
- Product catalog with images (Supabase Storage)
- Shopping cart (hybrid: server for auth users, localStorage for guests)
- Order management with admin dashboard
- User authentication (JWT + bcrypt)
- Email verification with 6-digit code
- Guest checkout flow
- Admin panel: products, orders, users management
- Responsive design with mobile adaptations
- **Database migration** — SQLite → Supabase PostgreSQL (Dec 2025)
- Image migration to Supabase Storage

---

[1.0.0]: https://github.com/treborg88/TechStore/compare/v0.9.0...v1.0.0
[0.9.0]: https://github.com/treborg88/TechStore/compare/v0.8.0...v0.9.0
[0.8.0]: https://github.com/treborg88/TechStore/compare/v0.7.0...v0.8.0
[0.7.0]: https://github.com/treborg88/TechStore/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/treborg88/TechStore/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/treborg88/TechStore/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/treborg88/TechStore/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/treborg88/TechStore/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/treborg88/TechStore/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/treborg88/TechStore/releases/tag/v0.1.0
