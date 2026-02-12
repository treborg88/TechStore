#!/usr/bin/env bash
# =============================================================================
# TechStore — Fresh Server Installation Script
# =============================================================================
# Sets up a clean Ubuntu 22.04+ server for production deployment.
#
# What it does:
#   1. Installs system dependencies (Node.js 20, Nginx, PM2)
#   2. Clones the repository (or uses existing)
#   3. Installs npm dependencies and builds the frontend
#   4. Creates backend/.env from user input
#   5. Configures Nginx reverse proxy (HTTP or HTTPS with Cloudflare Origin Cert)
#   6. Starts PM2 processes and enables startup on reboot
#
# Usage:
#   chmod +x scripts/install.sh
#   ./scripts/install.sh
#
# Requirements:
#   - Ubuntu 22.04+ (ARM64 or x86_64)
#   - Run as non-root user with sudo privileges (e.g., 'ubuntu')
#   - Internet access
#   - Supabase project created (URL + anon key)
#   - Domain pointing to server IP (Cloudflare recommended)
# =============================================================================

set -euo pipefail

# --- Colors for output ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No color

# --- Helper functions ---
info()    { echo -e "${BLUE}ℹ  $*${NC}"; }
success() { echo -e "${GREEN}✅ $*${NC}"; }
warn()    { echo -e "${YELLOW}⚠️  $*${NC}"; }
error()   { echo -e "${RED}❌ $*${NC}"; exit 1; }

ask() {
    # ask "prompt" "default" → sets REPLY
    local prompt="$1" default="${2:-}"
    if [[ -n "$default" ]]; then
        read -rp "$(echo -e "${BLUE}$prompt [${default}]: ${NC}")" REPLY
        REPLY="${REPLY:-$default}"
    else
        read -rp "$(echo -e "${BLUE}$prompt: ${NC}")" REPLY
    fi
}

ask_secret() {
    # ask_secret "prompt" → sets REPLY (no echo)
    read -srp "$(echo -e "${BLUE}$1: ${NC}")" REPLY
    echo
}

# --- Pre-checks ---
if [[ $EUID -eq 0 ]]; then
    error "Do not run as root. Run as your deploy user (e.g., 'ubuntu') with sudo access."
fi

echo ""
echo "=============================================="
echo "  🛍️  TechStore — Server Installation"
echo "=============================================="
echo ""

# =============================================================================
# STEP 1: Gather configuration
# =============================================================================
info "Step 1/7: Configuration"
echo ""

# App path
ask "Installation path" "/home/$USER/TechStore"
APP_PATH="$REPLY"

# Domain
ask "Domain name (e.g., eonsclover.com)" ""
DOMAIN="$REPLY"
[[ -z "$DOMAIN" ]] && error "Domain is required."

# Git repo
ask "Git repo URL" "git@github.com:treborg88/TechStore.git"
REPO_URL="$REPLY"

# Backend port
ask "Backend port" "5001"
BACKEND_PORT="$REPLY"

# Frontend port
ask "Frontend preview port" "5173"
FRONTEND_PORT="$REPLY"

# Supabase credentials
echo ""
info "Supabase credentials (from your Supabase project → Settings → API):"
ask "SUPABASE_URL (https://xxx.supabase.co)" ""
SUPABASE_URL="$REPLY"
[[ -z "$SUPABASE_URL" ]] && error "SUPABASE_URL is required."

ask_secret "SUPABASE_KEY (anon/public key)"
SUPABASE_KEY="$REPLY"
[[ -z "$SUPABASE_KEY" ]] && error "SUPABASE_KEY is required."

# JWT secret
echo ""
info "JWT secret (min 32 chars — leave blank to auto-generate):"
ask_secret "JWT_SECRET"
JWT_SECRET="$REPLY"
if [[ -z "$JWT_SECRET" ]]; then
    JWT_SECRET=$(openssl rand -base64 48)
    success "Auto-generated JWT_SECRET"
fi

# Email config (optional)
echo ""
info "Email settings (optional — for verification emails and password resets):"
ask "EMAIL_USER (Gmail address, blank to skip)" ""
EMAIL_USER="$REPLY"
EMAIL_PASS=""
if [[ -n "$EMAIL_USER" ]]; then
    ask_secret "EMAIL_PASS (Gmail app password)"
    EMAIL_PASS="$REPLY"
fi

# SSL mode
echo ""
info "SSL configuration:"
echo "  1) Cloudflare Flexible (HTTP only on Nginx — simplest)"
echo "  2) Cloudflare Full Strict (HTTPS with Origin Certificate — recommended)"
ask "SSL mode" "2"
SSL_MODE="$REPLY"

success "Configuration collected."
echo ""

# =============================================================================
# STEP 2: Install system dependencies
# =============================================================================
info "Step 2/7: Installing system dependencies..."

# Update packages
sudo apt-get update -qq

# Install essentials
sudo apt-get install -y -qq curl git nginx

# Install Node.js 20 (NodeSource)
if ! command -v node &>/dev/null || [[ "$(node -v)" != v20* ]]; then
    info "Installing Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y -qq nodejs
fi

# Install PM2 globally
if ! command -v pm2 &>/dev/null; then
    info "Installing PM2..."
    sudo npm install -g pm2
fi

success "Dependencies installed: Node $(node -v), npm $(npm -v), PM2 $(pm2 -v), Nginx"

# =============================================================================
# STEP 3: Clone repository
# =============================================================================
info "Step 3/7: Setting up application..."

if [[ -d "$APP_PATH/.git" ]]; then
    warn "Repository already exists at $APP_PATH — pulling latest..."
    cd "$APP_PATH"
    git fetch origin main
    git reset --hard origin/main
else
    info "Cloning repository..."
    git clone "$REPO_URL" "$APP_PATH"
    cd "$APP_PATH"
fi

success "Application code ready at $APP_PATH"

# =============================================================================
# STEP 4: Install npm dependencies and build
# =============================================================================
info "Step 4/7: Installing dependencies and building frontend..."

cd "$APP_PATH"

# Root dependencies
npm ci --ignore-scripts

# Backend dependencies
cd backend && npm ci --production && cd ..

# Frontend dependencies + build
cd frontend && npm ci && npm run build && cd ..

success "Dependencies installed and frontend built."

# =============================================================================
# STEP 5: Create backend/.env
# =============================================================================
info "Step 5/7: Creating backend/.env..."

ENV_FILE="$APP_PATH/backend/.env"

# Backup existing .env if present
if [[ -f "$ENV_FILE" ]]; then
    cp "$ENV_FILE" "${ENV_FILE}.backup.$(date +%Y%m%d%H%M%S)"
    warn "Existing .env backed up."
fi

cat > "$ENV_FILE" << EOF
# === Server ===
PORT=${BACKEND_PORT}

# === Database (Supabase) ===
SUPABASE_URL=${SUPABASE_URL}
SUPABASE_KEY=${SUPABASE_KEY}

# === Authentication ===
JWT_SECRET=${JWT_SECRET}

# === CORS & URLs ===
CORS_ORIGIN=https://${DOMAIN}
FRONTEND_URL=https://${DOMAIN}
BASE_URL=https://${DOMAIN}

# === Email (optional) ===
EMAIL_USER=${EMAIL_USER}
EMAIL_PASS=${EMAIL_PASS}
EOF

chmod 600 "$ENV_FILE"
success "backend/.env created (permissions: 600)."

# =============================================================================
# STEP 6: Configure Nginx
# =============================================================================
info "Step 6/7: Configuring Nginx..."

NGINX_AVAILABLE="/etc/nginx/sites-available/tienda"
NGINX_ENABLED="/etc/nginx/sites-enabled/tienda"

if [[ "$SSL_MODE" == "2" ]]; then
    # --- Cloudflare Full (Strict) with Origin Certificate ---
    SSL_DIR="/etc/ssl/cloudflare"
    CERT_FILE="$SSL_DIR/${DOMAIN}.pem"
    KEY_FILE="$SSL_DIR/${DOMAIN}.key"

    sudo mkdir -p "$SSL_DIR"

    # Check if certs already exist
    if [[ ! -f "$CERT_FILE" || ! -f "$KEY_FILE" ]]; then
        echo ""
        warn "SSL certificates not found. You need to create them:"
        echo ""
        echo "  1. Go to Cloudflare → SSL/TLS → Origin Server → Create Certificate"
        echo "  2. Copy the Origin Certificate to: $CERT_FILE"
        echo "  3. Copy the Private Key to:        $KEY_FILE"
        echo ""
        echo "  Run these commands after pasting the content:"
        echo "    sudo nano $CERT_FILE"
        echo "    sudo nano $KEY_FILE"
        echo "    sudo chmod 600 $KEY_FILE"
        echo ""
        ask "Press Enter when certificates are in place (or 'skip' to use HTTP-only for now)" ""
        if [[ "$REPLY" == "skip" ]]; then
            SSL_MODE="1"
            warn "Falling back to HTTP-only (Cloudflare Flexible)."
        fi
    fi
fi

if [[ "$SSL_MODE" == "2" ]]; then
    # Full Strict: HTTP redirect + HTTPS with Origin Cert
    sudo tee "$NGINX_AVAILABLE" > /dev/null << NGINXEOF
# TechStore — Nginx config (Cloudflare Full Strict)
# Generated by install.sh on $(date -u +"%Y-%m-%d %H:%M UTC")

# HTTP → redirect to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN} www.${DOMAIN};
    return 301 https://\$host\$request_uri;
}

# HTTPS with Cloudflare Origin Certificate
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${DOMAIN} www.${DOMAIN};
    server_tokens off;

    # --- Cloudflare Origin Certificate ---
    ssl_certificate     /etc/ssl/cloudflare/${DOMAIN}.pem;
    ssl_certificate_key /etc/ssl/cloudflare/${DOMAIN}.key;

    # --- SSL Hardening ---
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;
    ssl_session_tickets off;

    # --- Security Headers ---
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # --- Gzip ---
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_types text/plain text/css text/xml text/javascript
               application/javascript application/json application/xml
               image/svg+xml;

    # --- API Backend ---
    location /api/ {
        proxy_pass http://127.0.0.1:${BACKEND_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        client_max_body_size 50M;
    }

    # --- Share Page (OG meta) ---
    location /p/ {
        proxy_pass http://127.0.0.1:${BACKEND_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Forwarded-Host \$host;
    }

    # --- Frontend (Vite preview) ---
    location / {
        proxy_pass http://127.0.0.1:${FRONTEND_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
NGINXEOF
else
    # Flexible: HTTP only (Cloudflare terminates SSL)
    sudo tee "$NGINX_AVAILABLE" > /dev/null << NGINXEOF
# TechStore — Nginx config (Cloudflare Flexible / HTTP only)
# Generated by install.sh on $(date -u +"%Y-%m-%d %H:%M UTC")

server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN} www.${DOMAIN};
    server_tokens off;

    # --- Security Headers ---
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # --- Gzip ---
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_types text/plain text/css text/xml text/javascript
               application/javascript application/json application/xml
               image/svg+xml;

    # --- API Backend ---
    location /api/ {
        proxy_pass http://127.0.0.1:${BACKEND_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        client_max_body_size 50M;
    }

    # --- Share Page (OG meta) ---
    location /p/ {
        proxy_pass http://127.0.0.1:${BACKEND_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Forwarded-Host \$host;
    }

    # --- Frontend (Vite preview) ---
    location / {
        proxy_pass http://127.0.0.1:${FRONTEND_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
NGINXEOF
fi

# Enable site and remove default
sudo ln -sf "$NGINX_AVAILABLE" "$NGINX_ENABLED"
sudo rm -f /etc/nginx/sites-enabled/default

# Test and reload
sudo nginx -t && sudo systemctl reload nginx
success "Nginx configured and reloaded."

# =============================================================================
# STEP 7: Start PM2
# =============================================================================
info "Step 7/7: Starting application with PM2..."

cd "$APP_PATH"

# Stop existing processes if any
pm2 delete all 2>/dev/null || true

# Start from ecosystem config
pm2 start ecosystem.config.cjs

# Save process list and enable startup on reboot
pm2 save
sudo env PATH=$PATH:$(which node) $(which pm2) startup systemd -u "$USER" --hp "$HOME" 2>/dev/null || true

# Wait a moment, then check status
sleep 3
pm2 status

echo ""
echo "=============================================="
echo "  🎉  TechStore Installation Complete!"
echo "=============================================="
echo ""
echo "  📁 App path:    $APP_PATH"
echo "  🌐 Domain:      https://${DOMAIN}"
echo "  🔌 Backend:     http://127.0.0.1:${BACKEND_PORT}"
echo "  🖥️  Frontend:    http://127.0.0.1:${FRONTEND_PORT}"
echo ""

if [[ "$SSL_MODE" == "2" ]]; then
    echo "  🔒 SSL:         Cloudflare Full (Strict)"
    echo "  📜 Cert:        /etc/ssl/cloudflare/${DOMAIN}.pem"
    echo ""
    echo "  ⚠️  Don't forget: set Cloudflare SSL mode to 'Full (Strict)'"
else
    echo "  🔒 SSL:         Cloudflare Flexible (HTTP only on Nginx)"
    echo ""
    echo "  💡 Tip: upgrade to Full (Strict) for end-to-end encryption."
    echo "     See: DEPLOYMENT.md → Section 5"
fi

echo ""
echo "  📝 Next steps:"
echo "     1. Run schema.sql + seed.sql in Supabase SQL Editor"
echo "     2. Visit https://${DOMAIN} and log in as admin"
echo "     3. Configure store settings in Admin Panel"
echo "     4. Set up GitHub Actions secrets for CI/CD (see DEPLOYMENT.md)"
echo ""
echo "  🔧 Useful commands:"
echo "     pm2 logs          — view live logs"
echo "     pm2 status        — check process status"
echo "     pm2 restart all   — restart both services"
echo ""
