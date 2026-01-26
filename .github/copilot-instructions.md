## Agent Workflow
- Avoid unsolicited features or commentary.
- Keep code minimal; keep the code minimalistic and always comments the code for readability.
- Use existing project patterns and styles.
- Prioritize clarity, escalability and maintainability.
- Explanations go in chat, not in repository files.
- this is a professional project; maintain high standards of quality and professionalism.
- All code is intended for a production environment unless otherwise specified.
- whenever a code change, update or fix, make sure to delete any obsolete code as resulting from the change.

## Architecture Overview
**Monorepo**: Express backend (`backend/`) + Vite/React 19 frontend (`frontend/`).

| Layer | Key Files | Tech Stack |
|-------|-----------|------------|
| API | `backend/server.js` (~120 LOC, modular) | Express, JWT, bcrypt, multer |
| Routes | `backend/routes/*.routes.js` | auth, products, cart, orders, users, settings, verification |
| Middleware | `backend/middleware/` | auth, csrf, rateLimiter, upload |
| Services | `backend/services/` | email.service, encryption.service |
| Config | `backend/config/` | env vars, CORS |
| DB | `backend/database.js` (statements object) | Supabase (Postgres + Storage) |
| UI | `frontend/src/App.jsx` (state hub) | React 19, react-router-dom v7, react-hot-toast |
| FE Services | `frontend/src/services/apiClient.js` | `apiFetch()` wraps fetch with auth/CSRF headers |

### Backend Structure
```
backend/
├── server.js              # Main entry (~120 lines)
├── database.js            # Supabase statements
├── sharePage.js           # OG meta for social sharing
├── config/
│   ├── index.js           # ENV vars (JWT_SECRET, PORT, EMAIL_*)
│   └── cors.js            # CORS options
├── middleware/
│   ├── auth.js            # authenticateToken, requireAdmin, tokenBlacklist
│   ├── csrf.js            # CSRF protection
│   ├── rateLimiter.js     # Rate limiting
│   └── upload.js          # Multer config
├── routes/
│   ├── auth.routes.js     # /api/auth/* (8 endpoints)
│   ├── products.routes.js # /api/products/* (6 endpoints)
│   ├── cart.routes.js     # /api/cart/* (5 endpoints)
│   ├── orders.routes.js   # /api/orders/* (12 endpoints)
│   ├── users.routes.js    # /api/users/* (3 endpoints)
│   ├── settings.routes.js # /api/settings/* (3 endpoints)
│   └── verification.routes.js # /api/verification/* (2 endpoints)
├── services/
│   ├── email.service.js   # sendOrderEmail, sendMailWithSettings
│   └── encryption.service.js # AES-256-GCM for settings
└── utils/
    └── orderNumber.js     # generateOrderNumber
```

## Quick Start
```bash
# Backend (port 5001)
npm install           # repo root for shared deps (nodemailer, etc.)
cd backend && npm install && npm run dev

# Frontend (port 5173)
cd frontend && npm install && npm run dev
```

**Required backend `.env`:**
- `JWT_SECRET` (mandatory—server exits if missing)
- `SUPABASE_URL`, `SUPABASE_KEY`
- `EMAIL_USER`, `EMAIL_PASS` (for verification/reset emails)

## Key Patterns

### Authentication & Authorization
- JWT via `Authorization: Bearer <token>` or `auth_token` cookie (24h expiry).
- Token blacklist on logout (in-memory with hourly cleanup).
- Middleware: `authenticateToken` in `middleware/auth.js`.
- Admin guard: `requireAdmin` middleware.
- Roles: `customer` | `admin`. Frontend checks `user.role === 'admin'` for UI gating.
- Rate limiting on `/api/auth/*` and `/api/verification/*` (15 min window, 10 requests).

### Frontend API Calls
Always use `apiFetch()` from `services/apiClient.js`—it auto-attaches Bearer token and CSRF token:
```javascript
import { apiFetch, apiUrl } from './services/apiClient';
const res = await apiFetch(apiUrl('/products'), { method: 'GET' });
```

### Cart Behavior (Hybrid)
- **Authenticated**: server-managed via `/api/cart` endpoints; synced in `App.jsx`.
- **Guest**: client-side React state; persisted to `localStorage` key `cart_persistence`.
- On login, guest cart merges to server (`syncLocalCart` in App.jsx).

### Config Switching (Important!)
Frontend uses environment variables via `.env` files:
```javascript
// frontend/src/config.js reads from import.meta.env
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
export const BASE_URL = import.meta.env.VITE_BASE_URL || 'http://localhost:5173';
```

## API Routes Summary
| Route | Auth | Notes |
|-------|------|-------|
| `POST /api/auth/register` | Public | Requires `code` from verification flow |
| `POST /api/auth/login` | Public | Returns `{ user, token }` |
| `POST /api/auth/logout` | Bearer | Blacklists token |
| `GET /api/products` | Public | Paginated: `{ data, total, page, limit, totalPages }` |
| `POST /api/products` | Admin | `multipart/form-data`, field `images[]` (≤10) |
| `GET/POST/PUT/DELETE /api/cart` | Bearer | Server-side cart for logged-in users |
| `POST /api/orders` | Bearer | Creates order, decrements stock |
| `POST /api/orders/guest` | Public | Requires email verification |
| `GET /api/orders/track/:id` | Public | Track by ID or `order_number` |

## Testing
```bash
cd frontend && npm run test:e2e   # Playwright against localhost:5173
```
- Specs in `frontend/playwright/` (auth, catalog, filters, admin_search).
- `playwright.config.js` baseURL is `http://localhost:5173/`.
- **Gotcha**: auth tests can trigger rate limits; space out runs or reset limits.

## Common Gotchas
1. **CORS**: Add new dev origins to `corsOptions.origin` array in `config/cors.js`.
2. **Dependencies**: Some deps live in repo-root `package.json`; if `backend/` module resolution fails, run `npm install` at root.
3. **Errors**: All API errors return `{ message: "..." }`—read `.message` on frontend.
4. **Images**: `product.image` may be full Supabase URL or legacy path; handle both.
5. **ESLint**: Unused vars cause errors unless prefixed with `_`.

## Adding Features Checklist
- [ ] New endpoint: create route file in `routes/`, register in `routes/index.js`, mount in `server.js`
- [ ] New frontend route: add to `<Routes>` in `App.jsx`, lazy-load component
- [ ] CORS issues: add origin to `config/cors.js` `corsOptions.origin` array
- [ ] New env var: add to `config/index.js` and document here

## Security Features Implemented

### Authentication & Token Security
- **JWT 24h expiry**: Tokens expire after 24 hours (reduced from 7 days)
- **Token blacklist**: Logout invalidates tokens immediately via in-memory blacklist
- **Hourly cleanup**: Expired tokens purged from blacklist every hour
- **Dual token delivery**: Supports both `Authorization: Bearer` header and `auth_token` cookie

### Authorization & Access Control
- **Admin-only routes**: Product CRUD, user management, settings require `requireAdmin` middleware
- **Role-based access**: `authenticateToken` + `requireAdmin` pattern for protected endpoints
- **Self-protection**: Admins cannot demote themselves or deactivate their own accounts

### CSRF Protection
- **Double Submit Cookie**: CSRF token in `XSRF-TOKEN` cookie + `X-CSRF-Token` header
- **State-changing protection**: All POST/PUT/DELETE requests validate CSRF
- **Auto-refresh**: CSRF cookie refreshed on `/api/auth/me` if missing

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

### Environment Security
- **Mandatory secrets**: Server refuses to start without `JWT_SECRET`
- **Environment variables**: All URLs/secrets in `.env` files (gitignored)
- **Frontend env vars**: Uses `VITE_*` prefix for client-safe config
