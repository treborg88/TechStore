# Production Deployment Guide

> Guía de deployment verificada para **mi-tienda-online** (TechStore).
> Datos confirmados desde el servidor de producción — Feb 2026.

---

## Arquitectura en Producción

```
Internet → Cloudflare (DNS + SSL Flexible)
         → Nginx (:80) → Frontend (:5173) + Backend (:5001)
                           ↓
                   PM2 (process manager)
```

| Componente | Puerto | Descripción |
|---|---|---|
| Cloudflare | — | DNS proxy + SSL (Flexible mode) |
| Nginx | 80 | Reverse proxy (HTTP only — Cloudflare maneja HTTPS) |
| Frontend | 5173 | Vite preview server (sirve `dist/` build) |
| Backend | 5001 | Express API server |
| Supabase | — | PostgreSQL + Storage (servicio externo) |

---

## Servidor

| Campo | Valor |
|---|---|
| Proveedor | Oracle Cloud (ARM64) |
| OS | Ubuntu 22.04 LTS |
| IP | `143.47.118.165` |
| Usuario SSH | `ubuntu` |
| App path | `/home/ubuntu/TechStore/` |
| Node.js | v20.x |
| Dominio | `eonsclover.com` |

---

## 1. Prerequisitos

- Ubuntu 22.04+ con acceso SSH
- Node.js 20+ y npm
- Nginx instalado
- PM2 instalado globalmente (`npm install -g pm2`)
- Dominio con DNS apuntando al servidor (Cloudflare recomendado)
- Proyecto Supabase creado (URL + anon key)
- Puerto 80 abierto en firewall

---

## 2. Instalación

### 2.1 Clonar repositorio

```bash
cd /home/ubuntu
git clone git@github.com:treborg88/TechStore.git
cd TechStore
```

### 2.2 Instalar dependencias

```bash
# Root (shared dependencies)
npm ci --ignore-scripts

# Backend
cd backend && npm ci --production && cd ..

# Frontend
cd frontend && npm ci && cd ..
```

### 2.3 Build frontend

```bash
cd frontend && npm run build && cd ..
```

---

## 3. Variables de Entorno

### Backend (`backend/.env`)

```bash
# === OBLIGATORIO ===
JWT_SECRET=your-super-secure-jwt-secret-min-32-chars
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-supabase-anon-key

# === SERVER ===
PORT=5001

# === CORS & URLs ===
CORS_ORIGIN=https://yourdomain.com,https://*.yourdomain.com
FRONTEND_URL=https://yourdomain.com
BASE_URL=https://yourdomain.com

# === EMAIL (para verificación y reset password) ===
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
```

> Ver `backend/.env.example` para la lista completa de variables.
> La mayoría se configura desde el Admin Panel (filosofía admin-panel-first).

### Frontend

No requiere `.env` en producción. El frontend detecta automáticamente:
- **Localhost**: usa `http://localhost:5001/api`
- **Producción**: usa `/api` (relativo — Nginx hace proxy al backend)

Si necesitas override, crea `frontend/.env.production`:
```bash
VITE_API_URL=https://yourdomain.com/api
VITE_BASE_URL=https://yourdomain.com
```

---

## 4. Configurar Nginx

### 4.1 Crear configuración

Usando el template parametrizado:

```bash
sed -e 's/{{DOMAIN}}/eonsclover.com/g' \
    -e 's/{{BACKEND_PORT}}/5001/g' \
    -e 's/{{FRONTEND_PORT}}/5173/g' \
    -e 's|{{APP_PATH}}|/home/ubuntu/TechStore|g' \
    nginx/tienda.conf.template | sudo tee /etc/nginx/sites-available/tienda
```

O crear manualmente:

```nginx
server {
    listen 80;
    server_name eonsclover.com www.eonsclover.com *.eonsclover.com;

    # Frontend React (Vite preview)
    location / {
        proxy_pass http://localhost:5173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:5001/api;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Share pages (OG meta tags para social sharing)
    location /p/ {
        proxy_pass http://localhost:5001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
    }
}
```

### 4.2 Activar sitio

```bash
# Crear symlink
sudo ln -sf /etc/nginx/sites-available/tienda /etc/nginx/sites-enabled/

# Eliminar default
sudo rm -f /etc/nginx/sites-enabled/default

# Verificar y reiniciar
sudo nginx -t && sudo systemctl reload nginx
```

---

## 5. SSL con Cloudflare

El proyecto usa **Cloudflare proxy mode** para SSL. No hay Certbot en el servidor.

### 5.1 Configurar en Cloudflare

1. Añadir dominio a Cloudflare
2. Crear registro **A**: `yourdomain.com` → `IP_DEL_SERVIDOR`
3. Activar **Proxy** (nube naranja)
4. SSL/TLS → modo **Flexible** (Cloudflare maneja HTTPS, Nginx recibe HTTP)

### 5.2 Cómo funciona

```
Usuario → HTTPS → Cloudflare (SSL termination) → HTTP :80 → Nginx → App
```

- Cloudflare emite y renueva certificados automáticamente
- Nginx solo escucha en puerto 80
- No se necesita Certbot ni configurar certs locales

> **Nota**: Para mayor seguridad, considerar migrar a modo **Full** con
> Cloudflare Origin Certificate instalado en Nginx (:443).

---

## 6. PM2 — Process Manager

### 6.1 Iniciar aplicación

```bash
cd /home/ubuntu/TechStore
pm2 start ecosystem.config.cjs
```

### 6.2 Persistir en reboot

```bash
pm2 startup
# Ejecutar el comando que muestre
pm2 save
```

### 6.3 Comandos útiles

```bash
pm2 status              # Ver estado de procesos
pm2 logs                # Ver logs en tiempo real
pm2 logs backend        # Logs solo del backend
pm2 restart all         # Reiniciar todo
pm2 restart backend     # Reiniciar solo backend
pm2 reload all --update-env  # Recargar con nuevas env vars
pm2 monit               # Monitor en tiempo real
```

---

## 7. CI/CD — GitHub Actions

El deploy es automático al hacer push a `main`.

### 7.1 Workflows

| Workflow | Trigger | Qué hace |
|---|---|---|
| `ci.yml` | PR/push a main/develop | Lint + build (validación) |
| `deploy.yml` | Push a main + manual | SSH → git pull → npm ci → build → pm2 reload |
| `rollback.yml` | Manual dispatch | SSH → git reset a SHA específico |

### 7.2 GitHub Secrets requeridos

| Secreto | Valor |
|---|---|
| `SSH_PRIVATE_KEY` | Clave SSH privada para acceder al servidor |
| `SERVER_USER` | `ubuntu` (usado por rollback.yml) |
| `APP_PATH` | `/home/ubuntu/TechStore` (usado por rollback.yml) |
| `VITE_API_URL` | `https://yourdomain.com/api` (inyectado al build) |
| `VITE_BASE_URL` | `https://yourdomain.com` (inyectado al build) |

### 7.3 Deploy manual

En GitHub → Actions → "Deploy to Production" → Run workflow.

### 7.4 Rollback

En GitHub → Actions → "Rollback" → Run workflow → ingresar SHA del commit o dejar vacío para HEAD~1.

---

## 8. Verificación Post-Deploy

```bash
# Health check del backend
curl http://localhost:5001/api/health

# Verificar desde internet
curl -I https://yourdomain.com
curl https://yourdomain.com/api/health

# Estado de PM2
pm2 status

# Estado de Nginx
sudo systemctl status nginx

# Puertos en uso
sudo ss -tlnp | grep -E ':(80|5001|5173)'
```

---

## 9. Troubleshooting

| Problema | Solución |
|---|---|
| 502 Bad Gateway | `pm2 status` — verificar que backend y frontend están `online` |
| CORS errors | Verificar `CORS_ORIGIN` en `backend/.env` o usar Admin Panel → E-commerce → Dominio del Sitio |
| API no responde | `pm2 logs backend --lines 30` — revisar errores |
| Frontend no carga | `pm2 logs frontend --lines 30` — verificar que el build existe (`frontend/dist/`) |
| Cambios no se ven | Asegurar que `pm2 reload all --update-env` se ejecutó después del último pull |
| Emails no llegan | Verificar `EMAIL_USER`/`EMAIL_PASS` en `.env` o Admin Panel → Email |

### Debug commands

```bash
# Ver qué proceso usa qué puerto
sudo ss -tlnp | grep -E ':(80|5001|5173)'

# Test config de Nginx
sudo nginx -t

# Logs de Nginx
sudo tail -f /var/log/nginx/error.log

# Logs de PM2
pm2 logs --lines 50

# Variables de entorno cargadas
pm2 env 5  # (5 = id del backend)
```

---

## 10. Security Checklist

- [x] `JWT_SECRET` fuerte (32+ caracteres)
- [x] HTTPS vía Cloudflare
- [x] CORS dinámico (solo dominios permitidos)
- [x] CSRF protection activa
- [x] Rate limiting en auth endpoints
- [x] Supabase Row Level Security habilitado
- [x] Passwords hasheados con bcrypt (10 salt rounds)
- [x] Sensitive settings encriptados (AES-256-GCM)
- [ ] Firewall (UFW) — configurar si no está activo
- [ ] Cloudflare SSL Full mode (actualmente Flexible)
