#!/bin/bash
# ============================================================
# QD209 — Deployment Script (runs on production server)
# Called by GitHub Actions or manually: bash deploy.sh
# ============================================================
set -e

APP_DIR="/var/www/ttport/QD209"
PM2_APP_NAME="qd209"
NGINX_TANTHUAN="/etc/nginx/sites-available/tanthuan"
NGINX_SNIPPET="/etc/nginx/snippets/qd209.conf"

echo "=========================================="
echo "  Deploying QD209..."
echo "=========================================="

cd ${APP_DIR}

# 1. Install dependencies (production only)
echo "[1/5] Installing dependencies..."
npm ci --omit=dev
# Also need tsx for running TypeScript in production
npm ls tsx 2>/dev/null || npm install tsx

# 2. Build frontend (skip if dist already exists from CI)
if [ ! -d "frontend/dist" ]; then
    echo "[2/5] Building frontend..."
    export NODE_OPTIONS="--max-old-space-size=1024"
    npx vite build --config frontend/vite.config.ts
else
    echo "[2/5] Frontend already built (from CI). Skipping build."
fi

# 3. Setup Nginx config (idempotent)
echo "[3/5] Updating Nginx config..."
mkdir -p /etc/nginx/snippets
cp deploy/nginx.conf ${NGINX_SNIPPET}

# Add include directive to active tanthuan config if not already present
# Check both sites-available and sites-enabled (some setups use files directly)
for NGINX_CFG in /etc/nginx/sites-enabled/ttport.vn /etc/nginx/sites-available/ttport.vn; do
    if [ -f "${NGINX_CFG}" ] && ! grep -q "qd209.conf" "${NGINX_CFG}" 2>/dev/null; then
        sed -i '/root \/var\/www\/tanthuan-home;/a\    \n    # QD209 LogiPro Application\n    include /etc/nginx/snippets/qd209.conf;' "${NGINX_CFG}"
        echo "Added QD209 include to ${NGINX_CFG}"
    fi
done
nginx -t && systemctl reload nginx

# 4. Restart app with PM2
echo "[4/5] Restarting application..."

if pm2 describe ${PM2_APP_NAME} > /dev/null 2>&1; then
    pm2 restart ecosystem.config.cjs --update-env
else
    pm2 start ecosystem.config.cjs
fi

# 5. Save PM2 process list
echo "[5/5] Saving PM2 state..."
pm2 save

echo ""
echo "=========================================="
echo "  Deployment complete!"
echo "  App running at: https://ttport.vn/QD209/"
echo "  PM2 status:"
pm2 status ${PM2_APP_NAME}
echo "=========================================="
