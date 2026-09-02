@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title SlimeLounge v0.4.5 Setup
echo ========================================
echo   SlimeLounge v0.4.5 - Setup Check
echo ========================================
echo.
where node >nul 2>&1
if errorlevel 1 goto NO_NODE
node --version
node tools\02_validation\02_run_all_checks.mjs
if errorlevel 1 goto FAILED
echo.
echo [OK] Local mode needs no npm install.
echo [OK] Double-click run_local.bat to start.
goto HOLD
:NO_NODE
echo [ERROR] Node.js was not found.
goto HOLD
:FAILED
echo [ERROR] Setup/check failed. See the error above.
:HOLD
echo.
pause
