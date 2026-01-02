## Agent Workflow
- Always tailor responses to the user prompt; do not introduce unsolicited work or commentary.
- Keep generated code minimal and straightforward; avoid over-engineering.
- When suggesting new features or non-trivial additions, ask for explicit confirmation before editing project files.
- Provide explanations only in chat responses; do not add commentary or guidance into repository files.

## Project Snapshot
- Monorepo with Express backend (`backend/server.js`) and Vite/React 19 frontend (`frontend/src/App.jsx`).
- Backend uses Supabase (Postgres + Storage) via `@supabase/supabase-js` (`backend/database.js`).
- Authentication is JWT-based with bcrypt hashing and simple role support (customer/admin). Tokens use `Authorization: Bearer <token>`.
- IMPORTANT: `JWT_SECRET` is required; the server exits if missing.

## Backend API
- Start locally:
	- Install deps: `npm install` (repo root) + `cd backend && npm install`
	- Run: `cd backend && npm run dev`
	- Default port: `5001` (configurable via `PORT`)
- Required env vars (in backend `.env`):
	- `JWT_SECRET` (required; server refuses to start without it)
	- `SUPABASE_URL`, `SUPABASE_KEY` (required for DB/Storage)
	- Email (for verification/reset flows): `EMAIL_USER`, `EMAIL_PASS` (used by Nodemailer transporter in `backend/server.js`)
- CORS is allowlist-based in `backend/server.js`. If a new dev URL fails with CORS, add it to the allowed `origin` list.

### Main routes (high level)
- Auth
	- `POST /api/auth/register` requires `code` (verification code) and enforces password complexity.
	- `POST /api/auth/login`
	- `GET /api/auth/me` (Bearer token)
	- `PUT /api/auth/profile` (Bearer token)
	- `POST /api/auth/forgot-password`, `POST /api/auth/reset-password` (verification code flow)
- Verification (email codes)
	- `POST /api/verification/send-code` (purpose varies: `register`, `password_reset`, `guest_checkout`, etc.)
	- `POST /api/verification/verify-code`
- Products
	- `GET /api/products` returns a paginated object: `{ data, total, page, limit, totalPages }` and supports `?category`, `?page`, `?limit`, `?search`.
	- `POST /api/products` uses `multipart/form-data` with field `images` (array, up to 10). Images are uploaded to Supabase Storage and recorded in `product_images`.
	- `POST /api/products/:id/images` and `DELETE /api/products/:id/images/:imageId` manage product gallery images.
- Cart (server-side for authenticated users)
	- Protected with Bearer token: `GET /api/cart`, `POST /api/cart`, `PUT /api/cart/:productId`, `DELETE /api/cart/:productId`, `DELETE /api/cart`.
	- Stock checks are enforced on the server.
- Orders
	- `POST /api/orders` (authenticated) and `POST /api/orders/guest` (public) create orders and update product stock.
	- Admin routes: `GET /api/orders` (paginated with filters), `PUT /api/orders/:id`, `PUT /api/orders/:id/status`, `DELETE /api/orders/:id`.
	- Public tracking: `GET /api/orders/track/:id` (ID or order_number) and `GET /api/orders/track/email/:email`.
- Users (admin)
	- `GET /api/users` (paginated/search)
	- `PUT /api/users/:id/role`, `PUT /api/users/:id/status`

### Images
- Product images are now typically full public URLs (Supabase Storage). Frontend should treat `product.image` as a URL when it starts with `http`.

## Frontend UI
- Start UI with `cd frontend && npm install && npm run dev`; Vite serves on 5173 by default.
- The API base is configured in `frontend/src/config.js` via `API_URL` and `BASE_URL`.
	- NOTE: `config.js` currently contains hardcoded LAN/IP values (and commented alternatives). For local dev + Playwright, you may need to switch to `http://localhost:5001`.
- Auth flows live in `frontend/src/components/LoginPage.jsx` + `frontend/src/services/authService.js`.
	- On success, the UI stores `authToken` and `userData` in `localStorage`.
- Cart behavior is hybrid:
	- Logged-in user: cart is synced/managed via backend `/api/cart` (see `frontend/src/App.jsx`).
	- Guest user: cart is held client-side in React state (and guest checkout requires email verification).
- Checkout (`frontend/src/components/Checkout.jsx`) creates orders via:
	- Authenticated: `POST /api/orders` (Bearer token)
	- Guest: `POST /api/orders/guest` (requires email verification via `/api/verification/*`)

## Data & Auth Flow
- Backend expects `Authorization: Bearer <token>` for protected routes (cart, profile, admin routes).
- Products can contain `images` (gallery) and a primary `image` field. Images may be full URLs (Supabase) or legacy paths.

## Conventions & Gotchas
- Dependencies are not fully centralized:
	- There is a repo-root `package.json` with shared deps (e.g. `nodemailer`). Backend code may rely on parent `node_modules` resolution.
	- If `cd backend && npm install` alone causes runtime missing-module errors, run `npm install` at repo root too (or move the dependency into `backend/package.json`).
- Server-side security:
	- Auth endpoints have rate limiting (`express-rate-limit`). Automated tests or repeated login attempts may hit limits.
- Error handling uses JSON `{ message }` consistently; frontend should read that key.
- ESLint config (`frontend/eslint.config.js`) enforces React hooks rules; avoid unused vars unless prefixed with `_`.

## Common Tasks
- Run end-to-end tests (frontend): `cd frontend && npm run test:e2e`
	- Playwright specs are in `frontend/playwright/`.
	- The Playwright baseURL is `http://localhost:5173/` (see `frontend/playwright.config.js`), so ensure frontend is running and `frontend/src/config.js` points to a reachable backend.
- When adding new endpoints:
	- Update CORS allowlist in `backend/server.js`.
	- Keep frontend fetch URLs consistent via `API_URL`.
