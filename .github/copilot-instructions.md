## Agent Workflow
- Avoid unsolicited features or commentary.
- Keep code minimal; keep the code minimalistic and always comments the code for readability.
- Use existing project patterns and styles.
- Prioritize clarity, escalability and maintainability.
- Explanations go in chat, not in repository files.
- this is a professional project; maintain high standards of quality and professionalism.
- All code is intended for a production environment unless otherwise specified.
- whenever a code change, update or fix, make sure to delete any obsolete code as resulting from the change.

## Production Infrastructure (Verified Feb 2026)

| Field | Value |
|-------|-------|
| **Server** | Oracle Cloud ARM64, Ubuntu 22.04, IP `143.47.118.165` |
| **Domain** | `eonsclover.com` (Cloudflare proxy) |
| **SSH user** | `ubuntu` |
| **App path** | `/home/ubuntu/TechStore/` |
| **Process manager** | PM2 (backend on :5001, frontend Vite preview on :5173) |
| **Reverse proxy** | Nginx on :80 (redirect) + :443 (SSL) |
| **SSL** | Cloudflare Full (Strict) — Origin Certificate on Nginx :443 |
| **CI/CD** | GitHub Actions: `ci.yml` (lint+build), `deploy.yml` (auto on push to main), `rollback.yml` (manual) |
| **DB** | Supabase (hosted Postgres + Storage bucket `products`) |
| **Version** | `1.0.0` (SemVer — see `CHANGELOG.md`) |

## Architecture Overview
**Monorepo**: Express backend (`backend/`) + Vite/React 19 frontend (`frontend/`).

| Layer | Key Files | Tech Stack |
|-------|-----------|------------|
| API | `backend/server.js` (~200 LOC, modular) | Express, JWT, bcrypt, multer |
| Routes | `backend/routes/*.routes.js` | auth, products, cart, orders, users, settings, verification, payments, chatbot |
| Middleware | `backend/middleware/` | auth, csrf, rateLimiter, upload |
| Services | `backend/services/` | email.service, encryption.service, llm/ (chatbot) |
| Config | `backend/config/` | env vars, CORS (dynamic) |
| DB | `backend/database.js` (statements object) | Supabase (Postgres + Storage) |
| DB Schema | `backend/database/schema.sql` | 9 tables, 2 RPC functions, indexes |
| DB Seed | `backend/database/seed.sql` | Admin user, ~90 default settings |
| Share | `backend/sharePage.js` | OG meta for social sharing |
| UI | `frontend/src/App.jsx` (state hub) | React 19, react-router-dom v7, react-hot-toast |
| Hooks | `frontend/src/hooks/` | useAuth, useCart, useProducts, useSiteSettings |
| FE Services | `frontend/src/services/apiClient.js` | `apiFetch()` wraps fetch with auth/CSRF headers |
| Routes | `frontend/src/routes/AppRoutes.jsx` | Lazy-loaded routes with React.lazy + Suspense |

### Backend Structure
```
backend/
├── server.js              # Main entry (~200 lines)
├── database.js            # Supabase statements
├── sharePage.js           # OG meta for social sharing
├── config/
│   ├── index.js           # ENV vars (JWT_SECRET, PORT, EMAIL_*)
│   └── cors.js            # Dynamic CORS (env var + Admin Panel siteDomain + localhost)
├── database/
│   ├── schema.sql         # 9 tables, 2 RPC functions, indexes
│   └── seed.sql           # Default admin + ~90 settings
├── middleware/
│   ├── auth.js            # authenticateToken, requireAdmin, tokenBlacklist
│   ├── csrf.js            # CSRF protection
│   ├── rateLimiter.js     # Rate limiting
│   └── upload.js          # Multer config
├── routes/
│   ├── auth.routes.js     # /api/auth/* (9 endpoints)
│   ├── products.routes.js # /api/products/* (8 endpoints)
│   ├── cart.routes.js     # /api/cart/* (5 endpoints)
│   ├── orders.routes.js   # /api/orders/* (12 endpoints)
│   ├── users.routes.js    # /api/users/* (4 endpoints)
│   ├── settings.routes.js # /api/settings/* (5 endpoints)
│   ├── verification.routes.js # /api/verification/* (2 endpoints)
│   ├── payments.routes.js # /api/payments/* (9 endpoints: Stripe + PayPal + saved cards)
│   └── chatbot.routes.js  # /api/chatbot/* (4 endpoints: message, config, providers, test)
├── services/
│   ├── email.service.js   # sendOrderEmail, sendMailWithSettings (HTML templates)
│   ├── encryption.service.js # AES-256-GCM for settings
│   └── llm/               # Chatbot LLM
│       ├── adapter.js     # 5 providers: Groq, OpenAI, Google Gemini, OpenRouter, Custom
│       ├── contextBuilder.js # Dynamic DB context per intent, product links, store info cache
│       └── intentDetector.js # Keyword intent detection, Spanish synonyms, page awareness
└── utils/
    └── orderNumber.js     # generateOrderNumber (W-YYMMDD-XXXXX)
```

### Frontend Structure
```
frontend/src/
├── App.jsx                # State hub, cart sync, auth context
├── config.js              # API_URL (/api relative), BASE_URL (window.location.origin)
├── main.jsx               # React root
├── components/
│   ├── admin/
│   │   ├── AdminDashboard.jsx    # 4-tab dashboard: Overview, Products, Orders, Users
│   │   ├── AdminOrderDetail.jsx  # Order detail: status stepper, tracking, notes, PDF
│   │   ├── DatabaseSection.jsx   # Supabase URL/key editor + connection test
│   │   ├── EmailSettingsSection.jsx # SMTP config + invoice footer
│   │   ├── SettingsManager.jsx   # Full site config (20+ sections)
│   │   └── UserList.jsx          # CRUD users, roles, status, filters
│   ├── auth/
│   │   ├── EmailVerification.jsx # Multi-purpose: register, guest, payment
│   │   ├── LoginPage.jsx         # Login + register + forgot/reset password (3-step)
│   │   └── UserProfile.jsx       # Profile edit, address, password change
│   ├── cart/
│   │   ├── Cart.jsx              # Cart display + quantity management
│   │   ├── Checkout.jsx          # 4-step wizard: info → address/map → payment → invoice
│   │   ├── DeliveryMap.jsx       # Leaflet map, GPS, distance-based shipping
│   │   ├── PayPalPayment.jsx     # PayPal SDK integration
│   │   └── StripePayment.jsx     # Stripe Elements + saved cards
│   ├── chatbot/
│   │   ├── ChatBot.jsx           # Floating chat widget
│   │   └── ChatBotAdmin.jsx      # Provider config, personality, UI, test connection
│   ├── common/
│   │   ├── Header.jsx            # Responsive header, hamburger menu, transparent mode
│   │   ├── Footer.jsx            # Social links, quick links, customer service
│   │   ├── Invoice.jsx           # HTML invoice with status stepper + payment instructions
│   │   ├── InvoicePDF.jsx        # @react-pdf/renderer A4 PDF generation
│   │   └── LoadingSpinner.jsx    # Fullpage overlay + custom message
│   ├── orders/
│   │   ├── OrderList.jsx         # Filterable, searchable order list + status badges
│   │   └── OrderTrackerModal.jsx # Timeline modal for order tracking
│   └── products/
│       ├── ProductDetail.jsx     # Gallery, sharing, similar products, admin inline edit
│       ├── ProductImageGallery.jsx # Carousel, swipe, zoom, pinch, fullscreen
│       └── ProductList.jsx       # Grid with drag scroll, pagination
├── hooks/
│   ├── useAuth.js         # Auth state, cross-tab sync, checkout cleanup
│   ├── useCart.js         # Cart logic, guest/server merge, localStorage persistence
│   ├── useProducts.js    # Product fetching, localStorage cache (10min), stale-while-revalidate
│   └── useSiteSettings.js # Dynamic theme (CSS vars), favicon, title, settings cache
├── pages/
│   ├── Home.jsx           # Hero banner, category filters, product grid, promo, features
│   ├── Contact.jsx        # Contact info, Google Maps embed, admin inline editing
│   └── OrderTracker.jsx   # Public order search, visual timeline, email lookup
├── routes/
│   └── AppRoutes.jsx      # Lazy-loaded routes with React.lazy + Suspense
├── services/
│   ├── apiClient.js       # apiFetch() with auth/CSRF headers, CSRF memory fallback
│   ├── authService.js     # Login, register, profile API calls
│   └── verificationService.js # Send/verify code API calls
└── utils/
    ├── cartHelpers.js     # formatBackendCart (normalize backend → frontend format)
    ├── formatCurrency.js  # Intl.NumberFormat with configurable currency (default RD$)
    ├── invoiceUtils.js    # PDF blob generation, download helpers
    ├── notificationSound.js # Web Audio API two-tone chime (C5+E5) for new orders
    └── settingsHelpers.js # Deep-merge settings with category/card config defaults
```

## Quick Start
```bash
# Backend (port 5001)
npm install           # repo root for shared deps
cd backend && npm install && npm run dev

# Frontend (port 5173)
cd frontend && npm install && npm run dev
```

**Required backend `.env`:**
- `JWT_SECRET` (mandatory—server exits if missing)
- `SUPABASE_URL`, `SUPABASE_KEY`
- `EMAIL_USER`, `EMAIL_PASS` (for verification/reset emails)
- `STRIPE_SECRET_KEY` (optional — for Stripe payments)

## Key Features

### Home Page
- **Dynamic hero banner**: configurable bg image, overlay image, text position (X/Y), font sizes, colors, height — all from admin panel. Hero image cached as base64 in localStorage.
- **Category filter cards**: horizontal scroll with mouse drag, custom icons/images per category, fully configurable styles via admin settings (20+ CSS props).
- **Product search bar**: client-side text filtering by name, description, or category.
- **Product grid**: horizontal drag scrolling, configurable columns per breakpoint (mobile/tablet/desktop/wide), vertical or horizontal card orientation.
- **Promo section**: promotional banner with image.
- **"Why Choose Us" features section**: 3-card grid (shipping, warranty, secure payment).

### Product Detail
- **Image gallery**: infinite carousel with seamless wrap-around, touch swipe for mobile, mouse drag for desktop, fullscreen modal with zoom/pan, pinch-to-zoom (multi-touch), thumbnail dot indicators.
- **Social sharing**: Web Share API + clipboard fallback. OG meta tags via `/p/<slug>` backend route for WhatsApp/Telegram/Facebook previews.
- **Similar products**: same category, up to 10.
- **Stock indicators**: "out of stock" and "low stock" (< 5) badges.
- **Admin inline editing**: description editable directly from product detail page.

### Checkout Flow (4-Step Wizard)
1. **Customer info**: name, email, phone (prefilled from profile for logged-in users).
2. **Delivery address + map**: Leaflet.js interactive map, GPS geolocation, distance-based shipping (5 zones via Haversine formula), draggable marker, route visualization, shipping rates table.
3. **Payment**: Cash on delivery (COD), bank transfer (configurable details), Stripe (Elements + saved cards), PayPal.
4. **Invoice**: HTML display + PDF download/email.
- Guest checkout with inline email verification (no account required).
- Embedded login during checkout (no redirect away).
- Pending payment recovery: Stripe/PayPal state persisted in localStorage.
- Free shipping threshold support (configurable from admin).

### Payment Methods
- **Cash on delivery (COD)**: order placed with `pending_payment` status.
- **Bank transfer**: configurable bank name, holder, account, note (from admin settings).
- **Stripe**: Stripe Elements (`PaymentElement`), saved cards (list, select, delete), test/live mode toggle from admin.
- **PayPal**: PayPal SDK create/capture flow.
- Each method can be enabled/disabled from admin settings.

### Invoice System
- **HTML invoice**: status stepper, payment instructions per method, company details (name, address, phone, RNC, icon).
- **PDF generation**: `@react-pdf/renderer` — A4, company header, items table, totals with shipping.
- **Email invoice**: `POST /orders/:id/invoice-email`.
- **8 order statuses**: pending_payment → paid → to_ship → shipped → delivered (+ return, refund, cancelled).
- COD vs online payment have different status step order.

### Order Tracking
- **Public access**: search by order number (`W-YYMMDD-XXXXX`) or email.
- **Visual timeline**: 5-step progress for normal flow, separate cancelled indicator.
- **Filters**: active/all/completed, paginated (10 per page).
- **Detail modal**: full Invoice component with timeline.

### Admin Dashboard
- **4 tabs**: Overview, Products, Orders, Users.
- **KPI cards**: total revenue, pending orders, product count, user count (clickable → navigate to tab).
- **Sales chart**: bar chart with period selector (day/week/month/year), 7-period view, click-to-inspect tooltip.
- **Top selling products**: ranking with thumbnails, quantity, revenue, progress bars (top 5/10/15).
- **Stock alerts**: products with stock < 5.
- **Recent orders**: last 5 with status badge.
- **New order polling**: 30s interval with notification sound (Web Audio API two-tone chime).
- **Analytics cache**: 2-minute TTL with manual refresh.

### Admin Order Management
- **Status stepper**: different flow for COD vs online; separate main flow and extra actions (return/refund/cancel).
- **Tracking**: tracking number + carrier input.
- **Internal notes**: admin-only, saved per order.
- **PDF generation**: from admin detail view.
- **Filters**: search (debounced 500ms), status pipeline, type (all/online/COD), payment type.
- **Status badge counts** per pipeline step.
- **Paginated order list** with per-page cache (1-minute TTL).

### Admin User Management
- **Create user**: name, email, password, role.
- **Role change**: admin ↔ customer.
- **Activate/deactivate** users.
- **Filters**: search, role (all/admin/customer), status (all/active/inactive).
- **Self-protection**: admins cannot demote or deactivate themselves.

### Admin Settings Manager (20+ Sections)
- **Site identity**: logo upload, custom site name as image, sizing.
- **Maintenance mode** toggle.
- **Free shipping threshold**.
- **Promo banner** text toggle + custom text.
- **Hero section**: all banner properties, overlay image with position/size/opacity.
- **Product detail hero**: separate config or inherit from home.
- **Header styling**: background color, transparency (0–100%), text/button colors.
- **Theme editor**: 5 color variables (primary, secondary, accent, bg, text) → CSS vars on `:root` with auto-generated hover variants.
- **Category filters**: custom categories with icon/image, 20+ CSS style props.
- **Product card**: layout (orientation, responsive columns per breakpoint), 30+ CSS props, currency.
- **Payment methods**: toggle + configure cash/transfer/Stripe/PayPal individually.
- **All sections collapsible** with toggle state.

### Admin Database Section
- Supabase URL + key editor with masked display.
- Live connection status badge (green/red).
- Test connection button.

### Admin Email Settings
- SMTP config: host, port, user, password, TLS toggle.
- Sender name + email.
- Invoice footer tab: bank transfer details for invoices.
- HTML email template with placeholders.

### Chatbot (LLM-Powered)
- **5 providers**: Groq (Llama 3.3 70B), OpenAI (GPT-4o-mini), Google Gemini (2.0 Flash), OpenRouter (Llama 3.3 free), Custom (any OpenAI-compatible API).
- **Intent detection**: keyword matching → PRODUCT_SEARCH, ORDER_STATUS, POLICIES, STORE_INFO, HOW_TO_BUY.
- **Spanish synonyms**: celular↔smartphone, laptop↔portátil, etc.
- **Dynamic context**: only fetches relevant DB data per detected intent (not full product dump).
- **Page awareness**: detects current page (product detail, cart, checkout) with product ID extraction.
- **Store info caching**: 10-min TTL from app_settings.
- **Admin config**: enable/disable, provider selection, per-provider API key/model/URL, personality, verbosity, custom system prompt, UI config (greeting, color, max messages), LLM params, test connection button.

### Contact Page
- Public contact info: email, phone, WhatsApp (direct wa.me link), address, hours, support line.
- Google Maps embed via configurable URL.
- Admin inline editing of all contact fields (saves to settings).

### Social Sharing (Backend)
- `/p/<slug>` renders full HTML with Open Graph, Twitter Card, WhatsApp/Telegram meta tags.
- Product price meta tags (`product:price:amount`, `product:price:currency`).
- Auto-redirect to frontend product page via `<meta http-equiv="refresh">`.

### User Profile
- Profile editing: name, email, phone.
- Shipping address: street, sector, city, country (pre-populated for checkout).
- Password change: current → new → confirm with validation.

## Key Patterns

### Authentication & Authorization
- JWT via `Authorization: Bearer <token>` or `auth_token` cookie (24h expiry).
- Token blacklist on logout (in-memory with hourly cleanup).
- Middleware: `authenticateToken` in `middleware/auth.js`.
- Admin guard: `requireAdmin` middleware.
- Roles: `customer` | `admin`. Frontend checks `user.role === 'admin'` for UI gating.
- Rate limiting on `/api/auth/*` and `/api/verification/*` (15 min window, 10 requests).
- Forgot/reset password: email → verification code → new password (3-step flow).
- Cross-tab session sync: login/logout propagated via `storage` event listener.

### Frontend API Calls
Always use `apiFetch()` from `services/apiClient.js`—it auto-attaches Bearer token and CSRF token:
```javascript
import { apiFetch, apiUrl } from './services/apiClient';
const res = await apiFetch(apiUrl('/products'), { method: 'GET' });
```
CSRF token fallback: in-memory cache when cookies don't work (mobile browsers).

### Cart Behavior (Hybrid)
- **Authenticated**: server-managed via `/api/cart` endpoints; synced in `App.jsx`.
- **Guest**: client-side React state; persisted to `localStorage` key `cart_persistence`.
- On login, guest cart merges to server (`syncLocalCart` in App.jsx).
- `cartHelpers.js` normalizes backend → frontend cart format.

### Caching Strategy
- **Products**: localStorage per category+page, 10-min freshness, stale-while-revalidate.
- **Site settings**: localStorage, 10-min TTL, stale-while-revalidate.
- **Hero image**: cached as base64 in localStorage.
- **Admin analytics**: 2-min TTL with manual refresh.
- **Order list**: per-page cache, 1-min TTL.
- **User list**: 2-min cache TTL.

### Dynamic Theming
- `useSiteSettings` hook applies CSS variables to `:root` (primary, secondary, accent, bg, text + hover).
- Dynamic favicon: emoji → canvas → PNG, or logo URL.
- Dynamic page title from `siteName`.
- Header supports configurable background color with transparency (0–100%).

### Config Switching (Important!)
```javascript
// frontend/src/config.js — detects localhost vs production
const isLocalhost = window.location.hostname === 'localhost';
// Production: /api (relative — Nginx proxies to backend:5001)
// Dev: http://localhost:5001/api (direct)
export const API_URL = import.meta.env.VITE_API_URL || DEFAULT_API_URL;
export const BASE_URL = import.meta.env.VITE_BASE_URL || DEFAULT_BASE_URL;
```
**Production note**: No frontend `.env` files on server. `deploy.yml` does NOT pass VITE_ env vars. Frontend uses the `/api` relative + `window.location.origin` defaults.

## API Routes Summary (56 total endpoints)
| Route | Auth | Notes |
|-------|------|-------|
| `GET /api/auth/csrf` | Public | Returns CSRF token |
| `GET /api/auth/check-email` | Public | Check if email exists |
| `POST /api/auth/register` | Public | Requires `code` from verification flow |
| `POST /api/auth/login` | Public | Returns `{ user, token }` |
| `POST /api/auth/logout` | Bearer | Blacklists token |
| `GET /api/auth/me` | Bearer | Current user profile |
| `PUT /api/auth/profile` | Bearer | Update profile |
| `POST /api/auth/forgot-password` | Public | Send reset code |
| `POST /api/auth/reset-password` | Public | Reset with code |
| `GET /api/products` | Public | Paginated: `{ data, total, page, limit, totalPages }` |
| `GET /api/products/:id` | Public | Single product |
| `POST /api/products` | Admin | `multipart/form-data`, field `images[]` (≤10) |
| `PUT /api/products/:id` | Admin | Update product |
| `DELETE /api/products/:id` | Admin | Delete product |
| `POST /api/products/:id/images` | Admin | Add images to product |
| `DELETE /api/products/:id/images/:imgId` | Admin | Remove image |
| `GET/POST/PUT/DELETE /api/cart` | Bearer | Server-side cart for logged-in users |
| `POST /api/orders` | Bearer | Creates order, decrements stock atomically |
| `POST /api/orders/guest` | Public | Requires email verification |
| `GET /api/orders/my` | Bearer | User's own orders |
| `GET /api/orders/counts` | Admin | Order counts by status |
| `GET /api/orders/track/:id` | Public | Track by ID or `order_number` |
| `GET /api/orders/track/email/:email` | Public | Track by email |
| `PUT /api/orders/:id` | Admin | Update order details |
| `PUT /api/orders/:id/status` | Admin | Change order status |
| `DELETE /api/orders/:id` | Admin | Delete order |
| `POST /api/orders/:id/invoice-email` | Bearer | Send invoice by email |
| `GET /api/users` | Admin | List users (paginated) |
| `POST /api/users` | Admin | Create user |
| `PUT /api/users/:id/role` | Admin | Change user role |
| `PUT /api/users/:id/status` | Admin | Activate/deactivate user |
| `GET /api/settings` | Admin | All settings |
| `GET /api/settings/public` | Public | Public-facing settings |
| `PUT /api/settings` | Admin | Update settings |
| `GET /api/settings/db-status` | Admin | Supabase connection status |
| `POST /api/settings/upload` | Admin | Upload image (logo, hero, etc.) |
| `POST /api/verification/send` | Public | Send verification code |
| `POST /api/verification/verify` | Public | Verify code |
| `POST /api/payments/stripe/create-intent` | Bearer | Stripe payment intent |
| `POST /api/payments/stripe/confirm` | Bearer | Confirm stripe payment |
| `GET /api/payments/stripe/config` | Bearer | Public Stripe key |
| `POST /api/payments/stripe/webhook` | Public | Stripe webhook |
| `GET /api/payments/saved-cards` | Bearer | List saved Stripe cards |
| `DELETE /api/payments/saved-cards/:id` | Bearer | Delete saved card |
| `POST /api/payments/paypal/create` | Bearer | PayPal create order |
| `POST /api/payments/paypal/capture` | Bearer | PayPal capture payment |
| `GET /api/payments/paypal/config` | Bearer | PayPal client ID |
| `POST /api/chatbot/message` | Public | LLM chatbot (multi-provider) |
| `GET /api/chatbot/config` | Admin | Chatbot settings |
| `GET /api/chatbot/providers` | Admin | Available providers list |
| `POST /api/chatbot/test` | Admin | Test LLM connection |

## Database Schema (9 Tables)
| Table | Purpose |
|-------|---------|
| `users` | id, name, email, password (bcrypt), role, is_active, phone, address fields |
| `products` | id, name, description, price, stock, category, image (legacy), created_at |
| `product_images` | id, product_id (FK), image_url, display_order |
| `cart` | id, user_id (FK), product_id (FK), quantity |
| `orders` | id, user_id, order_number, status, payment_method/status, shipping_cost, tracking, notes |
| `order_items` | id, order_id (FK), product_id, name, price, quantity, image |
| `verification_codes` | id, email, code, type, expires_at, used |
| `app_settings` | id, key (unique), value (text) |
| `token_blacklist` | id, token, expires_at |
- **RPC**: `decrement_stock_if_available()` (prevents overselling), `increment_stock()` (returns/cancellations)
- **Storage**: Supabase bucket `products` (public read, authenticated write)

## Testing
```bash
cd frontend && npm run test:e2e     # All Playwright tests
cd frontend && npm run test:e2e:p0  # Critical tests only
cd frontend && npm run test:e2e:p1  # High priority
cd frontend && npm run test:e2e:p2  # Medium priority
```
- Specs in `frontend/tests/specs/` organized by priority: `p0-critical/`, `p1-high/`, `p2-medium/`, `components/`.
- `playwright.config.js` baseURL is `http://localhost:5173/`.
- **Gotcha**: auth tests can trigger rate limits; space out runs.

## Infrastructure Files
| Directory | Contents |
|-----------|----------|
| `docker/` | Dockerfile.backend, Dockerfile.frontend, nginx-frontend.conf, nginx-proxy.conf |
| `docker-compose.yml` | 3 services: backend, frontend, proxy (Nginx) |
| `ansible/` | playbook.yml, inventory.yml, vars/main.yml, templates/ (Nginx + PM2 Jinja2) |
| `scripts/install.sh` | Interactive server setup for fresh Ubuntu |
| `nginx/tienda.conf.template` | Parametrized Nginx config (sed variables) |
| `ecosystem.config.cjs` | PM2 config: backend (node) + frontend (vite preview) |
| `.github/workflows/` | ci.yml, deploy.yml, rollback.yml |

## Common Gotchas
1. **CORS**: Dynamic — set `CORS_ORIGIN` env var (comma-separated domains) or use Admin Panel → E-commerce → Dominio del Sitio. No need to edit code.
2. **Dependencies**: Root `package.json` has `devDependencies` only (`concurrently`). All production deps in `backend/` or `frontend/`.
3. **Errors**: All API errors return `{ message: "..." }`—read `.message` on frontend.
4. **Images**: `product.image` may be full Supabase URL or legacy path; handle both.
5. **ESLint**: Unused vars cause errors unless prefixed with `_`.
6. **Order number format**: `W-YYMMDD-XXXXX` (generated in `backend/utils/orderNumber.js`).
7. **Currency**: Default `RD$` (Dominican Peso), configurable from admin settings. Uses `Intl.NumberFormat`.
8. **Leaflet map**: warehouse location hardcoded to Santo Domingo, DR in `DeliveryMap.jsx`.

## Adding Features Checklist
- [ ] New endpoint: create route file in `routes/`, register in `routes/index.js`, mount in `server.js`
- [ ] New frontend route: add to `<Routes>` in `AppRoutes.jsx`, lazy-load component
- [ ] New component: follow existing pattern (component folder, CSS module if needed)
- [ ] New hook: add to `hooks/`, follow `useProducts.js` pattern for caching
- [ ] CORS issues: set `CORS_ORIGIN` env var or use Admin Panel → E-commerce → `siteDomain`
- [ ] New env var: add to `config/index.js` and document here
- [ ] New setting: add key to `seed.sql`, use `apiFetch(apiUrl('/settings'))` to read

## Security Features Implemented

### Authentication & Token Security
- **JWT 24h expiry**: Tokens expire after 24 hours
- **Token blacklist**: Logout invalidates tokens immediately via in-memory blacklist
- **Hourly cleanup**: Expired tokens purged from blacklist every hour
- **Dual token delivery**: Supports both `Authorization: Bearer` header and `auth_token` cookie
- **Cross-tab sync**: Login/logout propagated across browser tabs via `storage` event

### Authorization & Access Control
- **Admin-only routes**: Product CRUD, user management, settings require `requireAdmin` middleware
- **Role-based access**: `authenticateToken` + `requireAdmin` pattern for protected endpoints
- **Self-protection**: Admins cannot demote themselves or deactivate their own accounts

### CSRF Protection
- **Double Submit Cookie**: CSRF token in `XSRF-TOKEN` cookie + `X-CSRF-Token` header
- **State-changing protection**: All POST/PUT/DELETE requests validate CSRF
- **Auto-refresh**: CSRF cookie refreshed on `/api/auth/me` if missing
- **Mobile fallback**: In-memory CSRF cache when cookies fail

### Rate Limiting
- **Auth endpoints**: 10 requests per 15 minutes on login, register, password reset
- **Verification**: Rate limited to prevent code brute-forcing
- **Preflight skip**: OPTIONS requests don't count against limits

### Input Validation & Sanitization
- **Search sanitization**: `sanitizeSearchInput()` in `database.js` escapes SQL wildcards (`%`, `_`)
- **Query length limit**: Search queries capped at 100 characters
- **Password requirements**: Min 8 chars, uppercase, lowercase, number

### Data Protection
- **AES-256-GCM encryption**: Sensitive settings (mail password) encrypted at rest
- **Password hashing**: bcrypt with 10 salt rounds
- **No password exposure**: User responses never include password field
- **Stock atomicity**: `decrement_stock_if_available()` RPC prevents overselling

### Environment Security
- **Mandatory secrets**: Server refuses to start without `JWT_SECRET`
- **Environment variables**: All URLs/secrets in `.env` files (gitignored)
- **Frontend env vars**: Uses `VITE_*` prefix for client-safe config
- **Masked secrets in UI**: API keys and passwords masked with show/hide toggle
