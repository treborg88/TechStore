#!/bin/bash
set -e
echo "=== WIPING SERVER ==="

# Stop PM2 processes
echo "Stopping PM2..."
pm2 kill 2>/dev/null || true
pm2 unstartup 2>/dev/null || true

# Remove app directory
echo "Removing app..."
sudo rm -rf /home/ubuntu/TechStore

# Remove PM2
echo "Removing PM2..."
sudo npm uninstall -g pm2 2>/dev/null || true

# Remove Node.js
echo "Removing Node.js..."
sudo apt-get purge -y nodejs 2>/dev/null || true
sudo rm -rf /usr/local/lib/node_modules /usr/local/bin/node /usr/local/bin/npm /usr/local/bin/npx
sudo rm -f /etc/apt/sources.list.d/nodesource.list*
sudo rm -f /usr/share/keyrings/nodesource.gpg

# Remove Nginx
echo "Removing Nginx..."
sudo systemctl stop nginx 2>/dev/null || true
sudo apt-get purge -y nginx nginx-common nginx-core 2>/dev/null || true
sudo rm -rf /etc/nginx

# Remove SSL certs
echo "Removing SSL..."
sudo rm -rf /etc/ssl/cloudflare

# Remove swap
echo "Removing swap..."
sudo swapoff /swapfile 2>/dev/null || true
sudo rm -f /swapfile
sudo sed -i '/swapfile/d' /etc/fstab

# Cleanup
sudo apt-get autoremove -y 2>/dev/null || true

echo ""
echo "=== WIPE COMPLETE ==="
echo "Node: $(node --version 2>/dev/null || echo 'REMOVED')"
echo "PM2: $(pm2 --version 2>/dev/null || echo 'REMOVED')"
echo "Nginx: $(nginx -v 2>&1 || echo 'REMOVED')"
echo "App: $(ls /home/ubuntu/TechStore 2>/dev/null && echo 'EXISTS' || echo 'REMOVED')"
echo "Swap: $(swapon --show | grep -c swapfile || echo '0') swapfiles"
echo "RAM: $(free -h | grep Mem | awk '{print $2}')"
