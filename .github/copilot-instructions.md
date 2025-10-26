## Agent Workflow
- Always tailor responses to the user prompt; do not introduce unsolicited work or commentary.
- Keep generated code minimal and straightforward; avoid over-engineering.
- When suggesting new features or non-trivial additions, ask for explicit confirmation before editing project files.
- Provide explanations only in chat responses; do not add commentary or guidance into repository files.

## Project Snapshot
- Monorepo with Express backend (`backend/server.js`) and Vite/React 19 frontend (`frontend/src/App.jsx`); no shared build tooling, so manage deps per folder.
- Backend persists to SQLite via `better-sqlite3`; DB file lives at `backend/data/app.db` and is auto-created with tables on boot (`backend/database.js`).
- Authentication is JWT-based with bcrypt hashing and simple role support (customer/admin); tokens use `Authorization: Bearer` and default secret `JWT_SECRET` if env not set.

## Backend API
- Start locally with `cd backend && npm install && npm run dev` (nodemon). Default port `5001`; CORS restricted to listed origins in `server.js` so add new dev URLs there.
- Routes under `/api`: `auth` (register/login/me/profile/logout), `products` (CRUD + optional `?category` filter), `cart` (CRUD per user) and `users` (admin only). All non-auth routes reading request body assume JSON except `/api/products` POST which requires `multipart/form-data` with `image` field handled by Multer to `backend/images`.
- Database writes use prepared statements in `backend/database.js`; when extending, prefer adding new statements there to keep transaction style consistent.
- Cart/order logic assumes numeric IDs and stock enforcement on the server; check `statements.getCartItem` and related helpers before altering quantities.

## Frontend UI
- Start UI with `cd frontend && npm install && npm run dev`; Vite serves on 5173 by default. Build with `npm run build`.
- `frontend/src/App.jsx` drives catalog, hero content, and modals. State managed via hooks; cart is local state persisted to `localStorage` per `cart_${userId}` key.
- Auth flows reside in `frontend/src/components/LoginPage.jsx` and `frontend/src/services/authService.js`; successful login/registration stores `authToken` and `userData` in localStorage.
- API endpoints come from `frontend/src/config.js` (`API_URL`, `BASE_URL`). Be mindful `authService.js` currently hardcodes the same base string; keep them in sync when changing URLs.

## Data & Auth Flow
- After login, components rely on `getCurrentUser()` and `isLoggedIn()` helpers; backend `authenticateToken` middleware expects the JWT, but most current UI cart mutations are local-only—coordinate plans before switching to server cart endpoints.
- Product images render via `BASE_URL + product.image`; ensure backend returns paths like `/images/<filename>`.
- Orders are scaffolded in DB but no frontend flow hits them yet; reserve IDs and schema per `orders`/`order_items` tables if you implement checkout persistence.

## Conventions & Gotchas
- Prefer ASCII assets; backend ensures `backend/images` exists on boot. Keep filenames unique—Multer saves original names and will overwrite on collisions.
- Error handling surfaces `res.status(...).json({ message })`; align frontend error UX with these keys when adding new endpoints.
- ESLint config (`frontend/eslint.config.js`) enforces React hooks rules and flags unused vars unless they start with capital or underscore.

## Common Tasks
- Seed data by inserting directly into SQLite (`backend/data/app.db`) or via API calls—JSON files in `backend/data/*.json` are legacy and not read.
- To reset state, stop backend, delete `backend/data/app.db`, and restart to recreate schema.
- When exposing new endpoints, remember to extend both CORS whitelist and any frontend fetch calls using the shared `API_URL` constant.
