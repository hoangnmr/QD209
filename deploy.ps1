# ============================================================
# QD209 - Deploy Script (Windows PowerShell)
# Usage: .\deploy.ps1
# Usage: .\deploy.ps1 -m "commit message here"
# ============================================================
param(
    [string]$m = ""
)

$ErrorActionPreference = "Stop"
$SSH_KEY = "$env:USERPROFILE\.ssh\qd209_deploy"
$SSH_PORT = "24700"
$SSH_USER = "root@103.72.98.102"

function Write-Step($step, $msg) {
    Write-Host "`n[$step] $msg" -ForegroundColor Cyan
    Write-Host ("-" * 50)
}

# --- 1. Build frontend ---
Write-Step "1/5" "Building frontend..."
npm run build
if ($LASTEXITCODE -ne 0) { Write-Host "BUILD FAILED" -ForegroundColor Red; exit 1 }
Write-Host "Build OK" -ForegroundColor Green

# --- 2. Git commit & push ---
Write-Step "2/5" "Committing and pushing to GitHub..."
git add -A

$status = git status --porcelain
if (-not $status) {
    Write-Host "No local changes. Skipping commit and push..." -ForegroundColor Yellow
} else {
    if (-not $m) {
        $m = "deploy: update $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
    }
    git commit -m $m
    if ($LASTEXITCODE -ne 0) { Write-Host "COMMIT FAILED" -ForegroundColor Red; exit 1 }

    git push origin main
    if ($LASTEXITCODE -ne 0) { Write-Host "PUSH FAILED" -ForegroundColor Red; exit 1 }
    Write-Host "Push OK" -ForegroundColor Green
}

# --- 3. Pull code on server ---
Write-Step "3/5" "Pulling latest code on server..."
ssh -i $SSH_KEY -p $SSH_PORT $SSH_USER "cd /var/www/ttport/QD209 && git fetch origin main && git reset --hard origin/main"
if ($LASTEXITCODE -ne 0) { Write-Host "PULL FAILED" -ForegroundColor Red; exit 1 }
Write-Host "Pull OK" -ForegroundColor Green

# --- 4. Upload built frontend ---
Write-Step "4/5" "Uploading frontend build to server..."
scp -i $SSH_KEY -P $SSH_PORT -r "frontend/dist" "${SSH_USER}:/var/www/ttport/QD209/frontend/"
if ($LASTEXITCODE -ne 0) { Write-Host "UPLOAD FAILED" -ForegroundColor Red; exit 1 }
Write-Host "Upload OK" -ForegroundColor Green

# --- 5. Install deps & restart app ---
Write-Step "5/5" "Installing deps and restarting app on server..."
$remoteScript = @'
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
'@
($remoteScript -replace "`r", "") | ssh -i $SSH_KEY -p $SSH_PORT $SSH_USER "bash -s"
if ($LASTEXITCODE -ne 0) { Write-Host "RESTART FAILED" -ForegroundColor Red; exit 1 }

Write-Host "`n==========================================" -ForegroundColor Green
Write-Host "  Deploy complete!" -ForegroundColor Green
Write-Host "  https://ttport.vn/QD209/" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
