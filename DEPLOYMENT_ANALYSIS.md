# Análisis de Deployment Automatizado — mi-tienda-online

> Análisis completo para montar instancias del e-commerce en servidores de clientes/empresas
> de forma automatizada, reproducible y con capacidad de actualizaciones remotas.
>
> **Última actualización:** 2026-02-12

---

## 0. INFRAESTRUCTURA VERIFICADA (Febrero 2026)

> Datos confirmados desde el servidor de producción vía SSH + Cloudflare + GitHub.
> NO son suposiciones — cada ítem fue verificado.

### Servidor

| Campo | Valor verificado |
|---|---|
| **Proveedor** | Oracle Cloud (instancia ARM aarch64) |
| **OS** | Ubuntu 22.04.5 LTS |
| **IP pública** | `143.47.118.165` |
| **IP interna** | `10.0.0.22` |
| **Hostname** | `instance-20251023-1348` |
| **Usuario SSH** | `ubuntu` |
| **App path** | `/home/ubuntu/TechStore/` |
| **CPU** | ARM64 (~2 cores, load 0.05) |
| **RAM** | ~24 GB (12% usage) |
| **Disco** | 48.28 GB (16.5% usage) |
| **Node.js** | v20.x |

### DNS & SSL

| Campo | Valor verificado |
|---|---|
| **Dominio producción** | `eonsclover.com` |
| **DNS provider** | Cloudflare |
| **DNS mode** | Proxy (nube naranja — tráfico pasa por Cloudflare) |
| **Cloudflare SSL mode** | ✅ **Full (Strict)** — Origin Certificate instalado en Nginx :443 |
| **Certbot** | ❌ No instalado (no necesario — Cloudflare Origin Cert en su lugar) |
| **Registro A** | `eonsclover.com` → `143.47.118.165` (proxied por Cloudflare) |
| **nslookup eonsclover.com** | Resuelve a IPs de Cloudflare (`104.21.20.36`, `172.67.191.76`) |
| **demotechstore.duckdns.org** | ✅ Desactivado — dominio eliminado de DuckDNS |

### Nginx en producción

```nginx
# /etc/nginx/sites-enabled/tienda — config REAL en el servidor
server {
    listen 80;
    server_name eonsclover.com www.eonsclover.com;
    return 301 https://$host$request_uri;
}
server {
    listen 443 ssl http2;
    server_name eonsclover.com www.eonsclover.com;
    ssl_certificate     /etc/ssl/cloudflare/eonsclover.com.pem;
    ssl_certificate_key /etc/ssl/cloudflare/eonsclover.com.key;
    # Security headers + gzip + proxy locations for /, /api/, /p/
}
# ✅ SSL end-to-end (Cloudflare Full Strict + Origin Certificate)
# ✅ Security headers (X-Content-Type-Options, X-Frame-Options, Referrer-Policy)
# ✅ Gzip compression activo
```

### PM2 en producción

| Proceso | ID | Estado | Restarts | RAM |
|---|---|---|---|---|
| backend | 5 | online | 175 ⚠️ | 121.4 MB |
| frontend | 1 | online | 59 | 50.3 MB |

> ✅ 175 restarts son reloads legítimos de CI/CD (~1.6/día desde Oct 2023). No hay crashes ni memory leaks.

### Variables de entorno en servidor

| Archivo | Estado |
|---|---|
| `backend/.env` | ✅ Tiene `PORT`, `SUPABASE_URL`, `CORS_ORIGIN`, `FRONTEND_URL`, `BASE_URL` |
| `frontend/.env.production` | ❌ No existe (no necesario — frontend usa `/api` relativo en prod) |
| `frontend/.env` | ❌ No existe (no necesario — `config.js` usa rutas relativas + `window.location.origin`) |

### GitHub Secrets

| Secreto | Existe |
|---|---|
| `SSH_PRIVATE_KEY` | ✅ |
| `SERVER_USER` | ✅ |
| `APP_PATH` | ✅ |
| `VITE_API_URL` | ✅ Inyectado al build en `deploy.yml` |
| `VITE_BASE_URL` | ✅ Inyectado al build en `deploy.yml` |

### CI/CD

| Workflow | Trigger | Qué hace |
|---|---|---|
| `ci.yml` | PR/push a main/develop | Lint + build (Node 20) |
| `deploy.yml` | Push a main + manual | SSH → git reset --hard → npm ci → build → pm2 reload |
| `rollback.yml` | Manual dispatch | SSH → git reset a SHA especificado |

> ⚠️ `deploy.yml` hardcodea `SERVER_IP`, `SERVER_USER`, `APP_PATH`.
> `rollback.yml` usa `secrets.SERVER_USER` y `secrets.APP_PATH` — **inconsistencia**.

### Contradicciones resueltas

| # | Contradicción | Realidad verificada |
|---|---|---|
| C1 | `DEPLOYMENT.md` documentaba DuckDNS + Certbot | ✅ **Reescrito** — documenta Cloudflare Full (Strict) + Origin Cert |
| C2 | `DEPLOYMENT.md` usa dominio `demotechstore.duckdns.org` | **Dominio real: `eonsclover.com`** |
| C3 | `ecosystem.config.cjs` deploy user = `deploy` | **User real: `ubuntu`** |
| C4 | `DEPLOYMENT.md` app path = `/var/www/demotechstore` | **Path real: `/home/ubuntu/TechStore`** (el otro no existe) |
| C5 | `deploy.yml` hardcodea vs `rollback.yml` usa secrets | **Ambos funcionan, pero podrían divergir** |

### ⚠️ Issues detectados

1. ~~DEPLOYMENT.md desactualizado~~ — ✅ Reescrito con datos verificados
2. ~~deploy.yml no pasa VITE_ env vars~~ — ✅ Secrets inyectados al build
3. ~~Backend .env sin CORS_ORIGIN~~ — ✅ Añadido CORS_ORIGIN, FRONTEND_URL, BASE_URL
4. ~~175 restarts del backend~~ — ✅ Diagnosticado: reloads legítimos de CI/CD
5. ~~Cloudflare SSL Flexible~~ — ✅ Migrado a Full (Strict) con Origin Certificate
6. ~~config.js hardcodea eonsclover.com~~ — ✅ Usa `/api` relativo + `window.location.origin`
7. ~~DuckDNS sigue activo~~ — ✅ Desactivado/eliminado de DuckDNS
8. ~~deploy.yml / rollback.yml inconsistencia~~ — ✅ Unificados (secrets + VITE_ vars en rollback)

---

## 1. ESTADO ACTUAL DEL PROYECTO

### Lo que YA existe ✅

| Componente | Estado | Archivo(s) |
|---|---|---|
| PM2 ecosystem config | ✅ Funcional | `ecosystem.config.cjs` |
| Guía manual de deploy | ✅ Completa | `DEPLOYMENT.md` |
| Scripts npm monorepo | ✅ Básicos | `package.json` (root) |
| Config centralizada backend | ✅ Via env vars | `backend/config/index.js` |
| Config centralizada frontend | ✅ Via VITE env | `frontend/src/config.js` |
| `.env.example` backend | ✅ Completo | `backend/.env.example` (filosofía admin-panel-first) |
| `.env.example` frontend | ✅ Completo | `frontend/.env.example` |
| Health check endpoint | ✅ Funcional | `backend/server.js` → `GET /api/health` (status, version, uptime, DB state) |
| CI pipeline (lint + build) | ✅ Funcional | `.github/workflows/ci.yml` |
| CD auto-deploy (push to main) | ✅ Funcional | `.github/workflows/deploy.yml` (SSH → git pull → build → PM2 reload) |
| Rollback workflow | ✅ Funcional | `.github/workflows/rollback.yml` (manual dispatch, revierte por SHA) |
| Pagos (Stripe + PayPal) | ✅ Funcional | `backend/routes/payments.routes.js` |
| Chatbot / LLM | ✅ Funcional | `backend/routes/chatbot.routes.js`, `backend/services/llm/` (adapter pattern multi-provider) |
| Nginx config template | ✅ Parametrizado | `nginx/tienda.conf.template` (4 variables, Cloudflare + Certbot) |
| SQL de migración | ⚠️ Parcial | `backend/_archive/supabase_migration.sql` |
| CORS dinámico | ✅ Funcional | `backend/config/cors.js` — env var + Admin Panel `siteDomain` + localhost |

### Lo que FALTA ❌

| Componente | Prioridad | Impacto |
|---|---|---|
| **SQL completo de schema inicial** | 🔴 Crítica | Solo hay migraciones parciales, no schema base reproducible |
| **Seed data / admin inicial** | 🔴 Crítica | No hay forma automatizada de crear el primer admin |
| Script de instalación automatizada | 🟡 Alta | Hoy todo es manual vía SSH |
| Dockerfile / docker-compose | 🟠 Media | Portabilidad entre servidores |
| Validación de requisitos previos | 🟠 Media | No valida Node version, puertos, etc. |
| Backup / restore scripts | 🟠 Media | No hay estrategia de backups |
| Logs centralizados | 🟠 Media | Solo PM2 logs locales |
| CHANGELOG.md | 🟠 Media | Sin historial de versiones público |
| Monitoreo / alertas | 🔵 Baja | Nice-to-have para producción |
| Tests en CI pipeline | 🔵 Baja | Los tests existen pero no corren en CI |

---

## 2. ARQUITECTURA DE DEPENDENCIAS EXTERNAS

```
┌──────────────────────────────────────────┐
│           SERVIDOR DEL CLIENTE           │
│                                          │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐   │
│  │ Nginx   │  │ Node.js │  │ PM2     │   │
│  │ (proxy) │→ │ Backend │  │ (daemon)│   │
│  │         │→ │ Frontend│  │         │   │
│  └─────────┘  └─────────┘  └─────────┘   │
└────────────────────┬─────────────────────┘
                     │ HTTPS (Cloudflare proxy)
                     ▼
     ┌───────────────────────────────┐
     │    SERVICIOS EXTERNOS         │
     │                               │
     │  • Supabase (DB + Storage)    │
     │  • Stripe (pagos tarjeta)     │
     │  • PayPal (pagos PayPal)      │
     │  • Gmail SMTP / SMTP custom   │
     │  • Cloudflare (DNS + SSL)     │
     │  • LLM Provider (chatbot)     │
     │    (Groq / OpenAI / Google /  │
     │     OpenRouter — configurable │
     │     desde Admin Panel)        │
     │                               │
     └───────────────────────────────┘
```

```
┌────────────────────────────────────────────┐
│        GITHUB (CI/CD AUTOMATIZADO)         │
│                                            │
│  push to main → ci.yml (lint + build)      │
│               → deploy.yml (SSH → server)  │
│  manual       → rollback.yml (revert SHA)  │
└────────────────────────────────────────────┘
```

**Impacto**: La DB no es local — cada instancia de cliente necesita su PROPIO proyecto Supabase
(o Postgres autoalojado). Esto es clave para la estrategia multi-tenant.

---

## 3. LISTA COMPLETA DE NECESIDADES

### 3.1 Archivos de configuración — estado actual

#### A) `.env.example` para backend — ✅ COMPLETADO
Archivo: `backend/.env.example` (97 líneas). Documenta filosofía "admin-panel-first":
solo `JWT_SECRET` es obligatorio para arrancar, `SUPABASE_URL` + `SUPABASE_KEY` activan la app,
todo lo demás se configura desde el Admin Panel UI.

#### B) `.env.example` para frontend — ✅ COMPLETADO
Archivo: `frontend/.env.example` (31 líneas). Solo 2 variables: `VITE_API_URL` + `VITE_BASE_URL`.

#### C) Schema SQL completo inicial — ❌ PENDIENTE
Se necesita `database/schema.sql` con:
- Tabla `users` (con campo admin)
- Tabla `products` + `product_images`
- Tabla `orders` + `order_items`
- Tabla `cart_items`
- Tabla `app_settings` con seed data
- Tabla `verification_codes`
- Tabla `token_blacklist`
- Funciones `decrement_stock_if_available`, `increment_stock`, `cleanup_expired_blacklist_tokens`
- Storage bucket `products`
- Row Level Security policies
- **INSERT del primer usuario admin**
- Settings seed data para chatbot, pagos, email, etc.

#### D) Health check endpoint — ✅ COMPLETADO
```
GET /api/health → { status: "ok"|"setup", version, uptime, database, message }
```
Devuelve 200 si DB conectada, 503 si en modo setup. Implementado en `backend/server.js`.

#### E) CORS dinámico — ✅ COMPLETADO
Orígenes se construyen dinámicamente desde 3 fuentes (sin dominios hardcodeados):
1. **`CORS_ORIGIN` env var** — soporta múltiples dominios separados por coma, auto-expande http/https/www
2. **`FRONTEND_URL` env var** — si está configurada
3. **`siteDomain` desde Admin Panel** — Ajustes → E-commerce → Dominio del Sitio
   - Se carga de la DB al arrancar el servidor
   - Se actualiza en caliente al guardar desde el panel (sin reinicio)
4. **Localhost** siempre permitido como fallback

Archivos modificados: `backend/config/cors.js`, `backend/server.js`, `backend/routes/settings.routes.js`.

---

### 3.2 Scripts de automatización — estado actual

| Script | Propósito | Estado |
|---|---|---|
| `scripts/install.sh` | Instalar todo en servidor limpio | ❌ Pendiente |
| `scripts/configure.sh` | Wizard interactivo para generar `.env` files | ❌ Pendiente |
| `scripts/setup-database.sh` | Ejecutar schema SQL en Supabase | ❌ Pendiente |
| `scripts/setup-nginx.sh` | Generar y activar config de Nginx | ❌ Pendiente |
| `scripts/setup-ssl.sh` | SSL automático | ⚠️ Reemplazado por Cloudflare proxy |
| `scripts/update.sh` | Pull + install deps + build + restart PM2 | ✅ Reemplazado por `.github/workflows/deploy.yml` |
| `scripts/backup.sh` | Export data de Supabase | ❌ Pendiente |
| `scripts/health-check.sh` | Verificar que todos los servicios están corriendo | ❌ Pendiente (endpoint `/api/health` ya existe) |
| `scripts/rollback.sh` | Revertir a versión anterior | ✅ Reemplazado por `.github/workflows/rollback.yml` |

---

## 4. ESTRATEGIAS DE DEPLOYMENT — PROS Y CONTRAS

### Opción A: Script Bash Directo (Actual mejorado)

```
Cliente tiene: VPS/Cloud con Ubuntu
Tú ejecutas: ssh + script de instalación
```

**Cómo funciona:**
1. SSH al servidor del cliente
2. Ejecutar `curl -sSL https://tu-repo/install.sh | bash`
3. Script instala todo: Node 20, Nginx, PM2, Certbot
4. Wizard pide: dominio, Supabase URL, JWT secret, etc.
5. Genera `.env` files, configura Nginx, obtiene SSL
6. Clona repo, instala deps, build, arranca PM2

**Actualizaciones:** SSH → `cd /app && git pull && ./scripts/update.sh`

| Pros | Contras |
|---|---|
| ✅ Simple, sin overhead extra | ❌ Requiere acceso SSH directo |
| ✅ Mínimos requisitos (solo Ubuntu) | ❌ No reproducible exactamente igual |
| ✅ Fácil de debuggear (todo es visible) | ❌ Diferencias entre servidores (versiones OS) |
| ✅ Rápido de implementar ahora | ❌ Actualizaciones requieren SSH manual |
| ✅ Sin costos adicionales | ❌ Rollback manual |
| ✅ Bajo consumo de recursos | ❌ No escala a muchos clientes fácilmente |

**Ideal para:** 1-10 clientes, equipos técnicos que manejan SSH.

---

### Opción B: Docker + Docker Compose

```
Cliente tiene: Cualquier servidor con Docker
Tú envías: docker-compose.yml + .env
```

**Cómo funcionaría:**
```yaml
# docker-compose.yml
services:
  backend:
    build: ./backend
    ports: ["5001:5001"]
    env_file: ./backend/.env
    restart: always
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5001/api/health"]
      interval: 30s

  frontend:
    build: ./frontend
    ports: ["3000:80"]  # Nginx interno sirve el build estático
    restart: always

  nginx:
    image: nginx:alpine
    ports: ["80:80", "443:443"]
    volumes:
      - ./nginx/templates:/etc/nginx/templates
      - ./certbot/conf:/etc/letsencrypt
    depends_on: [backend, frontend]
```

**Actualizaciones:** `docker compose pull && docker compose up -d`

| Pros | Contras |
|---|---|
| ✅ 100% reproducible en cualquier máquina | ❌ Requiere Docker instalado (+overhead RAM) |
| ✅ Aislamiento total (no contamina el host) | ❌ Más complejo de configurar inicialmente |
| ✅ Rollback instantáneo (cambiar imagen tag) | ❌ Debugging más difícil (logs dentro de containers) |
| ✅ Funciona igual en Linux, Mac, Windows | ❌ ~200-500MB extra de RAM vs bare metal |
| ✅ Actualizaciones atómicas | ❌ SSL/Certbot en Docker es más complicado |
| ✅ Escala bien a muchos clientes | ❌ Necesitas registry para distribuir imágenes |

**Ideal para:** 5-50 clientes, cuando quieres garantía de reproducibilidad.

---

### Opción C: Ansible Playbooks (Infraestructura como Código)

```
Tú tienes: Ansible en tu máquina
Cliente tiene: SSH a su servidor
Tú ejecutas: ansible-playbook deploy.yml -i cliente-inventory.yml
```

**Cómo funcionaría:**
```yaml
# deploy.yml
- hosts: ecommerce_servers
  roles:
    - nodejs
    - nginx
    - pm2
    - certbot
    - app_deploy
  vars:
    domain: "{{ client_domain }}"
    supabase_url: "{{ vault_supabase_url }}"
```

| Pros | Contras |
|---|---|
| ✅ Automatización completa desde tu PC | ❌ Curva de aprendizaje de Ansible |
| ✅ Idempotente (ejecutar 10 veces = mismo resultado) | ❌ Solo Linux/Mac para el controlador |
| ✅ Inventario de TODOS los clientes en un archivo | ❌ Overhead inicial significativo |
| ✅ Actualizaciones masivas (todos los clientes a la vez) | ❌ Requiere acceso SSH a todos los servidores |
| ✅ Secrets encriptados con Ansible Vault | ❌ Un error en playbook afecta a todos |
| ✅ Documentación viviente (el playbook ES la documentación) | ❌ Más archivos y estructura a mantener |

**Ideal para:** 10-100+ clientes, cuando necesitas gestión centralizada.

---

### Opción D: Platform as a Service (Railway / Render / Fly.io)

```
Cliente no necesita servidor propio
Tú despliegas a la plataforma cloud
```

**Cómo funcionaría:**
- Conectar repo a Railway/Render
- Configurar env vars en el dashboard
- Push to main → auto-deploy

| Pros | Contras |
|---|---|
| ✅ Cero administración de servidores | ❌ Costo mensual por instancia ($5-20/mes) |
| ✅ SSL automático | ❌ Menos control sobre la infraestructura |
| ✅ CI/CD incluido (push = deploy) | ❌ Vendor lock-in |
| ✅ Escalado automático | ❌ Cold starts en planes gratuitos |
| ✅ Monitoreo incluido | ❌ No funciona si cliente quiere todo on-premise |
| ✅ Actualizaciones = git push | ❌ Latencia variable según región |

**Ideal para:** Clientes que no quieren manejar servidores, rápido time-to-market.

---

### Opción E: Híbrido — CLI de Instalación Propio

```
Cliente ejecuta: npx mi-tienda-setup
Wizard interactivo configura todo
```

**Cómo funcionaría:**
Crear un paquete npm `mi-tienda-cli` que:
1. Detecta el OS y requisitos
2. Instala dependencias del sistema (Node, Nginx, PM2)
3. Clona el repo
4. Wizard interactivo: dominio, Supabase credentials, email, etc.
5. Genera `.env`, configura Nginx, obtiene SSL
6. Arranca la aplicación
7. Comando `mi-tienda update` para actualizaciones

| Pros | Contras |
|---|---|
| ✅ UX profesional (wizard paso a paso) | ❌ Desarrollo inicial significativo |
| ✅ Cualquier persona puede instalar | ❌ Mantener el CLI es otro proyecto |
| ✅ Validación automática de inputs | ❌ Difícil soportar todos los OS |
| ✅ Marca propia / producto empaquetado | ❌ Edge cases con diferentes configuraciones |
| ✅ `mi-tienda update` para actualizar | ❌ Testing del CLI en múltiples entornos |
| ✅ `mi-tienda health` para diagnóstico | ❌ Más código que mantener |

**Ideal para:** Producto SaaS white-label, escala de 50+ clientes.

---

## 5. RECOMENDACIÓN — PLAN DE IMPLEMENTACIÓN POR FASES

### Fase 1 — Fundación (1-2 días) 🔴 CRÍTICA

Todo lo necesario para que CUALQUIER deployment funcione:

- [x] **1.1** ~~Crear `backend/.env.example`~~ — ✅ Completado (97 líneas, filosofía admin-panel-first)
- [x] **1.2** ~~Crear `frontend/.env.example`~~ — ✅ Completado (31 líneas)
- [ ] **1.3** Crear `database/schema.sql` — schema completo con seed data y admin inicial ← **PRÓXIMO PASO**
- [x] **1.4** ~~Hacer CORS dinámico~~ — ✅ Completado (env var + Admin Panel `siteDomain` + auto-expand dominios)
- [x] **1.5** ~~Agregar endpoint `GET /api/health`~~ — ✅ Completado (status, version, uptime, DB state)
- [x] **1.6** ~~Crear `nginx/tienda.conf.template`~~ — ✅ Completado (parametrizado con {{DOMAIN}}, Cloudflare + Certbot)
- [ ] **1.7** Eliminar hardcoded `eonsclover.com` de `config.js` — ⚠️ `config.js` lee de `import.meta.env` PERO el fallback sigue siendo `eonsclover.com`. En producción NO hay `.env` con VITE vars, así que SIEMPRE usa el fallback. `deploy.yml` tampoco pasa env vars al build.

**Progreso Fase 1: 5/7 completados (71%)** — Pendientes: schema.sql (1.3) + eliminar hardcoded domain (1.7)

### Fase 2 — Automatización Básica (2-3 días) 🟡 ALTA

Scripts que reducen deploy de 2 horas a 15 minutos:

- [ ] **2.1** `scripts/install.sh` — instalación completa en Ubuntu limpio
- [ ] **2.2** `scripts/configure.sh` — wizard interactivo `.env` generator
- [ ] **2.3** `scripts/setup-nginx.sh` — genera nginx config con dominio del cliente
- [ ] **2.4** ~~`scripts/setup-ssl.sh`~~ — ⚠️ Ya no necesario (Cloudflare proxy maneja SSL)
- [x] **2.5** ~~`scripts/update.sh`~~ — ✅ Reemplazado por `.github/workflows/deploy.yml`
- [ ] **2.6** `scripts/health-check.sh` — verificación post-deploy

**Progreso Fase 2: 1/6 completados (17%)**

### Fase 3 — Docker (3-4 días) 🟠 MEDIA

Para clientes que prefieren containers:

- [ ] **3.1** `backend/Dockerfile`
- [ ] **3.2** `frontend/Dockerfile` (multi-stage: build + nginx)
- [ ] **3.3** `docker-compose.yml` (backend + frontend + nginx)
- [ ] **3.4** `docker-compose.prod.yml` (override con volúmenes persistentes)
- [ ] **3.5** `.dockerignore` files
- [ ] **3.6** Documentación Docker en README

### Fase 4 — Actualizaciones Remotas (2-3 días) 🟠 MEDIA

Sistema para enviar updates a clientes:

- [x] **4.1** ~~CI/CD auto-deploy~~ — ✅ `.github/workflows/deploy.yml` (push to main → deploy)
- [x] **4.2** ~~Rollback automatizado~~ — ✅ `.github/workflows/rollback.yml` (workflow_dispatch)
- [ ] **4.3** Versionado semántico (`CHANGELOG.md` + tags de release)
- [ ] **4.4** Panel de control simple: lista de instancias + status + versión
- [ ] **4.5** Webhook endpoint para trigger updates desde panel central

**Progreso Fase 4: 2/5 completados (40%)**

### Fase 5 — Gestión Multi-Cliente (4-5 días) 🔵 OPCIONAL

Para escalar a muchos clientes:

- [ ] **5.1** Archivo de inventario de clientes (YAML/JSON)
- [ ] **5.2** Script de deploy masivo (SSH a N servidores)
- [ ] **5.3** Dashboard de monitoreo (health checks de todas las instancias)
- [ ] **5.4** Ansible playbooks (alternativa a scripts bash)
- [ ] **5.5** Tests en CI pipeline (añadir a `ci.yml`)

---

## 6. COMPARATIVA RÁPIDA POR ESCENARIO

| Escenario | Mejor Opción | Tiempo Setup | Costo Servidor |
|---|---|---|---|
| 1 cliente, rápido | A (Script Bash) | 30 min | VPS $5-10/mes |
| 3-5 clientes, control total | A + Fase 2 scripts | 15 min/cliente | VPS $5-10/mes c/u |
| 10+ clientes, uniformidad | B (Docker) | 10 min/cliente | VPS $10-15/mes c/u |
| 20+ clientes, gestión central | C (Ansible) | 5 min/cliente | VPS $5-10/mes c/u |
| Cliente no-técnico | D (PaaS) | 5 min | $10-25/mes |
| Producto white-label | E (CLI propio) | 2 min/cliente | Variable |

---

## 7. CONSIDERACIONES CRÍTICAS POR RESOLVER

### 7.1 Base de Datos — Supabase vs Self-Hosted

**Situación actual:** Cada instancia necesita su propio proyecto Supabase.

| Opción | Pros | Contras |
|---|---|---|
| **Supabase Cloud (actual)** | Cero mantenimiento DB, tier gratis, Storage incluido | Dependencia externa, 500MB limite free, latencia variable |
| **Supabase Self-Hosted** | Control total, sin limites, datos en servidor del cliente | Complejidad enorme (Docker+Postgres+GoTrue+Storage+Kong) |
| **PostgreSQL directo** | Simple, rápido, sin dependencias | Hay que reescribir `database.js` (migrate from Supabase SDK) + resolver Storage |
| **Multi-tenant (1 Supabase, N schemas)** | Más barato, gestión centralizada | Complejidad schema, riesgo de data leaks |

**Recomendación:** Mantener Supabase Cloud por ahora. Cada cliente obtiene su propio proyecto Supabase
(free tier = 500MB DB + 1GB Storage). Documentar proceso de crear proyecto Supabase como parte del setup.

### 7.2 Storage de Imágenes

Las imágenes de productos se almacenan en Supabase Storage. Esto significa:
- Cada instancia de cliente usa su propio bucket
- No hay migración de imágenes entre instancias
- El bandwidth de Supabase free tier es limitado (2GB/mes)
- **Alternativa futura:** Migrar a Cloudflare R2 o S3 (más barato a escala)

### 7.3 Pagos — Stripe/PayPal por Cliente

Cada instancia de cliente necesita sus propias credenciales de:
- Stripe (cuenta propia del cliente)
- PayPal (cuenta propia del cliente)

Esto NO se puede centralizar. El setup wizard debe guiar al cliente para obtener sus API keys.

### 7.4 Email — SMTP por Cliente

Cada instancia necesita su propio servicio de email:
- Gmail App Password (simple pero límites de envío)
- SendGrid / Mailgun (profesional pero tiene costo)
- SMTP propio del cliente

### 7.5 Dominio y SSL

**Estrategia actual:** Cloudflare proxy mode (DNS + SSL automático, sin Certbot).

Opciones:
- **Subdominio tuyo:** `cliente1.tudominio.com` (tú controlas DNS en Cloudflare)
- **Dominio del cliente:** `tienda.cliente.com` (el cliente configura DNS → tu IP)
- **DuckDNS:** Solo para desarrollo / testing

---

## 8. CHECKLIST DE PREREQUISITOS DEL SERVIDOR DEL CLIENTE

Lo que el cliente/empresa debe tener ANTES de la instalación:

### Hardware/Cloud Mínimo
- [ ] VPS/Cloud con Ubuntu 22.04+ (o Debian 12+)
- [ ] Mínimo: 1 CPU, 1GB RAM, 20GB disco
- [ ] Recomendado: 2 CPU, 2GB RAM, 40GB disco
- [ ] Acceso root o sudo
- [ ] IP pública estática (o DuckDNS configurado)
- [ ] Puertos 80 y 443 abiertos

### Servicios Externos (el cliente proporciona)
- [ ] Proyecto Supabase creado (URL + anon key)
- [ ] Schema SQL ejecutado en Supabase
- [ ] Dominio apuntando al servidor (DNS A record)
- [ ] Cuenta de email para envío (Gmail con App Password o SMTP)
- [ ] (Opcional) Cuenta Stripe para pagos con tarjeta
- [ ] (Opcional) Cuenta PayPal para pagos con PayPal

---

## 9. FLUJO IDEAL DE INSTALACIÓN PARA UN CLIENTE NUEVO

```
PASO 1: Preparación (cliente)
  └→ Comprar VPS (DigitalOcean/Hetzner/OVH ~$5/mes)
  └→ Crear proyecto Supabase (gratis)
  └→ Registrar dominio (opcional, puede usar subdominio)

PASO 2: Provisioning (tú o script automático)
  └→ SSH al servidor
  └→ Ejecutar script de instalación
  └→ Wizard pide: dominio, Supabase URL, JWT secret, email SMTP
  └→ Script configura todo automáticamente

PASO 3: Base de Datos (automático)
  └→ Ejecutar schema.sql en Supabase SQL Editor
  └→ Crear bucket de storage "products"
  └→ Configurar RLS policies
  └→ Crear usuario admin inicial

PASO 4: Verificación
  └→ Health check automático
  └→ Probar: homepage, login, admin, crear producto
  └→ Verificar SSL (padlock verde)
  └→ Verificar emails (verificación + reset password)

PASO 5: Entrega
  └→ Entregar credenciales admin al cliente
  └→ Documentación de uso básico
  └→ Configurar canal de actualizaciones
```

---

## 10. PRIORIDAD DE IMPLEMENTACIÓN (actualizada 2026-02-12)

> Reordenada tras auditoría de infraestructura verificada.
> Issues de producción van primero; features nuevas después.

### Completados ✅

| # | Tarea | Estado |
|---|---|---|
| 1 | `.env.example` files (backend 97 líneas + frontend 31 líneas) | ✅ |
| 2 | Health check endpoint (`GET /api/health`) | ✅ |
| 3 | CI/CD pipeline (`ci.yml` lint+build) | ✅ |
| 4 | Rollback automatizado (`rollback.yml`) | ✅ |
| 5 | CORS dinámico (env var + Admin Panel `siteDomain` + localhost) | ✅ |
| 7 | Nginx template parametrizado (`nginx/tienda.conf.template`) | ✅ |

### Pendientes — ordenados por prioridad

| # | Tarea | Esfuerzo | Tipo | Impacto | Estado |
|---|---|---|---|---|---|
| ~~P1~~ | ~~`deploy.yml`: pasar VITE_ env vars al build~~ | 10 min | 🔴 Fix producción | Crítico | ✅ |
| ~~P2~~ | ~~`config.js`: eliminar fallback hardcoded `eonsclover.com`~~ | 15 min | 🔴 Fix producción | Crítico | ✅ |
| ~~P3~~ | ~~Backend `.env`: añadir CORS_ORIGIN, FRONTEND_URL, BASE_URL~~ | 5 min | 🔴 Fix producción | Crítico | ✅ |
| ~~P4~~ | ~~Investigar 175 restarts del backend~~ (reloads legítimos de CI/CD) | 15 min | 🟠 Diagnóstico | Alto | ✅ |
| ~~P5~~ | ~~DEPLOYMENT.md: reescribir completo~~ | 1 hr | 🟡 Documentación | Alto | ✅ |
| ~~P6~~ | ~~Cloudflare SSL: Flexible → Full (Strict)~~ + Origin Cert en Nginx | 30 min | 🟠 Seguridad | Alto | ✅ |
| ~~P7~~ | ~~DuckDNS: desactivar~~ (dominio eliminado) | 5 min | 🟠 Seguridad | Medio | ✅ |
| ~~P8~~ | ~~`deploy.yml` / `rollback.yml`: unificados~~ — deploy.yml usa secrets, rollback.yml inyecta VITE_ vars | 15 min | 🟡 Mantenimiento | Medio | ✅ |
| ~~P9~~ | ~~`database/schema.sql` completo con seed data y admin inicial~~ | 2-3 hrs | 🔴 Feature | Crítico | ✅ |
| ~~P10~~ | ~~`scripts/install.sh` — instalación en Ubuntu limpio~~ | 3-4 hrs | 🟡 Feature | Alto | ✅ |
| ~~P11~~ | ~~`scripts/configure.sh`~~ — absorbido por `install.sh` (P10) | 2-3 hrs | 🟡 Feature | Alto | ✅ |
| **P12** | Docker setup (Dockerfiles + docker-compose) | 4-6 hrs | 🟠 Feature | Medio | ✅ |
| **P13** | CHANGELOG.md + release tags + versionado semántico | 1 hr | 🟠 Feature | Medio | ✅ |
| **P14** | Ansible playbooks (gestión multi-cliente) | 6-8 hrs | 🔵 Feature | Opcional | ❌ |

> **Criterio de orden**: Fixes de producción (P1-P3) > Diagnóstico (P4) > Documentación/Seguridad (P5-P8) > Features nuevas (P9-P14)
