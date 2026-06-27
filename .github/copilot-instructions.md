# Eonsclover — Contexto de Proyecto

> **Principio**: Contexto mínimo pero relevante. Sólo lo que un agente necesita saber. Sin reglas obvias, sin ruido.

---

## 🧭 Flujo de Trabajo

| Paso | Detalle |
|------|---------|
| **Dev local** | `http://eonsclover.local` — requiere `hosts` (ver abajo) |
| **Rama activa** | `feat/saas-multitenant` (estable: `main`) |
| **Despliegue** | `git push` → SSH → `git pull` → `docker compose up -d --build` |
| **Server staging** | `150.136.214.228` (Oracle Cloud ARM64) |

**Hosts requeridos**: `127.0.0.1 eonsclover.local app.eonsclover.local admin.eonsclover.local database.eonsclover.local`

---

## 1. Identidad
SaaS que permite crear tiendas online en minutos. Cada tienda = tenant PostgreSQL con esquema propio. Stack: Express + React + PostgreSQL + Docker Compose.

## 2. Arquitectura
```
Nginx (:80, default_server) → React SPA (frontend:80)
                              → Express API (backend:5001) → PostgreSQL (:5432)
                              → Adminer :8080 (database.eonsclover.com)
```
- **Multi-tenant**: Cada tienda = esquema `tenant_{slug}` propio. Datos de plataforma en esquema `public`.
- **Auth**: JWT Bearer + bcrypt + cookie CSRF.
- **Proxy**: `docker/nginx-proxy.conf` enruta por Host header (`default_server` para la app principal).
- **Base de datos**: pg raw con consultas parametrizadas (`$1`, `$2`).

## 3. Dominio del Negocio
| Entidad | Atributos clave |
|---------|----------------|
| **Tenant** | slug, name, plan (trial/basic/pro), schema_name, status |
| **Producto** | name, price, category, images[], stock, is_hidden, has_variants |
| **Orden** | items[], address, payment_method, status, total |
| **Config** | `app_settings` key-value por tenant — colores, tipografía, layout, landing, pagos |

## 4. Convenciones Técnicas
- **API**: Usar `apiFetch(apiUrl('/path'))` — auto-asigna auth + base URL. Backend usa pg raw.
- **React**: Hooks (`useState`/`useEffect`). Sin Redux. `useProducts` siempre trae TODOS los productos — cada página filtra localmente con `useMemo`.
- **CSS**: Sin framework. CSS Modules via Vite. PascalCase en JSX.
- **Estilo**: Evitar comentarios obvios. ES modules. JavaScript (sin TypeScript).

## 5. Mapa del Repositorio
```
backend/
  routes/           Endpoints REST por dominio (products, orders, settings, saas/)
  middleware/       auth, tenant.js, dbContext, upload, csrf, planLimits, rateLimiter
  services/         provisioner, email, backup.service, encryption, llm/
  database/         schema.sql, seed.sql, seed-demo-*.sql, themes/
frontend/src/
  components/admin/ SettingsManager, SiteCustomizer, LandingPageAdmin, DatabaseSection
  components/store/ Header, Home, Products, Cart, Checkout, OrderTracker, Footer
  components/saas/  OnboardingWizard, SaasLanding, SuperAdmin
  hooks/            useProducts (global), useSiteSettings, useCart, useAuth, useSeo
  config.js         IS_TENANT, IS_SUPER_ADMIN, SYSTEM_SLUGS, DEFAULT_CATEGORY_FILTERS_CONFIG
docker/             Dockerfiles, nginx-proxy.conf
```

## 6. Estado Actual (2026-06-26)
| Área | Estado |
|------|--------|
| Flujo tienda (productos → carrito → checkout → órdenes) | ✅ |
| Panel Super Admin | ✅ |
| Onboarding SaaS (registro → verificar → crear tienda) | ✅ |
| Multi-tenant con seeds demo por tema | ✅ |
| Filtros de categoría/búsqueda independientes por página | ✅ |
| Editor de settings con vista previa | ✅ |
| `default_server` en proxy para routing correcto de subdominios | ✅ |
| Backup UI (listar/descargar/restaurar) | ✅ |
| Paginación client-side en panel admin | ✅ |

## 7. Decisiones Arquitectónicas Clave
| Decisión | Por qué |
|----------|---------|
| Esquemas por tenant | Aislamiento total, backup/restore simple por tenant |
| `app_settings` key-value | Agregar settings sin migrar esquema |
| `SYSTEM_SLUGS` (app, admin, www, staging, database) | Bypass de resolución de tenant para subdominios de plataforma |
| `useProducts` trae TODOS los productos | Cada página (Home, Admin) filtra localmente con `useMemo` — evita contaminación de estado global |
| CSS variables para colores | Tema dinámico + vista previa en vivo |
| Docker Compose | Consistente entre local/staging/producción |

## 8. Conocimiento Especializado

**Resolución de tenant** → `config.js` (frontend), `middleware/tenant.js` (backend):
```
hostParts[0] → IS_TENANT si no está en SYSTEM_SLUGS
             → IS_SUPER_ADMIN si es 'admin'
```
Ambos lados comparten el mismo `SYSTEM_SLUGS`. Cualquier slug nuevo debe agregarse en ambos archivos.

**LandingPageAdmin vs SiteCustomizer**:
Ambos siguen: nav horizontal → controles laterales + vista previa. Prefijo `lp-` (landing) vs `sc-` (site). Landing edita JSON `landingPageConfig`; Site edita `app_settings` planas.

**Flujo de aprovisionamiento**:
1. Usuario ingresa nombre + slug (onboarding paso 3)
2. `provisionTenant()` → crea esquema → `schema.sql` → `seed.sql` → seed demo → aplicar tema → **pisar `siteName`** → crear admin
3. `seed.sql` hardcodea `siteName = 'Eonsclover'` — paso 3e del provisioner lo sobreescribe con el nombre real

**Auto-slug en categorías**:
SiteCustomizer → `setCatItem(idx, 'name', val)` → también ejecuta `slugify(val)` para actualizar el slug. Nuevas categorías reciben `slugify(name)` en vez de `cat-{timestamp}`.

## 9. Procedimientos Repetitivos
| Tarea | Pasos |
|-------|-------|
| **Agregar un setting** | 1) Default en SettingsManager, 2) `else if` en `buildTypedData`, 3) Componente field, 4) Incluir en payload de `handleSave` |
| **Agregar sección de landing** | 1) Default en `landingPageDefaults.js`, 2) Editor, 3) Registrar en `SECTION_EDITORS` + `SECTION_LABELS` + `SECTION_ICONS` |
| **Agregar feature al Super Admin** | 1) Componente en `pages/superadmin/`, 2) Agregar a `NAV_SYSTEM`, 3) Renderizar en `activeNav === 'id'`, 4) Conectar QuickActions |
| **Eliminar endpoint** | 1) Remover ruta, 2) Revisar `routes/index.js`, 3) Buscar callers en frontend, 4) Remover imports y componentes, 5) Remover entradas de navegación |
| **Agregar slug a SYSTEM_SLUGS** | 1) `frontend/src/config.js`, 2) `backend/middleware/tenant.js`, 3) Reiniciar backend |
| **Probar en local** | `docker compose up -d --build` en la raíz |

## 10. Actividad Reciente (2026-06-26)
- **Filtros aislados por página**: `useProducts` ahora trae TODOS los productos sin filtros. Cada página (Home, Admin) filtra localmente con `useMemo`. Se eliminó el workaround `onForceRefresh` en AdminDashboard.
- **Paginación client-side en admin**: ProductList del admin ahora pagina localmente (20 ítems por página). Contador muestra "X / Y productos" correctamente.
- **`default_server`** agregado al bloque main de nginx — evita que Adminer atrape `admin.eonsclover.com`.
- **`database` agregado a `SYSTEM_SLUGS`** tanto en frontend como backend para consistencia.
- **`siteName` en provisioner**: `seed.sql` pone `siteName = 'Eonsclover'`, paso 3e lo sobreescribe con el nombre real de la tienda.
