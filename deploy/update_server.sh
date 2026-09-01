#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
APP_DIR="$(pwd)"

echo "[1/5] Pulling latest code..."
git pull --ff-only

echo "[2/5] Cleaning retired files from overlay upgrades..."
rm -f \
  "$APP_DIR/src/index.js" \
  "$APP_DIR/wrangler.jsonc" \
  "$APP_DIR/deploy_cloudflare.bat" \
  "$APP_DIR/check_repo_root.bat" \
  "$APP_DIR/test_internal_connection.bat" \
  "$APP_DIR/test_ipop_connection.bat" \
  "$APP_DIR/public/styles-v038.css" \
  "$APP_DIR/public/accessory-visual.js" \
  "$APP_DIR/public/ui-v038.js" 2>/dev/null || true

echo "[3/5] Verifying project..."
npm run check

echo "[4/5] Restarting SlimeLounge..."
if systemctl list-unit-files | grep -q '^slimelounge.service'; then
  sudo systemctl restart slimelounge
  sudo systemctl --no-pager --full status slimelounge | sed -n '1,18p'
else
  echo "[WARN] slimelounge.service not installed. Stop the old 'node local_server.js' process and run: node local_server.js"
fi

echo "[5/5] Done."
