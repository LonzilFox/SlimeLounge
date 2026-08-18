#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
echo "[1/4] Pulling latest code..."
git pull --ff-only
echo "[2/4] Verifying project..."
npm run check
echo "[3/4] Restarting SlimeLounge..."
if systemctl list-unit-files | grep -q '^slimelounge.service'; then
  sudo systemctl restart slimelounge
  sudo systemctl --no-pager --full status slimelounge | sed -n '1,18p'
else
  echo "[WARN] slimelounge.service not installed. Stop the old 'node local_server.js' process and run: node local_server.js"
fi
echo "[4/4] Done."
