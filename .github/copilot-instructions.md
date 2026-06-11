# EonsClover — Store Builder SaaS

## 1. Identidad del Proyecto

**¿Qué es?** Plataforma SaaS multi-tenant que permite a pequeños negocios crear y gestionar su tienda online sin conocimientos técnicos.

**¿Para quién?** Emprendedores y pequeños negocios en República Dominicana y LATAM.

**Incluye:** catálogo de productos, gestión de órdenes, pagos (Stripe/PayPal/cash/transferencia), personalización visual, chatbot LLM, SEO, tracking de órdenes, facturación PDF.

**No incluye:** marketplace multi-vendedor, dropshipping, ERP, punto de venta físico.

**No negociable:** PostgreSQL (transacciones ACID y schemas por tenant), Express (estable, sin ORM), React 19 + Vite (SPA sin SSR).

## 2. Arquitectura

```
Navegador → Cloudflare (SSL) → Nginx (:443/:80)
  ├── /api/*      → backend:5001 (Express)
  ├── /storage/*  → backend:5001 (imágenes)
  ├── /p/*        → backend:5001 (OG meta para compartir)
  └── /*          → frontend:80 (Vite SPA)
```

**Flujo de datos:** React `apiFetch()` → Express route → service → PostgreSQL (pg Pool con `AsyncLocalStorage` para multi-tenant).

**Multi-tenant:** Cada tienda tiene su propio schema PostgreSQL (`tenant_{slug}`). El middleware `tenant.js` resuelve el tenant por subdominio (`mi-tienda.eonsclover.com`). Subdominios de sistema (`admin`, `app`, `database`, `www`) quedan excluidos.

**Modos de deployment:**
- **Docker Compose** (staging): PostgreSQL + backend + frontend + proxy Nginx + Adminer
- **PM2 + Nginx** (producción Oracle Cloud): proceso nativo, Ansible

## 3. Dominio del Negocio

```
Usuario (owner) → Tienda (tenant) → Productos → Órdenes → Pagos
```

**Reglas esenciales:**
- Una tienda pertenece a exactamente un owner (email único en `public.tenants`)
- Un producto requiere stock ≥ 0; el stock se decrementa atómicamente al crear orden (RPC `decrement_stock_if_available`)
- Una orden siempre transiciona por estados: `pending_payment → paid → to_ship → shipped → delivered`
- COD y pago online tienen flujos de estado distintos (COD empieza en `pending_payment`)
- El carrito es híbrido: server-side para usuarios autenticados, localStorage para guest
- Una tienda puede personalizar colores, tipografía, hero, categorías, landing page — todo desde `app_settings`

**Entidades clave:** `tenants`, `users`, `products`, `product_images`, `orders`, `order_items`, `cart`, `verification_codes`, `app_settings` (key-value), `token_blacklist`

## 4. Convenciones Técnicas

- **API calls:** siempre usar `apiFetch()` de `frontend/src/services/apiClient.js` — auto-adjunta JWT + CSRF
- **Nuevo endpoint:** crear archivo en `backend/routes/`, registrar en `routes/index.js`, montar en `server.js`
- **Nuevo componente React:** lazy-load en `AppRoutes.jsx`, hooks en `frontend/src/hooks/`, seguir patrón de `useProducts.js` (caché + stale-while-revalidate)
- **Nueva setting:** agregar key a `seed.sql` y a `frontend/src/utils/settingsHelpers.js`, leer con `useSiteSettings()`
- **Errores API:** todos devuelven `{ message: "..." }` — frontend lee `.message`
- **ESLint:** variables no usadas → error (prefijar con `_` para ignorar)
- **Código legacy:** al modificar, eliminar código obsoleto resultante
- **No hardcodear dominios:** usar `config.js` (frontend) y `config/index.js` (backend) + variables de entorno

## 5. Mapa del Repositorio

```
.
├── backend/
│   ├── server.js              # Express entry (~200 LOC)
│   ├── config/index.js         # ENV vars
│   ├── config/cors.js          # CORS dinámico
│   ├── database/
│   │   ├── postgres.js         # pg Pool + AsyncLocalStorage
│   │   ├── schema.sql          # 9 tablas + RPCs
│   │   ├── seed.sql            # Admin + ~90 settings
│   │   ├── seed-demo-*.sql     # Datos demo por tema
│   │   └── themes/             # applyTheme(): colores CSS por preset
│   ├── middleware/             # auth, csrf, rateLimiter, upload, tenant, dbContext, planLimits
│   ├── routes/                 # auth(9ep), products(8ep), cart(5ep), orders(12ep),
│   │   │                       # users, settings, verification, payments, chatbot,
│   │   │                       # seo, database, setup, storage, newsletter
│   │   └── saas/               # public, subscription, superadmin
│   └── services/               # email, encryption, backup, llm/, tenant/provisioner.js
├── frontend/src/
│   ├── App.jsx                 # State hub (auth, cart, products, settings)
│   ├── config.js               # SaaS context detection (IS_TENANT, IS_SUPER_ADMIN, etc.)
│   ├── components/             # admin/, auth/, cart/, chatbot/, common/, orders/, products/
│   ├── hooks/                  # useAuth, useCart, useProducts, useSiteSettings, useSeo
│   ├── pages/                  # Home, Contact, LandingPage, OrderTracker
│   │   ├── onboarding/         # OnboardingWizard.jsx (registro de tienda)
│   │   ├── superadmin/         # SuperAdmin.jsx, DatabaseSection.jsx
│   │   └── landing/            # Landing page pública del SaaS
│   ├── routes/AppRoutes.jsx    # Rutas lazy-load con guards SaaS
│   └── services/apiClient.js   # apiFetch() con JWT + CSRF
├── docker/                     # Dockerfiles + nginx configs
├── ansible/                    # Playbooks para deploy PM2 + Nginx
├── nginx/                      # Template Nginx parametrizado
├── scripts/install.sh          # Setup interactivo para Ubuntu
└── .github/workflows/          # CI (lint+build) + deploy + rollback
```

## 6. Estado Actual (Junio 2026)

**Rama activa:** `feat/saas-multitenant`

**Completado:**
- ✅ SaaS multi-tenant con schemas por tenant en PostgreSQL
- ✅ Onboarding: registro de tienda (4 pasos: email → verificación → nombre+dominio → tema)
- ✅ Super admin panel (`admin.eonsclover.com`): gestión de tenants, DB browser, Adminer
- ✅ Sistema de temas con 5 presets visuales + semillas demo
- ✅ Newsletter, footer configurable, SiteCustomizer
- ✅ Subdominios de sistema: `admin`, `app`, `database`, `www`

**🔄 En progreso (feature branch):**
- 🔄 SaaS subscriptions y límites de plan (middleware `planLimits.js` listo, UI parcial)
- 🔄 OAuth SSO (Google/Facebook) — backend listo, probando en staging
- 🔄 Landing page pública del SaaS (`app.eonsclover.com` → pricing/register)

**Servidores:**
| Entorno | IP | Rama | Modo |
|---------|-----|------|------|
| Producción | `143.47.118.165` | `main` | PM2 + Nginx |
| Staging | `150.136.214.228` | `feat/saas-multitenant` | Docker Compose |
| Test Docker | `129.213.145.236` | `main` | Docker Compose |

## 7. Decisiones Arquitectónicas

| Decisión | Razón |
|----------|-------|
| PostgreSQL (no MongoDB) | Schemas por tenant, transacciones ACID, RPC para stock atómico |
| Express sin ORM (no Prisma) | Schemas dinámicos por tenant; queries SQL directas con `pg` |
| Vite SPA (no Next.js SSR) | SEO vía backend (`/p/<slug>` con OG meta) + `useSeo()` hook |
| Multi-tenant vía schemas (no row-level) | Aislamiento total de datos, backups independientes |
| `app_settings` como key-value (no tabla relacional) | Flexibilidad para ~100 settings sin migraciones por cada nueva |
| `apiFetch()` como wrapper único | JWT + CSRF automático, single source of truth para headers |
| Cloudflare Full (Strict) SSL | Cifrado end-to-end sin costo de certificados |

## 8. Conocimiento Especializado

**SaaS context detection (`frontend/src/config.js`):**
- `IS_TENANT` = subdominio no es sistema, 3+ partes → rutas de tienda normal
- `IS_SUPER_ADMIN` = subdominio es `admin` → panel super admin
- `IS_LANDING` = dominio raíz o `www` → landing page pública
- `IS_ONBOARDING` = subdominio `app` → wizard de registro
- `SYSTEM_SLUGS = ['app', 'admin', 'www', 'staging', 'database']`

**Tenant provisioner (`backend/services/tenant/provisioner.js`):**
- Crea schema `tenant_{slug}`, ejecuta `schema.sql` + `seed.sql` + demo seed del tema
- **IMPORTANTE:** Después del seed, actualiza `app_settings.siteName` con el `businessName` del usuario (commit `12b21cb`)
- Aplica tema con `applyTheme()` del directorio `database/themes/`
- Crea admin user (sobrescribe el default de seed.sql) y registra en `public.tenants`

**Sistema de plantillas visuales:** Cada widget (hero, categorías, cards, footer) tiene `id`, `type`, `settings`. La UI nunca modifica HTML directamente — todo es config-driven desde `app_settings` como JSON.

## 9. Procedimientos Repetitivos

**Agregar endpoint:**
1. Crear archivo en `backend/routes/nuevo.routes.js`
2. Exportar en `backend/routes/index.js`
3. Montar en `backend/server.js` con `app.use('/api/nuevo', nuevoRoutes)`
4. Si es SaaS-aware, ejecutar después del middleware de tenant

**Agregar feature frontend:**
1. Crear componente en `frontend/src/components/feature/`
2. Si es página nueva, agregar ruta lazy en `AppRoutes.jsx`
3. Si necesita datos del backend, usar `apiFetch(apiUrl('/...'))`
4. Si guarda estado, crear hook en `frontend/src/hooks/`

**Eliminar endpoint o feature limpiamente:**
1. Buscar todas las referencias con `grep` / `vscode_listCodeUsages` (imports, rutas, hooks)
2. Eliminar archivo de ruta + su export en `routes/index.js` + su `app.use()` en `server.js`
3. Si tenía seed data, limpiar `seed.sql` o `seed-demo-*.sql`
4. Si el frontend consumía ese endpoint, eliminar el `apiFetch()` huérfano
5. Correr ESLint y tests para detectar imports rotos

**Deploy a staging:**
```bash
git push origin feat/saas-multitenant
ssh -i techstore_staging.key ubuntu@150.136.214.228 \
  'cd /home/ubuntu/TechStore && git pull && docker restart eonsclover-backend'
```

## 10. Historial Vivo

**Últimos fixes (11 Jun 2026):**
- `12b21cb` — **fix:** El nombre de tienda del onboarding ahora se guarda en `app_settings.siteName` (antes quedaba hardcodeado 'Eonsclover')
- `7534f05` — **fix:** `admin.eonsclover.com` mostraba Adminer en vez del panel super admin (Nginx `server_name _` no matcheaba)
- `ee7fa64` — **feat:** Adminer accesible vía `database.eonsclover.com` + server block en Nginx

**Deuda técnica conocida:**
- El `DeliveryMap.jsx` tiene coordenadas del warehouse hardcodeadas a Santo Domingo
- No hay tests para el flujo de onboarding SaaS
- `planLimits.js` middleware existe pero no se aplica en todas las rutas
- La UI de suscripciones (`SubscriptionPanel.jsx`) está parcialmente implementada

**Próximos pasos previstos:**
- Completar integración de suscripciones y límites de plan
- Migrar `feat/saas-multitenant` → `main` cuando esté estable
- Agregar tests E2E para el flujo de registro de tienda
