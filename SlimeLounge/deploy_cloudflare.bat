@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title SlimeLounge Cloudflare Deployment
echo This company network may block npm. Recommended deployment:
echo.
echo 1. Put THIS folder contents at the GitHub repository root.
echo 2. Connect the repository in Cloudflare Workers Builds.
echo 3. Deploy command: npx wrangler deploy
echo 4. Add secret EMPLOYEE_HASH_SECRET in Cloudflare before real use.
5. Recommended: add secret OWNER_EMPLOYEE_ID so only your employee ID can initialize Owner.
6. Optional: set NETEASE_SEARCH_BASE to a reachable compatible music search service.
echo.
echo Opening Cloudflare dashboard and GitHub...
start "" "https://dash.cloudflare.com/"
start "" "https://github.com/"
pause
