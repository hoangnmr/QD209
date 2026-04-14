#!/bin/bash
# ============================================================
# QD209 - Deploy Script (macOS / Linux)
# Usage: ./deploy.sh
# Usage: ./deploy.sh -m "commit message here"
# ============================================================
set -e

SSH_KEY="$HOME/.ssh/qd209_deploy"
SSH_PORT="24700"
SSH_USER="root@103.72.98.102"

# Parse arguments
COMMIT_MSG=""
while getopts "m:" opt; do
  case $opt in
    m) COMMIT_MSG="$OPTARG" ;;
    *) echo "Usage: $0 [-m \"commit message\"]"; exit 1 ;;
  esac
done

write_step() {
  echo ""
  echo "[$1] $2"
  echo "--------------------------------------------------"
}

# --- 0. Auto-increment version (patch: 1.1.001 → 1.1.002) ---
write_step "0" "Incrementing version..."
PKG_PATH="$(cd "$(dirname "$0")" && pwd)/package.json"

if [[ -f "$PKG_PATH" ]]; then
  CURRENT_VER=$(grep -oE '"version"\s*:\s*"[0-9]+\.[0-9]+\.[0-9]+"' "$PKG_PATH" | grep -oE '[0-9]+\.[0-9]+\.[0-9]+')
  if [[ -n "$CURRENT_VER" ]]; then
    MAJOR=$(echo "$CURRENT_VER" | cut -d. -f1)
    MINOR=$(echo "$CURRENT_VER" | cut -d. -f2)
    PATCH=$(echo "$CURRENT_VER" | cut -d. -f3)
    NEW_PATCH=$(printf "%03d" $((10#$PATCH + 1)))
    NEW_VER="$MAJOR.$MINOR.$NEW_PATCH"
    # macOS sed requires '' after -i
    sed -i '' "s/\"version\": \"$CURRENT_VER\"/\"version\": \"$NEW_VER\"/" "$PKG_PATH"
    echo "Version: $NEW_VER"
  else
    echo "WARNING: Could not find version in package.json"
  fi
fi

# --- 1. Build frontend ---
write_step "1/5" "Building frontend..."
npm run build
echo "Build OK"

# --- 2. Git commit & push ---
write_step "2/5" "Committing and pushing to GitHub..."
git add -A

STATUS=$(git status --porcelain)
if [[ -z "$STATUS" ]]; then
  echo "No local changes. Skipping commit and push..."
else
  if [[ -z "$COMMIT_MSG" ]]; then
    COMMIT_MSG="deploy: update $(date '+%Y-%m-%d %H:%M')"
  fi
  git commit -m "$COMMIT_MSG"
  git push origin main
  echo "Push OK"
fi

# --- 3. Pull code on server ---
write_step "3/5" "Pulling latest code on server..."
ssh -i "$SSH_KEY" -p "$SSH_PORT" "$SSH_USER" "cd /var/www/ttport/QD209 && git fetch origin main && git reset --hard origin/main"
echo "Pull OK"

# --- 4. Upload built frontend ---
write_step "4/5" "Uploading frontend build to server..."
scp -i "$SSH_KEY" -P "$SSH_PORT" -r "frontend/dist" "${SSH_USER}:/var/www/ttport/QD209/frontend/"
echo "Upload OK"

# --- 5. Install deps & restart app ---
write_step "5/5" "Installing deps and restarting app on server..."
ssh -i "$SSH_KEY" -p "$SSH_PORT" "$SSH_USER" bash -s <<'REMOTE_SCRIPT'
set -e
cd /var/www/ttport/QD209
npm ci --omit=dev
npm ls tsx 2>/dev/null || npm install tsx

mkdir -p /etc/nginx/snippets
cp deploy/nginx.conf /etc/nginx/snippets/qd209.conf
nginx -t && systemctl reload nginx

export NODE_ENV=production
if pm2 describe qd209 > /dev/null 2>&1; then
  pm2 restart ecosystem.config.cjs --update-env
else
  pm2 start ecosystem.config.cjs
fi
pm2 save
echo "--- PM2 Status ---"
pm2 status qd209
REMOTE_SCRIPT

echo ""
echo "=========================================="
echo "  Deploy complete!"
echo "  https://ttport.vn/QD209/"
echo "=========================================="
